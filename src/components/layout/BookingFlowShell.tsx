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
    <div className="min-h-screen bg-gradient-to-b from-brand-50 to-white font-sans text-neutral-900 selection:bg-brand-200 flex flex-col">
      <header className="px-4 md:px-8 pt-4 pb-2 sticky top-0 z-10 bg-gradient-to-b from-brand-50 via-brand-50/95 to-transparent">
        <div className="max-w-md mx-auto w-full flex items-center gap-3">
          {!isConfirmation && (
            <div className="flex-1 flex gap-1.5" aria-hidden="true">
              {STEPS.slice(0, 5).map((step, i) => (
                <div
                  key={step}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    i <= currentStep ? 'bg-brand-600' : 'bg-brand-100'
                  }`}
                />
              ))}
            </div>
          )}
          {isConfirmation && <div className="flex-1" />}
          <Link
            to="/"
            className="w-9 h-9 shrink-0 rounded-xl bg-white border border-brand-100 shadow-sm flex items-center justify-center text-neutral-500 hover:text-brand-700 hover:border-brand-300 transition-colors"
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
