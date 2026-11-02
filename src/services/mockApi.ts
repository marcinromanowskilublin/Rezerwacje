import {
  AnalyticsSummary,
  AvailabilityRule,
  BlockedPeriod,
  Booking,
  BookingStatus,
  BookingsBackupRunResult,
  BookingsBackupStatus,
  BookingsRealignResult,
  SlotHold,
  VisitType,
} from '../types';
import { BookingApi, CreateBookingInput } from './api';
import { fromMin, hm, rangesOverlap, ruleMatchesVisit, slotStep, toMin } from '../lib/schedule';

const STORE_KEY = 'rezerwacje_store_v2';

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
      status: 'pending',
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
};
