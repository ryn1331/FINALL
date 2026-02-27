import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface GlobalVoiceButtonProps {
  currentForm: Record<string, string>;
  onFieldsExtracted: (fields: Record<string, string>) => void;
}

export default function GlobalVoiceButton({ currentForm, onFieldsExtracted }: GlobalVoiceButtonProps) {
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [interim, setInterim] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const recognitionRef = useRef<any>(null);
  const fullTranscriptRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) try { recognitionRef.current.stop(); } catch {}
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const processTranscript = useCallback(async (transcript: string) => {
    if (!transcript.trim()) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('parse-voice-fields', {
        body: { transcript, currentForm },
      });
      if (error) throw error;
      const fields = data?.fields || {};
      const fieldCount = Object.keys(fields).length;
      if (fieldCount > 0) {
        onFieldsExtracted(fields);
        toast.success(`${fieldCount} champ(s) rempli(s) automatiquement par l'IA`, {
          description: Object.keys(fields).join(', '),
        });
      } else {
        toast.info("Aucun champ identifié dans la dictée");
      }
    } catch (err: any) {
      console.error('Voice AI error:', err);
      toast.error("Erreur lors de l'analyse vocale");
    } finally {
      setProcessing(false);
    }
  }, [currentForm, onFieldsExtracted]);

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Votre navigateur ne supporte pas la reconnaissance vocale");
      return;
    }

    fullTranscriptRef.current = '';
    setInterim('');
    setElapsed(0);

    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    };

    recognition.onresult = (event: any) => {
      let finalText = '';
      let interimText = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript + ' ';
        } else {
          interimText += result[0].transcript;
        }
      }
      if (finalText) fullTranscriptRef.current += finalText;
      setInterim(interimText || finalText.trim());
    };

    recognition.onerror = () => stopListening();

    recognition.onend = () => {
      if (recognitionRef.current === recognition && listening) {
        try { recognition.start(); } catch {}
        return;
      }
      finalize();
    };

    recognitionRef.current = recognition;
    recognition.start();

    // Auto-stop after 2 minutes
    setTimeout(() => {
      if (recognitionRef.current === recognition) stopListening();
    }, 120000);
  }, []);

  const finalize = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setListening(false);
    setElapsed(0);
    const text = fullTranscriptRef.current.trim();
    setInterim('');
    fullTranscriptRef.current = '';
    if (text) processTranscript(text);
  }, [processTranscript]);

  const stopListening = useCallback(() => {
    const rec = recognitionRef.current;
    recognitionRef.current = null;
    if (rec) try { rec.stop(); } catch {}
    finalize();
  }, [finalize]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Live transcript bubble */}
      <AnimatePresence>
        {(listening || processing) && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="bg-card border border-border shadow-xl rounded-2xl p-4 max-w-sm w-72"
          >
            {processing ? (
              <div className="flex items-center gap-3">
                <Loader2 size={18} className="animate-spin text-primary" />
                <div>
                  <p className="text-sm font-medium">Analyse IA en cours...</p>
                  <p className="text-xs text-muted-foreground">Distribution des champs</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5 h-4">
                      {[0, 1, 2, 3, 4].map(i => (
                        <motion.div
                          key={i}
                          className="w-[3px] rounded-full bg-destructive"
                          animate={{ height: ['3px', `${6 + Math.random() * 10}px`, '3px'] }}
                          transition={{ duration: 0.5 + Math.random() * 0.3, repeat: Infinity, delay: i * 0.1 }}
                        />
                      ))}
                    </div>
                    <span className="text-xs font-mono text-destructive font-medium tabular-nums">{formatTime(elapsed)}</span>
                  </div>
                  <Sparkles size={14} className="text-primary" />
                </div>
                {interim && (
                  <p className="text-xs text-muted-foreground italic leading-relaxed line-clamp-3">
                    « {interim} »
                  </p>
                )}
                {!interim && (
                  <p className="text-xs text-muted-foreground">Parlez naturellement... L'IA distribuera les infos automatiquement.</p>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main FAB */}
      <div className="relative">
        <AnimatePresence>
          {listening && (
            <>
              <motion.div
                className="absolute inset-0 rounded-full bg-destructive/20"
                initial={{ scale: 1 }}
                animate={{ scale: [1, 1.6, 1], opacity: [0.4, 0, 0.4] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <motion.div
                className="absolute inset-0 rounded-full bg-destructive/10"
                initial={{ scale: 1 }}
                animate={{ scale: [1, 2, 1], opacity: [0.3, 0, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
              />
            </>
          )}
        </AnimatePresence>

        <motion.button
          type="button"
          disabled={processing}
          onClick={listening ? stopListening : startListening}
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.05 }}
          className={cn(
            'relative z-10 flex items-center justify-center rounded-full w-16 h-16 shadow-lg transition-colors duration-200',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            listening
              ? 'bg-destructive text-destructive-foreground'
              : processing
              ? 'bg-primary/70 text-primary-foreground'
              : 'bg-primary text-primary-foreground hover:bg-primary/90',
            processing && 'pointer-events-none'
          )}
          title={listening ? 'Arrêter et analyser' : 'Dictée vocale intelligente'}
        >
          {processing ? (
            <Loader2 size={24} className="animate-spin" />
          ) : listening ? (
            <Square size={22} className="fill-current" />
          ) : (
            <Mic size={28} />
          )}
        </motion.button>
      </div>
    </div>
  );
}
