import { useState } from 'react';
import { useLocation, Link, Navigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Booking } from '../../types';
import { config } from '../../config/features';
import { bookingApi } from '../../services/bookingApi';

export default function Confirmation() {
  const location = useLocation();
  const booking = location.state?.booking as Booking;
  const paymentError = location.state?.paymentError as string | undefined;
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(paymentError || null);

  if (!booking) {
    return <Navigate to="/" replace />;
  }

  const dateObj = parseISO(booking.booking_date);
  const managePath = `/manage/${booking.management_token}`;
  const isMock = config.API_MODE !== 'production';
  const mailFailed = !isMock && booking.mail_sent === false;
  const paymentDue = booking.payment_status !== 'paid' && booking.status === 'pending_payment';

  const startPayment = async () => {
    setPaying(true);
    setPayError(null);
    try {
      const result = await bookingApi.startPayment(booking.management_token);
      if (result.ok && result.payment_url) {
        window.location.assign(result.payment_url);
        return;
      }
      throw new Error(result.error || 'Nie udało się rozpocząć płatności.');
    } catch (err: any) {
      setPayError(err.message || 'Nie udało się rozpocząć płatności.');
    } finally {
      setPaying(false);
    }
  };

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
                <span className="font-medium text-right text-neutral-900">
                  {paymentDue ? 'Oczekuje na płatność' : 'Oczekuje na potwierdzenie'}
                </span>
              </div>
          </div>
        </div>

        <div className="grid gap-3">
          {paymentDue && (
            <>
              <Button onClick={() => void startPayment()} disabled={paying} className="w-full h-12">
                {paying ? 'Przekierowuję...' : 'Przejdź do płatności online'}
              </Button>
              {payError && <p className="text-xs text-red-600 text-center">{payError}</p>}
            </>
          )}
          {!paymentDue && (
            <Button asChild className="w-full h-12">
              <Link to={managePath}>Potwierdź wizytę</Link>
            </Button>
          )}
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
