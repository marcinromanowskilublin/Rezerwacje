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
        <h1 className="text-3xl font-light text-neutral-900 mb-2">Rodzaj wizyty</h1>
        <p className="text-neutral-500 text-sm">Wybierz rodzaj konsultacji.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-brand-100 p-6 sm:p-8">
        <div className="grid gap-3">
          {visitTypes.map(vt => (
             <div
               key={vt.id}
               onClick={() => handleSelect(vt)}
               className="flex items-center justify-between p-4 rounded-xl border border-neutral-200 hover:bg-brand-50 hover:border-brand-600 cursor-pointer transition-all group"
             >
               <div className="space-y-1 text-left">
                 <p className="font-medium text-sm text-neutral-900">{vt.name}</p>
                 <p className="text-xs text-neutral-500">{vt.duration_minutes} min • {vt.price} {vt.currency}</p>
               </div>
               <div className="w-5 h-5 rounded-full border border-neutral-200 group-hover:border-brand-600 group-hover:bg-brand-600 transition-colors"></div>
             </div>
          ))}
        </div>
      </div>
    </div>
  );
}
