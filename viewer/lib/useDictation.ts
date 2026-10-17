'use client';

import { useEffect, useRef, useState } from 'react';

// Minimal typing for the (webkit-prefixed in Chrome/Safari) Web Speech API.
type Recognition = {
  continuous: boolean; interimResults: boolean; lang: string;
  start(): void; stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

// Speech-to-text via the browser. `onFinal` receives each finished phrase; `interim` is the phrase in progress.
export function useDictation(onFinal: (text: string) => void) {
  const rec = useRef<Recognition | null>(null);
  const cb = useRef(onFinal);
  cb.current = onFinal;
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    setSupported(true);
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = 'en-US';
    r.onresult = (e) => {
      let live = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) cb.current(res[0].transcript.trim()); else live += res[0].transcript;
      }
      setInterim(live);
    };
    r.onend = () => { setListening(false); setInterim(''); };
    r.onerror = (e) => setError(e.error === 'not-allowed' ? 'Microphone access was denied.' : `Dictation error: ${e.error}`);
    rec.current = r;
    return () => { r.onend = null; r.stop(); };
  }, []);

  const toggle = () => {
    const r = rec.current;
    if (!r) return;
    setError(null);
    if (listening) { r.stop(); return; }
    try { r.start(); setListening(true); } catch { /* already started */ }
  };

  return { supported, listening, interim, error, toggle };
}
