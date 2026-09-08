import { config } from '../config/features';
import { BookingApi } from './api';
import { mockBookingApi } from './mockApi';
import { productionBookingApi } from './productionApi';

let activeApi: BookingApi;

if (config.API_MODE === 'production') {
  activeApi = productionBookingApi; 
} else {
  activeApi = mockBookingApi;
}

export const bookingApi = activeApi;
