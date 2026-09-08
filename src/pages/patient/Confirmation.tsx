import { useLocation, Link, Navigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Booking } from '../../types';

export default function Confirmation() {
  const location = useLocation();
  const booking = location.state?.booking as Booking;

  if (!booking) {
    return <Navigate to="/" replace />;
  }

  const dateObj = parseISO(booking.booking_date);

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-md mx-auto w-full text-center mt-4">
      <div className="flex justify-center mb-6">
        <div className="w-20 h-20 bg-neutral-50 rounded-xl flex items-center justify-center border-4 border-neutral-100">
          <CheckCircle2 className="w-10 h-10 text-neutral-900" />
        </div>
      </div>
      
      <div className="space-y-2">
        <h1 className="text-3xl font-light text-neutral-900 mb-2">Wizyta zapisana</h1>
        <p className="text-neutral-500 text-sm">Estetyczne potwierdzenie e-mail zostało wysłane.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 sm:p-8 space-y-6 text-left">
        <div>
          <h3 className="text-[11px] font-bold text-neutral-500 uppercase tracking-[0.2em] mb-4">Podsumowanie wizyty</h3>
          <div className="space-y-3 text-sm">
             <div className="flex justify-between py-2 border-b border-neutral-100">
                <span className="text-neutral-500 font-light">Data</span>
                <span className="font-medium text-right capitalize text-neutral-900">{format(dateObj, 'd MMMM yyyy', { locale: pl })}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-neutral-100">
                <span className="text-neutral-500 font-light">Godzina</span>
                <span className="font-medium text-right text-neutral-900">{booking.start_time}</span>
              </div>
          </div>
        </div>
        
        <div className="pt-4 border-t border-neutral-100 flex flex-col items-center bg-neutral-50 p-4 rounded-xl text-center space-y-2">
          <p className="text-xs text-neutral-500">
            Wiadomość e-mail zawiera szczegóły (gdzie i kiedy) oraz specjalny link: <br/><strong className="text-neutral-900">Odwołaj wizytę</strong>.
          </p>
          <Link to={`/manage/${booking.management_token}`} className="text-xs font-bold text-neutral-900 underline underline-offset-4 hover:text-neutral-600 mt-2 block">
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
