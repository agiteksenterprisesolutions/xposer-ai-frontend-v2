// src/utils/tone.js
//
// Maps the loose color names used by dashboard stat cards and timelines onto
// static token classes.
//
// These must be written out in full: Tailwind scans source text for complete
// class names, so an interpolated `bg-${color}-50` is never generated and the
// element ends up with no background at all.

const TONES = {
  blue: { soft: 'bg-accent-soft', fg: 'text-accent-fg', solid: 'bg-accent', line: 'border-line-accent' },
  indigo: { soft: 'bg-accent-soft', fg: 'text-accent-fg', solid: 'bg-accent', line: 'border-line-accent' },
  purple: { soft: 'bg-accent-soft', fg: 'text-accent-fg', solid: 'bg-accent', line: 'border-line-accent' },
  primary: { soft: 'bg-accent-soft', fg: 'text-accent-fg', solid: 'bg-accent', line: 'border-line-accent' },
  green: { soft: 'bg-success-soft', fg: 'text-success-fg', solid: 'bg-success-solid', line: 'border-success-line' },
  emerald: { soft: 'bg-success-soft', fg: 'text-success-fg', solid: 'bg-success-solid', line: 'border-success-line' },
  orange: { soft: 'bg-warning-soft', fg: 'text-warning-fg', solid: 'bg-warning-solid', line: 'border-warning-line' },
  amber: { soft: 'bg-warning-soft', fg: 'text-warning-fg', solid: 'bg-warning-solid', line: 'border-warning-line' },
  yellow: { soft: 'bg-warning-soft', fg: 'text-warning-fg', solid: 'bg-warning-solid', line: 'border-warning-line' },
  red: { soft: 'bg-danger-soft', fg: 'text-danger-fg', solid: 'bg-danger-solid', line: 'border-danger-line' },
  rose: { soft: 'bg-danger-soft', fg: 'text-danger-fg', solid: 'bg-danger-solid', line: 'border-danger-line' },
  cyan: { soft: 'bg-info-soft', fg: 'text-info-fg', solid: 'bg-info-solid', line: 'border-info-line' },
  gray: { soft: 'bg-active', fg: 'text-ink-muted', solid: 'bg-active', line: 'border-line' },
};

const FALLBACK = TONES.gray;

/** Full tone set for a color name: { soft, fg, solid, line }. */
export const tone = (name) => TONES[name] || FALLBACK;

export default tone;
