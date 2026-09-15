import { Link } from 'react-router-dom';
import { CalendarPlus, CalendarDays, ClipboardList, CheckCircle2, ArrowRight } from 'lucide-react';

const STEPS = [
  { icon: CalendarDays, title: 'Wybierz termin', desc: 'Dzień i godzina dopasowane do Twojego kalendarza.' },
  { icon: ClipboardList, title: 'Podaj dane', desc: 'Krótki formularz kontaktowy, bez zbędnych pytań.' },
  { icon: CheckCircle2, title: 'Potwierdź', desc: 'Otrzymasz e-mail z potwierdzeniem i linkiem do wizyty.' },
];

export default function Home() {
  return (
    <div className="relative space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-md mx-auto w-full">
      <div
        className="fixed top-[-8rem] right-[-6rem] w-72 h-72 rounded-full bg-brand-200/40 blur-3xl -z-10 pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="fixed bottom-[-10rem] left-[-8rem] w-80 h-80 rounded-full bg-brand-100/50 blur-3xl -z-10 pointer-events-none"
        aria-hidden="true"
      />

      <div className="text-center">
        <p className="text-brand-700 text-xs font-semibold uppercase tracking-[0.25em] mb-3">Gabinet Psychiatryczny</p>
        <h1 className="font-display text-4xl sm:text-[2.75rem] leading-[1.15] text-ink mb-3">Cześć, w czym mogę pomóc?</h1>
        <p className="text-neutral-500 text-sm">Umów konsultację w kilka minut, bez telefonowania.</p>
      </div>

      <Link
        to="/start"
        className="group block bg-gradient-to-br from-brand-600 to-brand-800 rounded-3xl shadow-[0_20px_40px_-16px_rgba(18,51,40,0.55)] hover:shadow-[0_24px_48px_-12px_rgba(18,51,40,0.6)] hover:-translate-y-0.5 p-7 sm:p-9 text-white transition-all duration-300"
      >
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center mb-4">
              <CalendarPlus className="w-5 h-5" />
            </div>
            <p className="font-display text-xl">Umów wizytę</p>
            <p className="text-xs text-brand-100">Wybierz rodzaj konsultacji i dogodny termin</p>
          </div>
          <ArrowRight className="w-5 h-5 shrink-0 opacity-70 group-hover:translate-x-1 transition-transform" />
        </div>
      </Link>

      <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-[0_12px_36px_-18px_rgba(28,33,29,0.15)] border border-brand-900/[0.06] p-7 sm:p-9 space-y-6">
        <p className="text-[11px] uppercase font-semibold text-neutral-500 tracking-[0.2em]">Jak to działa</p>
        <div className="space-y-5">
          {STEPS.map(({ icon: Icon, title, desc }, i) => (
            <div key={title} className="flex items-start gap-4">
              <div className="w-9 h-9 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-ink">{i + 1}. {title}</p>
                <p className="text-xs text-neutral-500 mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
