import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBooking } from './BookingContext';
import { ChevronLeft } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export default function PatientForm() {
  const { state, updateState } = useBooking();
  const navigate = useNavigate();
  const [formData, setFormData] = useState(state.patient);

  if (!state.date || !state.time) {
    navigate('/');
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Honeypot check
    const websiteField = (e.target as HTMLFormElement).elements.namedItem('website') as HTMLInputElement;
    if (websiteField && websiteField.value !== '') {
      // Spam detected, silently redirect or show error
      console.warn("Spam detected.");
      navigate('/');
      return;
    }

    updateState({ patient: formData });
    navigate('/summary');
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-md mx-auto w-full">
      <div className="text-center relative">
        <button onClick={() => navigate(-1)} className="absolute left-0 top-1/2 -translate-y-1/2 text-sm text-neutral-500 hover:text-neutral-900 inline-flex items-center gap-1 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-light text-neutral-900 mb-2">Twoje dane</h1>
        <p className="text-neutral-500 text-sm">Wprowadź dane kontaktowe.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-brand-100 p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-4">
           <div>
             <label htmlFor="name" className="block text-[11px] uppercase font-bold text-neutral-500 tracking-widest mb-1.5">Imię i nazwisko</label>
             <input
               type="text"
               id="name"
               required
               value={formData.name}
               onChange={e => setFormData({ ...formData, name: e.target.value })}
               className="w-full h-12 px-4 rounded-xl border border-neutral-200 bg-white text-neutral-900 focus:bg-brand-50 focus:border-brand-600 focus:ring-1 focus:ring-brand-600 outline-none transition-all text-sm"
             />
           </div>

           {/* Honeypot field for basic spam protection */}
           <div className="hidden" aria-hidden="true">
             <label htmlFor="website">Strona WWW (nie wypełniaj)</label>
             <input type="text" id="website" tabIndex={-1} autoComplete="off" />
           </div>

           <div>
             <label htmlFor="email" className="block text-[11px] uppercase font-bold text-neutral-500 tracking-widest mb-1.5">Adres e-mail</label>
             <input
               type="email"
               id="email"
               required
               value={formData.email}
               onChange={e => setFormData({ ...formData, email: e.target.value })}
               className="w-full h-12 px-4 rounded-xl border border-neutral-200 bg-white text-neutral-900 focus:bg-brand-50 focus:border-brand-600 focus:ring-1 focus:ring-brand-600 outline-none transition-all text-sm"
             />
           </div>
           <div>
             <label htmlFor="phone" className="block text-[11px] uppercase font-bold text-neutral-500 tracking-widest mb-1.5">Numer telefonu</label>
             <input
               type="tel"
               id="phone"
               required
               value={formData.phone}
               onChange={e => setFormData({ ...formData, phone: e.target.value })}
               className="w-full h-12 px-4 rounded-xl border border-neutral-200 bg-white text-neutral-900 focus:bg-brand-50 focus:border-brand-600 focus:ring-1 focus:ring-brand-600 outline-none transition-all text-sm"
             />
           </div>
         </div>

         <div className="pt-4">
           <Button type="submit" className="w-full h-14" size="lg">Przejdź do podsumowania</Button>
         </div>
        </form>
      </div>
    </div>
  );
}
