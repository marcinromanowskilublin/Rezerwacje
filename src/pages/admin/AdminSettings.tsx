import { ReactNode, useEffect, useState } from 'react';
import { addDays, format } from 'date-fns';
import { Button } from '../../components/ui/Button';
import { bookingApi } from '../../services/bookingApi';
import { BookingsBackupStatus, PaymentGatewayStatus, SmsStatus, WhatsAppStatus } from '../../types';
import AdminGate from './AdminGate';

interface AdminAutomationSettings {
  emailPatientListEnabled: boolean;
  emailPatientListSendTime: string;
  morningConfirmationCheckEnabled: boolean;
  smsIfUnconfirmedEnabled: boolean;
  whatsappBotEnabled: boolean;
  whatsappLabelsEnabled: boolean;
  whatsappManualReplyEnabled: boolean;
  smsManualSendEnabled: boolean;
  smsAutoBookingEnabled: boolean;
  smsReminderDayBeforeEnabled: boolean;
  smsCancelRescheduleEnabled: boolean;
  paymentsOnlineEnabled: boolean;
  paymentsRequiredEnabled: boolean;
  emailReportsEnabled: boolean;
  backupsEnabled: boolean;
  assistantEnabled: boolean;
}

const STORAGE_KEY = 'rezerwacje_admin_automation_settings';
const defaultSettings: AdminAutomationSettings = {
  emailPatientListEnabled: false,
  emailPatientListSendTime: '18:00',
  morningConfirmationCheckEnabled: false,
  smsIfUnconfirmedEnabled: false,
  whatsappBotEnabled: false,
  whatsappLabelsEnabled: true,
  whatsappManualReplyEnabled: true,
  smsManualSendEnabled: true,
  smsAutoBookingEnabled: false,
  smsReminderDayBeforeEnabled: false,
  smsCancelRescheduleEnabled: false,
  paymentsOnlineEnabled: true,
  paymentsRequiredEnabled: true,
  emailReportsEnabled: true,
  backupsEnabled: true,
  assistantEnabled: false,
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
      whatsappBotEnabled: parsed.whatsappBotEnabled ?? defaultSettings.whatsappBotEnabled,
      whatsappLabelsEnabled: parsed.whatsappLabelsEnabled ?? defaultSettings.whatsappLabelsEnabled,
      whatsappManualReplyEnabled: parsed.whatsappManualReplyEnabled ?? defaultSettings.whatsappManualReplyEnabled,
      smsManualSendEnabled: parsed.smsManualSendEnabled ?? defaultSettings.smsManualSendEnabled,
      smsAutoBookingEnabled: parsed.smsAutoBookingEnabled ?? defaultSettings.smsAutoBookingEnabled,
      smsReminderDayBeforeEnabled: parsed.smsReminderDayBeforeEnabled ?? defaultSettings.smsReminderDayBeforeEnabled,
      smsCancelRescheduleEnabled: parsed.smsCancelRescheduleEnabled ?? defaultSettings.smsCancelRescheduleEnabled,
      paymentsOnlineEnabled: parsed.paymentsOnlineEnabled ?? defaultSettings.paymentsOnlineEnabled,
      paymentsRequiredEnabled: parsed.paymentsRequiredEnabled ?? defaultSettings.paymentsRequiredEnabled,
      emailReportsEnabled: parsed.emailReportsEnabled ?? defaultSettings.emailReportsEnabled,
      backupsEnabled: parsed.backupsEnabled ?? defaultSettings.backupsEnabled,
      assistantEnabled: parsed.assistantEnabled ?? defaultSettings.assistantEnabled,
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

function InfoList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-neutral-100 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">{title}</p>
      <ul className="mt-2 space-y-1 text-xs text-neutral-600">
        {items.map((item) => (
          <li key={item}>- {item}</li>
        ))}
      </ul>
    </div>
  );
}

