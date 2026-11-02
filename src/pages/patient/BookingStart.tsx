import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingApi } from '../../services/bookingApi';
import { VisitType } from '../../types';
import { useBooking } from './BookingContext';
import { formatZl, site, visitPriceZl } from '../../config/site';
import { config } from '../../config/features';
import SiteContact from '../../components/layout/SiteContact';

export default function BookingStart() {
  const [visitTypes, setVisitTypes] = useState<VisitType[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduleOn, setScheduleOn] = useState<boolean | null>(config.API_MODE === 'production' ? null : true);
  const navigate = useNavigate();
  const { updateState } = useBooking();

  useEffect(() => {
    bookingApi.getVisitTypes().then(types => {
      setVisitTypes(types);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (config.API_MODE !== 'production') return;
    let cancelled = false;
    bookingApi.getSiteStatus()
      .then((status) => {
        if (!cancelled) setScheduleOn(Boolean(status.schedule_enabled));
      })
      .catch(() => {
        if (!cancelled) setScheduleOn(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelect = (vt: VisitType) => {
    updateState({ visitType: vt });
    navigate('/day');
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-3 duration-500">
      <section aria-labelledby="doctor-name" className="grid items-center gap-7 border-b border-[#dfddd6] pb-9 sm:grid-cols-[auto_1fr] sm:gap-9 lg:pb-12">
        <div className="mx-auto h-[148px] w-[148px] overflow-hidden rounded-full bg-[#ebe8e1] ring-1 ring-[#d8d4cc] sm:mx-0 lg:h-[172px] lg:w-[172px]">
          <img
            src={site.portraitSrc}
            alt={site.officeName}
            width={172}
            height={172}
            fetchPriority="high"
            className="h-full w-full object-cover object-top"
          />
        </div>
        <div className="text-center sm:text-left">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-neutral-400">Prywatny gabinet psychiatryczny</p>
          <h1 id="doctor-name" className="mt-3 text-[2rem] font-medium tracking-[-0.04em] text-[#007865] sm:text-[2.35rem] lg:text-[2.7rem]">
            {site.officeDisplayName}
          </h1>
          <p className="mt-2 text-sm text-neutral-500 sm:text-base">{site.officeTitle}</p>
          <p className="mt-4 text-xs leading-6 text-neutral-500 sm:text-sm">
            Konsultacje psychiatryczne online · PWZ {site.pwz}
          </p>
        </div>
      </section>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.85fr)] lg:gap-8">
        <section
          aria-labelledby="visit-type-heading"
          className="rounded-2xl border border-[#dfddd6] bg-white p-5 shadow-[0_18px_50px_rgba(45,42,36,0.04)] sm:p-7"
        >
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
            {scheduleOn === false ? 'Wizyty' : 'Rezerwacja online'}
          </p>
          <h2 id="visit-type-heading" className="mt-2 text-2xl font-medium tracking-[-0.025em] text-neutral-900">
            {scheduleOn === false ? 'Rezerwacja online jest teraz wyłączona.' : 'Wybierz rodzaj wizyty'}
          </h2>

          <div className="mt-6 grid gap-3" aria-busy={loading || scheduleOn === null}>
          {loading || scheduleOn === null ? (
            <>
              <div className="h-[70px] animate-pulse rounded-2xl bg-neutral-100" />
              <div className="h-[70px] animate-pulse rounded-2xl bg-neutral-100" />
            </>
          ) : scheduleOn ? (
            visitTypes.map(vt => (
              <button
                type="button"
                key={vt.id}
                onClick={() => handleSelect(vt)}
                className="group flex w-full items-center justify-between rounded-xl border border-[#e4e2dc] bg-white px-5 py-4 text-left transition-colors hover:border-[#007865] hover:bg-[#f8f7f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007865] focus-visible:ring-offset-2"
              >
                <span>
                  <span className="block text-sm font-medium text-neutral-900">{vt.name}</span>
                  <span className="mt-1 block text-xs text-neutral-500">
                    {vt.duration_minutes} min · {site.visitModeWord}
                  </span>
                </span>
                <span className="ml-4 flex items-center gap-3">
                  <span className="text-sm font-medium tabular-nums text-[#007865]">
                    {formatZl(visitPriceZl(vt.kind, vt.price))}
                  </span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e7f4f1] text-[#007865] transition-colors group-hover:bg-[#007865] group-hover:text-white">
                    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none">
                      <path d="m7.5 4.5 5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </span>
              </button>
            ))
          ) : (
            visitTypes.map(vt => (
              <div
                key={vt.id}
                className="flex w-full items-center justify-between rounded-xl border border-[#e4e2dc] bg-white px-5 py-4 text-left"
              >
                <span>
                  <span className="block text-sm font-medium text-neutral-900">{vt.name}</span>
                  <span className="mt-1 block text-xs text-neutral-500">
                    {vt.duration_minutes} min · {site.visitModeWord}
                  </span>
                </span>
                <span className="ml-4 text-sm font-medium tabular-nums text-[#007865]">
                  {formatZl(visitPriceZl(vt.kind, vt.price))}
                </span>
              </div>
            ))
          )}
          </div>

          <p className="mt-5 text-xs leading-relaxed text-neutral-500">
            {site.contactNote} {site.bookingConfirmNote}
          </p>
        </section>

        <aside className="grid gap-5" aria-label="Informacje gabinetu">
          <section aria-labelledby="news-heading" className="rounded-2xl border border-[#dfddd6] bg-[#e8f3f0] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#39766b]">Aktualności</p>
              <span className="h-2 w-2 rounded-full bg-[#007865]" aria-hidden="true" />
            </div>
            <h2 id="news-heading" className="mt-5 text-xl font-medium tracking-[-0.02em] text-neutral-900">
              Konsultacje wznowione
            </h2>
            <p className="mt-3 text-sm leading-6 text-neutral-600">
              Rezerwacja konsultacji online jest ponownie dostępna. Aktualne terminy można sprawdzić w terminarzu.
            </p>
            <p className="mt-5 border-t border-[#cadfd9] pt-4 text-xs leading-5 text-[#52746d]">
              Bez publikowania niepotwierdzonej daty wznowienia.
            </p>
          </section>

          <SiteContact />
        </aside>
      </div>
    </div>
  );
}
