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
  ContactIntentStatus,
  PaymentGatewayStatus,
  PaymentStartResult,
  PaymentStatusResult,
  SmsSendResult,
  SmsStatus,
  SmsTemplateResponse,
  SlotHold,
  PhoneConversation,
  PhoneThread,
  VisitType,
  WhatsAppConversation,
  WhatsAppStatus,
  WhatsAppThread,
} from '../types';

export type CreateBookingInput = Partial<Booking> & { hold_id?: string };

export interface BookingApi {
  getAdminSession(): Promise<AdminSession>;
  adminLogin(login: string, password: string): Promise<AdminSession>;
  adminLogout(): Promise<void>;
  getVisitTypes(): Promise<VisitType[]>;
  getSiteStatus(): Promise<{ schedule_enabled: boolean }>;
  getAvailableDays(visitTypeId: string, month: number, year: number): Promise<string[]>;
  getAvailableSlots(date: string, visitTypeId: string, excludeBookingId?: string): Promise<string[]>;
  recordPageView(): Promise<void>;
  getAnalytics(): Promise<AnalyticsSummary>;
  createBooking(data: CreateBookingInput): Promise<Booking>;
  getBookingByToken(token: string): Promise<Booking>;
  confirmBookingByToken(token: string): Promise<Booking>;
  cancelBookingByToken(token: string): Promise<Booking>;
  getPaymentGatewayStatus(): Promise<PaymentGatewayStatus>;
  startPayment(token: string): Promise<PaymentStartResult>;
  getPaymentStatus(token: string): Promise<PaymentStatusResult>;

  holdSlot(data: { visit_type_id: string; booking_date: string; start_time: string }): Promise<SlotHold>;
  refreshHold(id: string): Promise<SlotHold>;
  releaseHold(id: string): Promise<void>;

  getBookings(date?: string): Promise<Booking[]>;
  createAdminBooking(data: Partial<Booking>): Promise<Booking>;
  getBookingDetails(id: string): Promise<Booking>;
  cancelBooking(id: string): Promise<Booking>;
  updateBookingStatus(id: string, status: BookingStatus): Promise<Booking>;
  rescheduleBooking(id: string, booking_date: string, start_time: string): Promise<Booking>;
  getActiveHolds(date?: string): Promise<SlotHold[]>;

  getAvailabilityRules(): Promise<AvailabilityRule[]>;
  createAvailabilityRule(rule: Partial<AvailabilityRule>): Promise<AvailabilityRule>;
  updateAvailabilityRule(id: string, rule: Partial<AvailabilityRule>): Promise<AvailabilityRule>;
  deleteAvailabilityRule(id: string): Promise<void>;

  listVisitTypes(): Promise<VisitType[]>;
  createVisitType(data: Partial<VisitType>): Promise<VisitType>;
  updateVisitType(id: string, data: Partial<VisitType>): Promise<VisitType>;

  getBlockedPeriods(): Promise<BlockedPeriod[]>;
  blockPeriod(period: Partial<BlockedPeriod>): Promise<BlockedPeriod>;
  unblockPeriod(id: string): Promise<void>;
  getBookingsBackupStatus(): Promise<BookingsBackupStatus>;
  runBookingsBackup(): Promise<BookingsBackupRunResult>;
  realignBookings(fromDate?: string): Promise<BookingsRealignResult>;
  sendVisitReportTest(dates?: string[]): Promise<{ ok: boolean; recipients: Record<string, boolean>; summary: unknown[] }>;
  getSmsStatus(): Promise<SmsStatus>;
  getSmsTemplates(bookingId: string): Promise<SmsTemplateResponse>;
  sendSms(data: { booking_id?: string; template_id?: string; to: string; message: string; purpose?: string }): Promise<SmsSendResult>;
  getWhatsAppStatus(): Promise<WhatsAppStatus>;
  getWhatsAppThreads(limit?: number): Promise<WhatsAppThread[]>;
  getWhatsAppMessages(threadId: number): Promise<WhatsAppConversation>;
  markWhatsAppThreadRead(threadId: number): Promise<void>;
  completeWhatsAppBotThread(threadId: number): Promise<WhatsAppConversation>;
  replyWhatsAppThread(threadId: number, body: string): Promise<WhatsAppConversation>;
  getPhoneThreads(limit?: number): Promise<PhoneThread[]>;
  getPhoneMessages(threadId: number): Promise<PhoneConversation>;
  getContactIntents(): Promise<ContactIntent[]>;
  createContactIntent(data: Partial<ContactIntent>): Promise<ContactIntent>;
  updateContactIntent(id: string, data: Partial<ContactIntent> & { status?: ContactIntentStatus }): Promise<ContactIntent>;
  deleteContactIntent(id: string): Promise<void>;
  askAssistant?: (text: string) => Promise<{ reply: string; action: string; details?: unknown }>;
}
