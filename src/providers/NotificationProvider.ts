export interface NotificationProvider {
  sendBookingConfirmation(booking: any): Promise<void>;
  sendCancellation(booking: any): Promise<void>;
}

export const mockNotificationProvider: NotificationProvider = {
  async sendBookingConfirmation(booking) {
    console.log(`[MockNotification] Sent booking confirmation to ${booking.patient_email} for ${booking.booking_date} ${booking.start_time}`);
  },
  
  async sendCancellation(booking) {
    console.log(`[MockNotification] Sent cancellation to ${booking.patient_email}`);
  }
};
