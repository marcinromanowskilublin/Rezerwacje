/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import BookingStart from './pages/patient/BookingStart';
import DaySelector from './pages/patient/DaySelector';
import SlotSelector from './pages/patient/SlotSelector';
import PatientForm from './pages/patient/PatientForm';
import Summary from './pages/patient/Summary';
import Confirmation from './pages/patient/Confirmation';
import ManageBooking from './pages/patient/ManageBooking';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminSchedule from './pages/admin/AdminSchedule';
import AdminSettings from './pages/admin/AdminSettings';
import PrivacyPolicy from './pages/legal/PrivacyPolicy';
import BookingTerms from './pages/legal/BookingTerms';
import { BookingProvider } from './pages/patient/BookingContext';
import { config } from './config/features';
import { bookingApi } from './services/bookingApi';

function RequireSchedule() {
  const [enabled, setEnabled] = useState<boolean | null>(config.API_MODE === 'production' ? null : true);

  useEffect(() => {
    if (config.API_MODE !== 'production') return;
    let cancelled = false;
    bookingApi.getSiteStatus()
      .then((status) => {
        if (!cancelled) setEnabled(Boolean(status.schedule_enabled));
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (enabled === null) return null;
  if (!enabled) return <Navigate to="/" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route element={<BookingProvider />}>
            <Route index element={<BookingStart />} />
            <Route element={<RequireSchedule />}>
              <Route path="day" element={<DaySelector />} />
              <Route path="slot" element={<SlotSelector />} />
              <Route path="form" element={<PatientForm />} />
              <Route path="summary" element={<Summary />} />
              <Route path="confirmation" element={<Confirmation />} />
            </Route>
          </Route>
          
          <Route path="manage/:token" element={<ManageBooking />} />
          <Route path="polityka-prywatnosci" element={<PrivacyPolicy />} />
          <Route path="zasady-rezerwacji" element={<BookingTerms />} />
          <Route path="admin/login" element={<AdminLogin />} />
          <Route path="admin" element={<AdminDashboard />} />
          <Route path="admin/grafik" element={<AdminSchedule />} />
          <Route path="admin/ustawienia" element={<AdminSettings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
