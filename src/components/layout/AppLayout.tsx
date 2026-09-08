import { Outlet, Link } from 'react-router-dom';

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-white font-sans text-neutral-900 selection:bg-neutral-200 flex flex-col">
      <header className="h-16 px-4 md:px-8 flex items-center justify-between bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-neutral-900 flex items-center justify-center text-white font-serif italic text-xl">ψ</div>
            <span className="font-light text-lg tracking-wide text-neutral-900 hidden sm:inline-block">Marcin Romanowski</span>
          </Link>
          <div className="flex space-x-6 text-sm font-medium uppercase tracking-widest text-neutral-500">
             <span className="text-neutral-900 border-b-2 border-neutral-900 py-5">Rezerwacja</span>
             <Link to="/admin" className="py-5 hover:text-neutral-900 transition-colors hidden sm:block">Admin</Link>
          </div>
        </div>
      </header>
      
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 py-8 md:py-12">
        <Outlet />
      </main>
      
      <footer className="h-12 bg-white border-t border-neutral-100 px-4 md:px-8 flex items-center justify-between text-[10px] text-neutral-500 uppercase tracking-widest mt-auto">
        <span>&copy; {new Date().getFullYear()} Marcin Romanowski</span>
        <span>Rezerwacja Wizyt</span>
      </footer>
    </div>
  );
}
