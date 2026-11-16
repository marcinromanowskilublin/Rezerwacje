import {
  AdminSession,
  AnalyticsSummary,
  AvailabilityRule,
  BlockedPeriod,
  Booking,
  BookingStatus,
  BookingsBackupRunResult,
  BookingsBackupStatus,
  BookingsRealignResult,
  ContactIntent,
  PaymentGatewayStatus,
  PaymentStartResult,
  PaymentStatusResult,
  SlotHold,
  SmsSendResult,
  SmsStatus,
  SmsTemplateResponse,
  PhoneConversation,
  PhoneMessage,
  PhoneThread,
  VisitType,
  WhatsAppConversation,
  WhatsAppMessage,
  WhatsAppStatus,
  WhatsAppThread,
} from '../types';
import { BookingApi, CreateBookingInput } from './api';
import { fromMin, hm, rangesOverlap, ruleMatchesVisit, slotStep, toMin } from '../lib/schedule';

const STORE_KEY = 'rezerwacje_store_v2';
const MOCK_ADMIN_KEY = 'rezerwacje_admin_mock_session';

const defaultVisitTypes: VisitType[] = [
  {
    id: 'vt_1',
    name: 'Pierwsza konsultacja',
    description: 'Kompleksowa ocena stanu zdrowia, postawienie diagnozy i zaplanowanie leczenia.',
    duration_minutes: 45,
    price: 275,
    currency: 'PLN',
    payment_policy: 'required',
    active: true,
    kind: 'first',
  },
  {
    id: 'vt_2',
    name: 'Konsultacja kontrolna',
    description: 'Monitorowanie postępów leczenia i ewentualna modyfikacja zaleceń.',
    duration_minutes: 30,
    price: 250,
    currency: 'PLN',
    payment_policy: 'optional',
    active: true,
    kind: 'followup',
  },
];

const defaultRules: AvailabilityRule[] = [
  { id: 'r_1', day_of_week: 1, start_time: '16:00', end_time: '18:45', slot_duration: 45, buffer_minutes: 15, audience: 'followup' },
  { id: 'r_2', day_of_week: 1, start_time: '16:00', end_time: '18:45', slot_duration: 60, buffer_minutes: 15, audience: 'first' },
  { id: 'r_3', day_of_week: 2, start_time: '16:00', end_time: '18:45', slot_duration: 45, buffer_minutes: 15, audience: 'followup' },
  { id: 'r_4', day_of_week: 2, start_time: '16:00', end_time: '18:45', slot_duration: 60, buffer_minutes: 15, audience: 'first' },
  { id: 'r_5', day_of_week: 3, start_time: '16:00', end_time: '18:45', slot_duration: 45, buffer_minutes: 15, audience: 'followup' },
  { id: 'r_6', day_of_week: 3, start_time: '16:00', end_time: '18:45', slot_duration: 60, buffer_minutes: 15, audience: 'first' },
  { id: 'r_7', day_of_week: 4, start_time: '16:00', end_time: '18:45', slot_duration: 45, buffer_minutes: 15, audience: 'followup' },
  { id: 'r_8', day_of_week: 4, start_time: '16:00', end_time: '18:45', slot_duration: 60, buffer_minutes: 15, audience: 'first' },
  { id: 'r_9', day_of_week: 5, start_time: '16:00', end_time: '18:45', slot_duration: 45, buffer_minutes: 15, audience: 'followup' },
  { id: 'r_10', day_of_week: 5, start_time: '16:00', end_time: '18:45', slot_duration: 60, buffer_minutes: 15, audience: 'first' },
];

type Store = {
  visitTypes: VisitType[];
  rules: AvailabilityRule[];
  bookings: Booking[];
  blockedPeriods: BlockedPeriod[];
  holds: SlotHold[];
};

function emptyStore(): Store {
  return {
    visitTypes: defaultVisitTypes.map((v) => ({ ...v })),
    rules: defaultRules.map((r) => ({ ...r })),
    bookings: [],
    blockedPeriods: [],
    holds: [],
  };
}

let memoryStore = emptyStore();
let mockPageViewTotal = 0;
const mockPageViewsByDate: Record<string, number> = {};
let mockBackupState: BookingsBackupStatus = {
  interval_seconds: 21600,
  retention_days: 30,
  last_run_at: null,
  last_file: null,
  last_count: 0,
  last_size_bytes: 0,
  next_due_at: null,
  seconds_until_next: 0,
};