function IntegrationSection({
  title,
  description,
  status,
  can,
  cannot,
  children,
}: {
  title: string;
  description: string;
  status: string;
  can: string[];
  cannot: string[];
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-light text-neutral-900">{title}</h2>
          <p className="mt-1 text-xs text-neutral-500">{description}</p>
        </div>
        <span className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[11px] text-neutral-600">
          {status}
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <InfoList title="Może robić" items={can} />
        <InfoList title="Nie może robić" items={cannot} />
      </div>
      <div className="space-y-3">{children}</div>
    </section>
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
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppStatus | null>(null);
  const [smsStatus, setSmsStatus] = useState<SmsStatus | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentGatewayStatus | null>(null);

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
    void bookingApi.getWhatsAppStatus().then(setWhatsappStatus).catch(() => undefined);
    void bookingApi.getSmsStatus().then(setSmsStatus).catch(() => undefined);
    void bookingApi.getPaymentGatewayStatus().then(setPaymentStatus).catch(() => undefined);
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
          Decyzje dla podłączonych aplikacji, automatyzacji i integracji.
        </p>
      </div>

      <IntegrationSection
        title="WhatsApp"
        description="Wiadomości, webhook, bot sekretarki i etykietowanie spraw."
        status={whatsappStatus?.threads_configured ? 'skonfigurowany' : 'wymaga konfiguracji'}
        can={[
          'odbierać wiadomości przez webhook Meta',
          'wysyłać odpowiedzi w 24-godzinnym oknie WhatsApp',
          'uruchamiać bota po czasie bez odpowiedzi',
          'nadawać etykiety i zbierać dane sprawy',
        ]}
        cannot={[
          'udzielać porad medycznych ani podejmować decyzji klinicznych',
          'odpowiadać po 24h bez oficjalnego szablonu Meta',
          'działać bez tokena, phone_number_id i webhook secret',
        ]}
      >
        <SettingSwitch
          title="Bot sekretarki WhatsApp"
          description="Decyzja operacyjna: bot może zebrać kategorię, dane pacjenta i opis sprawy."
          checked={settings.whatsappBotEnabled}
          onChange={(next) => setSettings((prev) => ({ ...prev, whatsappBotEnabled: next }))}
        />
        <SettingSwitch
          title="Etykietowanie wątków"
          description="Bot może dopisywać etykiety typu termin, recepta/leki, PESEL, pilne."
          checked={settings.whatsappLabelsEnabled}
          onChange={(next) => setSettings((prev) => ({ ...prev, whatsappLabelsEnabled: next }))}
        />
        <SettingSwitch
          title="Ręczne przejęcie rozmowy"
          description="Po odpowiedzi właściciela bot pauzuje automatyzację w danym wątku."
          checked={settings.whatsappManualReplyEnabled}
          onChange={(next) => setSettings((prev) => ({ ...prev, whatsappManualReplyEnabled: next }))}
        />
      </IntegrationSection>

      <IntegrationSection
        title="SMSAPI"
        description="Ręczne SMS-y z panelu, szablony i automatyczne przypomnienia."
        status={smsStatus?.configured ? 'skonfigurowany' : 'wymaga tokena'}
        can={[
          'wysyłać SMS po potwierdzeniu w panelu',
          'używać szablonu albo własnej treści',
          'wysyłać przypomnienie dzień przed wizytą po włączeniu reguły',
          'odbierać status doręczenia przez callback',
        ]}
        cannot={[
          'wysyłać automatycznie, jeśli reguła w configu jest wyłączona',
          'przechowywać treści SMS ani numeru odbiorcy w historii',
          'działać bez tokena SMSAPI i zatwierdzonego nadawcy, jeśli jest wymagany',
        ]}
      >
        <SettingSwitch
          title="Ręczna wysyłka SMS z panelu"
          description="Przycisk SMS otwiera podgląd, a wysyłka wymaga kliknięcia Wyślij."
          checked={settings.smsManualSendEnabled}
          onChange={(next) => setSettings((prev) => ({ ...prev, smsManualSendEnabled: next }))}
        />
        <SettingSwitch
          title="SMS po rezerwacji"
          description="Decyzja dla reguły booking_created. Domyślnie w backendzie wyłączone."
          checked={settings.smsAutoBookingEnabled}
          onChange={(next) => setSettings((prev) => ({ ...prev, smsAutoBookingEnabled: next }))}
        />
        <SettingSwitch
          title="Przypomnienie dzień przed wizytą"
          description="Decyzja dla crona smsapi/reminders/run. Domyślnie w backendzie wyłączone."
          checked={settings.smsReminderDayBeforeEnabled}
          onChange={(next) => setSettings((prev) => ({ ...prev, smsReminderDayBeforeEnabled: next }))}
        />
        <SettingSwitch
          title="SMS po anulowaniu lub przełożeniu"
          description="Decyzja dla reguł booking_cancelled i booking_rescheduled."
          checked={settings.smsCancelRescheduleEnabled}
          onChange={(next) => setSettings((prev) => ({ ...prev, smsCancelRescheduleEnabled: next }))}
        />
      </IntegrationSection>

      <IntegrationSection
        title="PayU"
        description="Płatność online za wizytę i automatyczne potwierdzenie po statusie COMPLETED."
        status={paymentStatus?.configured ? `skonfigurowany (${paymentStatus.environment})` : 'wymaga danych POS'}
        can={[
          'tworzyć płatność online po rezerwacji',
          'przekierować pacjenta do PayU',
          'odebrać notyfikację PayU i oznaczyć wizytę jako opłaconą',
          'automatycznie potwierdzić wizytę po skutecznej płatności',
        ]}
        cannot={[
          'działać bez POS ID, client_id, client_secret i drugiego klucza',
          'oznaczać płatności jako opłacone bez poprawnego podpisu PayU',
          'przechowywać danych kart ani pełnych danych płatniczych pacjenta',
        ]}
      >
        <SettingSwitch
          title="Płatności online PayU"
          description="Decyzja operacyjna dla przycisku płatności i przekierowania do PayU."
          checked={settings.paymentsOnlineEnabled}
          onChange={(next) => setSettings((prev) => ({ ...prev, paymentsOnlineEnabled: next }))}
        />
        <SettingSwitch
          title="Wymagana płatność dla wizyt z polityką required"
          description="Pierwsza konsultacja może czekać na płatność i potwierdzić się po statusie COMPLETED."
          checked={settings.paymentsRequiredEnabled}
          onChange={(next) => setSettings((prev) => ({ ...prev, paymentsRequiredEnabled: next }))}
        />
      </IntegrationSection>

      <IntegrationSection
        title="E-mail i raporty"
        description="Potwierdzenia rezerwacji, powiadomienia właściciela i raport wizyt."
        status="częściowo aktywne"
        can={[
          'wysyłać potwierdzenie rezerwacji na e-mail pacjenta',
          'wysyłać powiadomienie o rezerwacji do właściciela',
          'wysłać próbny raport wizyt z panelu',
        ]}
        cannot={[
          'wysyłać masowych mailingów marketingowych',
          'zastępować dokumentacji medycznej',
          'gwarantować doręczenia bez poprawnej konfiguracji poczty serwera',
        ]}
      >
        <SettingSwitch
          title="Raporty e-mail"
          description="Decyzja operacyjna dla raportów wizyt i listy pacjentów."
          checked={settings.emailReportsEnabled}
          onChange={(next) => setSettings((prev) => ({ ...prev, emailReportsEnabled: next }))}
        />
      </IntegrationSection>

      <IntegrationSection
        title="Backupy"
        description="Plikowe kopie rezerwacji i ręczne wymuszenie backupu."
        status={backupStatus.last_run_at ? 'działa' : 'brak ostatniego backupu'}
        can={[
          'zapisywać kopie rezerwacji do pliku',
          'uruchamiać backup ręcznie z panelu',
          'czyścić stare backupy według retencji',
        ]}
        cannot={[
          'zastępować pełnego backupu bazy MySQL',
          'chronić przed utratą danych, jeśli katalog storage nie jest zapisywalny',
        ]}
      >
        <SettingSwitch
          title="Automatyczne backupy rezerwacji"
          description="Decyzja operacyjna; szczegóły interwału są w config.php."
          checked={settings.backupsEnabled}
          onChange={(next) => setSettings((prev) => ({ ...prev, backupsEnabled: next }))}
        />
      </IntegrationSection>

      <IntegrationSection
        title="Asystent AI"
        description="Pomoc administracyjna w panelu, bez samodzielnych decyzji medycznych."
        status="opcjonalny"
        can={[
          'pomagać w zarządzaniu grafikiem i opisach zadań',
          'porządkować intencje kontaktu',
          'działać tylko z ograniczeniami panelu admina',
        ]}
        cannot={[
          'diagnozować, leczyć ani udzielać zaleceń medycznych',
          'wysyłać wiadomości do pacjenta bez osobnej funkcji wysyłki',
          'działać bez skonfigurowanego klucza API',
        ]}
      >
        <SettingSwitch
          title="Asystent w panelu"
          description="Decyzja operacyjna dla funkcji AI w panelu admina."
          checked={settings.assistantEnabled}
          onChange={(next) => setSettings((prev) => ({ ...prev, assistantEnabled: next }))}
        />
      </IntegrationSection>

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
