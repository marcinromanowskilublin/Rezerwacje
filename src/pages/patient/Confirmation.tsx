import { useEffect } from 'react';
import { useLocation, Link, Navigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Booking } from '../../types';
import { useBooking } from './BookingContext';

export default function Confirmation() {
  const location = useLocation();
  const { reset } = useBooking();
  const booking = location.state?.booking as Booking;

  // Reset only after this screen has mounted, so the still-transitioning
  // Summary/PatientForm guard clauses don't hijack this navigation.
  useEffect(() => {
    reset();
  }, [reset]);

  if (!booking) {
    return <Navigate to="/" replace />;
  }

  const dateObj = parseISO(booking.booking_date);

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-md mx-auto w-full text-center mt-4">
      <div className="flex justify-center mb-6">
        <div className="w-20 h-20 bg-brand-50 rounded-full flex items-center justify-center border-4 border-brand-100 shadow-[0_12px_28px_-10px_rgba(47,138,96,0.45)]">
          <CheckCircle2 className="w-10 h-10 text-brand-600" />
        </div>
      </div>

      <div className="space-y-2">
        <h1 className="font-display text-3xl sm:text-4xl text-ink mb-2">Wizyta zapisana</h1>
        <p className="text-neutral-500 text-sm">Estetyczne potwierdzenie e-mail zostało wysłane.</p>
      </div>

      <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-[0_12px_36px_-18px_rgba(28,33,29,0.15)] border border-brand-900/[0.06] p-7 sm:p-9 space-y-6 text-left">
        <div>
          <h3 className="text-[11px] font-bold text-neutral-500 uppercase tracking-[0.2em] mb-4">Podsumowanie wizyty</h3>
          <div className="space-y-3 text-sm">
             <div className="flex justify-between py-2 border-b border-neutral-100">
                <span className="text-neutral-500 font-light">Data</span>
                <span className="font-medium text-right capitalize text-ink">{format(dateObj, 'd MMMM yyyy', { locale: pl })}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-neutral-100">
                <span className="text-neutral-500 font-light">Godzina</span>
                <span className="font-medium text-right text-ink">{booking.start_time}</span>
              </div>
          </div>
        </div>

        <div className="pt-4 border-t border-neutral-100 flex flex-col items-center bg-brand-50 p-4 rounded-2xl text-center space-y-2">
          <p className="text-xs text-neutral-500">
            Wiadomość e-mail zawiera szczegóły (gdzie i kiedy) oraz specjalny link: <br/><strong className="text-ink">Odwołaj wizytę</strong>.
          </p>
          <Link to={`/manage/${booking.management_token}`} className="text-xs font-bold text-brand-700 underline underline-offset-4 hover:text-brand-800 mt-2 block">
            [Podgląd] Otwórz zarządzanie wizytą
          </Link>
        </div>
      </div>

      <Button asChild variant="outline" className="w-full h-14">
        <Link to="/">Wróć do strony głównej</Link>
      </Button>
    </div>
  );
}
