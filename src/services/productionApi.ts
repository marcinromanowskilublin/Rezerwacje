import {
  AnalyticsSummary,
  AvailabilityRule,
  BlockedPeriod,
  Booking,
  BookingsBackupRunResult,
  BookingsBackupStatus,
  BookingsRealignResult,
  SlotHold,
  VisitType,
} from '../types';
import { BookingApi } from './api';
import { config } from '../config/features';

const BASE_URL = config.API_BASE_URL;

function adminHeaders(): Record<string, string> {
  if (typeof sessionStorage === 'undefined') return {};
  const password = sessionStorage.getItem('rezerwacje_admin_password');
  return password ? { 'X-Admin-Password': password } : {};
}

async function fetchApi<T>(endpoint: string, options?: RequestInit, withAdmin = false): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(withAdmin ? adminHeaders() : {}),
      ...options?.headers,
    },
  });
  if (!response.ok) {
    const error = new Error(`API Error: ${response.statusText}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return response.json();
}

export const productionBookingApi: BookingApi = {
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
};
