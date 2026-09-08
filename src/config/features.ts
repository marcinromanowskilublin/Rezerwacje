export const config = {
  API_MODE: import.meta.env.VITE_API_MODE || 'mock',
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || '/rezerwacja/api',
  features: {
    payments: true,
    googleCalendar: false,
    googleMeet: false,
    gmailNotifications: false,
    googleContacts: false,
  },
};