const mockWhatsAppTime = (minutesAgo: number) =>
  new Date(Date.now() - minutesAgo * 60_000).toISOString();

let mockWhatsAppThreads: WhatsAppThread[] = [
  {
    id: 1,
    wa_id: '48500100200',
    phone: '+48500100200',
    display_name: 'Pacjent testowy',
    profile_name: 'Anna',
    patient_name: 'Pacjent testowy',
    is_patient: true,
    contact_confidence: 'known',
    contact_source: 'booking',
    issue_category: 'termin',
    triage_summary: 'Prosi o przełożenie terminu wizyty.',
    requires_attention: true,
    priority: 'high',
    bot_state: 'ready_for_owner',
    bot_paused: false,
    bot_last_auto_reply_at: mockWhatsAppTime(10),
    bot_data: {
      category: 'przełożenie',
      category_label: 'Przełożenie terminu',
      name: 'Pacjent testowy',
      pesel: '90010112345',
      address: 'ul. Testowa 1, 20-001 Lublin',
      details: 'Prosi o przełożenie terminu wizyty na przyszły tydzień.',
      labels: ['Przełożenie terminu', 'termin', 'dane pacjenta'],
    },
    labels: ['Przełożenie terminu', 'termin', 'dane pacjenta'],
    preview: 'Czy mogę przełożyć termin wizyty na przyszły tydzień?',
    last_direction: 'inbound',
    last_message_type: 'text',
    last_message_at: mockWhatsAppTime(8),
    last_inbound_at: mockWhatsAppTime(8),
    unread_count: 1,
    can_reply: true,
    whatsapp_url: 'https://wa.me/48500100200',
  },
  {
    id: 2,
    wa_id: '48500500600',
    phone: '+48500500600',
    display_name: 'Katarzyna',
    profile_name: 'Katarzyna',
    patient_name: null,
    is_patient: false,
    contact_confidence: 'candidate',
    contact_source: 'unknown',
    issue_category: 'recepta',
    triage_summary: 'Pyta o receptę, odpowiedź już wysłana.',
    requires_attention: false,
    priority: 'normal',
    bot_state: 'owner_replied',
    bot_paused: true,
    bot_last_auto_reply_at: null,
    bot_data: null,
    labels: ['recepta/leki'],
    preview: 'Dziękuję, sprawdzę i wrócę z informacją.',
    last_direction: 'outbound',
    last_message_type: 'text',
    last_message_at: mockWhatsAppTime(95),
    last_inbound_at: mockWhatsAppTime(100),
    unread_count: 0,
    can_reply: true,
    whatsapp_url: 'https://wa.me/48500500600',
  },
];

const mockWhatsAppMessages: Record<number, WhatsAppMessage[]> = {
  1: [
    {
      id: 1,
      meta_message_id: 'mock-in-1',
      direction: 'inbound',
      message_type: 'text',
      body: 'Dzień dobry. Czy mogę przełożyć termin wizyty na przyszły tydzień?',
      status: 'received',
      reply_to_meta_id: null,
      sent_at: mockWhatsAppTime(8),
    },
  ],
  2: [
    {
      id: 2,
      meta_message_id: 'mock-in-2',
      direction: 'inbound',
      message_type: 'text',
      body: 'Dzień dobry, mam pytanie dotyczące recepty.',
      status: 'received',
      reply_to_meta_id: null,
      sent_at: mockWhatsAppTime(100),
    },
    {
      id: 3,
      meta_message_id: 'mock-out-2',
      direction: 'outbound',
      message_type: 'text',
      body: 'Dziękuję, sprawdzę i wrócę z informacją.',
      status: 'read',
      reply_to_meta_id: null,
      sent_at: mockWhatsAppTime(95),
    },
  ],
};

const mockPhoneTime = (minutesAgo: number) =>
  new Date(Date.now() - minutesAgo * 60_000).toISOString();

