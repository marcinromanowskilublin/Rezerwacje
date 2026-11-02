import { useEffect, useState } from 'react';
import { addDays, format } from 'date-fns';
import { Button } from '../../components/ui/Button';
import { bookingApi } from '../../services/bookingApi';
import { BookingsBackupStatus } from '../../types';
import AdminGate from './AdminGate';

interface AdminAutomationSettings {
  emailPatientListEnabled: boolean;
  emailPatientListSendTime: string;
  morningConfirmationCheckEnabled: boolean;
  smsIfUnconfirmedEnabled: boolean;
}

const STORAGE_KEY = 'rezerwacje_admin_automation_settings';
const defaultSettings: AdminAutomationSettings = {
  emailPatientListEnabled: false,
  emailPatientListSendTime: '18:00',
  morningConfirmationCheckEnabled: false,
  smsIfUnconfirmedEnabled: false,
};

const emptyBackupStatus: BookingsBackupStatus = {
  interval_seconds: 21600,
  retention_days: 30,
  last_run_at: null,
  last_file: null,
  last_count: 0,
  last_size_bytes: 0,
  next_due_at: null,
  seconds_until_next: 0,
};

function readSettings(): AdminAutomationSettings {
  if (typeof window === 'undefined') return defaultSettings;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings;

    const parsed = JSON.parse(raw) as Partial<AdminAutomationSettings>;
    const sendTime =
      typeof parsed.emailPatientListSendTime === 'string' && /^\d{2}:\d{2}$/.test(parsed.emailPatientListSendTime)
        ? parsed.emailPatientListSendTime
        : '18:00';

    return {
      emailPatientListEnabled: Boolean(parsed.emailPatientListEnabled),
      emailPatientListSendTime: sendTime,
      morningConfirmationCheckEnabled: Boolean(parsed.morningConfirmationCheckEnabled),
      smsIfUnconfirmedEnabled: Boolean(parsed.smsIfUnconfirmedEnabled),
    };
  } catch {
    return defaultSettings;
  }
}

