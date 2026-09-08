import { AvailabilityRule, BlockedPeriod, Booking, BookingStatus, VisitType } from '../types';
import { BookingApi } from './api';
import { config } from '../config/features';

const BASE_URL = config.API_BASE_URL;

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }
  return response.json();
}

export const productionBookingApi: BookingApi = {
  getVisitTypes: () => fetchApi<VisitType[]>('/visit-types'),
  getAvailableDays: (visitTypeId, month, year) => fetchApi<string[]>(`/availability/days?visitTypeId=${visitTypeId}&month=${month}&year=${year}`),
  getAvailableSlots: (date, visitTypeId) => fetchApi<string[]>(`/availability/slots?date=${date}&visitTypeId=${visitTypeId}`),
  createBooking: (data) => fetchApi<Booking>('/bookings', { method: 'POST', body: JSON.stringify(data) }),
  getBookingByToken: (token) => fetchApi<Booking>(`/bookings?token=${token}`),
  cancelBookingByToken: (token) => fetchApi<Booking>(`/bookings?token=${token}`, { method: 'DELETE' }),
  
  getBookings: (date) => fetchApi<Booking[]>(date ? `/admin/bookings?date=${date}` : '/admin/bookings'),
  getBookingDetails: (id) => fetchApi<Booking>(`/admin/bookings/${id}`),
  cancelBooking: (id) => fetchApi<Booking>(`/admin/bookings/${id}/cancel`, { method: 'POST' }),
  updateBookingStatus: (id, status) => fetchApi<Booking>(`/admin/bookings/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  
  getAvailabilityRules: () => fetchApi<AvailabilityRule[]>('/admin/availability/rules'),
  createAvailabilityRule: (rule) => fetchApi<AvailabilityRule>('/admin/availability/rules', { method: 'POST', body: JSON.stringify(rule) }),
  deleteAvailabilityRule: (id) => fetchApi<void>(`/admin/availability/rules/${id}`, { method: 'DELETE' }),
  
  getBlockedPeriods: () => fetchApi<BlockedPeriod[]>('/admin/availability/blocks'),
  blockPeriod: (period) => fetchApi<BlockedPeriod>('/admin/availability/blocks', { method: 'POST', body: JSON.stringify(period) }),
  unblockPeriod: (id) => fetchApi<void>(`/admin/availability/blocks/${id}`, { method: 'DELETE' }),

  askAssistant: (text: string) => fetchApi<any>('/assistant', { method: 'POST', body: JSON.stringify({ text }) })
};