let mockPhoneThreads: PhoneThread[] = [
  {
    id: 1,
    phone: '+48695636680',
    display_name: 'Karolina Majewska (?)',
    contact_confidence: 'candidate',
    contact_source: 'edr',
    last_call_at: mockPhoneTime(28),
    last_message_at: mockPhoneTime(26),
    missed_count: 2,
    last_status: 'missed',
    summary: 'Dwa nieodebrane połączenia, możliwa sprawa o termin.',
    messages_preview: 'Proszę o kontakt w sprawie wizyty.',
    unread_count: 1,
  },
  {
    id: 2,
    phone: '+48500100200',
    display_name: 'Pacjent testowy (P.)',
    contact_confidence: 'known',
    contact_source: 'booking',
    last_call_at: mockPhoneTime(190),
    last_message_at: null,
    missed_count: 1,
    last_status: 'voicemail',
    summary: 'Nieodebrane połączenie z pocztą głosową.',
    messages_preview: 'Poczta głosowa bez transkrypcji.',
    unread_count: 0,
  },
];

const mockPhoneMessages: Record<number, PhoneMessage[]> = {
  1: [
    {
      id: 1,
      direction: 'inbound',
      message_type: 'sms',
      body: 'Proszę o kontakt w sprawie wizyty.',
      sent_at: mockPhoneTime(26),
    },
  ],
  2: [
    {
      id: 2,
      direction: 'inbound',
      message_type: 'voicemail',
      body: 'Poczta głosowa bez dostępnej transkrypcji.',
      sent_at: mockPhoneTime(188),
    },
  ],
};

let mockContactIntents: ContactIntent[] = [
  {
    id: 'intent_1',
    channel: 'whatsapp',
    source_id: '1',
    contact_label: 'Pacjent testowy (P.)',
    phone: '+48500100200',
    title: 'Przełożenie terminu',
    summary: 'Pacjent prosi o przełożenie wizyty na przyszły tydzień.',
    category: 'termin',
    priority: 'high',
    status: 'pending',
    extracted_at: mockWhatsAppTime(8),
  },
  {
    id: 'intent_2',
    channel: 'phone',
    source_id: '1',
    contact_label: 'Karolina Majewska (?)',
    phone: '+48695636680',
    title: 'Oddzwonić',
    summary: 'Nieodebrane połączenia i SMS z prośbą o kontakt.',
    category: 'telefon',
    priority: 'normal',
    status: 'pending',
    extracted_at: mockPhoneTime(26),
  },
];

function localDateKey(date = new Date()): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function load(): Store {
  if (typeof localStorage === 'undefined') return memoryStore;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Store;
    parsed.visitTypes = (parsed.visitTypes || []).map((v) => ({
      ...v,
      kind: v.kind || (v.id === 'vt_2' ? 'followup' : 'first'),
    }));
    parsed.rules = (parsed.rules || []).map((r) => ({
      ...r,
      buffer_minutes: r.buffer_minutes ?? 0,
      audience: r.audience || 'all',
    }));
    const legacyRulePresent = parsed.rules.some(
      (r) => (r.day_of_week === 3 && r.start_time === '09:00') || (r.day_of_week === 1 && r.start_time === '15:00'),
    );
    if (legacyRulePresent) {
      parsed.rules = defaultRules.map((r) => ({ ...r }));
    }
    parsed.bookings = parsed.bookings || [];
    parsed.blockedPeriods = parsed.blockedPeriods || [];
    parsed.holds = parsed.holds || [];
    return parsed;
  } catch {
    return emptyStore();
  }
}

