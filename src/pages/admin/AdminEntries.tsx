import { useEffect, useMemo, useState } from 'react';
import { bookingApi } from '../../services/bookingApi';
import { AnalyticsSummary } from '../../types';
import { FUNNEL, SIGNALS, largestDrop, stageTotals } from '../../lib/visitFunnel';
import AdminGate from './AdminGate';

const empty: AnalyticsSummary = { total: 0, today: 0, days: [] };

function AdminEntriesPanel() {
  const [analytics, setAnalytics] = useState<AnalyticsSummary>(empty);
  const [range, setRange] = useState<7 | 30>(7);

  useEffect(() => {
    bookingApi.getAnalytics().then(setAnalytics).catch(() => setAnalytics(empty));
  }, []);

  const days = useMemo(() => analytics.days.slice(-range), [analytics.days, range]);
  const totals = useMemo(() => stageTotals(days), [days]);
  const drop = useMemo(() => largestDrop(totals), [totals]);
  const views = useMemo(() => days.reduce((total, day) => total + day.count, 0), [days]);
  const enter = totals.enter || 0;
  const scale = Math.max(enter, ...FUNNEL.map((step) => totals[step.id] || 0), 1);
  const todayEnter = analytics.days.at(-1)?.stages?.enter || 0;

  return (
    <section aria-label="Wejścia na stronę" className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-neutral-400">Tylko w panelu</p>
          <h1 className="mt-1 text-2xl font-medium text-neutral-900">Wejścia</h1>
        </div>
        <div className="flex gap-2">
          {([7, 30] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRange(value)}
              className={`h-10 rounded-xl px-4 text-xs uppercase tracking-widest ${range === value ? 'bg-neutral-900 text-white' : 'border border-neutral-200 text-neutral-600'}`}
            >
              {value} dni
            </button>
          ))}
        </div>
      </div>

      <p className="max-w-2xl text-sm leading-6 text-neutral-500">
        Jedno wejście to jedna przeglądarka w danym dniu. Ta sama osoba na telefonie i na komputerze
        policzy się dwa razy. Przeglądarek nie łączę, bo do tego trzeba by rozpoznawać urządzenie.
        Sprawdzenie strony w przeglądarce, w której jesteś zalogowany do panelu, nie wlicza się.
      </p>

      <div className="grid grid-cols-3 gap-3 rounded-2xl border border-neutral-200 bg-white p-5">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-neutral-400">Dzisiaj</p>
          <p className="mt-1 text-2xl font-medium text-neutral-900">{todayEnter}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-neutral-400">{range} dni</p>
          <p className="mt-1 text-2xl font-medium text-neutral-900">{enter}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-neutral-400">Zapisy</p>
          <p className="mt-1 text-2xl font-medium text-neutral-900">{totals.booked || 0}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        <p className="text-[10px] uppercase tracking-widest text-neutral-400">Gdzie ludzie schodzą</p>
        <p className="mt-2 text-sm leading-6 text-neutral-700">
          {enter === 0
            ? 'W tym zakresie nie ma jeszcze wejść.'
            : drop
              ? `Najwięcej wejść nie przechodzi z „${drop.fromLabel}” do „${drop.toLabel}”: ${drop.left} z ${drop.fromCount}.`
              : 'Między krokami nikt nie zrezygnował.'}
        </p>
        <ol className="mt-5 space-y-3">
          {FUNNEL.map((step, index) => {
            const value = totals[step.id] || 0;
            const previous = index > 0 ? totals[FUNNEL[index - 1].id] || 0 : null;
            const left = previous === null ? 0 : Math.max(0, previous - value);
            const width = Math.round((value / scale) * 100);
            const marked = drop?.toId === step.id;
            return (
              <li key={step.id}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <span className={marked ? 'font-medium text-neutral-900' : 'text-neutral-700'}>{step.label}</span>
                  <span className="shrink-0 tabular-nums text-neutral-900">
                    {value}
                    {left > 0 && <span className="ml-2 text-xs text-neutral-400">odeszło {left}</span>}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className={`h-full rounded-full ${marked ? 'bg-[#c4654a]' : 'bg-[#007865]'}`}
                    style={{ width: `${value === 0 ? 0 : Math.max(width, 4)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        <p className="text-[10px] uppercase tracking-widest text-neutral-400">Miejsca z problemem</p>
        <p className="mt-2 text-sm leading-6 text-neutral-500">
          To nie są kolejne kroki. To sytuacje, w których ktoś doszedł do miejsca i nie miał jak iść dalej
          albo zapis się nie udał.
        </p>
        <ul className="mt-4 divide-y divide-neutral-100">
          {SIGNALS.map((signal) => (
            <li key={signal.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="text-neutral-700">{signal.label}</span>
              <span className="font-medium tabular-nums text-neutral-900">{totals[signal.id] || 0}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-neutral-400">
        Odsłony, czyli pełne wczytania strony wraz z odświeżeniem: {views} w tym zakresie, łącznie {analytics.total}.
      </p>
    </section>
  );
}

export default function AdminEntries() {
  return (
    <AdminGate>
      <AdminEntriesPanel />
    </AdminGate>
  );
}
