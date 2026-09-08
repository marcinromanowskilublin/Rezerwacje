import { useEffect, useState } from 'react';
import { bookingApi } from '../../services/bookingApi';
import { Booking, AvailabilityRule, BookingStatus } from '../../types';
import { format, parseISO, startOfToday } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Button } from '../../components/ui/Button';
import { AdminAssistant } from '../../components/admin/AdminAssistant';

export default function AdminDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const today = format(startOfToday(), 'yyyy-MM-dd');

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = () => {
    setLoading(true);
    bookingApi.getBookings(today).then(b => {
      const sorted = b.sort((a, b) => a.start_time.localeCompare(b.start_time));
      setBookings(sorted);
      setLoading(false);
    });
  };

  const cancelBooking = async (id: string) => {
    if(!confirm('Anulować wizytę?')) return;
    await bookingApi.cancelBooking(id);
    loadBookings();
  };

  const updateStatus = async (id: string, status: BookingStatus) => {
    await bookingApi.updateBookingStatus(id, status);
    loadBookings();
  };

  const blockHour = async () => {
    const time = prompt("Podaj godzinę do zablokowania na dzisiaj (np. 12:00):");
    if (!time) return;
    await bookingApi.blockPeriod({
      date: today,
      start_time: time,
      end_time: time.replace(/:\d\d/, ':59'),
      reason: 'Ręczna blokada'
    });
    alert('Zablokowano.');
    // Not explicitly rendering blocked slots in list for MVP brevity
  };
  
  const handleSimulatedAction = (action: string) => {
    if (action === 'block') {
      setTimeout(() => alert("Demo: Termin zablokowany z poziomu asystenta AI."), 500);
    } else if (action === 'book') {
      setTimeout(() => alert("Demo: Okno nowej rezerwacji otwarte z danymi pacjentki (np. Anna)."), 500);
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full max-w-4xl mx-auto">
      
      <div className="mb-6">
        <AdminAssistant onSimulatedAction={handleSimulatedAction} />
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-light text-neutral-900 mb-1">Terminarz</h1>
          <p className="text-neutral-500 text-sm capitalize">{format(startOfToday(), 'EEEE, d MMMM yyyy', { locale: pl })}</p>
        </div>
        <div className="flex gap-2">
           <Button onClick={blockHour} variant="outline" className="h-10 text-xs">Zablokuj termin</Button>
           <Button className="h-10 text-xs">+ Nowa wizyta</Button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-neutral-500">Wczytywanie...</div>
        ) : bookings.length === 0 ? (
          <div className="p-8 text-center text-neutral-500">Brak wizyt na dzisiaj.</div>
        ) : (
          <div className="divide-y divide-neutral-200">
            {bookings.map(b => (
              <div key={b.id} className="p-6 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center hover:bg-neutral-50 transition-colors">
                <div className="space-y-1 w-full">
                  <div className="flex items-center gap-4">
                    <span className="font-bold text-lg text-neutral-900 w-16 shrink-0">{b.start_time}</span>
                    <span className="font-medium text-neutral-900">{b.patient_name}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500 md:pl-20">
                    <span>{b.patient_phone}</span>
                    <span className="hidden md:inline">•</span>
                    <select 
                      value={b.status} 
                      onChange={(e) => updateStatus(b.id, e.target.value as BookingStatus)}
                      className="bg-neutral-100 border border-neutral-200 rounded-md px-2 py-1 font-medium capitalize outline-none cursor-pointer text-neutral-900"
                    >
                      <option value="pending">Oczekująca</option>
                      <option value="confirmed">Potwierdzona</option>
                      <option value="completed">Zakończona</option>
                      <option value="no_show">Nieobecność</option>
                      <option value="cancelled">Anulowana</option>
                    </select>
                    <span className="hidden md:inline">•</span>
                    <span className="uppercase tracking-widest text-[10px] font-bold">{b.payment_status.replace('_', ' ')}</span>
                  </div>
                </div>
                {b.status !== 'cancelled' && (
                  <div className="md:pl-0 shrink-0 self-end md:self-center">
                    <Button variant="outline" size="sm" onClick={() => cancelBooking(b.id)} className="text-red-600 hover:text-red-600 border-neutral-200 hover:border-red-300 hover:bg-red-50 text-xs h-8">
                      Anuluj
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
