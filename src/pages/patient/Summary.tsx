import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBooking } from './BookingContext';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { ChevronLeft } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { bookingApi } from '../../services/bookingApi';
import { mockPaymentProvider } from '../../providers/PaymentProvider';

export default function Summary() {
  const { state, reset } = useBooking();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('blik');
  const [error, setError] = useState<string | null>(null);

  if (!state.visitType || !state.date || !state.time || !state.patient.name) {
    navigate('/');
    return null;
  }

  const dateObj = parseISO(state.date);
  const policy = state.visitType.payment_policy;

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
        payment_status: paymentMethod === 'later' ? 'unpaid' : 'pending'
      });

      if (paymentMethod !== 'later' && policy !== 'none') {
        // Trigger payment
        const payResult = await mockPaymentProvider.createPayment(booking.id, state.visitType!.price, paymentMethod);
        if (payResult.success) {
          await bookingApi.updateBookingStatus(booking.id, 'confirmed');
        }
      } else {
        await bookingApi.updateBookingStatus(booking.id, 'confirmed');
      }

      navigate('/confirmation', { state: { booking } });
      reset();
    } catch (err: any) {
      setError(err.message || "Wystąpił błąd podczas rezerwacji.");
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

      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 sm:p-8 space-y-8 flex flex-col">
        <div>
          <h3 className="text-[11px] font-bold text-neutral-500 uppercase tracking-[0.2em] mb-4">Szczegóły wizyty</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-neutral-200">
              <span className="text-neutral-500 font-light">Data</span>
              <span className="font-medium text-right capitalize text-neutral-900">{format(dateObj, 'd MMMM yyyy', { locale: pl })}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-neutral-200">
              <span className="text-neutral-500 font-light">Godzina</span>
              <span className="font-medium text-right text-neutral-900">{state.time}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-neutral-200">
              <span className="text-neutral-500 font-light">Usługa</span>
              <span className="font-medium text-right text-neutral-900">{state.visitType.name}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-neutral-200">
              <span className="text-neutral-500 font-light">Pacjent</span>
              <span className="font-medium text-right text-neutral-900">{state.patient.name}</span>
            </div>
            <div className="flex justify-between py-2 mt-4">
              <span className="text-lg font-light text-neutral-900">Do zapłaty</span>
              <span className="text-lg font-bold text-neutral-900 uppercase">{state.visitType.price} {state.visitType.currency}</span>
            </div>
          </div>
        </div>

        {policy !== 'none' && (
          <div className="pt-2">
            <p className="text-[11px] uppercase font-bold text-neutral-500 mb-4 tracking-widest text-center">Formy płatności</p>
            <div className="grid gap-3">
              <button 
                onClick={() => setPaymentMethod('blik')}
                className={`h-12 rounded-xl border flex items-center justify-center transition-all ${paymentMethod === 'blik' ? 'border-neutral-900 bg-neutral-50 ring-1 ring-neutral-900' : 'border-neutral-200 bg-white hover:border-neutral-900'}`}
              >
                <div className="font-bold text-neutral-900 text-sm">BLIK</div>
              </button>
              
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setPaymentMethod('transfer')}
                  className={`h-12 rounded-xl border flex items-center justify-center transition-all ${paymentMethod === 'transfer' ? 'border-neutral-900 bg-neutral-50 ring-1 ring-neutral-900' : 'border-neutral-200 bg-white hover:border-neutral-900'}`}
                >
                  <span className="font-bold text-[11px] uppercase tracking-wider text-neutral-900">Przelew</span>
                </button>
                <button 
                  onClick={() => setPaymentMethod('card')}
                  className={`h-12 rounded-xl border flex items-center justify-center transition-all ${paymentMethod === 'card' ? 'border-neutral-900 bg-neutral-50 ring-1 ring-neutral-900' : 'border-neutral-200 bg-white hover:border-neutral-900'}`}
                >
                  <span className="font-bold text-[11px] uppercase tracking-wider text-neutral-900">Karta</span>
                </button>
              </div>

              {policy === 'optional' && (
                <button 
                  onClick={() => setPaymentMethod('later')}
                  className={`h-12 rounded-xl border flex items-center justify-center mt-2 transition-all ${paymentMethod === 'later' ? 'border-neutral-900 bg-neutral-50 ring-1 ring-neutral-900' : 'border-neutral-200 bg-neutral-50 hover:border-neutral-900'}`}
                >
                  <span className="font-bold text-[11px] uppercase tracking-wider text-neutral-500">Zapłacę później</span>
                </button>
              )}
            </div>
            <p className="text-[10px] text-center text-neutral-500 mt-4 leading-relaxed">
              Bezpieczne płatności realizowane po potwierdzeniu terminu.
            </p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl text-xs border border-red-100">
            {error}
          </div>
        )}

        <div className="mt-auto pt-4">
           <Button onClick={handleConfirm} disabled={loading} className="w-full h-14" size="lg">
             {loading ? 'Przetwarzanie...' : (paymentMethod === 'later' || policy === 'none' ? 'Zarezerwuj wizytę' : 'Zapłać i zarezerwuj')}
           </Button>
        </div>
      </div>
    </div>
  );
}
