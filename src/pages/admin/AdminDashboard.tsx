import { FormEvent, useEffect, useMemo, useState } from 'react';
import { addDays, format, parseISO, startOfToday } from 'date-fns';
import { pl } from 'date-fns/locale';
import { bookingApi } from '../../services/bookingApi';
import { AvailabilityRule, BlockedPeriod, Booking, BookingStatus, SlotAudience, VisitType } from '../../types';
import { Button, cn } from '../../components/ui/Button';
import { AUDIENCE_OPTIONS, WEEKDAYS } from '../../lib/schedule';
import AdminGate from './AdminGate';

const statusLabel: Record<string, string> = {
  pending: 'Oczekuje',
  pending_payment: 'Płatność',
  confirmed: 'Potwierdzona',
  cancelled: 'Anulowana',
  completed: 'Zakończona',
  no_show: 'Nieobecność',
};

type ScheduleSlot = {
  start: string;
  end: string;
  audiences: SlotAudience[];
  bookings: Booking[];
  blockedPeriods: BlockedPeriod[];
};

type BookingDraft = {
  visit_type_id: string;
  booking_date: string;
  start_time: string;
  patient_name: string;
  patient_email: string;
  patient_phone: string;
  status: BookingStatus;
};

function onlyDigits(value: string): string {
  return value.replace(/\D+/g, '');
}

function normalizePhone(value: string): string {
  const digits = onlyDigits(value);
  if (!digits) return '';
  if (digits.length === 9) return `48${digits}`;
  return digits;
}

function phoneHref(value: string): string {
  const digits = normalizePhone(value);
  return digits ? `tel:+${digits}` : '#';
}

function smsHref(value: string, patientName: string): string {
  const digits = normalizePhone(value);
  if (!digits) return '#';
  const body = encodeURIComponent(`Dzień dobry, ${patientName}. To wiadomość z gabinetu dotycząca wizyty.`);
  return `sms:+${digits}?body=${body}`;
}

function whatsappHref(value: string, patientName: string): string {
  const digits = normalizePhone(value);
  if (!digits) return '#';
  const body = encodeURIComponent(`Dzień dobry, ${patientName}. To wiadomość z gabinetu dotycząca wizyty.`);
  return `https://wa.me/${digits}?text=${body}`;
}

function toMin(time: string): number {
  const [h, m] = time.slice(0, 5).split(':').map(Number);
  return h * 60 + (m || 0);
}

