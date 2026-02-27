import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Square, AudioWaveform } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface VoiceMicButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'lg';
  /** Show live transcript preview inline */
  showPreview?: boolean;
  /** Continuous mode: keeps listening until manually stopped */
  continuous?: boolean;
}

export default function VoiceMicButton({
  onTranscript,
  disabled,
  className,
  size = 'sm',
  showPreview = false,
  continuous = false,
}: VoiceMicButtonProps) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const recognitionRef = useRef<any>(null);
  const fullTranscriptRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) try { recognitionRef.current.stop(); } catch {}
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      onTranscript('');
      return;
    }

    fullTranscriptRef.current = '';
    setInterim('');
    setElapsed(0);

    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.continuous = continuous;
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

      if (finalText) {
        fullTranscriptRef.current += finalText;
      }
      setInterim(interimText || finalText.trim());
    };

    recognition.onerror = () => {
      stopListening();
    };

    recognition.onend = () => {
      // In continuous mode, auto-restart if still supposed to be listening
      if (continuous && recognitionRef.current === recognition && listening) {
        try { recognition.start(); } catch {}
        return;
      }
      finalize();
    };

    recognitionRef.current = recognition;
    recognition.start();

    // Auto-stop after 60s for continuous, 15s for single
    const timeout = continuous ? 60000 : 15000;
    setTimeout(() => {
      if (recognitionRef.current === recognition) {
        stopListening();
      }
    }, timeout);
  }, [onTranscript, continuous]);

  const finalize = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setListening(false);
    setElapsed(0);
    const text = fullTranscriptRef.current.trim();
    if (text) {
      onTranscript(text);
    }
    setInterim('');
    fullTranscriptRef.current = '';
  }, [onTranscript]);

  const stopListening = useCallback(() => {
    const rec = recognitionRef.current;
    recognitionRef.current = null; // prevent auto-restart in continuous mode
    if (rec) {
      try { rec.stop(); } catch {}
    }
    finalize();
  }, [finalize]);

  const isLarge = size === 'lg';
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className={cn('relative inline-flex items-center gap-2', className)}>
      {/* Pulse rings when listening */}
      <AnimatePresence>
        {listening && (
          <>
            <motion.div
              className="absolute rounded-full bg-primary/20"
              style={{ width: isLarge ? 80 : 48, height: isLarge ? 80 : 48, left: isLarge ? -8 : -4, top: isLarge ? -8 : -4 }}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute rounded-full bg-destructive/15"
              style={{ width: isLarge ? 80 : 48, height: isLarge ? 80 : 48, left: isLarge ? -8 : -4, top: isLarge ? -8 : -4 }}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: [1, 1.6, 1], opacity: [0.3, 0, 0.3] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
            />
          </>
        )}
      </AnimatePresence>

      {/* Main button */}
      <motion.button
        type="button"
        disabled={disabled}
        onClick={listening ? stopListening : startListening}
        whileTap={{ scale: 0.92 }}
        className={cn(
          'relative z-10 flex items-center justify-center rounded-full transition-colors duration-200',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          isLarge ? 'w-16 h-16' : 'w-10 h-10',
          listening
            ? 'bg-destructive text-destructive-foreground shadow-lg'
            : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-md',
          disabled && 'opacity-50 pointer-events-none'
        )}
        title={listening ? 'Arrêter l\'enregistrement' : 'Commencer la dictée'}
      >
        {listening ? (
          <Square size={isLarge ? 22 : 14} className="fill-current" />
        ) : (
          <Mic size={isLarge ? 28 : 18} />
        )}
      </motion.button>

      {/* Status indicator */}
      <AnimatePresence>
        {listening && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            className="flex items-center gap-2"
          >
            {/* Waveform bars */}
            <div className="flex items-center gap-0.5 h-5">
              {[0, 1, 2, 3, 4].map(i => (
                <motion.div
                  key={i}
                  className="w-[3px] rounded-full bg-destructive"
                  animate={{
                    height: ['4px', `${8 + Math.random() * 12}px`, '4px'],
                  }}
                  transition={{
                    duration: 0.5 + Math.random() * 0.3,
                    repeat: Infinity,
                    delay: i * 0.1,
                    ease: 'easeInOut',
                  }}
                />
              ))}
            </div>

            <span className="text-xs font-mono text-destructive font-medium tabular-nums">
              {formatTime(elapsed)}
            </span>

            {showPreview && interim && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-muted-foreground max-w-[200px] truncate italic"
              >
                {interim}
              </motion.span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
