import { Loader2, Pause, Play, Square, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../lib/api.ts';

interface TtsBriefingButtonProps {
  label?: string;
  text: string;
  secondaryText?: string;
  mode?: 'single' | 'dispatch_dialogue';
  style?: string;
  compact?: boolean;
}

const VOICES = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'] as const;

export function TtsBriefingButton({
  label = 'Listen Brief',
  text,
  secondaryText,
  mode = 'single',
  style,
  compact = false,
}: TtsBriefingButtonProps) {
  const [voice, setVoice] = useState<(typeof VOICES)[number]>('Kore');
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const handleGenerateAndPlay = async () => {
    setError(null);

    if (audioRef.current && audioUrl) {
      if (playing) {
        audioRef.current.pause();
        setPlaying(false);
      } else {
        await audioRef.current.play();
        setPlaying(true);
      }
      return;
    }

    setLoading(true);
    try {
      const res = await apiRequest<{ audioBase64: string; mimeType: string }>('/api/tts', {
        method: 'POST',
        body: JSON.stringify({
          text,
          secondaryText,
          mode,
          voiceName: voice,
          style,
        }),
      });

      const byteChars = atob(res.audioBase64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i += 1) {
        byteNumbers[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([new Uint8Array(byteNumbers)], {
        type: res.mimeType || 'audio/wav',
      });
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setPlaying(false);
      audio.onerror = () => {
        setPlaying(false);
        setError('Unable to play generated audio stream.');
      };
      await audio.play();
      setPlaying(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to synthesize speech.');
    } finally {
      setLoading(false);
    }
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setPlaying(false);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    audioRef.current = null;
  };

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <div className="inline-flex items-center gap-1.5">
        {!compact && (
          <select
            aria-label="Voice persona"
            value={voice}
            onChange={(e) => {
              handleStop();
              setVoice(e.target.value as (typeof VOICES)[number]);
            }}
            className="h-9 rounded-lg border border-[#D99A32]/30 bg-[#211B19]/90 px-2.5 text-xs font-semibold text-[#FFF1DC] shadow-xs transition-all focus:border-[#E87524] focus:ring-2 focus:ring-[#E87524]/25 focus:outline-none [color-scheme:dark]"
          >
            {VOICES.map((v) => (
              <option key={v} value={v}>
                Voice: {v}
              </option>
            ))}
          </select>
        )}

        <button
          type="button"
          onClick={handleGenerateAndPlay}
          disabled={loading}
          className="ff-btn-royal h-9 px-3.5 text-xs"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
          ) : playing ? (
            <Pause className="h-3.5 w-3.5 shrink-0" />
          ) : audioUrl ? (
            <Play className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <Volume2 className="h-3.5 w-3.5 shrink-0" />
          )}
          <span>{loading ? 'Synthesizing...' : playing ? 'Pause Audio' : label}</span>
        </button>

        {audioUrl && (
          <button
            type="button"
            onClick={handleStop}
            aria-label="Stop audio briefing"
            className="ff-btn-danger h-9 w-9 p-0"
          >
            <Square className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