function hm(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function buildSlots(date: string, rules: AvailabilityRule[], types: VisitType[]): ScheduleSlot[] {
  const day = new Date(`${date}T12:00:00`).getDay();
  const dayRules = rules.filter((r) => r.day_of_week === day);
  const matching = dayRules.filter((r) => r.audience === 'followup' || r.audience === 'all');
  const effectiveRules = matching.length > 0 ? matching : dayRules;
  const followup = types.find((t) => t.kind === 'followup')?.duration_minutes || 30;
  const map = new Map<string, { start: string; endMin: number; audiences: Set<SlotAudience> }>();

  for (const rule of effectiveRules) {
    const audiences: SlotAudience[] = rule.audience === 'first' ? ['first'] : ['followup', 'first'];
    const visitDuration = followup;
    const step = Math.max(5, rule.slot_duration || visitDuration);
    const start = toMin(rule.start_time);
    const end = toMin(rule.end_time);
    for (let cursor = start; cursor + visitDuration <= end; cursor += step) {
      const key = hm(cursor);
      const endMin = cursor + followup;
      const found = map.get(key);
      if (found) {
        found.endMin = Math.max(found.endMin, endMin);
        audiences.forEach((aud) => found.audiences.add(aud));
      } else {
        map.set(key, { start: key, endMin, audiences: new Set(audiences) });
      }
    }
  }

  return Array.from(map.values())
    .map((slot) => ({
      start: slot.start,
      end: hm(slot.endMin),
      audiences: Array.from(slot.audiences),
      bookings: [],
      blockedPeriods: [],
    }))
    .sort((a, b) => a.start.localeCompare(b.start));
}

function AdminBookings() {
  const today = format(startOfToday(), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState(today);
  const [dayBookings, setDayBookings] = useState<Booking[]>([]);
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [types, setTypes] = useState<VisitType[]>([]);
  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [blockedPeriods, setBlockedPeriods] = useState<BlockedPeriod[]>([]);
  const [loadingDay, setLoadingDay] = useState(true);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | BookingStatus>('all');
  const [moving, setMoving] = useState<Booking | null>(null);
  const [moveDays, setMoveDays] = useState<string[]>([]);
  const [moveSlots, setMoveSlots] = useState<string[]>([]);
  const [moveDate, setMoveDate] = useState('');
  const [moveTime, setMoveTime] = useState('');
  const [moveError, setMoveError] = useState<string | null>(null);
  const [realigning, setRealigning] = useState(false);
  const [realignMessage, setRealignMessage] = useState<string | null>(null);
  const [realignError, setRealignError] = useState<string | null>(null);

  const [bookingDraft, setBookingDraft] = useState<BookingDraft>({
    visit_type_id: '',
    booking_date: today,
    start_time: '',
    patient_name: '',
    patient_email: '',
    patient_phone: '',
    status: 'confirmed',
  });
  const [bookingSlots, setBookingSlots] = useState<string[]>([]);
  const [bookingMessage, setBookingMessage] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSaving, setBookingSaving] = useState(false);

  const [slotDay, setSlotDay] = useState(1);
  const [slotStart, setSlotStart] = useState('16:00');
  const [slotEnd, setSlotEnd] = useState('18:45');
  const [slotAudience, setSlotAudience] = useState<SlotAudience>('followup');
  const [slotVisitMinutes, setSlotVisitMinutes] = useState(30);
  const [slotBreakMinutes, setSlotBreakMinutes] = useState(15);
  const [slotMessage, setSlotMessage] = useState<string | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);

  const [firstDuration, setFirstDuration] = useState(45);
  const [followupDuration, setFollowupDuration] = useState(30);
  const [defaultBreakMinutes, setDefaultBreakMinutes] = useState(15);
  const [applyingDefaults, setApplyingDefaults] = useState(false);
  const [defaultsMessage, setDefaultsMessage] = useState<string | null>(null);
  const [defaultsError, setDefaultsError] = useState<string | null>(null);

  const typeName = (id: string) => types.find((t) => t.id === id)?.name || id;

  const refreshMeta = async () => {
    setLoadingMeta(true);
    try {
      const [all, visitTypes, nextRules, nextBlocked] = await Promise.all([
        bookingApi.getBookings(),
        bookingApi.listVisitTypes().catch(() => bookingApi.getVisitTypes()),
        bookingApi.getAvailabilityRules(),
        bookingApi.getBlockedPeriods().catch(() => []),
      ]);
      const sortedAll = all.sort((a, b) => `${a.booking_date}${a.start_time}`.localeCompare(`${b.booking_date}${b.start_time}`));
      setAllBookings(sortedAll);
      setTypes(visitTypes);
      setRules(nextRules.sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time)));
      setBlockedPeriods(Array.isArray(nextBlocked) ? nextBlocked : []);
    } finally {
      setLoadingMeta(false);
    }
  };

  const refreshDay = async (date: string) => {
    setLoadingDay(true);
    try {
      const rows = await bookingApi.getBookings(date);
      setDayBookings(rows.sort((a, b) => a.start_time.localeCompare(b.start_time)));
    } finally {
      setLoadingDay(false);
    }
  };

  useEffect(() => {
    void refreshMeta();
  }, []);

  useEffect(() => {
    void refreshDay(selectedDate);
    setBookingDraft((prev) => ({ ...prev, booking_date: selectedDate, start_time: '' }));
  }, [selectedDate]);

  useEffect(() => {
    const first = types.find((t) => t.kind === 'first');
    const followup = types.find((t) => t.kind === 'followup');
    if (first) setFirstDuration(first.duration_minutes);
    if (followup) {
      setFollowupDuration(followup.duration_minutes);
      if (!bookingDraft.visit_type_id) {
        setBookingDraft((prev) => ({ ...prev, visit_type_id: followup.id }));
      }
    } else if (!bookingDraft.visit_type_id && types[0]) {
      setBookingDraft((prev) => ({ ...prev, visit_type_id: types[0].id }));
    }
  }, [types]);

  useEffect(() => {
    if (!bookingDraft.visit_type_id || !bookingDraft.booking_date) {
      setBookingSlots([]);
      return;
    }
    bookingApi
      .getAvailableSlots(bookingDraft.booking_date, bookingDraft.visit_type_id)
      .then((slots) => setBookingSlots(slots))
      .catch(() => setBookingSlots([]));
  }, [bookingDraft.visit_type_id, bookingDraft.booking_date, dayBookings.length]);

  useEffect(() => {
    if (slotAudience === 'first') {
      setSlotVisitMinutes(firstDuration || 45);
    } else if (slotAudience === 'followup') {
      setSlotVisitMinutes(followupDuration || 30);
    }
  }, [slotAudience, firstDuration, followupDuration]);

  const openMove = async (booking: Booking) => {
    setMoving(booking);
    setMoveError(null);
    setMoveTime('');
    const now = new Date();
    const days = await bookingApi.getAvailableDays(booking.visit_type_id, now.getMonth() + 1, now.getFullYear());
    setMoveDays(days);
    setMoveDate(days[0] || '');
    if (days[0]) {
      const slots = await bookingApi.getAvailableSlots(days[0], booking.visit_type_id, booking.id);
      setMoveSlots(slots);
    } else {
      setMoveSlots([]);
    }
  };

  useEffect(() => {
    if (!moving || !moveDate) return;
    bookingApi.getAvailableSlots(moveDate, moving.visit_type_id, moving.id).then(setMoveSlots);
  }, [moveDate, moving]);

  const submitMove = async () => {
    if (!moving || !moveDate || !moveTime) return;
    try {
      await bookingApi.rescheduleBooking(moving.id, moveDate, moveTime);
      setMoving(null);
      await refreshMeta();
      await refreshDay(selectedDate);
    } catch (err: any) {
      setMoveError(err.message || 'Nie udało się przenieść wizyty.');
    }
  };

  const cancelBooking = async (id: string) => {
    if (!confirm('Anulować wizytę?')) return;
    await bookingApi.cancelBooking(id);
    await refreshMeta();
    await refreshDay(selectedDate);
  };

  const realignToLatest = async () => {
    if (!confirm('Dopasować przyszłe wizyty do aktualnej siatki godzin?')) return;
    setRealigning(true);
    setRealignMessage(null);
    setRealignError(null);
    try {
      const result = await bookingApi.realignBookings(today);
      setRealignMessage(`Sprawdzone: ${result.checked_count}. Przeniesione: ${result.moved_count}.`);
      await refreshMeta();
      await refreshDay(selectedDate);
    } catch {
      setRealignError('Nie udało się dopasować wizyt do nowego grafiku.');
    } finally {
      setRealigning(false);
    }
  };

  const slotDefaultVisitType = (slot: ScheduleSlot): string => {
    const followup = types.find((t) => t.kind === 'followup');
    const first = types.find((t) => t.kind === 'first');
    if (slot.audiences.includes('followup') && followup) return followup.id;
    if (slot.audiences.includes('first') && first) return first.id;
    return followup?.id || first?.id || types[0]?.id || '';
  };

  const scheduleBookingFromSlot = (slot: ScheduleSlot) => {
    const typeId = slotDefaultVisitType(slot);
    setBookingDraft((prev) => ({
      ...prev,
      booking_date: selectedDate,
      visit_type_id: typeId || prev.visit_type_id,
      start_time: slot.start,
    }));
    setBookingMessage(`Uzupełnij dane pacjenta dla godziny ${slot.start}.`);
    setBookingError(null);
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  const blockSlot = async (slot: ScheduleSlot) => {
    if (!confirm(`Zablokować termin ${slot.start}–${slot.end}?`)) return;
    setSlotError(null);
    setSlotMessage(null);
    try {
      await bookingApi.blockPeriod({
        date: selectedDate,
        start_time: slot.start,
        end_time: slot.end,
        reason: 'Blokada z panelu wizyt',
      });
      setSlotMessage(`Termin ${slot.start} został zablokowany.`);
      await refreshMeta();
      await refreshDay(selectedDate);
    } catch {
      setSlotError('Nie udało się zablokować terminu.');
    }
  };

  const unblockSlot = async (blockId: string) => {
    if (!confirm('Odblokować termin?')) return;
    setSlotError(null);
    setSlotMessage(null);
    try {
      await bookingApi.unblockPeriod(blockId);
      setSlotMessage('Termin został odblokowany.');
      await refreshMeta();
      await refreshDay(selectedDate);
    } catch {
      setSlotError('Nie udało się odblokować terminu.');
    }
  };

  const submitBooking = async (e: FormEvent) => {
    e.preventDefault();
    setBookingMessage(null);
    setBookingError(null);
    setBookingSaving(true);
    try {
      await bookingApi.createAdminBooking({
        visit_type_id: bookingDraft.visit_type_id,
        booking_date: bookingDraft.booking_date,
        start_time: bookingDraft.start_time,
        patient_name: bookingDraft.patient_name,
        patient_email: bookingDraft.patient_email,
        patient_phone: bookingDraft.patient_phone,
        status: bookingDraft.status,
      });
      setBookingDraft((prev) => ({
        ...prev,
        start_time: '',
        patient_name: '',
        patient_email: '',
        patient_phone: '',
      }));
      setBookingMessage('Wizyta dodana.');
      await refreshMeta();
      await refreshDay(selectedDate);
    } catch (err: any) {
      setBookingError(err?.message || 'Nie udało się dodać wizyty.');
    } finally {
      setBookingSaving(false);
    }
  };

  const addSlotWindow = async (e: FormEvent) => {
    e.preventDefault();
    setSlotMessage(null);
    setSlotError(null);
    try {
      await bookingApi.createAvailabilityRule({
        day_of_week: slotDay,
        start_time: slotStart,
        end_time: slotEnd,
        audience: slotAudience,
        slot_duration: slotVisitMinutes + slotBreakMinutes,
        buffer_minutes: slotBreakMinutes,
      });
      setSlotMessage('Okno grafiku dodane.');
      await refreshMeta();
      await refreshDay(selectedDate);
    } catch {
      setSlotError('Nie udało się dodać okna grafiku.');
    }
  };

  const removeWindow = async (id: string) => {
    if (!confirm('Usunąć to okno grafiku?')) return;
    await bookingApi.deleteAvailabilityRule(id);
    await refreshMeta();
    await refreshDay(selectedDate);
  };

  const applyDefaults = async () => {
    setApplyingDefaults(true);
    setDefaultsMessage(null);
    setDefaultsError(null);
    try {
      for (const type of types) {
        const targetDuration = type.kind === 'first' ? firstDuration : followupDuration;
        if (type.duration_minutes !== targetDuration) {
          await bookingApi.updateVisitType(type.id, { ...type, duration_minutes: targetDuration });
        }
      }
      for (const rule of rules) {
        const targetVisit = rule.audience === 'first' ? firstDuration : followupDuration;
        const targetStep = targetVisit + defaultBreakMinutes;
        await bookingApi.updateAvailabilityRule(rule.id, {
          day_of_week: rule.day_of_week,
          start_time: rule.start_time,
          end_time: rule.end_time,
          audience: rule.audience,
          slot_duration: targetStep,
          buffer_minutes: defaultBreakMinutes,
        });
      }
      setDefaultsMessage('Domyślne długości i przerwa zostały zastosowane.');
      await refreshMeta();
      await refreshDay(selectedDate);
    } catch {
      setDefaultsError('Nie udało się zapisać domyślnych parametrów.');
    } finally {
      setApplyingDefaults(false);
    }
  };

  const dayLabel = useMemo(() => format(parseISO(selectedDate), 'EEEE, d MMMM yyyy', { locale: pl }), [selectedDate]);

  const daySlots = useMemo(() => {
    const slots = buildSlots(selectedDate, rules, types);
    if (slots.length === 0) return [];
    const dayBlocks = blockedPeriods.filter((period) => period.date === selectedDate);
    return slots.map((slot) => {
      const slotStart = toMin(slot.start);
      const slotEnd = toMin(slot.end);
      const booked = dayBookings.filter((booking) => booking.status !== 'cancelled' && booking.start_time.slice(0, 5) === slot.start);
      const blocked = dayBlocks.filter((period) =>
        rangesOverlap(slotStart, slotEnd, toMin(period.start_time), toMin(period.end_time)),
      );
      return { ...slot, bookings: booked, blockedPeriods: blocked };
    });
  }, [selectedDate, rules, dayBookings, types, blockedPeriods]);

  const nextDays = useMemo(() => {
    const grouped = new Map<string, Booking[]>();
    for (const booking of allBookings) {
      if (booking.status === 'cancelled' || booking.booking_date < today) continue;
      const current = grouped.get(booking.booking_date) || [];
      current.push(booking);
      grouped.set(booking.booking_date, current);
    }

    let dates = Array.from(grouped.keys()).sort();
    if (!dates.includes(selectedDate)) {
      dates = [selectedDate, ...dates.filter((d) => d !== selectedDate)];
    }
    if (dates.length === 0) {
      dates = Array.from({ length: 7 }).map((_, idx) => format(addDays(startOfToday(), idx), 'yyyy-MM-dd'));
    }
    return dates.slice(0, 12).map((date) => {
      const rows = (grouped.get(date) || []).sort((a, b) => a.start_time.localeCompare(b.start_time));
      return {
        date,
        count: rows.length,
        first: rows[0]?.start_time || '',
        last: rows[rows.length - 1]?.start_time || '',
      };
    });
  }, [allBookings, selectedDate, today]);

  const bookingMatchesFilters = (booking: Booking): boolean => {
    const query = searchTerm.trim().toLowerCase();
    if (statusFilter !== 'all' && booking.status !== statusFilter) return false;
    if (!query) return true;
    return [booking.patient_name, booking.patient_phone, booking.patient_email]
      .join(' ')
      .toLowerCase()
      .includes(query);
  };

  const rulesForSelectedDay = useMemo(() => {
    const day = new Date(`${selectedDate}T12:00:00`).getDay();
    return rules.filter((rule) => rule.day_of_week === day);
  }, [rules, selectedDate]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-light text-neutral-900">Panel grafiku</h1>
          <p className="text-sm text-neutral-500 capitalize">{dayLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-10 text-xs" onClick={() => setSelectedDate(format(addDays(parseISO(selectedDate), -1), 'yyyy-MM-dd'))}>
            Poprzedni dzień
          </Button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="h-10 px-3 rounded-xl border border-neutral-200 text-sm"
          />
          <Button variant="outline" className="h-10 text-xs" onClick={() => setSelectedDate(format(addDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'))}>
            Następny dzień
          </Button>
          <Button
            variant="outline"
            className="h-10 text-xs border-[#007865] text-[#007865] hover:bg-[#e7f4f1]"
            onClick={realignToLatest}
            disabled={realigning}
          >
            {realigning ? 'Dopasowywanie...' : 'Dopasuj pacjentów do nowego grafiku'}
          </Button>
        </div>
      </div>

      {realignMessage && <p className="text-xs text-emerald-700">{realignMessage}</p>}
      {realignError && <p className="text-xs text-red-600">{realignError}</p>}

      <section className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
          <div className="border-b border-neutral-200 px-5 py-4 space-y-3">
            <div>
              <h2 className="text-lg font-medium text-neutral-900">Wizyty dnia</h2>
              <p className="text-xs text-neutral-500">Dla wizyt umówionych: przesuń albo odwołaj. Dla wolnych slotów: umów wizytę albo zablokuj termin.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Wyszukaj pacjenta / telefon / e-mail"
                className="h-10 w-72 max-w-full rounded-xl border border-neutral-200 px-3 text-sm"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | BookingStatus)}
                className="h-10 rounded-xl border border-neutral-200 px-3 text-sm"
              >
                <option value="all">Wszystkie statusy</option>
                <option value="pending">Oczekuje</option>
                <option value="confirmed">Potwierdzona</option>
                <option value="completed">Zakończona</option>
                <option value="no_show">Nieobecność</option>
                <option value="cancelled">Anulowana</option>
              </select>
            </div>
          </div>
          {(loadingDay || loadingMeta) ? (
            <p className="p-5 text-sm text-neutral-500">Wczytywanie grafiku...</p>
          ) : daySlots.length === 0 ? (
            <p className="p-5 text-sm text-neutral-500">Brak zdefiniowanych slotów w tym dniu.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full text-sm">
                <thead className="bg-[#203149] text-white">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Godzina</th>
                    <th className="text-left px-3 py-2 font-medium">Pacjent</th>
                    <th className="text-left px-3 py-2 font-medium">Wizyta</th>
                    <th className="text-left px-3 py-2 font-medium">Kontakt</th>
                    <th className="text-left px-3 py-2 font-medium">Akcje</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {daySlots.flatMap((slot) => {
                    const bookedRows = slot.bookings.filter((booking) => bookingMatchesFilters(booking));
                    if (bookedRows.length > 0) {
                      return bookedRows.map((booking, index) => (
                        <tr key={`${slot.start}-${booking.id}`} className="align-top">
                          <td className="px-3 py-3 font-medium text-neutral-900 whitespace-nowrap">
                            {index === 0 ? `${slot.start}–${slot.end}` : ''}
                          </td>
                          <td className="px-3 py-3 text-neutral-900">
                            <p className="font-medium">{booking.patient_name}</p>
                            <p className="text-xs text-neutral-500">{booking.patient_phone || '—'} · {booking.patient_email || '—'}</p>
                          </td>
                          <td className="px-3 py-3 text-neutral-700">
                            <p>{typeName(booking.visit_type_id)}</p>
                            <p className="text-xs text-neutral-500">{statusLabel[booking.status] || booking.status}</p>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-1.5">
                              {booking.patient_phone && (
                                <>
                                  <a className="rounded-md border border-neutral-200 px-2 py-1 text-xs hover:bg-neutral-50" href={smsHref(booking.patient_phone, booking.patient_name)}>SMS</a>
                                  <a className="rounded-md border border-neutral-200 px-2 py-1 text-xs hover:bg-neutral-50" href={whatsappHref(booking.patient_phone, booking.patient_name)} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                                  <a className="rounded-md border border-neutral-200 px-2 py-1 text-xs hover:bg-neutral-50" href={phoneHref(booking.patient_phone)}>Telefon</a>
                                </>
                              )}
                              {booking.patient_email && (
                                <a className="rounded-md border border-neutral-200 px-2 py-1 text-xs hover:bg-neutral-50" href={`mailto:${booking.patient_email}`}>E-mail</a>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-1.5">
                              <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => openMove(booking)}>
                                Przesuń
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[11px] text-red-600 hover:bg-red-50"
                                onClick={() => void cancelBooking(booking.id)}
                              >
                                Odwołaj
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ));
                    }

                    if (slot.bookings.length > 0) {
                      return [];
                    }

                    if (slot.blockedPeriods.length > 0) {
                      const block = slot.blockedPeriods[0];
                      return [
                        <tr key={`${slot.start}-blocked`} className="bg-neutral-50 align-top">
                          <td className="px-3 py-3 font-medium text-neutral-900 whitespace-nowrap">{slot.start}–{slot.end}</td>
                          <td className="px-3 py-3 text-neutral-500">—</td>
                          <td className="px-3 py-3 text-[#8a3d2f] font-medium">zablokowany termin</td>
                          <td className="px-3 py-3 text-neutral-500">—</td>
                          <td className="px-3 py-3">
                            <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => void unblockSlot(block.id)}>
                              Odblokuj
                            </Button>
                          </td>
                        </tr>,
                      ];
                    }

                    return [
                      <tr key={`${slot.start}-free`} className="bg-[#f3faf7] align-top">
                        <td className="px-3 py-3 font-medium text-neutral-900 whitespace-nowrap">{slot.start}–{slot.end}</td>
                        <td className="px-3 py-3 text-neutral-500">—</td>
                        <td className="px-3 py-3 text-[#007865] font-medium">wolny slot</td>
                        <td className="px-3 py-3 text-neutral-500">—</td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => scheduleBookingFromSlot(slot)}>
                              Umów wizytę
                            </Button>
                            <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => void blockSlot(slot)}>
                              Zablokuj termin
                            </Button>
                          </div>
                        </td>
                      </tr>,
                    ];
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="text-lg font-medium text-neutral-900">Kolejne dni</h2>
          <p className="text-xs text-neutral-500 mt-1">Kliknij dzień, aby przełączyć grafik i listę wizyt.</p>
          <div className="mt-4 space-y-2">
            {nextDays.map((day) => (
              <button
                key={day.date}
                type="button"
                onClick={() => setSelectedDate(day.date)}
                className={cn(
                  'w-full rounded-xl border px-3 py-2 text-left transition-colors',
                  day.date === selectedDate
                    ? 'border-[#007865] bg-[#e7f4f1]'
                    : 'border-neutral-200 bg-white hover:bg-neutral-50',
                )}
              >
                <p className="text-sm font-medium text-neutral-900">{day.date}</p>
                <p className="text-xs text-neutral-500">
                  Wizyty: {day.count}
                  {day.first ? ` · ${day.first}${day.last ? `–${day.last}` : ''}` : ''}
                </p>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <form onSubmit={submitBooking} className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-3">
          <h3 className="text-base font-medium text-neutral-900">Dodaj wizytę ręcznie</h3>
          <p className="text-xs text-neutral-500">Szybkie dodanie pacjenta do bieżącego grafiku.</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs text-neutral-500">
              Rodzaj wizyty
              <select
                value={bookingDraft.visit_type_id}
                onChange={(e) => setBookingDraft((prev) => ({ ...prev, visit_type_id: e.target.value, start_time: '' }))}
                className="h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm text-neutral-900"
              >
                {types.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-neutral-500">
              Dzień
              <input
                type="date"
                value={bookingDraft.booking_date}
                onChange={(e) => setBookingDraft((prev) => ({ ...prev, booking_date: e.target.value, start_time: '' }))}
                className="h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm text-neutral-900"
              />
            </label>
            <label className="space-y-1 text-xs text-neutral-500">
              Godzina
              <select
                value={bookingDraft.start_time}
                onChange={(e) => setBookingDraft((prev) => ({ ...prev, start_time: e.target.value }))}
                className="h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm text-neutral-900"
              >
                <option value="">Wybierz</option>
                {bookingSlots.map((slot) => (
                  <option key={slot} value={slot}>{slot}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-neutral-500">
              Status
              <select
                value={bookingDraft.status}
                onChange={(e) => setBookingDraft((prev) => ({ ...prev, status: e.target.value as BookingStatus }))}
                className="h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm text-neutral-900"
              >
                <option value="confirmed">Potwierdzona</option>
                <option value="pending">Oczekuje</option>
                <option value="pending_payment">Płatność</option>
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <input
              placeholder="Imię i nazwisko"
              value={bookingDraft.patient_name}
              onChange={(e) => setBookingDraft((prev) => ({ ...prev, patient_name: e.target.value }))}
              className="h-10 rounded-xl border border-neutral-200 px-3 text-sm text-neutral-900"
              required
            />
            <input
              type="email"
              placeholder="E-mail"
              value={bookingDraft.patient_email}
              onChange={(e) => setBookingDraft((prev) => ({ ...prev, patient_email: e.target.value }))}
              className="h-10 rounded-xl border border-neutral-200 px-3 text-sm text-neutral-900"
              required
            />
          </div>
          <input
            placeholder="Telefon"
            value={bookingDraft.patient_phone}
            onChange={(e) => setBookingDraft((prev) => ({ ...prev, patient_phone: e.target.value }))}
            className="h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm text-neutral-900"
            required
          />

          <Button type="submit" className="h-10 text-xs" disabled={bookingSaving}>
            {bookingSaving ? 'Dodawanie...' : 'Dodaj wizytę'}
          </Button>
          {bookingMessage && <p className="text-xs text-emerald-700">{bookingMessage}</p>}
          {bookingError && <p className="text-xs text-red-600">{bookingError}</p>}
        </form>

        <form onSubmit={addSlotWindow} className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-3">
          <h3 className="text-base font-medium text-neutral-900">Miejsca w grafiku</h3>
          <p className="text-xs text-neutral-500">Dodawanie i usuwanie slotów, z domyślną przerwą 15 min.</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs text-neutral-500">
              Dzień tygodnia
              <select value={slotDay} onChange={(e) => setSlotDay(Number(e.target.value))} className="h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm text-neutral-900">
                {WEEKDAYS.map((day) => (
                  <option key={day.id} value={day.id}>{day.label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-neutral-500">
              Dla kogo
              <select value={slotAudience} onChange={(e) => setSlotAudience(e.target.value as SlotAudience)} className="h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm text-neutral-900">
                {AUDIENCE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-neutral-500">
              Od
              <input type="time" value={slotStart} onChange={(e) => setSlotStart(e.target.value)} className="h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm text-neutral-900" />
            </label>
            <label className="space-y-1 text-xs text-neutral-500">
              Do
              <input type="time" value={slotEnd} onChange={(e) => setSlotEnd(e.target.value)} className="h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm text-neutral-900" />
            </label>
            <label className="space-y-1 text-xs text-neutral-500">
              Długość wizyty (min)
              <input type="number" min={5} step={5} value={slotVisitMinutes} onChange={(e) => setSlotVisitMinutes(Number(e.target.value))} className="h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm text-neutral-900" />
            </label>
            <label className="space-y-1 text-xs text-neutral-500">
              Przerwa (min)
              <input type="number" min={0} step={5} value={slotBreakMinutes} onChange={(e) => setSlotBreakMinutes(Number(e.target.value))} className="h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm text-neutral-900" />
            </label>
          </div>

          <Button type="submit" className="h-10 text-xs">Dodaj okno grafiku</Button>
          {slotMessage && <p className="text-xs text-emerald-700">{slotMessage}</p>}
          {slotError && <p className="text-xs text-red-600">{slotError}</p>}

          <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-3 space-y-2">
            <p className="text-xs font-medium text-neutral-700">Okna dla wybranego dnia</p>
            {rulesForSelectedDay.length === 0 ? (
              <p className="text-xs text-neutral-500">Brak okien dla tego dnia.</p>
            ) : rulesForSelectedDay.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-xs">
                <span>
                  {rule.start_time}–{rule.end_time} · {AUDIENCE_OPTIONS.find((a) => a.id === rule.audience)?.label || rule.audience}
                  {' '}· wizyta {Math.max(5, rule.slot_duration - (rule.buffer_minutes || 0))} min + przerwa {rule.buffer_minutes || 0} min
                </span>
                <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => void removeWindow(rule.id)}>
                  Usuń
                </Button>
              </div>
            ))}
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-3">
        <h3 className="text-base font-medium text-neutral-900">Domyślne czasy wizyt</h3>
        <p className="text-xs text-neutral-500">
          Domyślnie: kontrolna 30 min, pierwszorazowa 45 min, przerwa 15 min. Zastosowanie aktualizuje rodzaje wizyt i kroki slotów.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-xs text-neutral-500">
            Kontrolna (min)
            <input type="number" min={5} step={5} value={followupDuration} onChange={(e) => setFollowupDuration(Number(e.target.value))} className="h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm text-neutral-900" />
          </label>
          <label className="space-y-1 text-xs text-neutral-500">
            Pierwszorazowa (min)
            <input type="number" min={5} step={5} value={firstDuration} onChange={(e) => setFirstDuration(Number(e.target.value))} className="h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm text-neutral-900" />
          </label>
          <label className="space-y-1 text-xs text-neutral-500">
            Przerwa (min)
            <input type="number" min={0} step={5} value={defaultBreakMinutes} onChange={(e) => setDefaultBreakMinutes(Number(e.target.value))} className="h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm text-neutral-900" />
          </label>
        </div>
        <Button className="h-10 text-xs" onClick={applyDefaults} disabled={applyingDefaults}>
          {applyingDefaults ? 'Zapisywanie...' : 'Zastosuj domyślne wartości'}
        </Button>
        {defaultsMessage && <p className="text-xs text-emerald-700">{defaultsMessage}</p>}
        {defaultsError && <p className="text-xs text-red-600">{defaultsError}</p>}
      </section>

      {moving && (
        <div className="fixed inset-0 bg-black/40 z-20 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-medium">Przenieś wizytę</h3>
            <p className="text-sm text-neutral-500">{moving.patient_name} — {typeName(moving.visit_type_id)}</p>
            <label className="block text-xs uppercase tracking-widest text-neutral-500">Nowy dzień</label>
            <select
              value={moveDate}
              onChange={(e) => setMoveDate(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-neutral-200"
            >
              {moveDays.map((date) => (
                <option key={date} value={date}>{date}</option>
              ))}
            </select>
            <label className="block text-xs uppercase tracking-widest text-neutral-500">Godzina</label>
            <div className="grid grid-cols-4 gap-2">
              {moveSlots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setMoveTime(slot)}
                  className={cn(
                    'h-10 rounded-xl border text-xs',
                    moveTime === slot ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200',
                  )}
                >
                  {slot}
                </button>
              ))}
            </div>
            {moveSlots.length === 0 && <p className="text-xs text-neutral-500">Brak wolnych godzin w tym dniu.</p>}
            {moveError && <p className="text-xs text-red-600">{moveError}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" className="h-10 text-xs" onClick={() => setMoving(null)}>Anuluj</Button>
              <Button className="h-10 text-xs" disabled={!moveTime} onClick={submitMove}>Zapisz nowy termin</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <AdminGate>
      <AdminBookings />
    </AdminGate>
  );
}
