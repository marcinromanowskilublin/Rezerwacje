import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  CheckCheck,
  Clock3,
  CheckCircle2,
  ExternalLink,
  ListChecks,
  MessageCircle,
  PhoneMissed,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  XCircle,
} from 'lucide-react';
import { Button, cn } from '../../components/ui/Button';
import { bookingApi } from '../../services/bookingApi';
import {
  WhatsAppConversation,
  WhatsAppMessage,
  WhatsAppStatus,
  WhatsAppThread,
  ContactIntent,
  PhoneConversation,
  PhoneMessage,
  PhoneThread,
} from '../../types';
import AdminGate from './AdminGate';

const categoryMeta: Record<string, { label: string; className: string }> = {
  termin: { label: 'Termin', className: 'bg-sky-50 text-sky-700 ring-sky-200' },
  recepta: { label: 'Recepta', className: 'bg-violet-50 text-violet-700 ring-violet-200' },
  dokumenty: { label: 'Dokumenty', className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  płatność: { label: 'Płatność', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  leczenie: { label: 'Leczenie', className: 'bg-rose-50 text-rose-700 ring-rose-200' },
  inna: { label: 'Inna sprawa', className: 'bg-neutral-100 text-neutral-600 ring-neutral-200' },
};

const deliveryLabels: Record<string, string> = {
  sent: 'Wysłano',
  delivered: 'Dostarczono',
  read: 'Odczytano',
  failed: 'Błąd wysyłki',
};

const timeFormatter = new Intl.DateTimeFormat('pl-PL', {
  hour: '2-digit',
  minute: '2-digit',
});

const dayFormatter = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric',
  month: 'short',
});

const fullDateFormatter = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function parsedDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function threadDate(value: string): string {
  const date = parsedDate(value);
  if (!date) return '';
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return timeFormatter.format(date);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Wczoraj';
  return dayFormatter.format(date);
}

function exactDate(value: string): string {
  const date = parsedDate(value);
  return date ? fullDateFormatter.format(date) : value;
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '?';
}

function categoryFor(value: string) {
  return categoryMeta[value] || categoryMeta.inna;
}

function contactLabel(name: string, isPatient?: boolean, confidence?: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  if (/\((P\.|\?)\)$/.test(trimmed)) return trimmed;
  if (isPatient || confidence === 'known') return `${trimmed} (P.)`;
  if (confidence === 'candidate') return `${trimmed} (?)`;
  return trimmed;
}

function priorityLabel(value?: string): string {
  if (value === 'high') return 'pilne';
  if (value === 'low') return 'niskie';
  return 'normalne';
}

function botStateLabel(value?: string): string {
  if (value === 'awaiting_category') return 'czeka na wybór sprawy';
  if (value === 'awaiting_identity') return 'zbiera dane pacjenta';
  if (value === 'awaiting_details') return 'czeka na opis sprawy';
  if (value === 'ready_for_owner') return 'do obsługi';
  if (value === 'owner_replied') return 'przejęte przez gabinet';
  return 'oczekuje';
}

