import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingApi } from '../../services/bookingApi';
import { useBooking } from './BookingContext';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { ChevronLeft } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export default function SlotSelector() {
  const { state, updateState } = useBooking();
  const navigate = useNavigate();
  const [slots, setSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!state.visitType || !state.date) {
      navigate('/');
      return;
    }
    setLoading(true);
    bookingApi.getAvailableSlots(state.date, state.visitType.id)
      .then(s => {
        setSlots(s);
        setLoading(false);
      });
  }, [state.date, state.visitType, navigate]);

  const handleSelect = (time: string) => {
    updateState({ time });
    navigate('/form');
  };

  if (!state.date) return null;

  const dateObj = parseISO(state.date);

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-md mx-auto w-full">
      <div className="text-center relative">
        <button onClick={() => navigate(-1)} className="absolute left-0 top-1/2 -translate-y-1/2 text-sm text-neutral-500 hover:text-brand-700 inline-flex items-center gap-1 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="font-display text-3xl sm:text-4xl text-ink mb-2">Wybierz godzinę</h1>
        <p className="text-neutral-500 text-sm capitalize">
          {format(dateObj, 'EEEE, d MMMM yyyy', { locale: pl })}
        </p>
      </div>

      <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-[0_12px_36px_-18px_rgba(28,33,29,0.15)] border border-brand-900/[0.06] p-7 sm:p-9">
        {loading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 animate-pulse">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-10 bg-neutral-50 rounded-2xl border border-neutral-200"></div>)}
          </div>
        ) : slots.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-neutral-500 text-sm">Brak dostępnych godzin w tym dniu.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {slots.map(time => (
              <button
                key={time}
                onClick={() => handleSelect(time)}
                className="py-3 px-2 border border-neutral-200/80 rounded-2xl text-center text-xs font-medium hover:border-brand-600 hover:bg-brand-50 hover:text-brand-700 hover:shadow-[0_6px_18px_-8px_rgba(47,138,96,0.35)] cursor-pointer transition-all text-ink"
              >
                {time}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
