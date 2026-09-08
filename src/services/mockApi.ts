import { AvailabilityRule, BlockedPeriod, Booking, BookingStatus, VisitType } from '../types';
import { BookingApi } from './api';

const visitTypes: VisitType[] = [
  {
    id: 'vt_1',
    name: 'Pierwsza konsultacja',
    description: 'Kompleksowa ocena stanu zdrowia, postawienie diagnozy i zaplanowanie leczenia.',
    duration_minutes: 60,
    price: 300,
    currency: 'PLN',
    payment_policy: 'required',
    active: true,
  },
  {
    id: 'vt_2',
    name: 'Konsultacja kontrolna',
    description: 'Monitorowanie postępów leczenia i ewentualna modyfikacja zaleceń.',
    duration_minutes: 30,
    price: 200,
    currency: 'PLN',
    payment_policy: 'optional',
    active: true,
  }
];

let bookings: Booking[] = [];
let rules: AvailabilityRule[] = [
  { id: 'r_1', day_of_week: 1, start_time: '15:00', end_time: '20:00', slot_duration: 30 },
  { id: 'r_2', day_of_week: 3, start_time: '09:00', end_time: '14:00', slot_duration: 30 },
];
let blockedPeriods: BlockedPeriod[] = [];

// Helper to generate a random token
const generateToken = () => Math.random().toString(36).substring(2, 15);

// Helper to check if a slot is blocked
const isSlotBlocked = (date: string, time: string, duration: number) => {
  // Simple check for overlap with blocked periods
  return blockedPeriods.some(bp => {
    if (bp.date !== date) return false;
    // Basic string comparison works for HH:mm format if within same day
    return (time >= bp.start_time && time < bp.end_time); 
  });
};

const isSlotBooked = (date: string, time: string) => {
  return bookings.some(b => b.booking_date === date && b.start_time === time && b.status !== 'cancelled');
}

export const mockBookingApi: BookingApi = {
  async getVisitTypes() {
    return visitTypes.filter(vt => vt.active);
  },

  async getAvailableDays(visitTypeId: string, month: number, year: number) {
    const vt = visitTypes.find(v => v.id === visitTypeId);
    if (!vt) return [];

    const availableDays: string[] = [];
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      if (date < new Date(new Date().setHours(0,0,0,0))) continue; // skip past days

      const dayOfWeek = date.getDay();
      const rule = rules.find(r => r.day_of_week === dayOfWeek);
      if (rule) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        availableDays.push(dateStr);
      }
    }
    return availableDays;
  },

  async getAvailableSlots(date: string, visitTypeId: string) {
    const vt = visitTypes.find(v => v.id === visitTypeId);
    if (!vt) return [];

    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay();
    const rule = rules.find(r => r.day_of_week === dayOfWeek);
    
    if (!rule) return [];

    const slots: string[] = [];
    let current = new Date(`1970-01-01T${rule.start_time}:00Z`);
    const end = new Date(`1970-01-01T${rule.end_time}:00Z`);

    while (current < end) {
      const timeStr = current.toISOString().substring(11, 16);
      
      if (!isSlotBlocked(date, timeStr, vt.duration_minutes) && !isSlotBooked(date, timeStr)) {
        slots.push(timeStr);
      }
      
      current = new Date(current.getTime() + rule.slot_duration * 60000);
    }

    return slots;
  },

  async createBooking(data: Partial<Booking>) {
    const vt = visitTypes.find(v => v.id === data.visit_type_id);
    if (!vt) throw new Error("Visit type not found");

    // limit active bookings per email to 2
    const activeBookingsForEmail = bookings.filter(
      b => b.patient_email === data.patient_email && ['pending', 'confirmed'].includes(b.status)
    );
    if (activeBookingsForEmail.length >= 2) {
      throw new Error("Wykorzystano limit aktywnych rezerwacji dla tego adresu email.");
    }
    
    // limit active bookings per phone to 2
    const activeBookingsForPhone = bookings.filter(
      b => b.patient_phone === data.patient_phone && ['pending', 'confirmed'].includes(b.status)
    );
    if (activeBookingsForPhone.length >= 2) {
      throw new Error("Wykorzystano limit aktywnych rezerwacji dla tego numeru telefonu.");
    }

    const newBooking: Booking = {
      id: `b_${Date.now()}`,
      visit_type_id: data.visit_type_id!,
      booking_date: data.booking_date!,
      start_time: data.start_time!,
      end_time: data.end_time || data.start_time!, // simplifed end_time
      patient_name: data.patient_name || '',
      patient_email: data.patient_email || '',
      patient_phone: data.patient_phone || '',
      status: 'pending',
      payment_status: data.payment_status || 'unpaid',
      management_token: generateToken(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    // check double booking
    if (isSlotBooked(newBooking.booking_date, newBooking.start_time)) {
      throw new Error("Termin jest już zajęty.");
    }

    bookings.push(newBooking);
    return newBooking;
  },

  async getBookingByToken(token: string) {
    const b = bookings.find(b => b.management_token === token);
    if (!b) throw new Error("Not found");
    return b;
  },

  async cancelBookingByToken(token: string) {
    const b = bookings.find(b => b.management_token === token);
    if (!b) throw new Error("Not found");
    b.status = 'cancelled';
    b.updated_at = new Date().toISOString();
    return b;
  },

  async getBookings(date?: string) {
    if (date) {
      return bookings.filter(b => b.booking_date === date);
    }
    return bookings;
  },

  async getBookingDetails(id: string) {
    const b = bookings.find(b => b.id === id);
    if (!b) throw new Error("Not found");
    return b;
  },

  async cancelBooking(id: string) {
    const b = bookings.find(b => b.id === id);
    if (!b) throw new Error("Not found");
    b.status = 'cancelled';
    b.updated_at = new Date().toISOString();
    return b;
  },

  async updateBookingStatus(id: string, status: BookingStatus) {
    const b = bookings.find(b => b.id === id);
    if (!b) throw new Error("Not found");
    b.status = status;
    b.updated_at = new Date().toISOString();
    return b;
  },

  async getAvailabilityRules() { return rules; },
  async createAvailabilityRule(rule: Partial<AvailabilityRule>) {
    const newRule = { ...rule, id: `r_${Date.now()}` } as AvailabilityRule;
    rules.push(newRule);
    return newRule;
  },
  async deleteAvailabilityRule(id: string) {
    rules = rules.filter(r => r.id !== id);
  },

  async getBlockedPeriods() { return blockedPeriods; },
  async blockPeriod(period: Partial<BlockedPeriod>) {
    const newBp = { ...period, id: `bp_${Date.now()}` } as BlockedPeriod;
    blockedPeriods.push(newBp);
    return newBp;
  },
  async unblockPeriod(id: string) {
    blockedPeriods = blockedPeriods.filter(bp => bp.id !== id);
  },
  
  async askAssistant(text: string) {
    return new Promise<{ reply: string, action: string, details?: any }>(resolve => {
      setTimeout(() => {
        const lowerText = text.toLowerCase();
        if (lowerText.includes('zablokuj')) {
          resolve({ reply: 'Zrozumiałem: Symulowana odpowiedź Gemini - zablokowałem termin.', action: 'block_slot' });
        } else if (lowerText.includes('wizyt')) {
          resolve({ reply: 'Zrozumiałem: Symulowana odpowiedź Gemini - przygotowuję rezerwację wizyty.', action: 'book_visit' });
        } else {
          resolve({ reply: 'Zrozumiałem intencję. To jest testowa symulacja modelu w Preview (mock). W produkcji PHP odpowie na to AI.', action: 'none' });
        }
      }, 1500);
    });
  }
};
