export type PaymentPolicy = 'none' | 'optional' | 'required';
export type VisitKind = 'first' | 'followup';
export type SlotAudience = 'all' | 'first' | 'followup';

export interface VisitType {
  id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price: number;
  currency: string;
  payment_policy: PaymentPolicy;
  active: boolean;
  kind: VisitKind;
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
  mail_sent?: boolean;
  owner_mail_sent?: boolean;
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
  slot_duration: number;
  buffer_minutes: number;
  audience: SlotAudience;
}

export interface BlockedPeriod {
  id: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  reason?: string;
}

export interface SlotHold {
  id: string;
  visit_type_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  expires_at: string;
}

export interface PageViewDay {
  date: string;
  count: number;
}

export interface AnalyticsSummary {
  total: number;
  today: number;
  days: PageViewDay[];
}

export interface BookingsBackupStatus {
  interval_seconds: number;
  retention_days: number;
  last_run_at: string | null;
  last_file: string | null;
  last_count: number;
  last_size_bytes: number;
  next_due_at: string | null;
  seconds_until_next: number;
}

export interface BookingsBackupRunResult extends BookingsBackupStatus {
  created: boolean;
  reason?: string;
}

export interface BookingsRealignResult {
  checked_count: number;
  moved_count: number;
  moved: Array<{
    id: string;
    booking_date: string;
    from_time: string;
    to_time: string;
    patient_name: string;
  }>;
}
