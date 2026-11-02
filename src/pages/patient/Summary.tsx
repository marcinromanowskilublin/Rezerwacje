import { useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useBooking } from './BookingContext';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { ChevronLeft } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { bookingApi } from '../../services/bookingApi';
import { slotRange } from '../../lib/schedule';
import { formatZl, visitPriceZl } from '../../config/site';

export default function Summary() {
  const { state, reset } = useBooking();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittedRef = useRef(false);

  if ((!state.visitType || !state.date || !state.time || !state.patient.name) && !submittedRef.current) {
    return <Navigate to="/" replace />;
  }

  const dateObj = parseISO(state.date);

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const booking = await bookingApi.createBooking({
        visit_type_id: state.visitType!.id,
        booking_date: state.date!,
        start_time: state.time!,
        patient_name: state.patient.name,
        patient_email: state.patient.email,
        patient_phone: state.patient.phone,
        payment_status: 'unpaid',
      });

      submittedRef.current = true;
      navigate('/confirmation', { state: { booking } });
      reset();
    } catch (err: any) {
      setError(err.message || 'Wystąpił błąd podczas rezerwacji.');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-md mx-auto w-full">
      <div className="text-center relative">
        <button onClick={() => navigate(-1)} className="absolute left-0 top-1/2 -translate-y-1/2 text-sm text-neutral-500 hover:text-neutral-900 inline-flex items-center gap-1 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-light text-neutral-900 mb-2">Podsumowanie</h1>
        <p className="text-neutral-500 text-sm">Sprawdź dane i zarezerwuj.</p>
      </div>

      <div className="flex flex-col space-y-8 rounded-2xl border border-[#e4e2dc] bg-white p-6 sm:p-8">
        <div>
          <h3 className="text-[11px] font-bold text-neutral-500 uppercase tracking-[0.2em] mb-4">Szczegóły wizyty</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-neutral-200">
              <span className="text-neutral-500 font-light">Data</span>
              <span className="font-medium text-right capitalize text-neutral-900">{format(dateObj, 'd MMMM yyyy', { locale: pl })}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-neutral-200">
              <span className="text-neutral-500 font-light">Godzina</span>
              <span className="font-medium text-right text-neutral-900">{slotRange(state.time, state.visitType.duration_minutes)}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-neutral-200">
              <span className="text-neutral-500 font-light">Długość</span>
              <span className="font-medium text-right text-neutral-900">{state.visitType.duration_minutes} min</span>
            </div>
            <div className="flex justify-between py-2 border-b border-neutral-200">
              <span className="text-neutral-500 font-light">Wizyta</span>
              <span className="font-medium text-right text-neutral-900">{state.visitType.name} online</span>
            </div>
            <div className="flex justify-between py-2 border-b border-neutral-200">
              <span className="text-neutral-500 font-light">Cena</span>
              <span className="font-medium text-right text-neutral-900">{formatZl(visitPriceZl(state.visitType.kind, state.visitType.price))}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-neutral-500 font-light">Pacjent</span>
              <span className="font-medium text-right text-neutral-900">{state.patient.name}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl text-xs border border-red-100">
            {error}
          </div>
        )}

        <div className="mt-auto pt-4">
           <Button onClick={handleConfirm} disabled={loading} className="w-full h-14" size="lg">
             {loading ? 'Zapisywanie...' : 'Zarezerwuj wizytę'}
           </Button>
        </div>
      </div>
    </div>
  );
}
