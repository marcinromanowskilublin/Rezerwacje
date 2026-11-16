import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { config } from '../../config/features';
import type { Booking } from '../../types';

type Candidate = {
  visit_id: number;
  patient_name: string;
  date: string;
  time: string;
  state: string;
  exact_name_match: boolean;
  latest_modification: string;
};

type Props = {
  booking: Booking;
  onClose: () => void;
};

function supportedMimeType(): string {
  const options = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  return options.find((value) => MediaRecorder.isTypeSupported(value)) || '';
}

async function apiResponse<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'include', ...init });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `Błąd serwera (${response.status})`);
  }
  return data as T;
}

export default function EdrVoiceVisit({ booking, onClose }: Props) {
  const [csrf, setCsrf] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [transcript, setTranscript] = useState('');
  const [saveKey, setSaveKey] = useState('');
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mountedRef = useRef(true);
  const discardRecordingRef = useRef(false);
  const recordingLimitRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const apiUrl = `${config.API_BASE_URL}/edr-voice.php`;

  const selected = candidates.find((candidate) => candidate.visit_id === selectedId) || null;
  const exactCandidateCount = candidates.filter((candidate) => candidate.exact_name_match).length;

  useEffect(() => {
    let cancelled = false;
    mountedRef.current = true;
    const load = async () => {
      setBusy(true);
      setError('');
      try {
        const session = await apiResponse<{ authenticated: boolean; csrf_token?: string }>(
          `${config.API_BASE_URL}/admin/session`,
        );
        if (!session.authenticated || !session.csrf_token) {
          throw new Error('Sesja administratora wygasła.');
        }
        if (cancelled) return;
        setCsrf(session.csrf_token);
        const result = await apiResponse<{ candidates: Candidate[] }>(`${apiUrl}?action=candidates`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': session.csrf_token,
          },
          body: JSON.stringify({
            booking_id: booking.id,
          }),
        });
        if (cancelled) return;
        setCandidates(result.candidates);
        const exact = result.candidates.filter((candidate) => candidate.exact_name_match);
        if (exact.length === 1) setSelectedId(exact[0].visit_id);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Nie udało się połączyć z EDR.');
      } finally {
        if (!cancelled) setBusy(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
      mountedRef.current = false;
      discardRecordingRef.current = true;
      if (recordingLimitRef.current) clearTimeout(recordingLimitRef.current);
      if (recorderRef.current?.state === 'recording') {
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [apiUrl, booking.id]);

  const transcribe = async (blob: Blob) => {
    if (!csrf) return;
    setBusy(true);
    setError('');
    setMessage('Transkrypcja nagrania…');
    try {
      const form = new FormData();
      form.append('audio', blob, 'dyktowanie.webm');
      const result = await apiResponse<{ transcript: string }>(`${apiUrl}?action=transcribe`, {
        method: 'POST',
        headers: { 'X-CSRF-Token': csrf },
        body: form,
      });
      if (!mountedRef.current) return;
      setTranscript(result.transcript);
      setSaveKey(crypto.randomUUID());
      setMessage('Sprawdź i popraw tekst przed zapisaniem do EDR.');
    } catch (caught) {
      if (mountedRef.current) {
        setError(caught instanceof Error ? caught.message : 'Nie udało się przepisać nagrania.');
        setMessage('');
      }
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  };

  const startRecording = async () => {
    if (!consentConfirmed || busy) return;
    setError('');
    setMessage('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = supportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      streamRef.current = stream;
      recorderRef.current = recorder;
      discardRecordingRef.current = false;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        if (recordingLimitRef.current) clearTimeout(recordingLimitRef.current);
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        chunksRef.current = [];
        if (!discardRecordingRef.current && mountedRef.current && blob.size > 0) void transcribe(blob);
      };
      recorder.start(1000);
      recordingLimitRef.current = setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop();
        if (mountedRef.current) setRecording(false);
      }, 30 * 60 * 1000);
      setRecording(true);
      setMessage('Nagrywanie trwa. Po zakończeniu nagranie zostanie wysłane do transkrypcji w UE.');
    } catch {
      setError('Przeglądarka nie udostępniła mikrofonu.');
    }
  };

  const stopRecording = () => {
    if (recordingLimitRef.current) clearTimeout(recordingLimitRef.current);
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    setRecording(false);
  };

  const saveToEdr = async () => {
    if (!csrf || !selected || !selected.exact_name_match || !transcript.trim() || !saveKey || busy) return;
    setBusy(true);
    setError('');
    setMessage('Zapisywanie wywiadu w EDR…');
    try {
      await apiResponse<{ ok: boolean }>(`${apiUrl}?action=save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrf,
        },
        body: JSON.stringify({
          booking_id: booking.id,
          visit_id: selected.visit_id,
          transcript: transcript.trim(),
          latest_modification: selected.latest_modification,
          idempotency_key: saveKey,
        }),
      });
      setMessage('Wywiad został dopisany do właściwej wizyty w EDR.');
      setTranscript('');
      setSaveKey('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Nie udało się zapisać wywiadu w EDR.');
      setMessage('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/45 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl bg-white p-6">
        <div>
          <h3 className="text-lg font-medium">Dyktowanie wizyty do EDR</h3>
          <p className="text-sm text-neutral-500">
            {booking.patient_name} · {booking.booking_date} · {booking.start_time.slice(0, 5)}
          </p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          Nagranie trafia do Deepgram w regionie UE z żądaniem zerowej retencji. Tekst nie zapisze
          się automatycznie — najpierw trzeba go sprawdzić i potwierdzić jednoznacznie dopasowaną wizytę.
        </div>

        <label className="flex items-start gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            className="mt-1"
            checked={consentConfirmed}
            onChange={(event) => setConsentConfirmed(event.target.checked)}
          />
          <span>Potwierdzam poinformowanie pacjenta i podstawę prawną nagrywania/transkrypcji.</span>
        </label>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-widest text-neutral-500">Wizyta w EDR</p>
          {busy && candidates.length === 0 ? (
            <p className="text-sm text-neutral-500">Wyszukiwanie wizyty…</p>
          ) : candidates.length === 0 ? (
            <p className="text-sm text-red-700">Nie znaleziono wizyty EDR o tej samej dacie i godzinie.</p>
          ) : (
            <div className="space-y-2">
              {exactCandidateCount > 1 && (
                <p className="text-sm text-red-700">
                  Kilka wizyt ma identyczne dane. Zapis jest zablokowany do czasu ręcznego powiązania.
                </p>
              )}
              {candidates.map((candidate) => (
                <label
                  key={candidate.visit_id}
                  className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${
                    candidate.exact_name_match ? 'border-neutral-200' : 'border-red-200 bg-red-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="edr-visit"
                    className="mt-1"
                    checked={selectedId === candidate.visit_id}
                    disabled={!candidate.exact_name_match || exactCandidateCount !== 1}
                    onChange={() => setSelectedId(candidate.visit_id)}
                  />
                  <span>
                    <span className="font-medium">{candidate.patient_name}</span>
                    <span className="block text-xs text-neutral-500">
                      {candidate.date} · {candidate.time} · {candidate.state || 'brak statusu'}
                    </span>
                    {!candidate.exact_name_match && (
                      <span className="block text-xs text-red-700">
                        Dane pacjenta nie są identyczne — zapis jest zablokowany.
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {!recording ? (
            <Button disabled={!consentConfirmed || busy} onClick={() => void startRecording()}>
              Rozpocznij nagrywanie
            </Button>
          ) : (
            <Button className="bg-red-700 hover:bg-red-800" onClick={stopRecording}>
              Zakończ nagrywanie
            </Button>
          )}
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-widest text-neutral-500">
            Tekst do pola „Wywiad”
          </span>
          <textarea
            value={transcript}
            onChange={(event) => setTranscript(event.target.value)}
            rows={10}
            maxLength={30000}
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            placeholder="Po zakończeniu nagrywania pojawi się tutaj transkrypcja…"
          />
        </label>

        {message && <p className="text-sm text-emerald-700">{message}</p>}
        {error && <p className="text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" disabled={recording} onClick={onClose}>Zamknij</Button>
          <Button
            disabled={
              busy
              || recording
              || !consentConfirmed
              || !selected?.exact_name_match
              || exactCandidateCount !== 1
              || !transcript.trim()
              || !saveKey
            }
            onClick={() => void saveToEdr()}
          >
            {busy ? 'Przetwarzanie…' : 'Dopisz wywiad do EDR'}
          </Button>
        </div>
      </div>
    </div>
  );
}
