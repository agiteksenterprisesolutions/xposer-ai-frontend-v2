// src/utils/posterRender.js
//
// Draws a QR poster (PORTAL.md §4) from one GET /posters/{id}/render response.
// The same drawing feeds the live preview and the PDF, so the preview is the
// PDF. Nothing here makes a network request: the logo arrives inlined as a
// data URL, the font is bundled (@fontsource/ibm-plex-sans-arabic, loaded in
// main.jsx), and the QR code is computed locally.
//
// pdf-lib can't shape Arabic, so the poster is drawn on a canvas (the browser
// shapes and orders Arabic text) at 300 dpi and placed full-page in a PDF of
// the exact paper size. The QR code is drawn module by module on that canvas,
// so it stays sharp at print resolution.
//
//   const { drawPoster, posterPdf } = await import('./posterRender');
//   await drawPoster(canvas, render, { width: 600 });      // preview
//   const blob = await posterPdf(render, 'A4');            // download
import QRCode from 'qrcode';

/** Paper sizes: pixels at 300 dpi and PDF points (1/72 in). */
export const PAPER = {
  A4: { px: [2480, 3508], pt: [595.28, 841.89] },
  A3: { px: [3508, 4961], pt: [841.89, 1190.55] },
};

/** Theme fallbacks when the organization set no colours (light theme). */
const DEFAULT_PRIMARY = '#2563EB';
const DEFAULT_ACCENT = '#F59E0B';
const INK = '#111827';
const INK_MUTED = '#4B5563';
const WHITE = '#FFFFFF';

const FONT = '"IBM Plex Sans Arabic", "Noto Naskh Arabic", system-ui, sans-serif';
const WEIGHTS = [400, 600, 700];

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const HEX = /^#[0-9a-f]{6}$/i;

const clean = (value) => (typeof value === 'string' ? value.trim() : '');
const colour = (value, fallback) => (HEX.test(value || '') ? value : fallback);

/** WCAG relative luminance of #RRGGBB. */
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};
/** White or near-black, whichever reads better on `bg`. */
export const textOn = (bg) => (contrast(bg, WHITE) >= contrast(bg, INK) ? WHITE : INK);

/** Wait for the bundled font (Latin and Arabic subsets) at every weight used. */
let fontsReady = null;
export const loadPosterFonts = () => {
  if (!fontsReady) {
    fontsReady = typeof document === 'undefined' || !document.fonts
      ? Promise.resolve()
      : Promise.all(
          WEIGHTS.map((w) => document.fonts.load(`${w} 40px "IBM Plex Sans Arabic"`, 'Speak up امسح الرمز للإبلاغ 0123')),
        ).then(() => undefined, () => undefined);
  }
  return fontsReady;
};

const loadImage = (src) =>
  new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

/** The QR matrix for `value`, error correction M. Encodes `value` exactly. */
export const qrMatrix = (value, level = 'M') => {
  const qr = QRCode.create(value, { errorCorrectionLevel: level || 'M' });
  return { size: qr.modules.size, dark: (x, y) => qr.modules.get(y, x) };
};

