import { Outlet, Link } from 'react-router-dom';

export default function SiteLayout() {
  return (
    <div className="min-h-screen bg-brand-50/40 font-sans text-neutral-900 selection:bg-brand-200 flex flex-col">
      <header className="h-16 px-4 md:px-8 flex items-center justify-between bg-white border-b border-brand-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-serif italic text-xl shadow-sm shadow-brand-900/10">ψ</div>
            <span className="font-light text-lg tracking-wide text-neutral-900 hidden sm:inline-block">Marcin Romanowski</span>
          </Link>
          <div className="flex space-x-6 text-sm font-medium uppercase tracking-widest text-neutral-500">
             <Link to="/" className="text-brand-700 border-b-2 border-brand-600 py-5">Gabinet</Link>
             <Link to="/admin" className="py-5 hover:text-brand-700 transition-colors hidden sm:block">Admin</Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 py-8 md:py-12">
        <Outlet />
      </main>

      <footer className="h-12 bg-white border-t border-brand-100 px-4 md:px-8 flex items-center justify-between text-[10px] text-neutral-500 uppercase tracking-widest mt-auto">
        <span>&copy; {new Date().getFullYear()} Marcin Romanowski</span>
        <span>Rezerwacja Wizyt</span>
      </footer>
    </div>
  );
}
