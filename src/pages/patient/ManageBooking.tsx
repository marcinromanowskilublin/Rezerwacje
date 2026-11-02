import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { bookingApi } from '../../services/bookingApi';
import { Booking } from '../../types';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Button } from '../../components/ui/Button';

const statusLabel: Record<string, string> = {
  pending: 'Oczekuje na potwierdzenie',
  pending_payment: 'Oczekuje na płatność',
  confirmed: 'Potwierdzona',
  cancelled: 'Anulowana',
  completed: 'Zakończona',
  no_show: 'Nieobecność',
};

export default function ManageBooking() {
  const { token } = useParams<{ token: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [working, setWorking] = useState<'confirm' | 'cancel' | null>(null);

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
    setWorking('cancel');
    try {
      const updated = await bookingApi.cancelBookingByToken(token!);
      setBooking(updated);
    } catch {
      alert('Błąd podczas anulowania.');
    }
    setWorking(null);
  };

  const handleConfirm = async () => {
    setWorking('confirm');
    try {
      const updated = await bookingApi.confirmBookingByToken(token!);
      setBooking(updated);
    } catch {
      alert('Błąd podczas potwierdzania.');
    }
    setWorking(null);
  };

  if (loading) return <div className="text-center py-12 text-neutral-500">Wczytywanie...</div>;

  if (error || !booking) {
    return (
      <div className="text-center py-12 space-y-4">
        <h1 className="text-2xl font-light text-neutral-900">Nie znaleziono rezerwacji</h1>
        <p className="text-neutral-500 text-sm">Link jest nieprawidłowy lub wygasł.</p>
        <Button asChild><Link to="/">Strona główna</Link></Button>
      </div>
    );
  }

  const dateObj = parseISO(booking.booking_date);
  const isCancelled = booking.status === 'cancelled';
  const isConfirmed = booking.status === 'confirmed';
  const canDecide = !isCancelled && booking.status !== 'completed' && booking.status !== 'no_show';

  return (
    <div className="max-w-md mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
      <div className="text-center">
        <h1 className="text-3xl font-light text-neutral-900 mb-2">Zarządzaj wizytą</h1>
        <p className="text-neutral-500 text-sm">
          {isCancelled
            ? 'Ta wizyta została anulowana.'
            : isConfirmed
              ? 'Wizyta jest potwierdzona. Nadal możesz ją anulować.'
              : 'Potwierdź termin albo anuluj wizytę.'}
        </p>
      </div>

      <div className="space-y-6 rounded-2xl border border-[#e4e2dc] bg-white p-6 sm:p-8">
        <div>
          <p className="text-[11px] uppercase font-bold text-neutral-500 mb-1 tracking-widest">Status</p>
          <div className="inline-flex items-center px-3 py-1 rounded-xl text-[10px] font-bold bg-neutral-100 text-neutral-900 uppercase tracking-wider">
            {statusLabel[booking.status] || booking.status}
          </div>
        </div>

        <div>
          <p className="text-[11px] uppercase font-bold text-neutral-500 mb-1 tracking-widest">Termin</p>
          <p className="font-medium text-lg text-neutral-900 capitalize">
            {format(dateObj, 'EEEE, d MMMM yyyy', { locale: pl })}{' '}
            {booking.end_time && booking.end_time !== booking.start_time
              ? `${booking.start_time}–${booking.end_time}`
              : booking.start_time}
          </p>
        </div>

        <div>
          <p className="text-[11px] uppercase font-bold text-neutral-500 mb-1 tracking-widest">Dane pacjenta</p>
          <p className="font-medium text-neutral-900">{booking.patient_name}</p>
          <p className="text-neutral-500 text-sm">{booking.patient_email}</p>
        </div>

        {canDecide && (
          <div className="pt-6 border-t border-neutral-100 grid gap-3">
            {!isConfirmed && (
              <Button onClick={handleConfirm} disabled={working !== null} className="w-full h-12">
                {working === 'confirm' ? 'Potwierdzanie...' : 'Potwierdź wizytę'}
              </Button>
            )}
            <Button variant="outline" onClick={handleCancel} disabled={working !== null} className="w-full h-12 text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200">
              {working === 'cancel' ? 'Anulowanie...' : 'Anuluj wizytę'}
            </Button>
          </div>
        )}
      </div>

      <div className="text-center">
        <Link to="/" className="text-xs font-bold text-neutral-900 uppercase tracking-widest hover:text-neutral-600 underline underline-offset-4">Wróć na stronę główną</Link>
      </div>
    </div>
  );
}
