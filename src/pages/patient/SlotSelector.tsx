import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingApi } from '../../services/bookingApi';
import { useBooking } from './BookingContext';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { ChevronLeft } from 'lucide-react';
import { slotRange } from '../../lib/schedule';

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
        setSlots(Array.isArray(s) ? s : []);
        setLoading(false);
      })
      .catch(() => {
        setSlots([]);
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
        <button onClick={() => navigate(-1)} className="absolute left-0 top-1/2 -translate-y-1/2 text-sm text-neutral-500 hover:text-neutral-900 inline-flex items-center gap-1 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-light text-neutral-900 mb-2">Wybierz godzinę</h1>
        <p className="text-neutral-500 text-sm capitalize">
          {format(dateObj, 'EEEE, d MMMM yyyy', { locale: pl })}
          {state.visitType ? ` · ${state.visitType.duration_minutes} min · online` : ''}
        </p>
      </div>

      <div className="space-y-6 rounded-2xl border border-[#e4e2dc] bg-white p-6 sm:p-8">
        <div>
          <p className="text-[11px] uppercase font-bold text-neutral-500 mb-4 tracking-widest">Krok 3: Godzina</p>
          
          {loading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 animate-pulse">
              {[1,2,3,4,5,6].map(i => <div key={i} className="h-10 bg-neutral-50 rounded-xl border border-neutral-200"></div>)}
            </div>
          ) : slots.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-neutral-500 text-sm">Brak dostępnych godzin w tym dniu.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {slots.map(time => (
                <button
                  key={time}
                  onClick={() => handleSelect(time)}
                  className="py-3 px-2 border border-neutral-200 rounded-xl text-center text-sm font-medium hover:border-[#007865] hover:bg-[#e7f4f1] hover:text-[#007865] cursor-pointer transition-all text-neutral-900"
                >
                  {state.visitType ? slotRange(time, state.visitType.duration_minutes) : time}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
