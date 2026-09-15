import React, { useState, useEffect, useRef } from 'react';
import { Mic, Send, Loader2, Bot, CalendarPlus, ShieldAlert, Sparkles, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { bookingApi } from '../../services/bookingApi';

// Mock Web Speech API interface
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: (event: any) => void;
  onend: () => void;
  onerror: (event: any) => void;
}

export function AdminAssistant({ onSimulatedAction }: { onSimulatedAction: (action: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    // Initialize Web Speech API if supported
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current!.continuous = false;
      recognitionRef.current!.interimResults = true;
      recognitionRef.current!.lang = 'pl-PL';

      recognitionRef.current!.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setText(prev => (prev + ' ' + finalTranscript).trim());
        }
      };

      recognitionRef.current!.onend = () => {
        setIsListening(false);
      };
      
      recognitionRef.current!.onerror = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListen = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setText('');
      setFeedback(null);
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    
    setIsProcessing(true);
    setFeedback(null);
    
    try {
      const response = await bookingApi.askAssistant!(text);
      setFeedback(response.reply);
      
      if (response.action === 'block' || response.action === 'block_slot' || response.action === 'block_day') {
        onSimulatedAction('block');
      } else if (response.action === 'book' || response.action === 'book_visit') {
        onSimulatedAction('book');
      }
      
      setTimeout(() => {
        setText('');
      }, 3000);
    } catch (err) {
      setFeedback('Wystąpił błąd podczas połączenia z asystentem.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center justify-between p-4 bg-white border border-brand-100 rounded-xl hover:border-brand-400 transition-colors shadow-sm group"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center text-brand-700">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="font-medium text-sm text-neutral-900">Inteligentny Asystent</span>
          <span className="text-xs text-neutral-500 hidden sm:inline-block">Opisz co chcesz zrobić...</span>
        </div>
        <div className="flex items-center gap-2 text-neutral-400 group-hover:text-brand-700 transition-colors">
          <Mic className="w-4 h-4" />
        </div>
      </button>
    );
  }

  return (
    <div className="bg-white border border-brand-100 rounded-xl p-4 sm:p-6 shadow-sm space-y-4 relative">
      <button onClick={() => setIsOpen(false)} className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-900">
        <X className="w-5 h-5" />
      </button>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white">
          <Bot className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-sm text-neutral-900">Asystent AI (Demo)</h3>
          <p className="text-xs text-neutral-500">Zarządzaj kalendarzem za pomocą głosu i tekstu</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 relative">
        <div className="relative flex-1">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Napisz np. 'Zablokuj wtorek' lub użyj mikrofonu..."
            className="w-full h-12 pl-4 pr-12 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 focus:bg-white focus:border-brand-600 outline-none transition-all text-sm"
            disabled={isProcessing}
          />
          {recognitionRef.current && (
            <button
              type="button"
              onClick={toggleListen}
              className={`absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100'}`}
              title="Mów"
            >
              <Mic className="w-4 h-4" />
            </button>
          )}
        </div>
        <Button type="submit" disabled={isProcessing || !text.trim()} className="w-12 h-12 p-0 flex-shrink-0">
          {isProcessing ? <Loader2 className="w-5 h-5 animate-spin text-white" /> : <Send className="w-4 h-4 text-white" />}
        </Button>
      </form>

      {feedback && (
        <div className="p-3 bg-brand-50 border border-brand-100 rounded-lg flex gap-3 text-sm animate-in fade-in zoom-in duration-300">
          <Sparkles className="w-4 h-4 text-brand-700 shrink-0 mt-0.5" />
          <p className="text-neutral-600 leading-relaxed">{feedback}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-2">
        <p className="text-[10px] w-full uppercase font-bold tracking-widest text-neutral-400">Przykłady:</p>
        <button type="button" onClick={() => setText("Zablokuj wtorek od 14 do 16")} className="text-xs px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 transition-colors">
          "Zablokuj wtorek..."
        </button>
        <button type="button" onClick={() => setText("Wpisz wizytę pani Annie na jutro o 12")} className="text-xs px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 transition-colors">
          "Wpisz wizytę..."
        </button>
      </div>
    </div>
  );
}
