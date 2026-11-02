const host = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
const localHosts = new Set(['localhost', '127.0.0.1']);
const inferredMode = localHosts.has(host) ? 'mock' : 'production';

export const config = {
  API_MODE: import.meta.env.VITE_API_MODE || inferredMode,
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || '/rezerwacja/api',
  features: {
    payments: false,
    googleCalendar: false,
    googleMeet: false,
    gmailNotifications: false,
    googleContacts: false,
  },
};
