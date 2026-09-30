// src/components/ui/AudioVisualizer.jsx
//
// Live microphone meter, drawn on a canvas. It replaces the chat's text input
// while the mic is open, so it has to work at any width from a phone (~100px
// of meter) up to the desktop panel.
//
// The look follows LiveKit's bar visualizer: chunky, fully-rounded pills
// growing symmetrically from the centre line, each one a frequency band rather
// than a single FFT bin. A bar with no energy rests as a dot instead of
// vanishing, and bars only take the accent colour once they carry signal —
// LiveKit's idle/highlighted split.
//
// It is one canvas in a single requestAnimationFrame loop rather than animated
// DOM nodes: restyling every bar per frame would thrash layout on a mid-range
// phone, and a canvas costs one composite.
import { useEffect, useRef, useState } from 'react';
import { Mic } from 'lucide-react';

// Bar geometry in CSS pixels. Thick bars, generously spaced, and few of them:
// that is what separates the LiveKit look from a spectrum analyser. The gap is
// derived from the width so the row always fills its slot exactly.
const BAR_WIDTH = { compact: 5, regular: 6 };
const MIN_GAP_RATIO = 1.2;
const MAX_GAP_RATIO = 2.4;
const MIN_BARS = 5;
const MAX_BARS = 15;
const COMPACT_WIDTH = 200;

// A bar below this carries no real signal and stays in the idle colour.
const HIGHLIGHT_LEVEL = 0.12;

// Resting bar height, as a fraction of the tallest possible bar. LiveKit keeps
// a floor here too: at zero the row collapses into a line of dots, and a short
// pill reads as a meter waiting for sound.
const MIN_BAR_RATIO = 0.24;

// Bars span the speech band rather than the full 24kHz the FFT covers: above
// ~7kHz a voice puts out almost nothing, so mapping the whole range spends
// half the meter on permanently flat bars. Derived from the context's real
// sample rate, which is not 48kHz on every device.
const SPEECH_MIN_HZ = 90;
const SPEECH_MAX_HZ = 7000;

// How fast a bar chases its target. Lower is smoother but laggier; this is
// roughly one 60fps frame behind, which reads as responsive without jitter.
const ATTACK = 0.45;
const RELEASE = 0.18;

// Treated as "no sound reaching the mic" once it holds for SILENCE_AFTER_MS.
const SILENCE_LEVEL = 0.045;
const SILENCE_AFTER_MS = 2600;

// Normalisation. Raw FFT levels for ordinary speech on a laptop mic sit low
// enough to draw as a flat line, and they vary hugely between devices, so the
// meter tracks a decaying peak and scales to it. PEAK_FLOOR caps how far quiet
// input can be amplified — without it, room noise fills the whole meter.
const PEAK_DECAY = 0.992;
const PEAK_FLOOR = 0.2;

// Below this container width the written label is dropped for the meter. The
// widget panel is ~450px wide on every desktop, so this has to key off the
// element, not the viewport.
const LABEL_MIN_WIDTH = 300;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Resolve a theme token to a concrete color the canvas can paint with. */
const readToken = (element, token, fallback) => {
  const value = getComputedStyle(element).getPropertyValue(token).trim();
  return value || fallback;
};

const formatElapsed = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

