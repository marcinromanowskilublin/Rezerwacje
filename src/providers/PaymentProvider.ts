export interface PaymentProvider {
  getAvailablePaymentMethods(): Promise<string[]>;
  createPayment(bookingId: string, amount: number, method: string): Promise<{ success: boolean; paymentId: string; redirectUrl?: string }>;
  getPaymentStatus(paymentId: string): Promise<string>;
  cancelPayment(paymentId: string): Promise<void>;
  refundPayment(paymentId: string): Promise<void>;
}

export const mockPaymentProvider: PaymentProvider = {
  async getAvailablePaymentMethods() {
    return ['blik', 'transfer', 'card', 'google_pay', 'apple_pay'];
  },
  
  async createPayment(bookingId, amount, method) {
    console.log(`[MockPayment] Creating payment for booking ${bookingId}: ${amount} PLN via ${method}`);
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    return { success: true, paymentId: `pay_${Date.now()}` };
  },

  async getPaymentStatus(paymentId) {
    return 'paid';
  },

  async cancelPayment(paymentId) {
    console.log(`[MockPayment] Cancelled ${paymentId}`);
  },

  async refundPayment(paymentId) {
    console.log(`[MockPayment] Refunded ${paymentId}`);
  }
};
