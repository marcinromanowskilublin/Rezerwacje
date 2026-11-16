import {
  AdminSession,
  AnalyticsSummary,
  AvailabilityRule,
  BlockedPeriod,
  Booking,
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
  PhoneThread,
  VisitType,
  WhatsAppConversation,
  WhatsAppStatus,
  WhatsAppThread,
} from '../types';
import { BookingApi } from './api';
import { config } from '../config/features';

const BASE_URL = config.API_BASE_URL;

let adminCsrfToken = '';

function rememberAdminSession(session: AdminSession): AdminSession {
  adminCsrfToken = session.authenticated ? (session.csrf_token || '') : '';
  return session;
}

async function fetchApi<T>(endpoint: string, options?: RequestInit, withAdmin = false): Promise<T> {
  const method = String(options?.method || 'GET').toUpperCase();
  const csrfHeader = withAdmin
    && !['GET', 'HEAD', 'OPTIONS'].includes(method)
    && adminCsrfToken
    ? { 'X-CSRF-Token': adminCsrfToken }
    : {};
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...csrfHeader,
      ...options?.headers,
    },
  });
  if (!response.ok) {
    if (response.status === 401) adminCsrfToken = '';
    let payload: Record<string, unknown> = {};
    try {
      payload = await response.json() as Record<string, unknown>;
    } catch {
      payload = {};
    }
    const message = typeof payload.error === 'string' && payload.error.trim()
      ? payload.error
      : `API Error: ${response.statusText}`;
    const error = new Error(message) as Error & {
      status?: number;
      payload?: Record<string, unknown>;
    };
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return response.json();
}

