import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { bookingApi } from '../../services/bookingApi';
import { AnalyticsSummary } from '../../types';

const empty: AnalyticsSummary = { total: 0, today: 0, days: [] };

export default function AdminVisitCounter() {
  const [analytics, setAnalytics] = useState<AnalyticsSummary>(empty);

  useEffect(() => {
    bookingApi.getAnalytics().then(setAnalytics).catch(() => setAnalytics(empty));
  }, []);

  const lastSevenDays = useMemo(
    () => analytics.days.slice(-7).reduce((total, day) => total + day.count, 0),
    [analytics.days],
  );
  const chartDays = useMemo(() => analytics.days.slice(-30), [analytics.days]);
  const chartMax = useMemo(
    () => Math.max(1, ...chartDays.map((day) => day.count)),
    [chartDays],
  );
  const chartTicks = useMemo(
    () => Array.from(new Set([chartMax, Math.round(chartMax / 2), 0])).sort((a, b) => b - a),
    [chartMax],
  );
  const chartPoints = useMemo(() => {
    if (chartDays.length === 0) {
      return [];
    }

    const width = 100;
    const height = 100;

    return chartDays.map((day, index) => {
      const x = chartDays.length === 1 ? 0 : (index / (chartDays.length - 1)) * width;
      const y = height - (day.count / chartMax) * height;

      return {
        x,
        y,
        day,
      };
    });
  }, [chartDays, chartMax]);
  const chartPath = useMemo(
    () =>
      chartPoints
        .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
        .join(' '),
    [chartPoints],
  );
  const firstLabel = chartDays[0] ? format(parseISO(chartDays[0].date), 'd MMM', { locale: pl }) : '';
  const middleLabel =
    chartDays[Math.floor((chartDays.length - 1) / 2)]
      ? format(parseISO(chartDays[Math.floor((chartDays.length - 1) / 2)].date), 'd MMM', { locale: pl })
      : '';
  const lastLabel = chartDays.at(-1) ? format(parseISO(chartDays.at(-1)!.date), 'd MMM', { locale: pl }) : '';

  return (
    <section aria-label="Licznik odwiedzin strony" className="rounded-2xl border border-neutral-200 bg-white p-5">
      <p className="text-[10px] uppercase tracking-widest text-neutral-400">Odwiedziny strony</p>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-neutral-400">Dzisiaj</p>
          <p className="mt-1 text-2xl font-medium text-neutral-900">{analytics.today}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-neutral-400">7 dni</p>
          <p className="mt-1 text-2xl font-medium text-neutral-900">{lastSevenDays}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-neutral-400">Łącznie</p>
          <p className="mt-1 text-2xl font-medium text-neutral-900">{analytics.total}</p>
        </div>
      </div>
      {chartDays.length > 0 && (
        <div className="mt-4 rounded-xl border border-neutral-100 p-3 sm:p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-neutral-700">Wykres odwiedzin (30 dni)</p>
            <p className="text-[11px] text-neutral-400">oś X: dni, oś Y: liczba odwiedzin</p>
          </div>
          <svg
            viewBox="-10 -6 120 124"
            role="img"
            aria-label="Wykres odwiedzin strony z ostatnich 30 dni"
            className="w-full"
          >
            {chartTicks.map((value) => {
              const y = 100 - (value / chartMax) * 100;
              return (
                <g key={`tick-${value}`}>
                  <line x1={0} y1={y} x2={100} y2={y} stroke="#eceae3" strokeWidth="0.6" />
                  <text x={-2} y={y + 1.7} textAnchor="end" className="fill-neutral-400 text-[4px]">
                    {value}
                  </text>
                </g>
              );
            })}
            <line x1={0} y1={0} x2={0} y2={100} stroke="#d7d3ca" strokeWidth="0.8" />
            <line x1={0} y1={100} x2={100} y2={100} stroke="#d7d3ca" strokeWidth="0.8" />
            {chartPath && <path d={chartPath} fill="none" stroke="#007865" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />}
            {chartPoints.map((point) => (
              <circle key={point.day.date} cx={point.x} cy={point.y} r="1.1" fill="#007865">
                <title>{`${format(parseISO(point.day.date), 'd MMM', { locale: pl })}: ${point.day.count}`}</title>
              </circle>
            ))}
            <text x={0} y={108} textAnchor="start" className="fill-neutral-400 text-[4px]">
              {firstLabel}
            </text>
            <text x={50} y={108} textAnchor="middle" className="fill-neutral-400 text-[4px]">
              {middleLabel}
            </text>
            <text x={100} y={108} textAnchor="end" className="fill-neutral-400 text-[4px]">
              {lastLabel}
            </text>
          </svg>
        </div>
      )}
      {analytics.days.length > 0 && (
        <details className="mt-4 border-t border-neutral-100 pt-3">
          <summary className="cursor-pointer text-xs text-neutral-500">Ostatnie 30 dni</summary>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
            {[...analytics.days].reverse().map((day) => (
              <div key={day.date} className="flex justify-between gap-3 py-1 text-neutral-500">
                <span>{format(parseISO(day.date), 'd MMM', { locale: pl })}</span>
                <span className="font-medium text-neutral-900">{day.count}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
