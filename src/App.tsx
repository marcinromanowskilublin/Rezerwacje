/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import BookingStart from './pages/patient/BookingStart';
import DaySelector from './pages/patient/DaySelector';
import SlotSelector from './pages/patient/SlotSelector';
import PatientForm from './pages/patient/PatientForm';
import Summary from './pages/patient/Summary';
import Confirmation from './pages/patient/Confirmation';
import ManageBooking from './pages/patient/ManageBooking';
import AdminDashboard from './pages/admin/AdminDashboard';
import { BookingProvider } from './pages/patient/BookingContext';

export default function App() {
  const base = import.meta.env.PROD ? '/rezerwacja' : '/';
  return (
    <BrowserRouter basename={base}>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route element={<BookingProvider />}>
            <Route index element={<BookingStart />} />
            <Route path="day" element={<DaySelector />} />
            <Route path="slot" element={<SlotSelector />} />
            <Route path="form" element={<PatientForm />} />
            <Route path="summary" element={<Summary />} />
            <Route path="confirmation" element={<Confirmation />} />
          </Route>
          
          <Route path="manage/:token" element={<ManageBooking />} />
          <Route path="admin" element={<AdminDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
