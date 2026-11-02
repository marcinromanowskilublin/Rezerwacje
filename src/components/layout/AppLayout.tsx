import { useEffect } from 'react';
import { Outlet, Link, NavLink, useLocation } from 'react-router-dom';
import { formatNip, formatRegon, fullAddress, site } from '../../config/site';
import { bookingApi } from '../../services/bookingApi';

let pageViewRecorded = false;

export default function AppLayout() {
  const location = useLocation();

  useEffect(() => {
    const isPrivacy = location.pathname === '/polityka-prywatnosci';
    const isTerms = location.pathname === '/zasady-rezerwacji';
    const isPrivateRoute = location.pathname.startsWith('/admin') || location.pathname.startsWith('/manage');
    const isBookingStart = location.pathname === '/';

    const title = isPrivacy
      ? `Polityka prywatności — ${site.officeDisplayName}`
      : isTerms
        ? `Zasady rezerwacji — ${site.officeDisplayName}`
        : `Psychiatra Lublin — ${site.officeDisplayName} | Rezerwacja`;
    const description = isPrivacy
      ? `Informacje o przetwarzaniu danych przez ${site.businessName}.`
      : isTerms
        ? `Zasady rezerwacji wizyt u ${site.officeDisplayName}.`
        : `Umów wizytę u ${site.officeDisplayName}, specjalisty psychiatrii w Lublinie.`;
    const canonical = isPrivacy
      ? `${site.canonicalUrl}polityka-prywatnosci`
      : isTerms
        ? `${site.canonicalUrl}zasady-rezerwacji`
        : site.canonicalUrl;

    document.title = title;
    document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', description);
    document
      .querySelector<HTMLMetaElement>('meta[name="robots"]')
      ?.setAttribute('content', isPrivateRoute || (!isBookingStart && !isPrivacy && !isTerms) ? 'noindex, follow' : 'index, follow, max-image-preview:large');
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute('href', canonical);
  }, [location.pathname]);

  useEffect(() => {
    const isPrivateRoute =
      location.pathname.startsWith('/admin') || location.pathname.startsWith('/manage');
    if (pageViewRecorded || isPrivateRoute) {
      return;
    }

    pageViewRecorded = true;
    void bookingApi.recordPageView().catch(() => undefined);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-[#f4f3ef] font-sans text-neutral-900 selection:bg-[#d4efe8]">
      <header className="sticky top-0 z-20 border-b border-[#dfddd6] bg-[#f4f3ef]/95 px-5 py-3.5 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <Link
            to="/"
            aria-label={`${site.businessName} — rezerwacja wizyty`}
            className="flex min-w-0 items-start gap-3"
          >
            <img
              src={site.portraitSrc}
              alt=""
              width={44}
              height={44}
              className="mt-0.5 h-11 w-11 shrink-0 rounded-full object-cover object-top ring-1 ring-[#d8d4cc]"
            />
            <span className="min-w-0 leading-tight">
              <span className="block text-[11px] font-medium tracking-[0.04em] text-neutral-500">
                {site.practiceKind}
              </span>
              <span className="mt-0.5 block text-sm font-medium text-[#007865] sm:text-[15px]">
                {site.officeName}
              </span>
              <span className="mt-1 block text-[11px] leading-4 text-neutral-500">
                {fullAddress()}
              </span>
              <span className="mt-0.5 block text-[11px] leading-4 text-neutral-500">
                NIP {formatNip()} · REGON {formatRegon()} · PWZ {site.pwz}
              </span>
            </span>
          </Link>
          <div className="order-3 w-full border-t border-[#e5e2db] pt-3 lg:order-none lg:w-auto lg:border-0 lg:pt-0">
            <nav aria-label="Główne sekcje" className="flex items-center gap-x-5 overflow-x-auto pb-0.5 text-[11px] font-medium text-neutral-500 sm:gap-x-6 sm:text-xs">
              <span className="shrink-0 text-[#007865]" aria-current="page">Rezerwacja</span>
              {['Aktualności', 'O mnie', 'Oferta', 'ADHD', 'Dokumenty'].map((item) => (
                <span key={item} className="shrink-0 cursor-default select-none" aria-disabled="true">
                  {item}
                </span>
              ))}
            </nav>
          </div>
          <NavLink
            to="/admin/login"
            className="shrink-0 rounded-full border border-[#d8d5ce] px-3.5 py-1.5 text-[11px] font-medium text-neutral-600 transition-colors hover:border-[#007865] hover:text-[#007865]"
          >
            Panel
          </NavLink>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-9 sm:py-12 lg:py-16">
        <Outlet />
      </main>

      <footer className="mt-auto border-t border-[#e4e2dc] bg-[#f4f3ef] px-5 py-7">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#007865]">{site.businessName}</p>
            <p className="mt-1 text-xs leading-5 text-neutral-500">{fullAddress()}</p>
            <p className="mt-1 text-xs leading-5 text-neutral-500">
              NIP {formatNip()} · REGON {formatRegon()} · PWZ {site.pwz}
            </p>
            <p className="mt-1 text-xs leading-5 text-neutral-500">
              Tytuł zawodowy: {site.professionalTitle} ({site.titleCountry})
            </p>
            <p className="mt-1 text-xs leading-5 text-neutral-500">
              {site.pwzRegister}, {site.pwzRegisterAuthority}
            </p>
            <p className="mt-1 text-xs leading-5 text-neutral-500">
              <a
                className="transition-colors hover:text-[#007865]"
                href={site.chamberUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {site.chamberName}
              </a>
              {' · '}
              {site.licensingRegister}, organ: {site.licensingAuthority}
            </p>
            <p className="mt-1 text-xs leading-5 text-neutral-500">
              <a className="transition-colors hover:text-[#007865]" href={`mailto:${site.privacyEmail}`}>
                {site.privacyEmail}
              </a>
              {' · '}
              <a
                className="transition-colors hover:text-[#007865]"
                href={site.ethicsCodeUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {site.ethicsCodeName}
              </a>
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <nav aria-label="Informacje prawne" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
              <Link className="transition-colors hover:text-[#007865]" to="/polityka-prywatnosci">
                Prywatność
              </Link>
              <Link className="transition-colors hover:text-[#007865]" to="/zasady-rezerwacji">
                Zasady rezerwacji
              </Link>
            </nav>
            <p className="text-xs text-neutral-400">{site.domain}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
