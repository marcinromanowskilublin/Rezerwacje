import { AvailabilityRule, BlockedPeriod, Booking, BookingStatus, VisitType } from '../types';

export interface BookingApi {
  // Public Patient API
  getVisitTypes(): Promise<VisitType[]>;
  getAvailableDays(visitTypeId: string, month: number, year: number): Promise<string[]>; // Returns array of 'YYYY-MM-DD'
  getAvailableSlots(date: string, visitTypeId: string): Promise<string[]>; // Returns array of 'HH:mm'
  createBooking(data: Partial<Booking>): Promise<Booking>;
  getBookingByToken(token: string): Promise<Booking>;
  cancelBookingByToken(token: string): Promise<Booking>;

  // Admin API
  getBookings(date?: string): Promise<Booking[]>;
  getBookingDetails(id: string): Promise<Booking>;
  cancelBooking(id: string): Promise<Booking>;
  updateBookingStatus(id: string, status: BookingStatus): Promise<Booking>;
  
  getAvailabilityRules(): Promise<AvailabilityRule[]>;
  createAvailabilityRule(rule: Partial<AvailabilityRule>): Promise<AvailabilityRule>;
  deleteAvailabilityRule(id: string): Promise<void>;
  
  getBlockedPeriods(): Promise<BlockedPeriod[]>;
  blockPeriod(period: Partial<BlockedPeriod>): Promise<BlockedPeriod>;
  unblockPeriod(id: string): Promise<void>;

  // AI Assistant (Optional)
  askAssistant?: (text: string) => Promise<{ reply: string, action: string, details?: any }>;
}
