import { bookingApi } from '../services/bookingApi';
import { VisitStage, VISIT_STAGES } from './visitFunnel';

const STORAGE_KEY = 'mr_visit_reach';
const ADMIN_KEY = 'rezerwacje_admin_password';

type StoredReach = { day: string; stages: string[] };

const pending = new Set<string>();
const memoryReached = new Set<string>();
let pageViewSent = false;

function warsawDay(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function canCount(): boolean {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname;
  if (path.startsWith('/admin') || path.startsWith('/manage')) return false;
  try {
    if (sessionStorage.getItem(ADMIN_KEY)) return false;
  } catch {
    return false;
  }
  return true;
}

function readReach(day: string): StoredReach {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { day, stages: [] };
    const parsed = JSON.parse(raw) as StoredReach;
    if (!parsed || parsed.day !== day || !Array.isArray(parsed.stages)) {
      return { day, stages: [] };
    }
    return { day, stages: parsed.stages.filter((stage) => typeof stage === 'string') };
  } catch {
    return { day, stages: [] };
  }
}

function writeReach(reach: StoredReach) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reach));
  } catch {
    reach.stages.forEach((stage) => memoryReached.add(`${reach.day}:${stage}`));
  }
}

function alreadyReached(day: string, stage: string): boolean {
  if (memoryReached.has(`${day}:${stage}`)) return true;
  return readReach(day).stages.includes(stage);
}

function remember(day: string, stage: string) {
  memoryReached.add(`${day}:${stage}`);
  const reach = readReach(day);
  if (!reach.stages.includes(stage)) {
    reach.stages.push(stage);
    writeReach(reach);
  }
}

export function notePageView(): void {
  if (!canCount() || pageViewSent) return;
  pageViewSent = true;
  void bookingApi.recordPageView().catch(() => {
    pageViewSent = false;
  });
}

export function noteStage(stage: VisitStage): void {
  if (!canCount() || !VISIT_STAGES.includes(stage)) return;
  const day = warsawDay();
  if (alreadyReached(day, stage) || pending.has(stage)) return;
  pending.add(stage);
  void bookingApi.recordVisitStage(stage).then(() => {
    remember(day, stage);
  }).catch(() => undefined).finally(() => {
    pending.delete(stage);
  });
}
