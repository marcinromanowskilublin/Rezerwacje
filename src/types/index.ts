export type PaymentPolicy = 'none' | 'optional' | 'required';

export interface VisitType {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price: number;
  currency: string;
  payment_policy: PaymentPolicy;
  active: boolean;
}

export type BookingStatus = 'pending' | 'pending_payment' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded';
export type PaymentMethod = 'blik' | 'transfer' | 'card' | 'google_pay' | 'apple_pay' | 'later';

export interface Booking {
  id: string;
  visit_type_id: string;
  booking_date: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  patient_name: string;
  patient_email: string;
  patient_phone: string;
  status: BookingStatus;
  payment_status: PaymentStatus;
  management_token: string;
  management_token_expires_at?: string | null;
  external_event_id?: string | null;
  meeting_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  booking_id: string;
  provider: string;
  external_payment_id?: string | null;
  payment_method: PaymentMethod;
  amount: number;
  currency: string;
  status: PaymentStatus;
  created_at: string;
  paid_at?: string | null;
  refunded_at?: string | null;
}

export interface AvailabilityRule {
  id: string;
  day_of_week: number; // 0-6 (0 = Sunday)
  start_time: string;
  end_time: string;
  slot_duration: number; // minutes
}

export interface BlockedPeriod {
  id: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  reason?: string;
}
