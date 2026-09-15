import { Outlet, Link, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';

const STEPS = ['/start', '/day', '/slot', '/form', '/summary', '/confirmation'];

export default function BookingFlowShell() {
  const { pathname } = useLocation();
  const base = import.meta.env.PROD ? '/rezerwacja' : '';
  const relativePath = base && pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
  const currentStep = STEPS.indexOf(relativePath);
  const isConfirmation = relativePath === '/confirmation';

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 via-cream to-cream font-sans text-ink selection:bg-brand-200 flex flex-col">
      <header className="px-4 md:px-8 pt-5 pb-3 sticky top-0 z-10 bg-cream/70 backdrop-blur-md">
        <div className="max-w-md mx-auto w-full flex items-center gap-3">
          {!isConfirmation && (
            <div className="flex-1 flex gap-1.5" aria-hidden="true">
              {STEPS.slice(0, 5).map((step, i) => (
                <div
                  key={step}
                  className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                    i <= currentStep ? 'bg-brand-600 shadow-[0_0_8px_rgba(47,138,96,0.5)]' : 'bg-brand-900/10'
                  }`}
                />
              ))}
            </div>
          )}
          {isConfirmation && <div className="flex-1" />}
          <Link
            to="/"
            className="w-10 h-10 shrink-0 rounded-full bg-white/80 border border-brand-900/[0.06] shadow-[0_4px_14px_-4px_rgba(26,71,54,0.2)] flex items-center justify-center text-neutral-500 hover:text-brand-700 hover:border-brand-300 transition-colors"
            aria-label="Zamknij i wróć na stronę główną"
          >
            <X className="w-4 h-4" />
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-md w-full mx-auto p-4 pb-12 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
