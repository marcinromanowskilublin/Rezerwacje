import { FormEvent, useEffect, useState, type JSX } from 'react';
import { bookingApi } from '../../services/bookingApi';
import { AvailabilityRule, SlotAudience, VisitKind, VisitType } from '../../types';
import { AUDIENCE_OPTIONS, DURATION_OPTIONS, WEEKDAYS } from '../../lib/schedule';
import { Button } from '../../components/ui/Button';
import AdminGate from './AdminGate';

function audienceLabel(value: string) {
  return AUDIENCE_OPTIONS.find((o) => o.id === value)?.label || value;
}

function weekdayLabel(id: number) {
  return WEEKDAYS.find((d) => d.id === id)?.label || String(id);
}

function ScheduleEditor() {
  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [types, setTypes] = useState<VisitType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [day, setDay] = useState(1);
  const [start, setStart] = useState('15:00');
  const [end, setEnd] = useState('20:00');
  const [slotEvery, setSlotEvery] = useState(60);
  const [audience, setAudience] = useState<SlotAudience>('all');

  const load = () => {
    setLoading(true);
    Promise.all([bookingApi.getAvailabilityRules(), bookingApi.listVisitTypes()])
      .then(([nextRules, nextTypes]) => {
        setRules(nextRules.sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time)));
        setTypes(nextTypes);
        setLoading(false);
      })
      .catch(() => {
        setError('Nie udało się wczytać grafiku.');
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
  }, []);

  const addWindow = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await bookingApi.createAvailabilityRule({
        day_of_week: day,
        start_time: start,
        end_time: end,
        slot_duration: slotEvery,
        buffer_minutes: 0,
        audience,
      });
      load();
    } catch {
      setError('Nie udało się dodać okna.');
    }
  };

  const removeWindow = async (id: string) => {
    if (!confirm('Usunąć to okno z grafiku? Pacjent przestanie je widzieć.')) return;
    await bookingApi.deleteAvailabilityRule(id);
    load();
  };

  const saveType = async (type: VisitType) => {
    await bookingApi.updateVisitType(type.id, type);
    load();
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-light text-neutral-900 mb-2">Grafik</h1>
        <p className="text-neutral-500 text-sm">
          To, co ustawisz tutaj, pacjent widzi jako dostępne godziny. Osobne okna możesz dać na pierwszą wizytę, kontrolną albo wszystkich.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="space-y-4">
        <h2 className="text-lg font-light">Okna przyjęć</h2>
        <form onSubmit={addWindow} className="bg-white border border-neutral-200 rounded-xl p-5 grid gap-3 sm:grid-cols-2">
          <label className="text-xs uppercase tracking-widest text-neutral-500 space-y-1">
            Dzień
            <select value={day} onChange={(e) => setDay(Number(e.target.value))} className="w-full h-11 px-3 rounded-xl border border-neutral-200 text-sm text-neutral-900">
              {WEEKDAYS.map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </label>
          <label className="text-xs uppercase tracking-widest text-neutral-500 space-y-1">
            Dla kogo
            <select value={audience} onChange={(e) => setAudience(e.target.value as SlotAudience)} className="w-full h-11 px-3 rounded-xl border border-neutral-200 text-sm text-neutral-900">
              {AUDIENCE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="text-xs uppercase tracking-widest text-neutral-500 space-y-1">
            Od
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="w-full h-11 px-3 rounded-xl border border-neutral-200 text-sm" />
          </label>
          <label className="text-xs uppercase tracking-widest text-neutral-500 space-y-1">
            Do
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full h-11 px-3 rounded-xl border border-neutral-200 text-sm" />
          </label>
          <label className="text-xs uppercase tracking-widest text-neutral-500 space-y-1 sm:col-span-2">
            Pokazuj godziny co (minuty)
            <input type="number" min={5} max={180} step={5} value={slotEvery} onChange={(e) => setSlotEvery(Number(e.target.value))} className="w-full h-11 px-3 rounded-xl border border-neutral-200 text-sm" />
          </label>
          <p className="text-xs text-neutral-500 sm:col-span-2">
            Pacjent widzi tylko konkretne godziny, np. 15:00, 16:00, 17:00.
          </p>
          <div className="sm:col-span-2">
            <Button type="submit" className="h-11 text-sm">Dodaj okno</Button>
          </div>
        </form>

        <div className="bg-white border border-neutral-200 rounded-xl divide-y divide-neutral-100">
          {loading ? (
            <p className="p-6 text-sm text-neutral-500">Wczytywanie...</p>
          ) : rules.length === 0 ? (
            <p className="p-6 text-sm text-neutral-500">Brak okien. Pacjent nie zobaczy żadnych terminów, dopóki czegoś nie dodasz.</p>
          ) : rules.map((rule) => (
            <div key={rule.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
              <div className="text-sm">
                <p className="font-medium text-neutral-900">{weekdayLabel(rule.day_of_week)} {rule.start_time}–{rule.end_time}</p>
                <p className="text-neutral-500 text-xs">
                  {audienceLabel(rule.audience)} · co {rule.slot_duration || 60} min
                </p>
              </div>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => removeWindow(rule.id)}>
                Usuń
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-light">Rodzaje i długość wizyt</h2>
        <div className="space-y-3">
          {types.map((type) => (
            <div key={type.id}>
              <VisitTypeRow type={type} onSave={saveType} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function VisitTypeRow({ type, onSave }: { type: VisitType; onSave: (type: VisitType) => Promise<void> }): JSX.Element {
  const [draft, setDraft] = useState(type);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(type);
  }, [type]);

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-5 grid gap-3 sm:grid-cols-2">
      <label className="text-xs uppercase tracking-widest text-neutral-500 space-y-1">
        Nazwa
        <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="w-full h-11 px-3 rounded-xl border border-neutral-200 text-sm" />
      </label>
      <label className="text-xs uppercase tracking-widest text-neutral-500 space-y-1">
        Dla kogo
        <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as VisitKind })} className="w-full h-11 px-3 rounded-xl border border-neutral-200 text-sm">
          <option value="first">Pierwsza wizyta</option>
          <option value="followup">Kontrolna / kolejna</option>
        </select>
      </label>
      <label className="text-xs uppercase tracking-widest text-neutral-500 space-y-1">
        Długość (min)
        <select value={draft.duration_minutes} onChange={(e) => setDraft({ ...draft, duration_minutes: Number(e.target.value) })} className="w-full h-11 px-3 rounded-xl border border-neutral-200 text-sm">
          {DURATION_OPTIONS.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </label>
      <label className="text-xs uppercase tracking-widest text-neutral-500 space-y-1">
        Cena
        <input type="number" min={0} value={draft.price} onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })} className="w-full h-11 px-3 rounded-xl border border-neutral-200 text-sm" />
      </label>
      <label className="flex items-center gap-2 text-sm text-neutral-700 sm:col-span-2">
        <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
        Widoczna dla pacjenta
      </label>
      <div>
        <Button
          className="h-10 text-xs"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            await onSave(draft);
            setSaving(false);
          }}
        >
          {saving ? 'Zapis...' : 'Zapisz rodzaj'}
        </Button>
      </div>
    </div>
  );
}

export default function AdminSchedule() {
  return (
    <AdminGate>
      <ScheduleEditor />
    </AdminGate>
  );
}
