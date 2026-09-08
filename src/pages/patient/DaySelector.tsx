import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingApi } from '../../services/bookingApi';
import { useBooking } from './BookingContext';
import { Button } from '../../components/ui/Button';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, isBefore, startOfToday } from 'date-fns';
import { pl } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../components/ui/Button';

export default function DaySelector() {
  const { state, updateState } = useBooking();
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!state.visitType) {
      navigate('/');
      return;
    }
    setLoading(true);
    bookingApi.getAvailableDays(state.visitType.id, currentMonth.getMonth() + 1, currentMonth.getFullYear())
      .then(days => {
        setAvailableDays(days);
        setLoading(false);
      });
  }, [currentMonth, state.visitType, navigate]);

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  });

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => {
    const prev = subMonths(currentMonth, 1);
    if (!isBefore(prev, startOfMonth(new Date()))) {
      setCurrentMonth(prev);
    }
  };

  const handleSelectDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    if (availableDays.includes(dateStr)) {
      updateState({ date: dateStr });
      navigate('/slot');
    }
  };

  const isPrevDisabled = isBefore(subMonths(currentMonth, 1), startOfMonth(new Date()));

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-md mx-auto w-full">
      <div className="text-center relative">
        <button onClick={() => navigate(-1)} className="absolute left-0 top-1/2 -translate-y-1/2 text-sm text-neutral-500 hover:text-neutral-900 inline-flex items-center gap-1 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-light text-neutral-900 mb-2">Wybierz dzień</h1>
        <p className="text-neutral-500 text-sm">{state.visitType?.name}</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 sm:p-8 space-y-8">
        <div>
          <p className="text-[11px] uppercase font-bold text-neutral-500 mb-4 tracking-widest">Krok 2: Wybierz termin</p>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-semibold capitalize text-neutral-900">
              {format(currentMonth, 'LLLL yyyy', { locale: pl })}
            </h2>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" onClick={prevMonth} disabled={isPrevDisabled} className="w-8 h-8 rounded-xl border-neutral-200">
                <ChevronLeft className="w-4 h-4 text-neutral-500" />
              </Button>
              <Button variant="outline" size="icon" onClick={nextMonth} className="w-8 h-8 rounded-xl border-neutral-200">
                <ChevronRight className="w-4 h-4 text-neutral-500" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-y-2 gap-x-2 text-center text-[10px] font-bold text-neutral-500 mb-2">
            {['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'].map(day => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-2 gap-x-2 text-sm">
            {Array.from({ length: (days[0].getDay() + 6) % 7 }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            
            {days.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const isAvailable = availableDays.includes(dateStr);
              const isPast = isBefore(day, startOfToday());
              
              return (
                <button
                  key={day.toString()}
                  disabled={!isAvailable || isPast}
                  onClick={() => handleSelectDay(day)}
                  className={cn(
                    "aspect-square flex items-center justify-center rounded-lg text-sm transition-all relative",
                    isAvailable && !isPast
                      ? "hover:bg-neutral-50 text-neutral-900 font-medium cursor-pointer hover:text-neutral-900"
                      : "text-[#374151] cursor-not-allowed",
                    isToday(day) && !isPast && "after:absolute after:bottom-1 after:w-1 after:h-1 after:bg-[#64A377] after:rounded-xl"
                  )}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
