import { Outlet, Link } from 'react-router-dom';

export default function SiteLayout() {
  return (
    <div className="min-h-screen bg-cream font-sans text-ink selection:bg-brand-200 flex flex-col">
      <header className="h-20 px-4 md:px-8 flex items-center justify-between bg-cream/80 backdrop-blur-md border-b border-brand-900/[0.06] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-800 flex items-center justify-center text-white font-display italic text-xl shadow-[0_6px_16px_-4px_rgba(26,71,54,0.45)]">ψ</div>
            <span className="font-display text-xl tracking-wide text-ink hidden sm:inline-block">Marcin Romanowski</span>
          </Link>
          <div className="flex space-x-6 text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">
             <Link to="/" className="text-brand-700 border-b-2 border-brand-600 py-7">Gabinet</Link>
             <Link to="/admin" className="py-7 hover:text-brand-700 transition-colors hidden sm:block">Admin</Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 py-8 md:py-14">
        <Outlet />
      </main>

      <footer className="h-14 bg-cream border-t border-brand-900/[0.06] px-4 md:px-8 flex items-center justify-between text-[10px] text-neutral-500 uppercase tracking-[0.2em] mt-auto">
        <span>&copy; {new Date().getFullYear()} Marcin Romanowski</span>
        <span>Rezerwacja Wizyt</span>
      </footer>
    </div>
  );
}
