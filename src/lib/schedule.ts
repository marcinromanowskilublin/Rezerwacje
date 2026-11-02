export const HOLD_MINUTES = 10;

export function hm(time: string): string {
  return time.slice(0, 5);
}

export function toMin(time: string): number {
  const [h, m] = hm(time).split(':').map(Number);
  return h * 60 + (m || 0);
}

export function fromMin(total: number): string {
  const safe = Math.max(0, total);
  return `${String(Math.floor(safe / 60) % 24).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export const WEEKDAYS = [
  { id: 1, label: 'Poniedziałek' },
  { id: 2, label: 'Wtorek' },
  { id: 3, label: 'Środa' },
  { id: 4, label: 'Czwartek' },
  { id: 5, label: 'Piątek' },
  { id: 6, label: 'Sobota' },
  { id: 0, label: 'Niedziela' },
] as const;

export const DURATION_OPTIONS = [15, 30, 45, 50, 60, 90];

export const AUDIENCE_OPTIONS = [
  { id: 'all' as const, label: 'Wszyscy' },
  { id: 'first' as const, label: 'Tylko pierwsza wizyta' },
  { id: 'followup' as const, label: 'Tylko kontrolna' },
];

export function ruleMatchesVisit(audience: string | undefined, kind: string | undefined): boolean {
  if (!audience || audience === 'all') return true;
  return audience === kind;
}

export function slotStep(durationMinutes: number, slotDurationMinutes?: number): number {
  return Math.max(5, slotDurationMinutes || durationMinutes);
}

export function slotRange(start: string, durationMinutes: number): string {
  return `${hm(start)}–${fromMin(toMin(start) + durationMinutes)}`;
}