export const productionBookingApi: BookingApi = {
  getAdminSession: async () => rememberAdminSession(await fetchApi<AdminSession>('/admin/session')),
  adminLogin: async (login, password) => rememberAdminSession(await fetchApi<AdminSession>(
    '/admin/login',
    { method: 'POST', body: JSON.stringify({ login, password }) },
  )),
  adminLogout: async () => {
    try {
      await fetchApi<void>('/admin/logout', { method: 'POST' }, true);
    } finally {
      adminCsrfToken = '';
    }
  },
  getVisitTypes: () => fetchApi<VisitType[]>('/visit-types'),
  getSiteStatus: () => fetchApi<{ schedule_enabled: boolean }>('/site'),
  getAvailableDays: (visitTypeId, month, year) =>
    fetchApi<string[]>(`/availability/days?visitTypeId=${visitTypeId}&month=${month}&year=${year}`),
  getAvailableSlots: (date, visitTypeId, excludeBookingId) => {
    const extra = excludeBookingId ? `&excludeBookingId=${encodeURIComponent(excludeBookingId)}` : '';
    return fetchApi<string[]>(`/availability/slots?date=${date}&visitTypeId=${visitTypeId}${extra}`);
  },
  recordPageView: () => fetchApi<void>('/analytics/view', { method: 'POST' }),
  getAnalytics: () => fetchApi<AnalyticsSummary>('/admin/analytics', undefined, true),
  createBooking: (data) => fetchApi<Booking>('/bookings', { method: 'POST', body: JSON.stringify(data) }),
  getBookingByToken: (token) => fetchApi<Booking>(`/bookings?token=${encodeURIComponent(token)}`),
  confirmBookingByToken: (token) => fetchApi<Booking>('/bookings/confirm', { method: 'POST', body: JSON.stringify({ token }) }),
  cancelBookingByToken: (token) => fetchApi<Booking>(`/bookings?token=${encodeURIComponent(token)}`, { method: 'DELETE' }),
  getPaymentGatewayStatus: () => fetchApi<PaymentGatewayStatus>('/admin/payments/status', undefined, true),
  startPayment: (token) =>
    fetchApi<PaymentStartResult>('/payments/start', { method: 'POST', body: JSON.stringify({ token }) }),
  getPaymentStatus: (token) =>
    fetchApi<PaymentStatusResult>(`/payments/status?token=${encodeURIComponent(token)}`),

  holdSlot: (data) => fetchApi<SlotHold>('/holds', { method: 'POST', body: JSON.stringify(data) }),
  refreshHold: (id) => fetchApi<SlotHold>(`/holds/${id}/refresh`, { method: 'POST' }),
  releaseHold: (id) => fetchApi<void>(`/holds/${id}`, { method: 'DELETE' }),

  getBookings: (date) => fetchApi<Booking[]>(date ? `/admin/bookings?date=${date}` : '/admin/bookings', undefined, true),
  createAdminBooking: (data) =>
    fetchApi<Booking>('/admin/bookings', { method: 'POST', body: JSON.stringify(data) }, true),
  getBookingDetails: (id) => fetchApi<Booking>(`/admin/bookings/${id}`, undefined, true),
  cancelBooking: (id) => fetchApi<Booking>(`/admin/bookings/${id}/cancel`, { method: 'POST' }, true),
  updateBookingStatus: (id, status) =>
    fetchApi<Booking>(`/admin/bookings/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }, true),
  rescheduleBooking: (id, booking_date, start_time) =>
    fetchApi<Booking>(`/admin/bookings/${id}/reschedule`, { method: 'POST', body: JSON.stringify({ booking_date, start_time }) }, true),
  getActiveHolds: (date) => fetchApi<SlotHold[]>(date ? `/admin/holds?date=${date}` : '/admin/holds', undefined, true),

  getAvailabilityRules: () => fetchApi<AvailabilityRule[]>('/admin/availability/rules', undefined, true),
  createAvailabilityRule: (rule) =>
    fetchApi<AvailabilityRule>('/admin/availability/rules', { method: 'POST', body: JSON.stringify(rule) }, true),
  updateAvailabilityRule: (id, rule) =>
    fetchApi<AvailabilityRule>(`/admin/availability/rules/${id}`, { method: 'PUT', body: JSON.stringify(rule) }, true),
  deleteAvailabilityRule: (id) => fetchApi<void>(`/admin/availability/rules/${id}`, { method: 'DELETE' }, true),

  listVisitTypes: () => fetchApi<VisitType[]>('/admin/visit-types', undefined, true),
  createVisitType: (data) => fetchApi<VisitType>('/admin/visit-types', { method: 'POST', body: JSON.stringify(data) }, true),
  updateVisitType: (id, data) => fetchApi<VisitType>(`/admin/visit-types/${id}`, { method: 'PUT', body: JSON.stringify(data) }, true),

  getBlockedPeriods: () => fetchApi<BlockedPeriod[]>('/admin/availability/blocks', undefined, true),
  blockPeriod: (period) => fetchApi<BlockedPeriod>('/admin/availability/blocks', { method: 'POST', body: JSON.stringify(period) }, true),
  unblockPeriod: (id) => fetchApi<void>(`/admin/availability/blocks/${id}`, { method: 'DELETE' }, true),
  getBookingsBackupStatus: () => fetchApi<BookingsBackupStatus>('/admin/backups/bookings/status', undefined, true),
  runBookingsBackup: () => fetchApi<BookingsBackupRunResult>('/admin/backups/bookings/run', { method: 'POST' }, true),
  realignBookings: (fromDate) =>
    fetchApi<BookingsRealignResult>('/admin/bookings/realign', { method: 'POST', body: JSON.stringify({ from_date: fromDate }) }, true),
  sendVisitReportTest: (dates) =>
    fetchApi<{ ok: boolean; recipients: Record<string, boolean>; summary: unknown[] }>(
      '/admin/reports/visit/send-test',
      { method: 'POST', body: JSON.stringify({ dates }) },
      true,
    ),
  getSmsStatus: () =>
    fetchApi<SmsStatus>('/admin/sms/status', undefined, true),
  getSmsTemplates: (bookingId) =>
    fetchApi<SmsTemplateResponse>(
      `/admin/sms/templates?booking_id=${encodeURIComponent(bookingId)}`,
      undefined,
      true,
    ),
  sendSms: (data) =>
    fetchApi<SmsSendResult>('/admin/sms/send', { method: 'POST', body: JSON.stringify(data) }, true),
  getWhatsAppStatus: () =>
    fetchApi<WhatsAppStatus>('/admin/whatsapp/status', undefined, true),
  getWhatsAppThreads: (limit = 50) =>
    fetchApi<WhatsAppThread[]>(
      `/admin/whatsapp/threads?limit=${Math.max(1, Math.min(100, Math.round(limit)))}`,
      undefined,
      true,
    ),
  getWhatsAppMessages: (threadId) =>
    fetchApi<WhatsAppConversation>(
      `/admin/whatsapp/threads/${encodeURIComponent(threadId)}/messages`,
      undefined,
      true,
    ),
  markWhatsAppThreadRead: (threadId) =>
    fetchApi<void>(
      `/admin/whatsapp/threads/${encodeURIComponent(threadId)}/read`,
      { method: 'POST' },
      true,
    ),
  completeWhatsAppBotThread: (threadId) =>
    fetchApi<WhatsAppConversation>(
      `/admin/whatsapp/threads/${encodeURIComponent(threadId)}/bot/done`,
      { method: 'POST' },
      true,
    ),
  replyWhatsAppThread: (threadId, body) =>
    fetchApi<WhatsAppConversation>(
      `/admin/whatsapp/threads/${encodeURIComponent(threadId)}/reply`,
      { method: 'POST', body: JSON.stringify({ body }) },
      true,
    ),
  getPhoneThreads: (limit = 50) =>
    fetchApi<PhoneThread[]>(
      `/admin/phone/threads?limit=${Math.max(1, Math.min(100, Math.round(limit)))}`,
      undefined,
      true,
    ),
  getPhoneMessages: (threadId) =>
    fetchApi<PhoneConversation>(
      `/admin/phone/threads/${encodeURIComponent(threadId)}/messages`,
      undefined,
      true,
    ),
  getContactIntents: () =>
    fetchApi<ContactIntent[]>('/admin/contact-intents', undefined, true),
  createContactIntent: (data) =>
    fetchApi<ContactIntent>('/admin/contact-intents', { method: 'POST', body: JSON.stringify(data) }, true),
  updateContactIntent: (id, data) =>
    fetchApi<ContactIntent>(
      `/admin/contact-intents/${encodeURIComponent(id)}`,
      { method: 'PUT', body: JSON.stringify(data) },
      true,
    ),
  deleteContactIntent: (id) =>
    fetchApi<void>(
      `/admin/contact-intents/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
      true,
    ),
};