function save(store: Store) {
  memoryStore = store;
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

function token() {
  return Math.random().toString(36).slice(2, 16);
}

function prune(store: Store) {
  const now = Date.now();
  store.holds = store.holds.filter((h) => new Date(h.expires_at).getTime() > now);
}

function visitEnd(store: Store, booking: Booking): number {
  const start = toMin(booking.start_time);
  if (booking.end_time && hm(booking.end_time) !== hm(booking.start_time)) {
    return toMin(booking.end_time);
  }
  const vt = store.visitTypes.find((v) => v.id === booking.visit_type_id);
  return start + (vt?.duration_minutes || 30);
}

function occupied(store: Store, date: string, excludeBookingId?: string, excludeHoldId?: string) {
  const ranges: Array<[number, number]> = [];
  for (const b of store.bookings) {
    if (b.booking_date !== date || b.status === 'cancelled' || b.id === excludeBookingId) continue;
    ranges.push([toMin(b.start_time), visitEnd(store, b)]);
  }
  for (const bp of store.blockedPeriods) {
    if (bp.date !== date) continue;
    ranges.push([toMin(bp.start_time), toMin(bp.end_time)]);
  }
  for (const h of store.holds) {
    if (h.booking_date !== date || h.id === excludeHoldId) continue;
    ranges.push([toMin(h.start_time), toMin(h.end_time)]);
  }
  return ranges;
}

function slotsFor(store: Store, date: string, visitType: VisitType, excludeBookingId?: string) {
  const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
  const matching = store.rules.filter((r) => r.day_of_week === dayOfWeek && ruleMatchesVisit(r.audience, visitType.kind));
  if (!matching.length) return [];

  const busy = occupied(store, date, excludeBookingId);
  const today = new Date().toISOString().slice(0, 10);
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const found = new Set<string>();

  for (const rule of matching) {
    const duration = visitType.duration_minutes;
    const step = slotStep(duration, rule.slot_duration || duration);
    const start = toMin(rule.start_time);
    const end = toMin(rule.end_time);
    for (let cursor = start; cursor + duration <= end; cursor += step) {
      if (date === today && cursor <= nowMin) continue;
      const slotEnd = cursor + duration;
      const taken = busy.some(([a, b]) => rangesOverlap(cursor, slotEnd, a, b));
      if (!taken) found.add(fromMin(cursor));
    }
  }

  return Array.from(found).sort();
}

export const mockBookingApi: BookingApi = {
  async getAdminSession(): Promise<AdminSession> {
    return { authenticated: sessionStorage.getItem(MOCK_ADMIN_KEY) === '1' };
  },

  async adminLogin(login, password): Promise<AdminSession> {
    const expectedPassword = import.meta.env.VITE_ADMIN_PASSWORD || 'admin';
    if (login.trim().toLowerCase() !== 'admin' || password !== expectedPassword) {
      const error = new Error('Unauthorized') as Error & { status?: number };
      error.status = 401;
      throw error;
    }
    sessionStorage.setItem(MOCK_ADMIN_KEY, '1');
    return { authenticated: true, csrf_token: 'mock' };
  },

  async adminLogout() {
    sessionStorage.removeItem(MOCK_ADMIN_KEY);
  },

  async getVisitTypes() {
    return load().visitTypes.filter((v) => v.active);
  },

  async getAvailableDays(visitTypeId, month, year) {
    const store = load();
    const vt = store.visitTypes.find((v) => v.id === visitTypeId && v.active);
    if (!vt) return [];
    const daysInMonth = new Date(year, month, 0).getDate();
    const days: string[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (date < new Date().toISOString().slice(0, 10)) continue;
      if (slotsFor(store, date, vt).length) days.push(date);
    }
    return days;
  },

  async getAvailableSlots(date, visitTypeId, excludeBookingId) {
    const store = load();
    prune(store);
    save(store);
    const vt = store.visitTypes.find((v) => v.id === visitTypeId && v.active);
    if (!vt) return [];
    return slotsFor(store, date, vt, excludeBookingId);
  },

  async recordPageView() {
    const today = localDateKey();
    mockPageViewTotal += 1;
    mockPageViewsByDate[today] = (mockPageViewsByDate[today] || 0) + 1;
  },

  async getAnalytics(): Promise<AnalyticsSummary> {
    const days = [];
    for (let offset = 29; offset >= 0; offset--) {
      const date = new Date();
      date.setDate(date.getDate() - offset);
      const key = localDateKey(date);
      days.push({ date: key, count: mockPageViewsByDate[key] || 0 });
    }
    const today = localDateKey();
    return {
      total: mockPageViewTotal,
      today: mockPageViewsByDate[today] || 0,
      days,
    };
  },

  async createBooking(data: CreateBookingInput) {
    const store = load();
    prune(store);
    const vt = store.visitTypes.find((v) => v.id === data.visit_type_id && v.active);
    if (!vt) throw new Error('Nie znaleziono rodzaju wizyty');

    const date = data.booking_date!;
    const start = hm(data.start_time!);
    const end = fromMin(toMin(start) + vt.duration_minutes);

    if (!slotsFor(store, date, vt).includes(start)) {
      throw new Error('Termin nie jest dostępny.');
    }

    const activeForEmail = store.bookings.filter(
      (b) => b.patient_email === data.patient_email && ['pending', 'confirmed'].includes(b.status),
    );
    if (activeForEmail.length >= 2) {
      throw new Error('Wykorzystano limit aktywnych rezerwacji dla tego adresu email.');
    }

    if (data.hold_id) {
      store.holds = store.holds.filter((h) => h.id !== data.hold_id);
    }

    const booking: Booking = {
      id: `b_${Date.now()}`,
      visit_type_id: vt.id,
      booking_date: date,
      start_time: start,
      end_time: end,
      patient_name: data.patient_name || '',
      patient_email: data.patient_email || '',
      patient_phone: data.patient_phone || '',
      status: vt.payment_policy === 'required' ? 'pending_payment' : 'pending',
      payment_status: data.payment_status || 'unpaid',
      management_token: token(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    store.bookings.push(booking);
    save(store);
    return booking;
  },

  async getBookingByToken(tokenValue) {
    const b = load().bookings.find((item) => item.management_token === tokenValue);
    if (!b) throw new Error('Not found');
    return b;
  },

  async confirmBookingByToken(tokenValue) {
    const store = load();
    const b = store.bookings.find((item) => item.management_token === tokenValue);
    if (!b) throw new Error('Not found');
    if (b.status === 'cancelled') throw new Error('Nie można potwierdzić anulowanej wizyty');
    b.status = 'confirmed';
    b.updated_at = new Date().toISOString();
    save(store);
    return b;
  },

  async cancelBookingByToken(tokenValue) {
    const store = load();
    const b = store.bookings.find((item) => item.management_token === tokenValue);
    if (!b) throw new Error('Not found');
    b.status = 'cancelled';
    b.updated_at = new Date().toISOString();
    save(store);
    return b;
  },

  async getPaymentGatewayStatus(): Promise<PaymentGatewayStatus> {
    return { enabled: true, configured: true, provider: 'payu', environment: 'sandbox' };
  },

  async startPayment(tokenValue): Promise<PaymentStartResult> {
    const store = load();
    const b = store.bookings.find((item) => item.management_token === tokenValue);
    if (!b) return { ok: false, error: 'Nie znaleziono rezerwacji.' };
    b.payment_status = 'pending';
    b.status = b.status === 'cancelled' ? b.status : 'pending_payment';
    b.updated_at = new Date().toISOString();
    save(store);
    return {
      ok: true,
      status: 'pending',
      payment_id: `pay_mock_${Date.now()}`,
      payment_url: `/manage/${encodeURIComponent(tokenValue)}?payment=mock`,
    };
  },

  async getPaymentStatus(tokenValue): Promise<PaymentStatusResult> {
    const b = load().bookings.find((item) => item.management_token === tokenValue);
    if (!b) throw new Error('Not found');
    return { payment_status: b.payment_status, booking_status: b.status };
  },

  async holdSlot({ visit_type_id, booking_date, start_time }) {
    const store = load();
    prune(store);
    const vt = store.visitTypes.find((v) => v.id === visit_type_id && v.active);
    if (!vt) throw new Error('Nie znaleziono rodzaju wizyty');
    const start = hm(start_time);
    const end = fromMin(toMin(start) + vt.duration_minutes);
    if (occupied(store, booking_date).some(([a, b]) => rangesOverlap(toMin(start), toMin(end), a, b))) {
      throw new Error('Termin jest już zajęty.');
    }
    const hold: SlotHold = {
      id: `h_${Date.now()}`,
      visit_type_id,
      booking_date,
      start_time: start,
      end_time: end,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };
    store.holds.push(hold);
    save(store);
    return hold;
  },

  async refreshHold(id) {
    const store = load();
    prune(store);
    const hold = store.holds.find((h) => h.id === id);
    if (!hold) throw new Error('Not found');
    hold.expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    save(store);
    return hold;
  },

  async releaseHold(id) {
    const store = load();
    store.holds = store.holds.filter((h) => h.id !== id);
    save(store);
  },

  async getBookings(date) {
    const list = load().bookings;
    return date ? list.filter((b) => b.booking_date === date) : list;
  },

  async createAdminBooking(data) {
    const store = load();
    const vt = store.visitTypes.find((v) => v.id === data.visit_type_id);
    if (!vt) throw new Error('Nie znaleziono rodzaju wizyty');
    const date = String(data.booking_date || '');
    const start = hm(String(data.start_time || ''));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(start)) {
      throw new Error('Niepełne dane rezerwacji');
    }
    const end = fromMin(toMin(start) + (vt.duration_minutes || 30));
    if (occupied(store, date).some(([a, b]) => rangesOverlap(toMin(start), toMin(end), a, b))) {
      throw new Error('Termin nachodzi na inną wizytę.');
    }
    const booking: Booking = {
      id: `b_${Date.now()}`,
      visit_type_id: vt.id,
      booking_date: date,
      start_time: start,
      end_time: end,
      patient_name: String(data.patient_name || ''),
      patient_email: String(data.patient_email || ''),
      patient_phone: String(data.patient_phone || ''),
      status: (data.status as BookingStatus) || 'confirmed',
      payment_status: 'unpaid',
      management_token: token(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    store.bookings.push(booking);
    save(store);
    return booking;
  },

  async getBookingDetails(id) {
    const b = load().bookings.find((item) => item.id === id);
    if (!b) throw new Error('Not found');
    return b;
  },

  async cancelBooking(id) {
    const store = load();
    const b = store.bookings.find((item) => item.id === id);
    if (!b) throw new Error('Not found');
    b.status = 'cancelled';
    b.updated_at = new Date().toISOString();
    save(store);
    return b;
  },

  async updateBookingStatus(id, status: BookingStatus) {
    const store = load();
    const b = store.bookings.find((item) => item.id === id);
    if (!b) throw new Error('Not found');
    b.status = status;
    b.updated_at = new Date().toISOString();
    save(store);
    return b;
  },

  async rescheduleBooking(id, booking_date, start_time) {
    const store = load();
    prune(store);
    const b = store.bookings.find((item) => item.id === id);
    if (!b) throw new Error('Not found');
    const vt = store.visitTypes.find((v) => v.id === b.visit_type_id);
    if (!vt) throw new Error('Nie znaleziono rodzaju wizyty');
    const start = hm(start_time);
    const end = fromMin(toMin(start) + vt.duration_minutes);
    if (!slotsFor(store, booking_date, vt, b.id).includes(start)) {
      throw new Error('Termin nie jest dostępny.');
    }
    b.booking_date = booking_date;
    b.start_time = start;
    b.end_time = end;
    b.updated_at = new Date().toISOString();
    save(store);
    return b;
  },

  async getActiveHolds(date) {
    const store = load();
    prune(store);
    save(store);
    return date ? store.holds.filter((h) => h.booking_date === date) : store.holds;
  },

  async getAvailabilityRules() {
    return load().rules;
  },

  async createAvailabilityRule(rule) {
    const store = load();
    const created: AvailabilityRule = {
      id: `r_${Date.now()}`,
      day_of_week: rule.day_of_week ?? 1,
      start_time: hm(rule.start_time || '16:00'),
      end_time: hm(rule.end_time || '18:45'),
      slot_duration: rule.slot_duration || 60,
      buffer_minutes: rule.buffer_minutes ?? 0,
      audience: rule.audience || 'all',
    };
    store.rules.push(created);
    save(store);
    return created;
  },

  async updateAvailabilityRule(id, rule) {
    const store = load();
    const found = store.rules.find((r) => r.id === id);
    if (!found) throw new Error('Not found');
    found.day_of_week = rule.day_of_week ?? found.day_of_week;
    found.start_time = hm(rule.start_time || found.start_time);
    found.end_time = hm(rule.end_time || found.end_time);
    found.slot_duration = rule.slot_duration ?? found.slot_duration;
    found.buffer_minutes = rule.buffer_minutes ?? found.buffer_minutes;
    found.audience = rule.audience || found.audience;
    save(store);
    return found;
  },

  async deleteAvailabilityRule(id) {
    const store = load();
    store.rules = store.rules.filter((r) => r.id !== id);
    save(store);
  },

  async listVisitTypes() {
    return load().visitTypes;
  },

  async createVisitType(data) {
    const store = load();
    const created: VisitType = {
      id: `vt_${Date.now()}`,
      name: data.name || 'Nowa wizyta',
      description: data.description || '',
      duration_minutes: data.duration_minutes || 30,
      price: data.price ?? 200,
      currency: 'PLN',
      payment_policy: data.payment_policy || 'none',
      active: data.active ?? true,
      kind: data.kind || 'followup',
    };
    store.visitTypes.push(created);
    save(store);
    return created;
  },

  async updateVisitType(id, data) {
    const store = load();
    const vt = store.visitTypes.find((item) => item.id === id);
    if (!vt) throw new Error('Not found');
    Object.assign(vt, data);
    save(store);
    return vt;
  },

  async getBlockedPeriods() {
    return load().blockedPeriods;
  },

  async blockPeriod(period) {
    const store = load();
    const created: BlockedPeriod = {
      id: `bp_${Date.now()}`,
      date: period.date!,
      start_time: hm(period.start_time || '00:00'),
      end_time: hm(period.end_time || '23:59'),
      reason: period.reason,
    };
    store.blockedPeriods.push(created);
    save(store);
    return created;
  },

  async unblockPeriod(id) {
    const store = load();
    store.blockedPeriods = store.blockedPeriods.filter((bp) => bp.id !== id);
    save(store);
  },

  async getSiteStatus() {
    return { schedule_enabled: true };
  },

  async getBookingsBackupStatus() {
    return mockBackupState;
  },

  async runBookingsBackup(): Promise<BookingsBackupRunResult> {
    const now = new Date();
    const fileName = `bookings_${now.toISOString().replace(/[-:T]/g, '').slice(0, 15)}.json`;
    const bookings = load().bookings;
    const size = new Blob([JSON.stringify(bookings)]).size;

    mockBackupState = {
      interval_seconds: mockBackupState.interval_seconds,
      retention_days: mockBackupState.retention_days,
      last_run_at: now.toISOString(),
      last_file: fileName,
      last_count: bookings.length,
      last_size_bytes: size,
      next_due_at: new Date(now.getTime() + mockBackupState.interval_seconds * 1000).toISOString(),
      seconds_until_next: mockBackupState.interval_seconds,
    };

    return {
      created: true,
      ...mockBackupState,
    };
  },

  async realignBookings(fromDate): Promise<BookingsRealignResult> {
    const store = load();
    const startDate = fromDate && /^\d{4}-\d{2}-\d{2}$/.test(fromDate) ? fromDate : localDateKey();
    const checked = store.bookings.filter((b) => b.status !== 'cancelled' && b.booking_date >= startDate);
    return {
      checked_count: checked.length,
      moved_count: 0,
      moved: [],
    };
  },

  async sendVisitReportTest() {
    return {
      ok: true,
      recipients: {
        'marcin.romanowski.lublin@gmail.com': true,
        'zalef87@gmail.com': true,
      },
      summary: [],
    };
  },

  async getSmsStatus(): Promise<SmsStatus> {
    return { configured: true, callback_configured: true };
  },

  async getSmsTemplates(bookingId): Promise<SmsTemplateResponse> {
    const booking = load().bookings.find((item) => item.id === bookingId);
    if (!booking) throw new Error('Nie znaleziono rezerwacji.');
    const firstName = booking.patient_name.trim().split(/\s+/)[0] || booking.patient_name;
    const digits = booking.patient_phone.replace(/\D+/g, '');
    return {
      to: digits.length === 9 ? `48${digits}` : digits,
      templates: [
        {
          id: 'booking_created',
          label: 'Potwierdzenie rezerwacji',
          message: `Dzień dobry ${firstName}, termin wizyty: ${booking.booking_date} o ${booking.start_time}.`,
        },
        {
          id: 'reminder_day_before',
          label: 'Przypomnienie dzień przed',
          message: `Przypomnienie: jutro o ${booking.start_time} jest wizyta.`,
        },
        {
          id: 'custom',
          label: 'Własna wiadomość',
          message: `Dzień dobry ${firstName}, `,
        },
      ],
    };
  },

  async sendSms(): Promise<SmsSendResult> {
    return { ok: true, message_id: `sms_${Date.now()}`, status: 'QUEUE' };
  },

  async getWhatsAppStatus(): Promise<WhatsAppStatus> {
    return {
      sending_configured: true,
      threads_configured: true,
      retention_days: 30,
    };
  },

  async getWhatsAppThreads(limit = 50): Promise<WhatsAppThread[]> {
    return mockWhatsAppThreads
      .slice()
      .sort((a, b) => b.last_message_at.localeCompare(a.last_message_at))
      .slice(0, limit)
      .map((thread) => ({ ...thread }));
  },

  async getWhatsAppMessages(threadId): Promise<WhatsAppConversation> {
    const thread = mockWhatsAppThreads.find((item) => item.id === threadId);
    if (!thread) throw new Error('Nie znaleziono wątku.');
    return {
      thread: { ...thread },
      messages: (mockWhatsAppMessages[threadId] || []).map((message) => ({ ...message })),
    };
  },

  async markWhatsAppThreadRead(threadId) {
    mockWhatsAppThreads = mockWhatsAppThreads.map((thread) =>
      thread.id === threadId ? { ...thread, unread_count: 0 } : thread,
    );
  },

  async completeWhatsAppBotThread(threadId): Promise<WhatsAppConversation> {
    mockWhatsAppThreads = mockWhatsAppThreads.map((thread) =>
      thread.id === threadId
        ? {
            ...thread,
            bot_state: 'owner_replied',
            bot_paused: true,
            requires_attention: false,
            unread_count: 0,
          }
        : thread,
    );
    return this.getWhatsAppMessages(threadId);
  },

  async replyWhatsAppThread(threadId, body): Promise<WhatsAppConversation> {
    const trimmed = body.trim();
    if (!trimmed) throw new Error('Wpisz treść wiadomości.');
    const thread = mockWhatsAppThreads.find((item) => item.id === threadId);
    if (!thread) throw new Error('Nie znaleziono wątku.');
    if (!thread.can_reply) throw new Error('Minęło 24-godzinne okno odpowiedzi.');

    const sentAt = new Date().toISOString();
    const message: WhatsAppMessage = {
      id: Date.now(),
      meta_message_id: `mock-out-${Date.now()}`,
      direction: 'outbound',
      message_type: 'text',
      body: trimmed,
      status: 'sent',
      reply_to_meta_id: null,
      sent_at: sentAt,
    };
    mockWhatsAppMessages[threadId] = [...(mockWhatsAppMessages[threadId] || []), message];
    mockWhatsAppThreads = mockWhatsAppThreads.map((item) =>
      item.id === threadId
        ? {
            ...item,
            preview: trimmed,
            last_direction: 'outbound',
            last_message_type: 'text',
            last_message_at: sentAt,
            unread_count: 0,
          }
        : item,
    );
    return this.getWhatsAppMessages(threadId);
  },

  async getPhoneThreads(limit = 50): Promise<PhoneThread[]> {
    return mockPhoneThreads
      .slice()
      .sort((a, b) => b.last_call_at.localeCompare(a.last_call_at))
      .slice(0, limit)
      .map((thread) => ({ ...thread }));
  },

  async getPhoneMessages(threadId): Promise<PhoneConversation> {
    const thread = mockPhoneThreads.find((item) => item.id === threadId);
    if (!thread) throw new Error('Nie znaleziono wątku telefonu.');
    return {
      thread: { ...thread },
      messages: (mockPhoneMessages[threadId] || []).map((message) => ({ ...message })),
    };
  },

  async getContactIntents(): Promise<ContactIntent[]> {
    return mockContactIntents
      .slice()
      .sort((a, b) => b.extracted_at.localeCompare(a.extracted_at))
      .map((intent) => ({ ...intent }));
  },

  async createContactIntent(data): Promise<ContactIntent> {
    const now = new Date().toISOString();
    const intent: ContactIntent = {
      id: `intent_${Date.now()}`,
      channel: data.channel || 'manual',
      source_id: data.source_id || null,
      contact_label: String(data.contact_label || 'Ręczna intencja'),
      phone: String(data.phone || ''),
      title: String(data.title || 'Nowa sprawa'),
      summary: String(data.summary || ''),
      category: String(data.category || 'inna'),
      priority: data.priority || 'normal',
      status: data.status || 'pending',
      extracted_at: now,
      updated_at: now,
    };
    mockContactIntents = [intent, ...mockContactIntents];
    return { ...intent };
  },

  async updateContactIntent(id, data): Promise<ContactIntent> {
    let updated: ContactIntent | null = null;
    mockContactIntents = mockContactIntents.map((intent) => {
      if (intent.id !== id) return intent;
      updated = {
        ...intent,
        ...data,
        id: intent.id,
        updated_at: new Date().toISOString(),
      } as ContactIntent;
      return updated;
    });
    if (!updated) throw new Error('Nie znaleziono intencji.');
    return { ...updated };
  },

  async deleteContactIntent(id): Promise<void> {
    mockContactIntents = mockContactIntents.filter((intent) => intent.id !== id);
  },
};
