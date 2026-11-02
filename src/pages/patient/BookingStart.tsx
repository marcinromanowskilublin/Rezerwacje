import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookingApi } from '../../services/bookingApi';
import { VisitType } from '../../types';
import { useBooking } from './BookingContext';
import { formatZl, site, visitPriceZl } from '../../config/site';
import { config } from '../../config/features';
import SiteContact from '../../components/layout/SiteContact';
import OfficeNetworkBackdrop from '../../components/layout/OfficeNetworkBackdrop';

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
    <div className="relative isolate w-full animate-in fade-in slide-in-from-bottom-3 duration-500">
      <OfficeNetworkBackdrop />

      <div className="relative z-10 mx-auto w-full max-w-lg">
      <section aria-labelledby="doctor-name" className="text-center">
        <div className="mx-auto h-[156px] w-[156px] overflow-hidden rounded-full bg-[#ebe8e1] shadow-[0_18px_50px_rgba(31,92,81,0.10)] ring-1 ring-[#d8d4cc]">
          <img
            src={site.portraitSrc}
            alt={site.officeName}
            width={156}
            height={156}
            fetchPriority="high"
            className="h-full w-full object-cover object-top"
          />
        </div>
        <h1 id="doctor-name" className="mt-5 text-[1.65rem] font-medium tracking-[-0.03em] text-[#007865] sm:text-[1.85rem]">
          {site.officeDisplayName}
        </h1>
        <p className="mt-1.5 text-sm text-neutral-500">{site.officeTitle}</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-[#5f746f] sm:text-xs">
          <span>Niezależny gabinet · wspólna sieć specjalistów</span>
          <span className="hidden h-1.5 w-1.5 rounded-full bg-[#e6816d] sm:block" aria-hidden="true" />
          <span className="text-neutral-500">Na swoim. Nie samemu.</span>
        </div>
      </section>

      <section
        aria-labelledby="visit-type-heading"
        className="mt-7 rounded-[1.35rem] border border-[#dedbd3] bg-white/95 p-5 shadow-[0_24px_70px_rgba(31,72,63,0.07)] backdrop-blur-sm sm:p-6"
      >
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
          {scheduleOn === false ? 'Wizyty' : 'Umów wizytę'}
        </p>
        <h2 id="visit-type-heading" className="mt-1.5 text-xl font-medium tracking-[-0.015em] text-neutral-900">
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
                className="group flex w-full items-center justify-between rounded-xl border border-[#e4e1da] bg-white px-5 py-4 text-left transition-all hover:-translate-y-px hover:border-[#428276] hover:shadow-[0_10px_28px_rgba(31,92,81,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007865] focus-visible:ring-offset-2"
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

      <div className="mt-5">
          <SiteContact />
      </div>
      </div>
    </div>
  );
}
