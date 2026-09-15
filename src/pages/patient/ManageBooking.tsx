import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { bookingApi } from '../../services/bookingApi';
import { Booking } from '../../types';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Button } from '../../components/ui/Button';

export default function ManageBooking() {
  const { token } = useParams<{ token: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!token) return;
    bookingApi.getBookingByToken(token)
      .then(b => {
        setBooking(b);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [token]);

  const handleCancel = async () => {
    if (!confirm('Czy na pewno chcesz anulować wizytę?')) return;
    setCancelling(true);
    try {
      await bookingApi.cancelBookingByToken(token!);
      const b = await bookingApi.getBookingByToken(token!);
      setBooking(b);
    } catch {
      alert("Błąd podczas anulowania.");
    }
    setCancelling(false);
  };

  if (loading) return <div className="text-center py-12 text-neutral-500">Wczytywanie...</div>;

  if (error || !booking) {
    return (
      <div className="text-center py-12 space-y-4">
        <h1 className="font-display text-2xl text-ink">Nie znaleziono rezerwacji</h1>
        <p className="text-neutral-500 text-sm">Link jest nieprawidłowy lub wygasł.</p>
        <Button asChild><Link to="/">Strona główna</Link></Button>
      </div>
    );
  }

  const dateObj = parseISO(booking.booking_date);
  const isCancelled = booking.status === 'cancelled';

  return (
    <div className="max-w-md mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
      <div className="text-center">
        <h1 className="font-display text-3xl sm:text-4xl text-ink mb-2">Zarządzaj wizytą</h1>
        <p className="text-neutral-500 text-sm">
          {isCancelled ? 'Ta wizyta została anulowana.' : 'Oto szczegóły Twojej rezerwacji.'}
        </p>
      </div>

      <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-[0_12px_36px_-18px_rgba(28,33,29,0.15)] border border-brand-900/[0.06] p-7 sm:p-9 space-y-6">
        <div>
          <p className="text-[11px] uppercase font-bold text-neutral-500 mb-1.5 tracking-widest">Status</p>
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${isCancelled ? 'bg-neutral-100 text-neutral-900' : 'bg-brand-50 text-brand-800'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isCancelled ? 'bg-neutral-400' : 'bg-brand-600'}`} />
            {booking.status.replace('_', ' ')}
          </div>
        </div>

        <div>
          <p className="text-[11px] uppercase font-bold text-neutral-500 mb-1 tracking-widest">Termin</p>
          <p className="font-medium text-lg text-ink capitalize">
            {format(dateObj, 'EEEE, d MMMM yyyy', { locale: pl })} o {booking.start_time}
          </p>
        </div>

        <div>
          <p className="text-[11px] uppercase font-bold text-neutral-500 mb-1 tracking-widest">Dane pacjenta</p>
          <p className="font-medium text-ink">{booking.patient_name}</p>
          <p className="text-neutral-500 text-sm">{booking.patient_email}</p>
        </div>

        {!isCancelled && (
          <div className="pt-6 border-t border-neutral-100">
            <Button variant="outline" onClick={handleCancel} disabled={cancelling} className="w-full h-12 text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200">
              {cancelling ? 'Anulowanie...' : 'Odwołaj wizytę'}
            </Button>
          </div>
        )}
      </div>
      
      <div className="text-center">
        <Link to="/" className="text-xs font-bold text-brand-700 uppercase tracking-widest hover:text-brand-800 underline underline-offset-4">Wróć na stronę główną</Link>
      </div>
    </div>
  );
}
