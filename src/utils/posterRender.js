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
const WEIGHTS = [400, 500, 600, 700];

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

/** `hex` blended towards white: t = 1 is `hex`, t = 0 is white. */
const tint = (hex, t) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `#${c.map((v) => Math.round(v * t + 255 * (1 - t)).toString(16).padStart(2, '0')).join('')}`;
};

const INK_SECONDARY = '#374151';
const HAIRLINE = '#E5E7EB';

/**
 * Lays out (and, when `paint` is true, draws) the poster at unit scale `s`.
 * Returns the height used, so the caller can shrink `s` until it fits.
 * `extra` is spare height to spread through the layout, so a short poster
 * doesn't end in an empty half page.
 *
 *   ┌──────────────────────────────┐
 *   │ primary band: logo on a white │
 *   │ chip, organization name,      │
 *   │ accent rule, heading EN / AR  │
 *   │      ┌──────────────┐         │  QR card overlaps the band's edge,
 *   └──────│   QR code    │─────────┘  accent corner marks around the code
 *          └──────────────┘
 *        address as text
 *   EN step ─────── (1) ─────── AR step   (hairlines between steps)
 *   ▓▓▓▓▓▓▓ footer on a light tint, always at the bottom of the page ▓▓▓▓
 */
const layout = (ctx, W, H, data, s, paint, extra = 0) => {
  const { poster, branding, qr, logo } = data;
  const primary = colour(branding?.primary_color, DEFAULT_PRIMARY);
  const accent = colour(branding?.accent_color, DEFAULT_ACCENT);
  const onPrimary = textOn(primary);

  const margin = Math.round(W * 0.08);
  const inner = W - margin * 2;
  const left = margin;
  const right = W - margin;
  const gap = W * 0.022 * s;
  let y = 0;

  const font = (weight, size) => `${weight} ${Math.round(size)}px ${FONT}`;

  const roundRect = (x, top, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, top);
    ctx.arcTo(x + w, top, x + w, top + h, r);
    ctx.arcTo(x + w, top + h, x, top + h, r);
    ctx.arcTo(x, top + h, x, top, r);
    ctx.arcTo(x, top, x + w, top, r);
    ctx.closePath();
  };

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
    const step = size * (rtl ? Math.max(lineHeight, 1.45) : lineHeight);
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

  /** Run `draw` without painting; returns how far it moved `y`. */
  const measure = (draw) => {
    const [was, from] = [paint, y];
    paint = false;
    draw();
    const used = y - from;
    paint = was;
    y = from;
    return used;
  };

  if (paint) {
    ctx.fillStyle = WHITE;
    ctx.fillRect(0, 0, W, H);
  }

  // ── Header: logo, organization name, heading, on the primary colour ────
  const nameEn = branding?.display_name?.en;
  const nameAr = branding?.display_name?.ar;
  const headEn = poster?.heading?.en;
  const headAr = poster?.heading?.ar;
  const header = () => {
    y += W * 0.065 + extra * 0.3;
    if (logo) {
      const pad = W * 0.02 * s;
      const ratio = Math.min((inner * 0.4) / logo.width, (H * 0.055 * s) / logo.height);
      const lw = logo.width * ratio;
      const lh = logo.height * ratio;
      const cw = lw + pad * 2;
      const ch = lh + pad * 2;
      if (paint) {
        ctx.fillStyle = WHITE;
        roundRect((W - cw) / 2, y, cw, ch, ch * 0.2);
        ctx.fill();
        ctx.drawImage(logo, (W - cw) / 2 + pad, y + pad, lw, lh);
      }
      y += ch + gap * 0.8;
    }
    y += text(nameEn, { size: W * 0.026 * s, weight: 600, color: onPrimary, align: 'center' });
    y += text(nameAr, { size: W * 0.026 * s, weight: 600, color: onPrimary, align: 'center' });
    if ((clean(nameEn) || clean(nameAr) || logo) && (clean(headEn) || clean(headAr))) {
      y += gap * 0.7;
      const bw = W * 0.07;
      const bh = Math.max(2, W * 0.006);
      if (paint) {
        ctx.fillStyle = accent;
        roundRect((W - bw) / 2, y, bw, bh, bh / 2);
        ctx.fill();
      }
      y += bh + gap * 0.9;
    }
    y += text(headEn, { size: W * 0.064 * s, weight: 700, color: onPrimary, align: 'center', lineHeight: 1.15 });
    if (clean(headEn) && clean(headAr)) y += gap * 0.25;
    y += text(headAr, { size: W * 0.058 * s, weight: 700, color: onPrimary, align: 'center' });
  };

  // ── QR card: sizes are known before anything is placed ─────────────────
  // ≥ 8 cm on A4 (0.38 of 21 cm), growing with the type up to 0.46 of the
  // width (0.5 on a short poster). Quiet zone of 4 modules, white, inside the card.
  const matrix = qr?.value ? qrMatrix(qr.value, qr.error_correction) : null;
  let card = null;
  if (matrix) {
    const quiet = 4;
    const total = matrix.size + quiet * 2;
    const target = W * Math.min(0.5, Math.max(0.38, 0.42 * s));
    const module = Math.max(1, Math.floor(target / total));
    const side = module * total;
    // Whole pixels: a module off the pixel grid leaves grey seams between
    // modules, which print as hairlines and confuse some scanners.
    const pad = Math.round(W * 0.035);
    const size = side + pad * 2;
    card = { quiet, module, side, pad, size, overlap: size * 0.3 };
  }

  const headerH = measure(header);
  const afterHeader = gap * 1.3 + extra * 0.25;
  const bandBottom = headerH + afterHeader + (card ? card.overlap : gap * 0.5);
  if (paint) {
    ctx.fillStyle = primary;
    ctx.fillRect(0, 0, W, bandBottom);
  }
  header();
  y = headerH + afterHeader;

  if (card) {
    const x = Math.round((W - card.size) / 2);
    const top = Math.round(y);
    if (paint) {
      ctx.save();
      ctx.shadowColor = 'rgba(17, 24, 39, 0.22)';
      ctx.shadowBlur = W * 0.03;
      ctx.shadowOffsetY = W * 0.008;
      ctx.fillStyle = WHITE;
      roundRect(x, top, card.size, card.size, card.size * 0.06);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = HAIRLINE;
      ctx.lineWidth = Math.max(1, W * 0.0012);
      roundRect(x, top, card.size, card.size, card.size * 0.06);
      ctx.stroke();

      // Corner marks in the accent colour, in the card's padding: outside
      // the quiet zone, so they never touch the code.
      const o = card.pad * 0.45;
      const bx = x + card.pad - o;
      const by = top + card.pad - o;
      const bs = card.side + o * 2;
      const len = card.side * 0.13;
      ctx.strokeStyle = accent;
      ctx.lineWidth = W * 0.0075;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      [[bx, by, 1, 1], [bx + bs, by, -1, 1], [bx, by + bs, 1, -1], [bx + bs, by + bs, -1, -1]].forEach(([cx, cy, dx, dy]) => {
        ctx.beginPath();
        ctx.moveTo(cx, cy + dy * len);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx + dx * len, cy);
        ctx.stroke();
      });

      const qx = x + card.pad;
      const qy = top + card.pad;
      ctx.fillStyle = '#000000';
      for (let my = 0; my < matrix.size; my += 1) {
        for (let mx = 0; mx < matrix.size; mx += 1) {
          if (matrix.dark(mx, my)) ctx.fillRect(qx + (mx + card.quiet) * card.module, qy + (my + card.quiet) * card.module, card.module, card.module);
        }
      }
    }
    y = top + card.size + gap * 0.8;
    // The address as text under the code, always left-to-right.
    ctx.font = font(600, W * 0.024 * s);
    const urlSize = Math.min(W * 0.024 * s, (inner / Math.max(1, ctx.measureText(qr.value).width)) * W * 0.024 * s);
    y += text(qr.value, { size: urlSize, weight: 600, color: INK_SECONDARY, align: 'center' });
    y += gap * 1.3 + extra * 0.2;
  } else {
    y = bandBottom + gap;
  }

  // ── Steps ──────────────────────────────────────────────────────────────
  // Both languages: English left, number in the middle, Arabic right. When
  // every step is in one language, that language runs the full width with
  // the number on its reading side. A single step isn't numbered: it is
  // centred, English above Arabic, like a second heading.
  const lines = (poster?.instructions || []).filter((l) => clean(l?.en) || clean(l?.ar));
  if (lines.length) {
    const size = W * 0.027 * s;
    const numbered = lines.length > 1;
    const badge = numbered ? size * 1.2 : 0;
    const colGap = numbered ? W * 0.022 : W * 0.02;
    // The circle is centred on the first line's capitals (text is drawn
    // from the top of the em box, so measure where the glyphs really sit).
    ctx.font = font(400, size);
    ctx.textBaseline = 'top';
    const cap = ctx.measureText('H');
    const capMid = (cap.actualBoundingBoxDescent - cap.actualBoundingBoxAscent) / 2;
    const rowPad = gap * 0.45;
    const onlyAr = lines.every((l) => !clean(l.en));
    const onlyEn = lines.every((l) => !clean(l.ar));
    const badgeX = onlyEn ? left + badge / 2 : onlyAr ? right - badge / 2 : W / 2;
    lines.forEach((line, i) => {
      if (i > 0 && paint) {
        ctx.fillStyle = HAIRLINE;
        ctx.fillRect(left, y, inner, Math.max(1, W * 0.0012));
      }
      const top = y + (i > 0 ? rowPad : 0);
      let hEn = 0;
      let hAr = 0;
      y = top;
      if (!numbered) {
        hEn = text(line.en, { size: size * 1.1, weight: 500, align: 'center' });
        if (hEn && clean(line.ar)) hEn += gap * 0.2;
        y = top + hEn;
        hAr = text(line.ar, { size: size * 1.1, weight: 500, align: 'center' });
        hEn += hAr;
        hAr = 0;
      } else if (onlyEn) hEn = text(line.en, { size, x0: left + (numbered ? badge + colGap : 0), x1: right });
      else if (onlyAr) hAr = text(line.ar, { size, x0: left, x1: right - (numbered ? badge + colGap : 0) });
      else {
        hEn = text(line.en, { size, x0: left, x1: W / 2 - badge / 2 - colGap });
        y = top;
        hAr = text(line.ar, { size, x0: W / 2 + badge / 2 + colGap, x1: right });
      }
      const cy = top + capMid;
      const rowH = Math.max(hEn, hAr, cy - top + badge / 2);
      if (paint && numbered) {
        ctx.fillStyle = primary;
        ctx.beginPath();
        ctx.arc(badgeX, cy, badge / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = onPrimary;
        // Digits centred by their measured box, not the font's middle line.
        ctx.font = font(700, size * 0.7);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.direction = 'ltr';
        const digit = ctx.measureText(String(i + 1));
        ctx.fillText(String(i + 1), badgeX, cy + (digit.actualBoundingBoxAscent - digit.actualBoundingBoxDescent) / 2);
      }
      y = top + rowH + rowPad;
    });
    y += gap * 0.6;
  }

  // ── Footer: on a light tint of the primary colour, at the page's foot ──
  const footEn = poster?.footer?.en;
  const footAr = poster?.footer?.ar;
  const stripe = Math.max(4, W * 0.012);
  const footSize = W * 0.022 * s;
  const footPad = gap * 1.1;
  const footer = () => {
    y += footPad;
    y += text(footEn, { size: footSize, weight: 500, color: INK_SECONDARY, align: 'center' });
    if (clean(footEn) && clean(footAr)) y += gap * 0.2;
    y += text(footAr, { size: footSize, weight: 500, color: INK_SECONDARY, align: 'center' });
    y += footPad;
  };
  const hasFooter = Boolean(clean(footEn) || clean(footAr));
  const footerH = (hasFooter ? measure(footer) : 0) + stripe;
  const contentEnd = y;
  if (paint) {
    const footTop = H - footerH;
    if (hasFooter) {
      ctx.fillStyle = tint(primary, 0.1);
      ctx.fillRect(0, footTop, W, footerH - stripe);
      y = footTop;
      footer();
    }
    ctx.fillStyle = primary;
    ctx.fillRect(0, H - stripe, W, stripe);
  }
  return contentEnd + footerH;
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
  // Whatever height is left over is spread through the layout.
  const extra = Math.max(0, H - layout(ctx, W, H, data, s, false));
  ctx.clearRect(0, 0, W, H);
  layout(ctx, W, H, data, s, true, extra);
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

/**
 * poster-<tenant>[-<entity>]-<A4|A3>[-en|-ar].pdf from the address the code
 * opens; no language suffix for a bilingual poster.
 */
export const posterFileName = (url, size, lang = 'both') => {
  let parts = [];
  try {
    parts = new URL(url).pathname.split('/').filter(Boolean);
  } catch {
    parts = String(url || '').split('/').filter(Boolean).slice(-2);
  }
  const slug = parts.map((p) => p.toLowerCase().replace(/[^a-z0-9-]+/g, '-')).filter(Boolean).join('-') || 'portal';
  return `poster-${slug}-${size}${lang === 'en' || lang === 'ar' ? `-${lang}` : ''}.pdf`;
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

/**
 * Open the browser's print dialog for a PDF Blob, from a hidden frame on this
 * page. Where the browser won't print a PDF from a frame, the PDF opens in a
 * new tab instead (its viewer has a print button). Resolves with 'dialog' or
 * 'tab'.
 */
export const printBlob = (blob) =>
  new Promise((resolve) => {
    const href = URL.createObjectURL(blob);
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    frame.style.cssText = 'position:fixed;inset-inline-end:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    const fallback = () => {
      frame.remove();
      window.open(href, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(href), 60000);
      resolve('tab');
    };
    frame.onload = () => {
      // The PDF viewer needs a moment after load before it can print.
      setTimeout(() => {
        try {
          frame.contentWindow.focus();
          frame.contentWindow.print();
          // Keep the frame until the dialog has had time to read it.
          setTimeout(() => {
            frame.remove();
            URL.revokeObjectURL(href);
          }, 60000);
          resolve('dialog');
        } catch {
          fallback();
        }
      }, 300);
    };
    frame.src = href;
    document.body.appendChild(frame);
  });