const AudioVisualizer = ({
  stream,
  active = true,
  label = 'Listening',
  showTimer = true,
  className = '',
}) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  // The pill. Its width is independent of what is rendered inside it, which
  // matters: deciding the label from the meter's own width would be a feedback
  // loop (hide label -> meter grows -> show label -> meter shrinks), and a
  // ResizeObserver caught in one stops delivering notifications entirely.
  const rootRef = useRef(null);
  const levelsRef = useRef([]);
  const rafRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  // Read once per resize/theme change instead of once per frame —
  // getComputedStyle in a rAF loop is a well-known jank source.
  const paletteRef = useRef(null);
  const silenceSinceRef = useRef(null);
  const targetsRef = useRef([]);
  const peakRef = useRef(PEAK_FLOOR);

  const [isSilent, setIsSilent] = useState(false);
  const [showLabel, setShowLabel] = useState(true);
  const [elapsed, setElapsed] = useState(0);

  // Elapsed time is its own 1Hz interval so the draw loop never triggers a
  // React render.
  useEffect(() => {
    if (!active || !showTimer) return undefined;
    setElapsed(0);
    const started = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [active, showTimer]);

  // Analyser: tapped off the live track, never connected to the destination —
  // routing the mic to the speakers would create feedback.
  useEffect(() => {
    if (!active || !stream) return undefined;

    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return undefined;

    let cancelled = false;
    let source = null;
    const audioCtx = new AudioContextCtor();
    audioCtxRef.current = audioCtx;

    try {
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.72;
      // Widen the floor a little: default -100dB leaves quiet speech invisible.
      analyser.minDecibels = -85;
      analyser.maxDecibels = -15;

      source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyserRef.current = analyser;

      // Browsers start the context suspended until a gesture; opening the mic
      // is one, but resume() can still settle a frame later.
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => { });
      }
    } catch (error) {
      console.error('AudioVisualizer - could not analyse the microphone stream:', error);
    }

    return () => {
      cancelled = true;
      analyserRef.current = null;
      try {
        source?.disconnect();
      } catch (error) {
        /* already torn down */
      }
      // Closing releases the audio thread; without it every mic toggle leaks
      // a context and browsers cap how many a page may hold.
      audioCtx.close().catch(() => { });
      audioCtxRef.current = null;
      if (cancelled) silenceSinceRef.current = null;
    };
  }, [active, stream]);

  // Sizing, palette, and the draw loop.
  useEffect(() => {
    if (!active) return undefined;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    const root = rootRef.current;
    if (!canvas || !container || !root) return undefined;

    const ctx = canvas.getContext('2d');
    const reduceMotion = prefersReducedMotion();
    // roundRect is recent (Safari 16, Firefox 112); square bars are a fine
    // degradation on anything older.
    const hasRoundRect = typeof ctx.roundRect === 'function';
    let width = 0;
    let height = 0;

    const readPalette = () => {
      const root = document.documentElement;
      paletteRef.current = {
        accent: readToken(root, '--xp-accent', '#3b82f6'),
        accentSoft: readToken(root, '--xp-accent-hover', '#60a5fa'),
        idle: readToken(root, '--xp-border-strong', 'rgba(255,255,255,0.2)'),
      };
    };

    const resize = () => {
      const rect = container.getBoundingClientRect();
      // Label visibility follows the pill's width, not the window's and not
      // the meter's — see the note on rootRef.
      const rootWidth = root.getBoundingClientRect().width;
      setShowLabel((prev) => {
        const next = rootWidth >= LABEL_MIN_WIDTH;
        return prev === next ? prev : next;
      });
      // Cap the backing store at 2x: a 3x phone gains nothing visible here and
      // triples the fill cost.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(rect.width, 1);
      height = Math.max(rect.height, 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    readPalette();
    resize();

    // Both: the pill decides the label, the meter decides the canvas, and
    // showing the label resizes the meter without resizing the pill. Reading
    // the label from the pill alone keeps this from looping.
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(root);
    resizeObserver.observe(container);

    // The palette is theme-dependent, and the theme can flip while the mic is
    // open.
    const themeObserver = new MutationObserver(readPalette);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    const frequencies = new Uint8Array(1024 / 2);
    let lastSilenceCheck = 0;

    const draw = (timestamp) => {
      rafRef.current = requestAnimationFrame(draw);

      const compact = width < COMPACT_WIDTH;
      const barWidth = compact ? BAR_WIDTH.compact : BAR_WIDTH.regular;
      const minGap = barWidth * MIN_GAP_RATIO;
      // Cap the count first, then spread the leftover space into the gaps, so
      // a wide slot gets airier bars rather than more of them.
      const count = Math.max(
        MIN_BARS,
        Math.min(MAX_BARS, Math.floor((width + minGap) / (barWidth + minGap)))
      );
      const gap =
        count > 1
          ? Math.min((width - count * barWidth) / (count - 1), barWidth * MAX_GAP_RATIO)
          : 0;

      const levels = levelsRef.current;
      if (levels.length !== count) {
        levels.length = count;
        levels.fill(0);
      }

      const analyser = analyserRef.current;
      let sum = 0;

      if (analyser) {
        analyser.getByteFrequencyData(frequencies);
        const hzPerBin = analyser.context.sampleRate / analyser.fftSize;
        const minBin = Math.max(1, Math.round(SPEECH_MIN_HZ / hzPerBin));
        const maxBin = Math.min(
          frequencies.length - 1,
          Math.max(minBin + count, Math.round(SPEECH_MAX_HZ / hzPerBin))
        );

        const targets = targetsRef.current;
        if (targets.length !== count) targets.length = count;
        let frameMax = 0;

        const ratio = maxBin / minBin;

        for (let i = 0; i < count; i += 1) {
          // One bar is one band, not one bin: each covers everything from its
          // own edge to the next bar's. Bands are log-spaced because linear
          // spacing crams all the vocal energy into the leftmost few bars and
          // leaves the rest dead.
          const from = Math.round(minBin * Math.pow(ratio, i / count));
          const to = Math.max(
            from,
            Math.min(
              frequencies.length - 1,
              Math.round(minBin * Math.pow(ratio, (i + 1) / count)) - 1
            )
          );

          // Peak-weighted average: a plain mean over a wide high band buries a
          // real formant under the silence around it, while a plain peak
          // flickers. Halfway between the two is stable and still lively.
          let acc = 0;
          let peak = 0;
          for (let b = from; b <= to; b += 1) {
            acc += frequencies[b];
            if (frequencies[b] > peak) peak = frequencies[b];
          }
          const mean = acc / (to - from + 1);
          // Gamma lift: raw byte values sit low for normal speech. Weighted
          // towards the mean — leaning on the peak makes every band saturate.
          const raw = Math.pow((mean * 0.7 + peak * 0.3) / 255, 0.72);
          targets[i] = raw;
          if (raw > frameMax) frameMax = raw;
          sum += raw;
        }

        // Decaying peak, so the meter adapts to a quiet mic within a second or
        // two but does not jump on every syllable.
        peakRef.current = Math.max(peakRef.current * PEAK_DECAY, frameMax, PEAK_FLOOR);
        // Headroom: normalising the loudest band to exactly 1 pins it to the
        // ceiling on every syllable and flattens the shape.
        const gain = 0.88 / peakRef.current;

        for (let i = 0; i < count; i += 1) {
          const target = Math.min(1, targets[i] * gain);
          const smoothing = target > levels[i] ? ATTACK : RELEASE;
          levels[i] += (target - levels[i]) * (reduceMotion ? 1 : smoothing);
        }
      } else {
        // No analyser yet (permission race, or an unsupported browser). A
        // highlight sweeping left to right, like LiveKit's connecting state,
        // so the control reads as waiting rather than broken.
        for (let i = 0; i < count; i += 1) {
          if (reduceMotion) {
            levels[i] = 0.14;
            continue;
          }
          const head = ((timestamp / 900) % 1) * (count + 6) - 3;
          const distance = Math.abs(i - head);
          levels[i] = distance > 3 ? 0.06 : 0.06 + (1 - distance / 3) * 0.5;
        }
      }

      // Silence detection at 4Hz — flipping React state per frame would be
      // sixty renders a second.
      if (analyser && timestamp - lastSilenceCheck > 250) {
        lastSilenceCheck = timestamp;
        const average = sum / count;
        if (average < SILENCE_LEVEL) {
          if (silenceSinceRef.current == null) silenceSinceRef.current = timestamp;
          const silent = timestamp - silenceSinceRef.current > SILENCE_AFTER_MS;
          setIsSilent((prev) => (prev === silent ? prev : silent));
        } else {
          silenceSinceRef.current = null;
          setIsSilent((prev) => (prev ? false : prev));
        }
      }

      const palette = paletteRef.current;
      const mid = height / 2;
      // Half-heights, measured from the centre line the bars grow either side
      // of. A full-scale bar spans the meter but for a hairline; a bar with no
      // signal keeps MIN_BAR_RATIO of that, so a pause leaves an even row of
      // short pills rather than an empty strip.
      const maxBar = height / 2 - 0.5;
      const minBar = Math.max(barWidth / 2, maxBar * MIN_BAR_RATIO);
      const radius = barWidth / 2;

      ctx.clearRect(0, 0, width, height);

      // Centre the row so an odd remainder splits evenly either side.
      const totalWidth = count * barWidth + (count - 1) * gap;

      // Two passes, so the whole idle set is painted before the active bars —
      // one fillStyle change per pass instead of one per bar.
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, palette.accent);
      gradient.addColorStop(0.5, palette.accentSoft);
      gradient.addColorStop(1, palette.accent);

      for (let pass = 0; pass < 2; pass += 1) {
        const highlighted = pass === 1;
        ctx.fillStyle = highlighted ? gradient : palette.idle;
        let x = Math.max(0, (width - totalWidth) / 2);

        for (let i = 0; i < count; i += 1) {
          const level = levels[i];
          // A bar carrying no real energy stays dim — LiveKit's idle vs
          // highlighted split, which is what makes speech legible at a glance.
          if ((level >= HIGHLIGHT_LEVEL) === highlighted) {
            const magnitude = Math.max(minBar, level * maxBar);
            const barHeight = magnitude * 2;

            if (hasRoundRect) {
              ctx.beginPath();
              ctx.roundRect(x, mid - magnitude, barWidth, barHeight, radius);
              ctx.fill();
            } else {
              ctx.fillRect(x, mid - magnitude, barWidth, barHeight);
            }
          }
          x += barWidth + gap;
        }
      }
    };

    rafRef.current = requestAnimationFrame(draw);

    peakRef.current = PEAK_FLOOR;

    return () => {
      cancelAnimationFrame(rafRef.current);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      levelsRef.current = [];
      silenceSinceRef.current = null;
    };
  }, [active]);

  if (!active) return null;

  return (
    <div
      ref={rootRef}
      className={`flex min-w-0 flex-1 items-center gap-2 rounded-full border border-line-strong bg-canvas px-2.5 py-1.5 sm:gap-3 sm:px-3.5 sm:py-2 ${className}`}
      role="status"
      aria-live="polite"
    >
      {/* Recording indicator. The ring is decorative; the label carries the
          meaning for screen readers. */}
      <span className="relative flex h-2.5 w-2.5 shrink-0 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger-solid opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-danger-solid" />
      </span>

      {showLabel && (
        <span
          className={`shrink-0 text-xs font-medium ${isSilent ? 'text-warning-fg' : 'text-ink-secondary'}`}
        >
          {isSilent ? 'No sound detected' : label}
        </span>
      )}

      {/* The meter itself. min-w-0 lets it shrink inside the flex row instead
          of pushing the timer off a narrow screen. */}
      <div ref={containerRef} className="relative h-7 min-w-0 flex-1 sm:h-8">
        <canvas ref={canvasRef} className="block h-full w-full" aria-hidden="true" />
        {/* On a narrow pill the label is gone, so the warning goes over the
            meter — silence is the one state worth interrupting for. */}
        {isSilent && !showLabel && (
          <span className="absolute inset-0 flex items-center justify-center gap-1 rounded-full bg-canvas text-[10px] font-medium text-warning-fg">
            <Mic className="h-3 w-3" />
            No sound
          </span>
        )}
      </div>

      {showTimer && (
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-muted sm:text-xs">
          {formatElapsed(elapsed)}
        </span>
      )}
    </div>
  );
};

export default AudioVisualizer;
