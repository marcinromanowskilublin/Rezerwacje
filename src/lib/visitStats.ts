import { bookingApi } from '../services/bookingApi';
import { VisitStage, VISIT_STAGES } from './visitFunnel';

const STORAGE_KEY = 'mr_visit_reach';
const ADMIN_KEY = 'rezerwacje_admin_password';
const OWNER_UNTIL_KEY = 'mr_owner_until';
const OWNER_HOLD_MS = 3 * 60 * 1000;

type StoredReach = { day: string; stages: string[] };

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

export function holdOwnerBrowser(): void {
  try {
    localStorage.setItem(OWNER_UNTIL_KEY, String(Date.now() + OWNER_HOLD_MS));
  } catch {
    // Przeglądarka bez pamięci lokalnej i tak nie utrzyma licznika między kartami.
  }
}

export function releaseOwnerBrowser(): void {
  try {
    localStorage.removeItem(OWNER_UNTIL_KEY);
  } catch {
    // Brak pamięci lokalnej oznacza, że znacznika panelu tam nie było.
  }
}

function ownerBrowserIsOpen(): boolean {
  try {
    if (sessionStorage.getItem(ADMIN_KEY)) return true;
    const until = Number(localStorage.getItem(OWNER_UNTIL_KEY) || 0);
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
}

function canCount(): boolean {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname;
  if (path.startsWith('/admin') || path.startsWith('/manage')) return false;
  return !ownerBrowserIsOpen();
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

async function sendStage(day: string, stage: VisitStage): Promise<void> {
  if (!canCount() || alreadyReached(day, stage)) return;
  remember(day, stage);
  try {
    await bookingApi.recordVisitStage(stage);
  } catch {
    // Zapis w przeglądarce zostaje. Drugie wysłanie doliczyłoby kolejne unikalne wejście,
    // także gdy serwer przyjął pierwsze żądanie, a przeglądarka nie dostała odpowiedzi.
  }
}

export function noteStage(stage: VisitStage): void {
  if (!canCount() || !VISIT_STAGES.includes(stage)) return;
  const day = warsawDay();
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (locks?.request) {
    void locks.request(`mr-visit-${day}-${stage}`, () => sendStage(day, stage));
    return;
  }
  void sendStage(day, stage);
}