/** Split `text` into lines no wider than `maxWidth` with the context's current font. */
const wrap = (ctx, text, maxWidth) => {
  const words = clean(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
};

/**
 * Lays out (and, when `paint` is true, draws) the poster at unit scale `s`.
 * Returns the height used, so the caller can shrink `s` until it fits.
 */
const layout = (ctx, W, H, data, s, paint) => {
  const { poster, branding, qr, logo } = data;
  const primary = colour(branding?.primary_color, DEFAULT_PRIMARY);
  const accent = colour(branding?.accent_color, DEFAULT_ACCENT);
  const onPrimary = textOn(primary);
  const onAccent = textOn(accent);

  const frame = Math.round(W * 0.018);
  const margin = Math.round(W * 0.075);
  const inner = W - margin * 2;
  const left = margin;
  const right = W - margin;
  const gap = W * 0.022 * s;
  let y = frame + W * 0.05;

  const font = (weight, size) => `${weight} ${Math.round(size)}px ${FONT}`;

  /**
   * One block of text. English (or anything not Arabic) starts at `x0`
   * left-to-right; Arabic is right-aligned at `x1`, right-to-left.
   * `align: 'center'` centres either.
   */
  const text = (value, { size, weight = 400, color = INK, x0 = left, x1 = right, align, lineHeight = 1.35 }) => {
    const str = clean(value);
    if (!str) return 0;
    const rtl = ARABIC.test(str);
    ctx.font = font(weight, size);
    ctx.direction = rtl ? 'rtl' : 'ltr';
    const lines = wrap(ctx, str, x1 - x0);
    const step = size * lineHeight;
    if (paint) {
      ctx.fillStyle = color;
      ctx.textBaseline = 'top';
      lines.forEach((line, i) => {
        if (align === 'center') {
          ctx.textAlign = 'center';
          ctx.fillText(line, (x0 + x1) / 2, y + i * step);
        } else if (rtl) {
          ctx.textAlign = 'right';
          ctx.fillText(line, x1, y + i * step);
        } else {
          ctx.textAlign = 'left';
          ctx.fillText(line, x0, y + i * step);
        }
      });
    }
    return lines.length * step;
  };

  // Frame in the primary colour.
  if (paint) {
    ctx.fillStyle = WHITE;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = primary;
    ctx.lineWidth = frame;
    ctx.strokeRect(frame / 2, frame / 2, W - frame, H - frame);
  }

  // Logo, then the organization's name in both languages.
  if (logo) {
    const maxW = inner * 0.45;
    const maxH = H * 0.075 * s;
    const ratio = Math.min(maxW / logo.width, maxH / logo.height);
    const lw = logo.width * ratio;
    const lh = logo.height * ratio;
    if (paint) ctx.drawImage(logo, (W - lw) / 2, y, lw, lh);
    y += lh + gap * 0.7;
  }
  const nameEn = branding?.display_name?.en;
  const nameAr = branding?.display_name?.ar;
  y += text(nameEn, { size: W * 0.03 * s, weight: 600, align: 'center' });
  y += text(nameAr, { size: W * 0.03 * s, weight: 600, align: 'center' });
  y += gap;

  // Heading band: English then Arabic, in the primary colour.
  const headEn = poster?.heading?.en;
  const headAr = poster?.heading?.ar;
  if (clean(headEn) || clean(headAr)) {
    const pad = W * 0.03 * s;
    const bandTop = y;
    const size = W * 0.052 * s;
    const between = clean(headEn) && clean(headAr) ? size * 0.25 : 0;
    const opts = { size, weight: 700, color: onPrimary, x0: left + pad, x1: right - pad };
    // Measure without painting, paint the band, then the text on top of it.
    const wasPainting = paint;
    paint = false;
    const hEn = text(headEn, { ...opts, lineHeight: 1.2 });
    const hAr = text(headAr, { ...opts, lineHeight: 1.25 });
    paint = wasPainting;
    const bandH = pad * 2 + hEn + between + hAr;
    if (paint) {
      ctx.fillStyle = primary;
      ctx.fillRect(left, bandTop, inner, bandH);
    }
    y = bandTop + pad;
    y += text(headEn, { ...opts, lineHeight: 1.2 });
    y += between;
    text(headAr, { ...opts, lineHeight: 1.25 });
    y = bandTop + bandH + gap * 1.2;
  }

  // QR code: at least 8 cm on A4 (~0.38 of the width), quiet zone of 4 modules,
  // sitting in an accent-coloured frame.
  const matrix = qr?.value ? qrMatrix(qr.value, qr.error_correction) : null;
  if (matrix) {
    const quiet = 4;
    const total = matrix.size + quiet * 2;
    // ≥ 8 cm on A4 (0.38 of 21 cm), growing with the type up to about half the width.
    const target = W * Math.min(0.5, Math.max(0.38, 0.4 * s));
    const module = Math.max(1, Math.floor(target / total));
    const side = module * total;
    const x = Math.round((W - side) / 2);
    const top = Math.round(y);
    const ring = W * 0.012;
    if (paint) {
      ctx.fillStyle = accent;
      ctx.fillRect(x - ring, top - ring, side + ring * 2, side + ring * 2);
      ctx.fillStyle = WHITE;
      ctx.fillRect(x, top, side, side);
      ctx.fillStyle = '#000000';
      for (let my = 0; my < matrix.size; my += 1) {
        for (let mx = 0; mx < matrix.size; mx += 1) {
          if (matrix.dark(mx, my)) ctx.fillRect(x + (mx + quiet) * module, top + (my + quiet) * module, module, module);
        }
      }
    }
    y = top + side + ring + gap * 0.6;
    // The address as text under the code, always left-to-right.
    ctx.font = font(600, W * 0.024 * s);
    const urlSize = Math.min(W * 0.024 * s, (inner / Math.max(1, ctx.measureText(qr.value).width)) * W * 0.024 * s);
    y += text(qr.value, { size: urlSize, weight: 600, color: INK, align: 'center' });
    y += gap;
  }

  // Instructions: numbered, English on the left, Arabic on the right.
  const lines = (poster?.instructions || []).filter((l) => clean(l?.en) || clean(l?.ar));
  if (lines.length) {
    const size = W * 0.026 * s;
    const badge = size * 1.5;
    const mid = W / 2;
    const colGap = W * 0.02;
    lines.forEach((line, i) => {
      const top = y;
      if (paint) {
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(mid, top + badge / 2, badge / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = onAccent;
        ctx.font = font(700, size * 0.9);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.direction = 'ltr';
        ctx.fillText(String(i + 1), mid, top + badge / 2 + size * 0.04);
      }
      y = top;
      const hEn = text(line.en, { size, color: INK, x0: left, x1: mid - badge / 2 - colGap });
      y = top;
      const hAr = text(line.ar, { size, color: INK, x0: mid + badge / 2 + colGap, x1: right });
      y = top + Math.max(hEn, hAr, badge) + gap * 0.55;
    });
    y += gap * 0.4;
  }

  // Footer, after an accent rule.
  const footEn = poster?.footer?.en;
  const footAr = poster?.footer?.ar;
  if (clean(footEn) || clean(footAr)) {
    if (paint) {
      ctx.fillStyle = accent;
      ctx.fillRect(left, y, inner, Math.max(2, W * 0.004));
    }
    y += gap * 0.8;
    const size = W * 0.021 * s;
    y += text(footEn, { size, color: INK_MUTED, align: 'center' });
    y += text(footAr, { size, color: INK_MUTED, align: 'center' });
  }

  return y + frame + W * 0.04;
};

/**
 * Draw the poster on `canvas`. Pass `size` ('A4' | 'A3') for print resolution,
 * or `width` for a preview of that pixel width (same proportions).
 */
export const drawPoster = async (canvas, render, { size = 'A4', width = null } = {}) => {
  await loadPosterFonts();
  const [pw, ph] = PAPER[size]?.px || PAPER.A4.px;
  const W = width ? Math.round(width) : pw;
  const H = Math.round((W * ph) / pw);
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const logo = await loadImage(render?.branding?.logo_data_url);
  const data = { poster: render?.poster, branding: render?.branding, qr: render?.qr, logo };

  // The largest type that still fits on the page: a short poster fills the
  // sheet, a long one shrinks to fit.
  let lo = 0.4;
  let hi = 1.6;
  for (let i = 0; i < 14; i += 1) {
    const mid = (lo + hi) / 2;
    if (layout(ctx, W, H, data, mid, false) <= H) lo = mid;
    else hi = mid;
  }
  const s = lo;
  ctx.clearRect(0, 0, W, H);
  layout(ctx, W, H, data, s, true);
  return canvas;
};

/** The poster as a one-page PDF of the exact paper size. */
export const posterPdf = async (render, size = 'A4') => {
  const paper = PAPER[size] || PAPER.A4;
  const canvas = document.createElement('canvas');
  await drawPoster(canvas, render, { size });
  const png = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  const { PDFDocument } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  pdf.setTitle(clean(render?.poster?.name) || 'Poster');
  pdf.setCreator('Xposer AI');
  pdf.setProducer('Xposer AI');
  const page = pdf.addPage(paper.pt);
  const image = await pdf.embedPng(await png.arrayBuffer());
  page.drawImage(image, { x: 0, y: 0, width: paper.pt[0], height: paper.pt[1] });
  canvas.width = 0; // free the 300 dpi bitmap
  return new Blob([await pdf.save()], { type: 'application/pdf' });
};

/** poster-<tenant>[-<entity>]-<A4|A3>.pdf from the address the code opens. */
export const posterFileName = (url, size) => {
  let parts = [];
  try {
    parts = new URL(url).pathname.split('/').filter(Boolean);
  } catch {
    parts = String(url || '').split('/').filter(Boolean).slice(-2);
  }
  const slug = parts.map((p) => p.toLowerCase().replace(/[^a-z0-9-]+/g, '-')).filter(Boolean).join('-') || 'portal';
  return `poster-${slug}-${size}.pdf`;
};

/** Save a Blob as a file. */
export const saveBlob = (blob, fileName) => {
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10000);
};