function SettingSwitch({
  title,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-neutral-100 bg-white p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium text-neutral-900">{title}</p>
        <p className="text-xs text-neutral-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors ${
          disabled
            ? 'cursor-not-allowed border-neutral-200 bg-neutral-100 opacity-60'
            : checked
              ? 'border-neutral-900 bg-neutral-900'
              : 'border-neutral-300 bg-neutral-200'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

function SettingsPanel() {
  const [settings, setSettings] = useState<AdminAutomationSettings>(() => readSettings());
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [backupStatus, setBackupStatus] = useState<BookingsBackupStatus>(emptyBackupStatus);
  const [loadingBackupStatus, setLoadingBackupStatus] = useState(true);
  const [backupRunning, setBackupRunning] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [sendingReport, setSendingReport] = useState(false);
  const [reportMessage, setReportMessage] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setSavedAt(
      new Date().toLocaleTimeString('pl-PL', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    );
  }, [settings]);

  const loadBackupStatus = async () => {
    setLoadingBackupStatus(true);
    setBackupError(null);
    try {
      const status = await bookingApi.getBookingsBackupStatus();
      setBackupStatus(status);
    } catch {
      setBackupError('Nie udało się pobrać statusu backupu.');
    } finally {
      setLoadingBackupStatus(false);
    }
  };

  useEffect(() => {
    void loadBackupStatus();
  }, []);

  const runBackupNow = async () => {
    setBackupRunning(true);
    setBackupError(null);
    setBackupMessage(null);
    try {
      const result = await bookingApi.runBookingsBackup();
      setBackupStatus(result);
      setBackupMessage(
        result.created
          ? `Backup zapisany do pliku: ${result.last_file ?? 'bookings.json'}.`
          : 'Backup został pominięty (interwał nie minął lub backup jest już w toku).',
      );
    } catch {
      setBackupError('Nie udało się wykonać backupu do pliku.');
    } finally {
      setBackupRunning(false);
    }
  };

  const sendReportTestNow = async () => {
    setSendingReport(true);
    setReportError(null);
    setReportMessage(null);
    const today = format(new Date(), 'yyyy-MM-dd');
    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    try {
      const result = await bookingApi.sendVisitReportTest([today, tomorrow]);
      const sentCount = Object.values(result.recipients).filter(Boolean).length;
      const total = Object.keys(result.recipients).length;
      setReportMessage(`Raport próbny wysłany: ${sentCount}/${total}.`);
    } catch {
      setReportError('Nie udało się wysłać raportu próbnego.');
    } finally {
      setSendingReport(false);
    }
  };

  const formatDateTime = (value: string | null) => {
    if (!value) return 'brak';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('pl-PL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-light text-neutral-900 mb-2">Ustawienia</h1>
        <p className="text-neutral-500 text-sm">
          Opcje automatyzacji przypomnień i potwierdzeń wizyt.
        </p>
      </div>

      <section className="space-y-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-light text-neutral-900">Automatyzacje</h2>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] text-amber-700">
            W trakcie implementacji
          </span>
        </div>

        <SettingSwitch
          title="Wyślij lekarzowi grafik z następnego dnia"
          description="Po wdrożeniu: e-mail z listą pacjentów będzie wysyłany dzień wcześniej o ustawionej godzinie."
          checked={settings.emailPatientListEnabled}
          onChange={(next) => setSettings((prev) => ({ ...prev, emailPatientListEnabled: next }))}
        />

        <div className="rounded-xl border border-neutral-100 bg-white p-4">
          <label className="block text-xs uppercase tracking-widest text-neutral-500">
            Godzina wysyłki dzień wcześniej
          </label>
          <input
            type="time"
            className="mt-2 h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm text-neutral-900 disabled:bg-neutral-100"
            value={settings.emailPatientListSendTime}
            disabled={!settings.emailPatientListEnabled}
            onChange={(e) =>
              setSettings((prev) => ({
                ...prev,
                emailPatientListSendTime: e.target.value,
              }))
            }
          />
          <p className="mt-2 text-xs text-neutral-500">Przykład: ustaw 19:00, a dziś wyjdzie lista na jutro.</p>
        </div>

        <SettingSwitch
          title="Sprawdzaj codziennie o 07:00 potwierdzenia wizyt (24h+ do przodu)"
          description="Po wdrożeniu: poranny przegląd wizyt i wychwytywanie niepotwierdzonych terminów."
          checked={settings.morningConfirmationCheckEnabled}
          onChange={(next) =>
            setSettings((prev) => ({
              ...prev,
              morningConfirmationCheckEnabled: next,
              smsIfUnconfirmedEnabled: next ? prev.smsIfUnconfirmedEnabled : false,
            }))
          }
        />

        <SettingSwitch
          title="Wysyłaj SMS z pytaniem o obecność, gdy wizyta nie jest potwierdzona"
          description="Po wdrożeniu: SMS do pacjenta, jeśli poranny check nie znajdzie potwierdzenia."
          checked={settings.smsIfUnconfirmedEnabled}
          disabled={!settings.morningConfirmationCheckEnabled}
          onChange={(next) => setSettings((prev) => ({ ...prev, smsIfUnconfirmedEnabled: next }))}
        />

        <p className="text-xs text-neutral-500">
          Na ten moment ustawienia zapisują się lokalnie w tej przeglądarce panelu admina.
          {savedAt ? ` Ostatni zapis: ${savedAt}.` : ''}
        </p>

        <div className="rounded-xl border border-neutral-100 bg-white p-4 space-y-3">
          <p className="text-sm font-medium text-neutral-900">Raport poranny wizyt</p>
          <p className="text-xs text-neutral-500">
            Raport codzienny uruchamia się od jutra po 06:00 i wysyła tabelę wolnych oraz zajętych slotów z kontaktem do pacjenta.
          </p>
          <Button className="h-10 text-xs" onClick={sendReportTestNow} disabled={sendingReport}>
            {sendingReport ? 'Wysyłanie raportu...' : 'Wyślij próbny raport teraz'}
          </Button>
          {reportMessage && <p className="text-xs text-emerald-700">{reportMessage}</p>}
          {reportError && <p className="text-xs text-red-600">{reportError}</p>}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-light text-neutral-900">Backup zapisów</h2>
          <span className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[11px] text-neutral-500">
            Interwał: co {Math.round(backupStatus.interval_seconds / 3600)}h
          </span>
        </div>

        <p className="text-sm text-neutral-600">
          Backup zapisuje aktualną tabelę rezerwacji do pliku JSON na serwerze.
        </p>

        <div className="rounded-xl border border-neutral-100 bg-white p-4 text-sm text-neutral-600">
          {loadingBackupStatus ? (
            <p>Wczytywanie statusu backupu...</p>
          ) : (
            <div className="grid gap-1">
              <p><span className="text-neutral-500">Ostatni backup:</span> {formatDateTime(backupStatus.last_run_at)}</p>
              <p><span className="text-neutral-500">Plik:</span> {backupStatus.last_file || 'brak'}</p>
              <p><span className="text-neutral-500">Liczba zapisów:</span> {backupStatus.last_count}</p>
              <p><span className="text-neutral-500">Rozmiar:</span> {backupStatus.last_size_bytes} B</p>
              <p><span className="text-neutral-500">Następny planowany:</span> {formatDateTime(backupStatus.next_due_at)}</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button className="h-10 text-xs" onClick={runBackupNow} disabled={backupRunning || loadingBackupStatus}>
            {backupRunning ? 'Tworzenie backupu...' : 'Wykonaj backup do pliku'}
          </Button>
          <Button variant="outline" className="h-10 text-xs" onClick={() => void loadBackupStatus()} disabled={backupRunning}>
            Odśwież status
          </Button>
        </div>

        {backupMessage && <p className="text-xs text-emerald-700">{backupMessage}</p>}
        {backupError && <p className="text-xs text-red-600">{backupError}</p>}
      </section>
    </div>
  );
}

export default function AdminSettings() {
  return (
    <AdminGate>
      <SettingsPanel />
    </AdminGate>
  );
}
