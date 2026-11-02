import { useLocation, Link, Navigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Booking } from '../../types';
import { config } from '../../config/features';

export default function Confirmation() {
  const location = useLocation();
  const booking = location.state?.booking as Booking;

  if (!booking) {
    return <Navigate to="/" replace />;
  }

  const dateObj = parseISO(booking.booking_date);
  const managePath = `/manage/${booking.management_token}`;
  const isMock = config.API_MODE !== 'production';
  const mailFailed = !isMock && booking.mail_sent === false;

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-md mx-auto w-full text-center mt-4">
      <div className="flex justify-center mb-6">
        <div className="w-20 h-20 bg-neutral-50 rounded-xl flex items-center justify-center border-4 border-neutral-100">
          <CheckCircle2 className="w-10 h-10 text-neutral-900" />
        </div>
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-light text-neutral-900 mb-2">Wizyta zapisana</h1>
        <p className="text-neutral-500 text-sm">
          {isMock
            ? 'Termin jest w systemie. W podglądzie lokalnym e-mail nie wychodzi — potwierdź albo anuluj poniżej.'
            : mailFailed
              ? 'Termin jest zapisany, ale serwer nie potwierdził wysłania e-maila. Potwierdź wizytę albo anuluj poniżej i zachowaj tę stronę.'
              : 'Na podany e-mail poszła krótka notatka. Potwierdź wizytę online albo anuluj, jeśli nie możesz się połączyć.'}
        </p>
      </div>

      <div className="space-y-6 rounded-2xl border border-[#e4e2dc] bg-white p-6 sm:p-8 text-left">
        <div>
          <h3 className="text-[11px] font-bold text-neutral-500 uppercase tracking-[0.2em] mb-4">Podsumowanie wizyty</h3>
          <div className="space-y-3 text-sm">
             <div className="flex justify-between py-2 border-b border-neutral-100">
                <span className="text-neutral-500 font-light">Data</span>
                <span className="font-medium text-right capitalize text-neutral-900">{format(dateObj, 'd MMMM yyyy', { locale: pl })}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-neutral-100">
                <span className="text-neutral-500 font-light">Godzina</span>
                <span className="font-medium text-right text-neutral-900">{booking.end_time && booking.end_time !== booking.start_time ? `${booking.start_time}–${booking.end_time}` : booking.start_time}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-neutral-100">
                <span className="text-neutral-500 font-light">Status</span>
                <span className="font-medium text-right text-neutral-900">Oczekuje na potwierdzenie</span>
              </div>
          </div>
        </div>

        <div className="grid gap-3">
          <Button asChild className="w-full h-12">
            <Link to={managePath}>Potwierdź wizytę</Link>
          </Button>
          <Button asChild variant="outline" className="w-full h-12">
            <Link to={managePath}>Anuluj wizytę</Link>
          </Button>
        </div>
      </div>

      <Button asChild variant="ghost" className="w-full h-12">
        <Link to="/">Wróć do strony głównej</Link>
      </Button>
    </div>
  );
}
