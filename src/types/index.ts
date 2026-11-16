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
export type PaymentMethod = 'online' | 'blik' | 'transfer' | 'card' | 'google_pay' | 'apple_pay' | 'later';

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

export interface PaymentGatewayStatus {
  enabled: boolean;
  configured: boolean;
  provider: string;
  environment: 'production' | 'sandbox';
}

export interface PaymentStartResult {
  ok: boolean;
  status?: PaymentStatus;
  payment_id?: string;
  payment_url?: string;
  error?: string;
}

export interface PaymentStatusResult {
  payment_status: PaymentStatus;
  booking_status: BookingStatus;
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

export interface AdminSession {
  authenticated: boolean;
  csrf_token?: string;
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

export interface SmsTemplate {
  id: string;
  label: string;
  message: string;
}

export interface SmsTemplateResponse {
  to: string | null;
  templates: SmsTemplate[];
}

export interface SmsSendResult {
  ok: boolean;
  message_id?: string;
  status?: string;
  error?: string;
}

export interface SmsStatus {
  configured: boolean;
  callback_configured: boolean;
}

export type WhatsAppDirection = 'inbound' | 'outbound';
export type ContactConfidence = 'known' | 'candidate' | 'unknown';
export type ContactSource = 'booking' | 'google_contacts' | 'edr' | 'whatsapp' | 'phone' | 'manual' | 'unknown';
export type TriagePriority = 'low' | 'normal' | 'high';
export type ContactIntentStatus = 'pending' | 'done' | 'dismissed';
export type ContactChannel = 'whatsapp' | 'phone' | 'manual';

export interface WhatsAppStatus {
  sending_configured: boolean;
  threads_configured: boolean;
  retention_days: number;
}

export interface WhatsAppBotData {
  category?: string;
  category_label?: string;
  issue_category?: string;
  priority?: TriagePriority;
  identity_raw?: string;
  name?: string;
  pesel?: string;
  address?: string;
  details?: string;
  labels?: string[];
}

export interface WhatsAppThread {
  id: number;
  wa_id: string;
  phone: string;
  display_name: string;
  profile_name: string | null;
  patient_name: string | null;
  is_patient: boolean;
  contact_confidence?: ContactConfidence;
  contact_source?: ContactSource;
  issue_category: string;
  triage_summary?: string | null;
  requires_attention?: boolean;
  priority?: TriagePriority;
  bot_state?: string;
  bot_paused?: boolean;
  bot_last_auto_reply_at?: string | null;
  bot_data?: WhatsAppBotData | null;
  labels?: string[];
  preview: string;
  last_direction: WhatsAppDirection;
  last_message_type: string;
  last_message_at: string;
  last_inbound_at: string | null;
  unread_count: number;
  can_reply: boolean;
  whatsapp_url: string;
}

export interface WhatsAppMessage {
  id: number;
  meta_message_id: string;
  direction: WhatsAppDirection;
  message_type: string;
  body: string;
  status: string;
  reply_to_meta_id: string | null;
  sent_at: string;
}

export interface WhatsAppConversation {
  thread: WhatsAppThread;
  messages: WhatsAppMessage[];
}

export type PhoneMessageDirection = 'inbound' | 'outbound' | 'note';
export type PhoneMessageType = 'sms' | 'voicemail' | 'transcript' | 'note';
export type PhoneCallStatus = 'missed' | 'answered' | 'voicemail';

export interface PhoneThread {
  id: number;
  phone: string;
  display_name: string;
  contact_confidence: ContactConfidence;
  contact_source: ContactSource;
  last_call_at: string;
  last_message_at: string | null;
  missed_count: number;
  last_status: PhoneCallStatus;
  summary: string;
  messages_preview: string;
  unread_count: number;
}

export interface PhoneMessage {
  id: number;
  direction: PhoneMessageDirection;
  message_type: PhoneMessageType;
  body: string;
  sent_at: string;
}

export interface PhoneConversation {
  thread: PhoneThread;
  messages: PhoneMessage[];
}

export interface ContactIntent {
  id: string;
  channel: ContactChannel;
  source_id: string | null;
  contact_label: string;
  phone: string;
  title: string;
  summary: string;
  category: string;
  priority: TriagePriority;
  status: ContactIntentStatus;
  extracted_at: string;
  updated_at?: string;
}
