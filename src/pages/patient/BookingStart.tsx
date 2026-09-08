import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingApi } from '../../services/bookingApi';
import { VisitType } from '../../types';
import { useBooking } from './BookingContext';
import { Button } from '../../components/ui/Button';

export default function BookingStart() {
  const [visitTypes, setVisitTypes] = useState<VisitType[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { updateState } = useBooking();

  useEffect(() => {
    bookingApi.getVisitTypes().then(types => {
      setVisitTypes(types);
      setLoading(false);
    });
  }, []);

  const handleSelect = (vt: VisitType) => {
    updateState({ visitType: vt });
    navigate('/day');
  };

  if (loading) {
    return <div className="animate-pulse flex flex-col space-y-4 mt-8 max-w-md mx-auto w-full">
      <div className="h-24 bg-neutral-200 rounded-xl w-full opacity-50"></div>
      <div className="h-24 bg-neutral-200 rounded-xl w-full opacity-50"></div>
    </div>;
  }

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-md mx-auto w-full">
      <div className="text-center">
        <h1 className="text-3xl font-light text-neutral-900 mb-2">Umów wizytę</h1>
        <p className="text-neutral-500 text-sm">Wybierz rodzaj konsultacji.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 sm:p-8 space-y-6">
        <div>
           <p className="text-[11px] uppercase font-bold text-neutral-500 mb-4 tracking-widest">Krok 1: Rodzaj wizyty</p>
           <div className="grid gap-3">
             {visitTypes.map(vt => (
                <div
                  key={vt.id}
                  onClick={() => handleSelect(vt)}
                  className="flex items-center justify-between p-4 rounded-xl border border-neutral-200 hover:bg-neutral-50 hover:border-neutral-900 cursor-pointer transition-all group"
                >
                  <div className="space-y-1 text-left">
                    <p className="font-medium text-sm text-neutral-900 group-hover:text-neutral-900">{vt.name}</p>
                    <p className="text-xs text-neutral-500">{vt.duration_minutes} min • {vt.price} {vt.currency}</p>
                  </div>
                  <div className="w-5 h-5 rounded-xl border border-neutral-200 group-hover:border-neutral-900"></div>
                </div>
             ))}
           </div>
        </div>
      </div>
    </div>
  );
}