function botDataRows(thread?: WhatsAppThread | null): Array<[string, string]> {
  const data = thread?.bot_data;
  if (!data) return [];
  const rows: Array<[string, string]> = [
    ['Sprawa', data.category_label || data.category || ''],
    ['Imię i nazwisko', data.name || ''],
    ['PESEL', data.pesel || ''],
    ['Adres', data.address || ''],
    ['Opis', data.details || ''],
  ];
  return rows.filter(([, value]) => value.trim() !== '');
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

function messageStatus(message: WhatsAppMessage): string {
  if (message.direction !== 'outbound') return '';
  return deliveryLabels[message.status] || message.status;
}

function WhatsAppPanel() {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [threads, setThreads] = useState<WhatsAppThread[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [conversation, setConversation] = useState<WhatsAppConversation | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('attention');
  const [draft, setDraft] = useState('');
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [completingBot, setCompletingBot] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const didAutoSelectRef = useRef(false);

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await bookingApi.getWhatsAppStatus());
    } catch (error) {
      setLoadError(getErrorMessage(error, 'Nie udało się sprawdzić połączenia z WhatsApp.'));
    }
  }, []);

  const refreshThreads = useCallback(async (quiet = false) => {
    if (!quiet) setLoadingThreads(true);
    try {
      const rows = await bookingApi.getWhatsAppThreads(75);
      const sorted = rows.slice().sort((a, b) =>
        b.last_message_at.localeCompare(a.last_message_at) || b.id - a.id,
      );
      setThreads(sorted);
      setSelectedId((current) => {
        if (current !== null && !sorted.some((thread) => thread.id === current)) {
          return sorted[0]?.id ?? null;
        }
        if (current === null && !didAutoSelectRef.current && sorted[0]) {
          didAutoSelectRef.current = true;
          return sorted[0].id;
        }
        return current;
      });
      setLastUpdated(new Date());
      setLoadError(null);
    } catch (error) {
      if (!quiet) {
        setLoadError(getErrorMessage(error, 'Nie udało się wczytać wątków WhatsApp.'));
      }
    } finally {
      if (!quiet) setLoadingThreads(false);
    }
  }, []);

  const refreshConversation = useCallback(async (threadId: number, quiet = false) => {
    if (!quiet) setLoadingConversation(true);
    try {
      const next = await bookingApi.getWhatsAppMessages(threadId);
      setConversation((current) =>
        selectedId !== null && selectedId !== threadId ? current : next,
      );
      setThreads((current) =>
        current.map((thread) =>
          thread.id === threadId
            ? { ...thread, ...next.thread, unread_count: 0 }
            : thread,
        ),
      );
      void bookingApi.markWhatsAppThreadRead(threadId).catch(() => undefined);
      setReplyError(null);
    } catch (error) {
      if (!quiet) {
        setLoadError(getErrorMessage(error, 'Nie udało się wczytać rozmowy.'));
      }
    } finally {
      if (!quiet) setLoadingConversation(false);
    }
  }, [selectedId]);

  useEffect(() => {
    void Promise.all([refreshStatus(), refreshThreads()]);
  }, [refreshStatus, refreshThreads]);

  useEffect(() => {
    if (selectedId === null) {
      setConversation(null);
      return;
    }
    setConversation((current) => current?.thread.id === selectedId ? current : null);
    setDraft('');
    setReplyError(null);
    void refreshConversation(selectedId);
  }, [selectedId, refreshConversation]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void refreshThreads(true);
      if (selectedId !== null) void refreshConversation(selectedId, true);
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [refreshConversation, refreshThreads, selectedId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [conversation?.messages.length]);

  const filteredThreads = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pl-PL');
    return threads.filter((thread) => {
      if (category === 'attention' && !thread.requires_attention && thread.unread_count === 0) return false;
      if (category === 'high' && thread.priority !== 'high') return false;
      if (category === 'no_action' && (thread.requires_attention || thread.unread_count > 0)) return false;
      if (!['all', 'attention', 'high', 'no_action'].includes(category) && thread.issue_category !== category) return false;
      if (!query) return true;
      return [
        thread.display_name,
        thread.patient_name || '',
        thread.profile_name || '',
        thread.phone,
        thread.preview,
        thread.triage_summary || '',
      ]
        .join(' ')
        .toLocaleLowerCase('pl-PL')
        .includes(query);
    });
  }, [category, search, threads]);

  const selectedThread = conversation?.thread
    || threads.find((thread) => thread.id === selectedId)
    || null;

  const manualRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refreshStatus(),
      refreshThreads(true),
      selectedId === null ? Promise.resolve() : refreshConversation(selectedId, true),
    ]);
    setRefreshing(false);
  };

  const sendReply = async (event?: FormEvent) => {
    event?.preventDefault();
    if (selectedId === null || sending) return;
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setReplyError(null);
    try {
      const next = await bookingApi.replyWhatsAppThread(selectedId, body);
      setConversation(next);
      setDraft('');
      await refreshThreads(true);
    } catch (error) {
      setReplyError(getErrorMessage(error, 'Nie udało się wysłać wiadomości.'));
      const apiError = error as {
        status?: number;
        payload?: { whatsapp_url?: unknown };
      };
      if (apiError.status === 409) {
        const fallbackUrl = typeof apiError.payload?.whatsapp_url === 'string'
          ? apiError.payload.whatsapp_url
          : selectedThread?.whatsapp_url;
        setConversation((current) => current ? {
          ...current,
          thread: {
            ...current.thread,
            can_reply: false,
            whatsapp_url: fallbackUrl || current.thread.whatsapp_url,
          },
        } : current);
      }
    } finally {
      setSending(false);
    }
  };

  const completeBotThread = async () => {
    if (selectedId === null || completingBot) return;
    setCompletingBot(true);
    setReplyError(null);
    try {
      const next = await bookingApi.completeWhatsAppBotThread(selectedId);
      setConversation(next);
      await refreshThreads(true);
    } catch (error) {
      setReplyError(getErrorMessage(error, 'Nie udało się oznaczyć sprawy jako załatwionej.'));
    } finally {
      setCompletingBot(false);
    }
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendReply();
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[#007865]">
            <MessageCircle className="h-5 w-5" aria-hidden="true" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">WhatsApp Business</span>
          </div>
          <h1 className="text-3xl font-light text-neutral-900">Wiadomości</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Wątki pacjentów od najnowszych, bez przełączania między aplikacjami.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="hidden text-[11px] text-neutral-400 sm:inline">
              Odświeżono {timeFormatter.format(lastUpdated)}
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            className="h-10 gap-2 text-xs"
            disabled={refreshing}
            onClick={() => void manualRefresh()}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} aria-hidden="true" />
            Odśwież
          </Button>
        </div>
      </header>

      {status && !status.threads_configured && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Połączenie numeru gabinetu z Meta jest jeszcze kończone. Karta jest gotowa i zacznie
          pobierać wątki automatycznie po aktywacji WhatsApp Business.
        </div>
      )}

      {status?.threads_configured && (
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <ShieldCheck className="h-4 w-4 text-[#007865]" aria-hidden="true" />
          Treść jest szyfrowana w bazie i usuwana po {status.retention_days} dniach.
        </div>
      )}

      {loadError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      <section className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-[0_18px_50px_rgba(32,49,73,0.08)]">
        <div className="grid min-h-[640px] lg:h-[calc(100vh-14rem)] lg:min-h-[640px] lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside
            className={cn(
              'min-h-0 flex-col border-neutral-200 bg-[#fbfcfc] lg:flex lg:border-r',
              selectedId === null ? 'flex' : 'hidden',
            )}
          >
            <div className="space-y-3 border-b border-neutral-200 p-4">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Imię, numer lub treść"
                  className="h-11 w-full rounded-xl border border-neutral-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-[#007865]"
                />
              </label>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-xs text-neutral-700 outline-none focus:border-[#007865]"
              >
                <option value="attention">Do obsłużenia</option>
                <option value="high">Pilne</option>
                <option value="all">Wszystkie sprawy</option>
                <option value="no_action">Bez akcji</option>
                {Object.entries(categoryMeta).map(([value, meta]) => (
                  <option key={value} value={value}>{meta.label}</option>
                ))}
              </select>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {loadingThreads ? (
                <div className="space-y-2 p-2">
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="h-24 animate-pulse rounded-2xl bg-neutral-100" />
                  ))}
                </div>
              ) : filteredThreads.length === 0 ? (
                <div className="flex h-full min-h-72 flex-col items-center justify-center px-7 text-center">
                  <div className="mb-4 rounded-full bg-neutral-100 p-4 text-neutral-400">
                    <MessageCircle className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <p className="text-sm font-medium text-neutral-800">
                    {threads.length === 0 ? 'Nie ma jeszcze wątków' : 'Brak pasujących rozmów'}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-neutral-500">
                    {threads.length === 0
                      ? 'Nowe rozmowy pojawią się tutaj automatycznie.'
                      : 'Zmień wyszukiwanie albo filtr sprawy.'}
                  </p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {filteredThreads.map((thread) => {
                    const meta = categoryFor(thread.issue_category);
                    const active = selectedId === thread.id;
                    const label = contactLabel(thread.display_name, thread.is_patient, thread.contact_confidence);
                    return (
                      <motion.button
                        layout
                        key={thread.id}
                        type="button"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.18 }}
                        onClick={() => setSelectedId(thread.id)}
                        className={cn(
                          'mb-1.5 w-full rounded-2xl border px-3 py-3 text-left transition-colors',
                          active
                            ? 'border-[#91c9be] bg-[#edf8f5]'
                            : 'border-transparent hover:border-neutral-200 hover:bg-white',
                        )}
                        aria-pressed={active}
                      >
                        <div className="flex items-start gap-3">
                          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#203149] text-xs font-semibold text-white">
                            {initials(label)}
                            {thread.unread_count > 0 && (
                              <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-[#00a884]" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-900">
                                {label}
                              </p>
                              <time className="shrink-0 text-[10px] text-neutral-400">
                                {threadDate(thread.last_message_at)}
                              </time>
                            </div>
                            <div className="mt-1 flex items-center gap-1.5">
                              <span className={cn(
                                'rounded-full px-2 py-0.5 text-[9px] font-medium ring-1 ring-inset',
                                meta.className,
                              )}>
                                {meta.label}
                              </span>
                              {thread.is_patient && (
                                <span className="truncate text-[9px] font-medium text-[#007865]">
                                  pacjent
                                </span>
                              )}
                              {thread.priority === 'high' && (
                                <span className="truncate text-[9px] font-medium text-rose-600">
                                  pilne
                                </span>
                              )}
                              {thread.bot_state && thread.bot_state !== 'idle' && (
                                <span className="truncate text-[9px] font-medium text-[#007865]">
                                  bot: {botStateLabel(thread.bot_state)}
                                </span>
                              )}
                            </div>
                            {thread.labels && thread.labels.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {thread.labels.slice(0, 3).map((label) => (
                                  <span key={label} className="rounded-full bg-white px-1.5 py-0.5 text-[9px] font-medium text-neutral-500 ring-1 ring-neutral-200">
                                    {label}
                                  </span>
                                ))}
                              </div>
                            )}
                            {thread.triage_summary && (
                              <p className="mt-1 truncate text-[11px] font-medium text-neutral-600">
                                {thread.triage_summary}
                              </p>
                            )}
                            <div className="mt-1.5 flex items-center gap-2">
                              <p className="min-w-0 flex-1 truncate text-xs text-neutral-500">
                                {thread.last_direction === 'outbound' ? 'Ty: ' : ''}
                                {thread.preview || 'Wiadomość bez podglądu'}
                              </p>
                              {thread.unread_count > 0 && (
                                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#00a884] px-1 text-[10px] font-semibold text-white">
                                  {thread.unread_count}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>
          </aside>

          <main
            className={cn(
              'min-h-0 flex-col bg-[#f5f8f7] lg:flex',
              selectedId === null ? 'hidden' : 'flex',
            )}
          >
            {selectedThread ? (
              <>
                <div className="flex items-center gap-3 border-b border-neutral-200 bg-white px-4 py-3">
                  <button
                    type="button"
                    className="rounded-full p-2 text-neutral-500 hover:bg-neutral-100 lg:hidden"
                    onClick={() => setSelectedId(null)}
                    aria-label="Wróć do listy wątków"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#203149] text-xs font-semibold text-white">
                    {initials(contactLabel(selectedThread.display_name, selectedThread.is_patient, selectedThread.contact_confidence))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-sm font-semibold text-neutral-900">
                        {contactLabel(selectedThread.display_name, selectedThread.is_patient, selectedThread.contact_confidence)}
                      </h2>
                      {selectedThread.is_patient && (
                        <span className="rounded-full bg-[#e7f4f1] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#007865]">
                          pacjent z rezerwacji
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-neutral-500">
                      {selectedThread.phone} · {categoryFor(selectedThread.issue_category).label} · priorytet {priorityLabel(selectedThread.priority)}
                    </p>
                    {selectedThread.triage_summary && (
                      <p className="mt-1 truncate text-xs text-neutral-600">{selectedThread.triage_summary}</p>
                    )}
                  </div>
                  {selectedThread.requires_attention && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 shrink-0 text-[11px]"
                      disabled={completingBot}
                      onClick={() => void completeBotThread()}
                    >
                      {completingBot ? 'Zapis...' : 'Załatwione'}
                    </Button>
                  )}
                  <a
                    href={selectedThread.whatsapp_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 text-[11px] font-medium text-neutral-700 transition hover:border-[#007865] hover:text-[#007865]"
                  >
                    <span className="hidden sm:inline">WhatsApp</span>
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-7">
                  {(selectedThread.bot_state && selectedThread.bot_state !== 'idle') || botDataRows(selectedThread).length > 0 ? (
                    <div className="mx-auto mb-4 max-w-3xl rounded-2xl border border-[#cfe7e1] bg-white/90 p-4 text-xs text-neutral-700 shadow-sm">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#e7f4f1] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#007865]">
                          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                          Bot: {botStateLabel(selectedThread.bot_state)}
                        </span>
                        {selectedThread.bot_paused && (
                          <span className="rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-medium text-neutral-600">
                            pauza automatyzacji
                          </span>
                        )}
                      </div>
                      {botDataRows(selectedThread).length > 0 && (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {selectedThread.labels && selectedThread.labels.length > 0 && (
                            <div className="sm:col-span-2">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Etykiety</p>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {selectedThread.labels.map((label) => (
                                  <span key={label} className="rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-medium text-neutral-700">
                                    {label}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {botDataRows(selectedThread).map(([label, value]) => (
                            <div key={label} className={label === 'Opis' ? 'sm:col-span-2' : ''}>
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">{label}</p>
                              <p className="mt-0.5 whitespace-pre-wrap break-words text-neutral-800">{value}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                  {loadingConversation && !conversation ? (
                    <div className="flex h-full items-center justify-center text-sm text-neutral-500">
                      Wczytywanie rozmowy...
                    </div>
                  ) : conversation?.messages.length ? (
                    <div className="mx-auto flex max-w-3xl flex-col gap-2">
                      <div className="mb-3 flex justify-center">
                        <span className="rounded-full bg-white/90 px-3 py-1 text-[10px] text-neutral-500 shadow-sm ring-1 ring-neutral-200">
                          Wiadomości z ostatnich {status?.retention_days || 30} dni
                        </span>
                      </div>
                      <AnimatePresence initial={false}>
                        {conversation.messages.map((message) => {
                          const outbound = message.direction === 'outbound';
                          return (
                            <motion.div
                              key={message.id}
                              initial={{ opacity: 0, y: 8, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              transition={{ duration: 0.18 }}
                              className={cn('flex', outbound ? 'justify-end' : 'justify-start')}
                            >
                              <div
                                className={cn(
                                  'max-w-[86%] rounded-2xl px-3.5 py-2.5 shadow-sm sm:max-w-[72%]',
                                  outbound
                                    ? 'rounded-br-md bg-[#d9fdd3] text-neutral-900'
                                    : 'rounded-bl-md bg-white text-neutral-900 ring-1 ring-neutral-100',
                                )}
                                title={exactDate(message.sent_at)}
                              >
                                <p className="whitespace-pre-wrap break-words text-sm leading-5">
                                  {message.body || '[Wiadomość bez treści]'}
                                </p>
                                <div className="mt-1 flex items-center justify-end gap-1 text-[9px] text-neutral-500">
                                  <time>{threadDate(message.sent_at)}</time>
                                  {outbound && (
                                    <>
                                      <CheckCheck
                                        className={cn(
                                          'h-3 w-3',
                                          message.status === 'read' ? 'text-sky-600' : 'text-neutral-400',
                                        )}
                                        aria-hidden="true"
                                      />
                                      <span className="sr-only">{messageStatus(message)}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                      <div ref={messagesEndRef} />
                    </div>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center text-center">
                      <MessageCircle className="mb-3 h-8 w-8 text-neutral-300" aria-hidden="true" />
                      <p className="text-sm text-neutral-500">Brak zapisanych wiadomości w tym wątku.</p>
                    </div>
                  )}
                </div>

                <div className="border-t border-neutral-200 bg-white p-3 sm:p-4">
                  {replyError && (
                    <p className="mx-auto mb-2 max-w-3xl text-xs text-red-600">{replyError}</p>
                  )}
                  {selectedThread.can_reply && status?.sending_configured ? (
                    <form
                      className="mx-auto flex max-w-3xl items-end gap-2"
                      onSubmit={(event) => void sendReply(event)}
                    >
                      <label className="sr-only" htmlFor="whatsapp-reply">Treść odpowiedzi</label>
                      <textarea
                        id="whatsapp-reply"
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={handleComposerKeyDown}
                        maxLength={1500}
                        rows={1}
                        placeholder="Napisz odpowiedź..."
                        className="max-h-36 min-h-11 flex-1 resize-y rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none transition focus:border-[#007865] focus:bg-white"
                      />
                      <Button
                        type="submit"
                        className="h-11 w-11 shrink-0 rounded-full p-0"
                        disabled={sending || draft.trim() === ''}
                        aria-label="Wyślij odpowiedź"
                      >
                        <Send className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </form>
                  ) : (
                    <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-2 text-xs text-amber-800">
                        <Clock3 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <p>
                          {status?.sending_configured
                            ? 'Minęło 24-godzinne okno odpowiedzi przez API. Otwórz rozmowę w WhatsApp Business.'
                            : 'Wysyłanie będzie dostępne po zakończeniu połączenia numeru z Meta.'}
                        </p>
                      </div>
                      <a
                        href={selectedThread.whatsapp_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#007865] px-3 text-[11px] font-semibold text-white"
                      >
                        Otwórz WhatsApp
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <div className="mb-4 rounded-full bg-[#e7f4f1] p-5 text-[#007865]">
                  <MessageCircle className="h-8 w-8" aria-hidden="true" />
                </div>
                <h2 className="text-lg font-medium text-neutral-900">Wybierz rozmowę</h2>
                <p className="mt-1 max-w-sm text-sm leading-6 text-neutral-500">
                  Najnowsze wątki są na górze. Po otwarciu wiadomości zostaną oznaczone jako przeczytane.
                </p>
              </div>
            )}
          </main>
        </div>
      </section>
    </div>
  );
}

function phoneMessageTypeLabel(value: PhoneMessage['message_type']): string {
  if (value === 'sms') return 'SMS';
  if (value === 'voicemail') return 'Poczta głosowa';
  if (value === 'transcript') return 'Transkrypcja';
  return 'Notatka';
}

function PhonePanel() {
  const [threads, setThreads] = useState<PhoneThread[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [conversation, setConversation] = useState<PhoneConversation | null>(null);
  const [search, setSearch] = useState('');
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshThreads = useCallback(async () => {
    setLoadingThreads(true);
    try {
      const rows = await bookingApi.getPhoneThreads(75);
      setThreads(rows);
      setSelectedId((current) => current ?? rows[0]?.id ?? null);
      setError(null);
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Nie udało się wczytać połączeń.'));
    } finally {
      setLoadingThreads(false);
    }
  }, []);

  const refreshConversation = useCallback(async (threadId: number) => {
    setLoadingConversation(true);
    try {
      setConversation(await bookingApi.getPhoneMessages(threadId));
      setError(null);
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Nie udało się wczytać wiadomości telefonu.'));
    } finally {
      setLoadingConversation(false);
    }
  }, []);

  useEffect(() => {
    void refreshThreads();
  }, [refreshThreads]);

  useEffect(() => {
    if (selectedId === null) {
      setConversation(null);
      return;
    }
    void refreshConversation(selectedId);
  }, [refreshConversation, selectedId]);

  const filteredThreads = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pl-PL');
    if (!query) return threads;
    return threads.filter((thread) =>
      [thread.display_name, thread.phone, thread.summary, thread.messages_preview]
        .join(' ')
        .toLocaleLowerCase('pl-PL')
        .includes(query),
    );
  }, [search, threads]);

  const selectedThread = conversation?.thread
    || threads.find((thread) => thread.id === selectedId)
    || null;

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[#007865]">
            <PhoneMissed className="h-5 w-5" aria-hidden="true" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">Telefon</span>
          </div>
          <h1 className="text-3xl font-light text-neutral-900">Nieodebrane połączenia</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Numery z telefonu/CDR z wiadomościami i podpowiedzią, kto mógł dzwonić.
          </p>
        </div>
        <Button type="button" variant="outline" className="h-10 gap-2 text-xs" onClick={() => void refreshThreads()}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Odśwież
        </Button>
      </header>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-[0_18px_50px_rgba(32,49,73,0.08)]">
        <div className="grid min-h-[620px] lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="min-h-0 border-neutral-200 bg-[#fbfcfc] lg:border-r">
            <div className="border-b border-neutral-200 p-4">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Numer, osoba lub sprawa"
                  className="h-11 w-full rounded-xl border border-neutral-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-[#007865]"
                />
              </label>
            </div>
            <div className="max-h-[620px] overflow-y-auto p-2">
              {loadingThreads ? (
                <div className="p-4 text-sm text-neutral-500">Wczytywanie połączeń...</div>
              ) : filteredThreads.length === 0 ? (
                <div className="p-6 text-sm text-neutral-500">Brak połączeń do pokazania.</div>
              ) : filteredThreads.map((thread) => {
                const active = selectedId === thread.id;
                const label = contactLabel(thread.display_name, false, thread.contact_confidence);
                return (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => setSelectedId(thread.id)}
                    className={cn(
                      'mb-1.5 w-full rounded-2xl border px-3 py-3 text-left transition-colors',
                      active ? 'border-[#91c9be] bg-[#edf8f5]' : 'border-transparent hover:border-neutral-200 hover:bg-white',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#203149] text-xs font-semibold text-white">
                        {initials(label)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-900">{label}</p>
                          <time className="shrink-0 text-[10px] text-neutral-400">{threadDate(thread.last_call_at)}</time>
                        </div>
                        <p className="mt-1 truncate text-[11px] font-medium text-neutral-600">{thread.summary || thread.phone}</p>
                        <p className="mt-1 truncate text-xs text-neutral-500">{thread.messages_preview || 'Brak treści wiadomości'}</p>
                        <div className="mt-2 flex items-center gap-1.5 text-[9px] font-medium text-neutral-500">
                          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-700 ring-1 ring-inset ring-rose-100">
                            {thread.missed_count} nieodebr.
                          </span>
                          <span>{thread.contact_source}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <main className="min-h-0 bg-[#f5f8f7]">
            {selectedThread ? (
              <div className="flex h-full min-h-[620px] flex-col">
                <div className="flex items-center gap-3 border-b border-neutral-200 bg-white px-4 py-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#203149] text-xs font-semibold text-white">
                    {initials(contactLabel(selectedThread.display_name, false, selectedThread.contact_confidence))}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-semibold text-neutral-900">
                      {contactLabel(selectedThread.display_name, false, selectedThread.contact_confidence)}
                    </h2>
                    <p className="mt-0.5 truncate text-[11px] text-neutral-500">
                      {selectedThread.phone} · {selectedThread.missed_count} nieodebranych · źródło {selectedThread.contact_source}
                    </p>
                  </div>
                  <a
                    href={`tel:${selectedThread.phone}`}
                    className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl bg-[#007865] px-3 text-[11px] font-semibold text-white"
                  >
                    Oddzwoń
                  </a>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-7">
                  {loadingConversation ? (
                    <div className="text-sm text-neutral-500">Wczytywanie wiadomości...</div>
                  ) : conversation?.messages.length ? (
                    <div className="mx-auto flex max-w-3xl flex-col gap-2">
                      {conversation.messages.map((message) => (
                        <div key={message.id} className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-neutral-100">
                          <div className="mb-1 flex items-center justify-between gap-3 text-[10px] font-medium uppercase tracking-wide text-neutral-400">
                            <span>{phoneMessageTypeLabel(message.message_type)}</span>
                            <time>{exactDate(message.sent_at)}</time>
                          </div>
                          <p className="whitespace-pre-wrap break-words text-sm leading-5 text-neutral-900">
                            {message.body || '[Brak treści]'}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center text-center">
                      <PhoneMissed className="mb-3 h-8 w-8 text-neutral-300" aria-hidden="true" />
                      <p className="text-sm text-neutral-500">Ten numer ma tylko metadane połączenia, bez treści wiadomości.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[620px] items-center justify-center text-sm text-neutral-500">
                Wybierz połączenie.
              </div>
            )}
          </main>
        </div>
      </section>
    </div>
  );
}

function IntentPanel() {
  const [intents, setIntents] = useState<ContactIntent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftSummary, setDraftSummary] = useState('');

  const refreshIntents = useCallback(async () => {
    setLoading(true);
    try {
      setIntents(await bookingApi.getContactIntents());
      setError(null);
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Nie udało się wczytać intencji.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshIntents();
  }, [refreshIntents]);

  const updateStatus = async (intent: ContactIntent, status: ContactIntent['status']) => {
    setSaving(true);
    try {
      const updated = await bookingApi.updateContactIntent(intent.id, { status });
      setIntents((current) => current.map((item) => item.id === intent.id ? updated : item));
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Nie udało się zaktualizować intencji.'));
    } finally {
      setSaving(false);
    }
  };

  const deleteIntent = async (intent: ContactIntent) => {
    setSaving(true);
    try {
      await bookingApi.deleteContactIntent(intent.id);
      setIntents((current) => current.filter((item) => item.id !== intent.id));
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Nie udało się usunąć intencji.'));
    } finally {
      setSaving(false);
    }
  };

  const addManualIntent = async (event: FormEvent) => {
    event.preventDefault();
    const title = draftTitle.trim();
    if (!title) return;
    setSaving(true);
    try {
      const created = await bookingApi.createContactIntent({
        channel: 'manual',
        title,
        summary: draftSummary.trim(),
        contact_label: 'Ręcznie dodane',
        category: 'manual',
        priority: 'normal',
        status: 'pending',
      });
      setIntents((current) => [created, ...current]);
      setDraftTitle('');
      setDraftSummary('');
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Nie udało się dodać intencji.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      <header>
        <div className="mb-2 flex items-center gap-2 text-[#007865]">
          <ListChecks className="h-5 w-5" aria-hidden="true" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">Triage</span>
        </div>
        <h1 className="text-3xl font-light text-neutral-900">Intencje do zaznaczenia</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Krótkie sprawy wyciągnięte z WhatsAppa i telefonu: potwierdź, odrzuć, usuń albo dodaj ręcznie.
        </p>
      </header>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={(event) => void addManualIntent(event)} className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto]">
          <input
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            placeholder="Dodaj ręcznie: tytuł sprawy"
            className="h-11 rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-[#007865]"
          />
          <input
            value={draftSummary}
            onChange={(event) => setDraftSummary(event.target.value)}
            placeholder="Krótki opis"
            className="h-11 rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-[#007865]"
          />
          <Button type="submit" className="h-11 gap-2" disabled={saving || !draftTitle.trim()}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Dodaj
          </Button>
        </div>
      </form>

      <section className="rounded-3xl border border-neutral-200 bg-white p-3 shadow-[0_18px_50px_rgba(32,49,73,0.08)]">
        {loading ? (
          <div className="p-6 text-sm text-neutral-500">Wczytywanie intencji...</div>
        ) : intents.length === 0 ? (
          <div className="p-6 text-sm text-neutral-500">Brak intencji do obsłużenia.</div>
        ) : (
          <div className="space-y-2">
            {intents.map((intent) => (
              <article key={intent.id} className="rounded-2xl border border-neutral-100 bg-[#fbfcfc] p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold text-neutral-900">{intent.title}</h2>
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-600">
                        {intent.channel}
                      </span>
                      <span className="rounded-full bg-[#e7f4f1] px-2 py-0.5 text-[10px] font-medium text-[#007865]">
                        {priorityLabel(intent.priority)}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500">{intent.contact_label} {intent.phone ? `· ${intent.phone}` : ''}</p>
                    <p className="mt-2 text-sm leading-5 text-neutral-700">{intent.summary || 'Brak opisu.'}</p>
                    <p className="mt-2 text-[10px] text-neutral-400">Wyłapane: {exactDate(intent.extracted_at)} · status {intent.status}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button type="button" variant="outline" className="h-9 gap-1.5 text-xs" disabled={saving} onClick={() => void updateStatus(intent, 'done')}>
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Tak
                    </Button>
                    <Button type="button" variant="outline" className="h-9 gap-1.5 text-xs" disabled={saving} onClick={() => void updateStatus(intent, 'dismissed')}>
                      <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      Nie
                    </Button>
                    <Button type="button" variant="outline" className="h-9 gap-1.5 text-xs text-red-600" disabled={saving} onClick={() => void deleteIntent(intent)}>
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Usuń
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MessagesPanel() {
  const [tab, setTab] = useState<'whatsapp' | 'phone' | 'intents'>('whatsapp');
  const tabs = [
    { id: 'whatsapp' as const, label: 'WhatsApp', icon: MessageCircle },
    { id: 'phone' as const, label: 'Telefon', icon: PhoneMissed },
    { id: 'intents' as const, label: 'Intencje', icon: ListChecks },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 rounded-2xl border border-neutral-200 bg-white p-2 shadow-sm">
        {tabs.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                'inline-flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-semibold transition',
                active ? 'bg-[#203149] text-white' : 'text-neutral-600 hover:bg-neutral-100',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </div>
      {tab === 'whatsapp' && <WhatsAppPanel />}
      {tab === 'phone' && <PhonePanel />}
      {tab === 'intents' && <IntentPanel />}
    </div>
  );
}

export default function AdminMessages() {
  return (
    <AdminGate>
      <MessagesPanel />
    </AdminGate>
  );
}
