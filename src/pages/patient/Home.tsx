import { Link } from 'react-router-dom';
import { CalendarPlus, CalendarDays, ClipboardList, CheckCircle2, ArrowRight } from 'lucide-react';

const STEPS = [
  { icon: CalendarDays, title: 'Wybierz termin', desc: 'Dzień i godzina dopasowane do Twojego kalendarza.' },
  { icon: ClipboardList, title: 'Podaj dane', desc: 'Krótki formularz kontaktowy, bez zbędnych pytań.' },
  { icon: CheckCircle2, title: 'Potwierdź', desc: 'Otrzymasz e-mail z potwierdzeniem i linkiem do wizyty.' },
];

export default function Home() {
  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-md mx-auto w-full">
      <div className="text-center">
        <p className="text-brand-700 text-xs font-bold uppercase tracking-widest mb-2">Gabinet Psychiatryczny</p>
        <h1 className="text-3xl font-light text-neutral-900 mb-2">Cześć, w czym mogę pomóc?</h1>
        <p className="text-neutral-500 text-sm">Umów konsultację w kilka minut, bez telefonowania.</p>
      </div>

      <Link
        to="/start"
        className="group block bg-gradient-to-br from-brand-600 to-brand-700 rounded-2xl shadow-sm shadow-brand-900/20 p-6 sm:p-8 text-white hover:from-brand-700 hover:to-brand-800 transition-all"
      >
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center mb-3">
              <CalendarPlus className="w-5 h-5" />
            </div>
            <p className="text-lg font-medium">Umów wizytę</p>
            <p className="text-xs text-brand-100">Wybierz rodzaj konsultacji i dogodny termin</p>
          </div>
          <ArrowRight className="w-5 h-5 shrink-0 opacity-70 group-hover:translate-x-1 transition-transform" />
        </div>
      </Link>

      <div className="bg-white rounded-2xl shadow-sm border border-brand-100 p-6 sm:p-8 space-y-6">
        <p className="text-[11px] uppercase font-bold text-neutral-500 tracking-widest">Jak to działa</p>
        <div className="space-y-5">
          {STEPS.map(({ icon: Icon, title, desc }, i) => (
            <div key={title} className="flex items-start gap-4">
              <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-900">{i + 1}. {title}</p>
                <p className="text-xs text-neutral-500 mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
