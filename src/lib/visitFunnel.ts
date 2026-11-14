export const FUNNEL = [
  { id: 'enter', label: 'Wejście na stronę' },
  { id: 'kind', label: 'Wybrany rodzaj wizyty' },
  { id: 'day', label: 'Wybrany dzień' },
  { id: 'hour', label: 'Wybrana godzina' },
  { id: 'data', label: 'Podane dane' },
  { id: 'booked', label: 'Zapisana wizyta' },
] as const;

export const SIGNALS = [
  { id: 'empty_days', label: 'Brak wolnych dni w pierwszym miesiącu' },
  { id: 'empty_hours', label: 'Brak wolnych godzin w wybranym dniu' },
  { id: 'schedule_failed', label: 'Lista terminów się nie wczytała' },
  { id: 'save_failed', label: 'Zapis wizyty nie przeszedł' },
] as const;

export type FunnelStage = (typeof FUNNEL)[number]['id'];
export type SignalStage = (typeof SIGNALS)[number]['id'];
export type VisitStage = FunnelStage | SignalStage;

export const VISIT_STAGES: VisitStage[] = [...FUNNEL.map((step) => step.id), ...SIGNALS.map((step) => step.id)];

export interface StageCounts {
  [stage: string]: number;
}

export interface FunnelDrop {
  fromId: FunnelStage;
  toId: FunnelStage;
  fromLabel: string;
  toLabel: string;
  left: number;
  fromCount: number;
}

export function emptyStageCounts(): StageCounts {
  return Object.fromEntries(VISIT_STAGES.map((stage) => [stage, 0]));
}

export function sumStage(days: Array<{ stages?: StageCounts }>, stage: string): number {
  return days.reduce((total, day) => total + (day.stages?.[stage] || 0), 0);
}

export function stageTotals(days: Array<{ stages?: StageCounts }>): StageCounts {
  const totals = emptyStageCounts();
  for (const stage of VISIT_STAGES) {
    totals[stage] = sumStage(days, stage);
  }
  return totals;
}

export function availabilitySignal(loadFailed: boolean, count: number): 'empty' | 'failed' | null {
  if (loadFailed) return 'failed';
  if (count === 0) return 'empty';
  return null;
}

export function largestDrop(counts: StageCounts): FunnelDrop | null {
  let best: FunnelDrop | null = null;

  for (let index = 1; index < FUNNEL.length; index += 1) {
    const from = FUNNEL[index - 1];
    const to = FUNNEL[index];
    const fromCount = counts[from.id] || 0;
    const toCount = counts[to.id] || 0;
    const left = Math.max(0, fromCount - toCount);
    if (left === 0) continue;
    if (!best || left > best.left) {
      best = {
        fromId: from.id,
        toId: to.id,
        fromLabel: from.label,
        toLabel: to.label,
        left,
        fromCount,
      };
    }
  }

  return best;
}
