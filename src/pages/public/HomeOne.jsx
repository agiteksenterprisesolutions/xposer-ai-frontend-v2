/* NOTE: This component (Home1) has been replaced by HomeTwo as the default landing page. */
// src/pages/public/Home.jsx
import React, { useEffect, useState, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Shield,
  Lock,
  Eye,
  Users,
  BarChart3,
  MessageSquare,
  CheckCircle,
  AlertTriangle,
  Clock,
  ArrowRight,
  FileText,
  ShieldCheck,
  ChevronRight,
  Zap,
  Globe,
  TrendingUp,
  Bell,
  Search,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { reportsAPI } from '../../api';

/* ─────────────────────────────────────────────
   Styles
───────────────────────────────────────────── */
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Geist:wght@300;400;500&display=swap');

  :root {
    --black: #050709;
    --surface-1: #0c0e12;
    --surface-2: #111318;
    --surface-3: #181b22;
    --surface-4: #1e222c;
    --border-subtle: rgba(255,255,255,0.055);
    --border-mid: rgba(255,255,255,0.1);
    --border-strong: rgba(255,255,255,0.18);
    --text-1: #f0f2f5;
    --text-2: #8b93a5;
    --text-3: #525c6e;
    --teal: #00d4aa;
    --teal-dim: rgba(0,212,170,0.12);
    --teal-glow: rgba(0,212,170,0.25);
    --blue: #4f8ef7;
    --blue-dim: rgba(79,142,247,0.1);
    --amber: #f5a623;
    --amber-dim: rgba(245,166,35,0.1);
    --red: #f25c5c;
    --font-display: 'Syne', sans-serif;
    --font-body: 'Geist', system-ui, sans-serif;
    --radius-sm: 6px;
    --radius-md: 10px;
    --radius-lg: 16px;
    --radius-xl: 24px;
  }

  .hp * { box-sizing: border-box; margin: 0; padding: 0; }

  .hp {
    font-family: var(--font-body);
    background: var(--black);
    color: var(--text-1);
    overflow-x: hidden;
    -webkit-font-smoothing: antialiased;
  }

  /* ─── NOISE TEXTURE ─── */
  .hp::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
    pointer-events: none;
    z-index: 9999;
    opacity: 0.4;
  }

  /* ─── NAV ─── */
  .hp-nav {
    position: sticky;
    top: 0;
    z-index: 100;
    background: rgba(5,7,9,0.8);
    backdrop-filter: blur(20px) saturate(180%);
    border-bottom: 1px solid var(--border-subtle);
    padding: 0 40px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    max-width: 100%;
  }

  .nav-logo {
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    color: var(--text-1);
  }

  .nav-logo-mark {
    width: 30px;
    height: 30px;
    background: linear-gradient(135deg, #00d4aa, #4f8ef7);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .nav-logo-text {
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 700;
    letter-spacing: -0.03em;
  }

  .nav-badge {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--teal);
    background: var(--teal-dim);
    border: 1px solid rgba(0,212,170,0.2);
    padding: 2px 7px;
    border-radius: 100px;
    margin-left: 4px;
  }

  .nav-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .nav-link {
    font-size: 13.5px;
    font-weight: 400;
    color: var(--text-2);
    text-decoration: none;
    padding: 6px 12px;
    border-radius: var(--radius-sm);
    transition: color 0.15s;
    letter-spacing: -0.01em;
  }

  .nav-link:hover { color: var(--text-1); }

  .nav-cta {
    font-family: var(--font-body);
    font-size: 13.5px;
    font-weight: 500;
    color: var(--black);
    background: var(--teal);
    padding: 7px 16px;
    border-radius: var(--radius-sm);
    text-decoration: none;
    border: none;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.15s;
    letter-spacing: -0.01em;
    white-space: nowrap;
  }

  .nav-cta:hover { opacity: 0.88; transform: translateY(-1px); }

  /* ─── HERO ─── */
  .hero-wrap {
    position: relative;
    min-height: calc(100vh - 60px);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    padding: 80px 40px 60px;
  }

  /* Radial gradient background */
  .hero-bg-radial {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0,212,170,0.08) 0%, transparent 60%),
      radial-gradient(ellipse 60% 40% at 80% 80%, rgba(79,142,247,0.06) 0%, transparent 50%);
    pointer-events: none;
  }

  /* Dot grid */
  .hero-bg-grid {
    position: absolute;
    inset: 0;
    background-image: radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px);
    background-size: 32px 32px;
    mask-image: radial-gradient(ellipse 70% 60% at 50% 40%, black 0%, transparent 80%);
    pointer-events: none;
  }

  .hero-content {
    position: relative;
    z-index: 2;
    text-align: center;
    max-width: 780px;
  }

  .hero-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.04em;
    color: var(--text-2);
    background: var(--surface-3);
    border: 1px solid var(--border-mid);
    padding: 5px 12px 5px 6px;
    border-radius: 100px;
    margin-bottom: 32px;
    cursor: default;
    transition: border-color 0.2s;
  }

  .hero-pill:hover { border-color: var(--border-strong); }

  .hero-pill-dot {
    display: flex;
    align-items: center;
    gap: 5px;
    background: var(--teal-dim);
    border: 1px solid rgba(0,212,170,0.25);
    padding: 2px 8px;
    border-radius: 100px;
    color: var(--teal);
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .pill-blink {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--teal);
    animation: blink 2s ease-in-out infinite;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  .hero-h1 {
    font-family: var(--font-display);
    font-size: clamp(46px, 6.5vw, 82px);
    font-weight: 800;
    line-height: 1.0;
    letter-spacing: -0.04em;
    color: var(--text-1);
    margin-bottom: 24px;
  }

  .hero-h1 .word-highlight {
    background: linear-gradient(135deg, #00d4aa 0%, #4f8ef7 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .hero-sub {
    font-size: 16.5px;
    font-weight: 300;
    line-height: 1.7;
    color: var(--text-2);
    max-width: 560px;
    margin: 0 auto 40px;
    letter-spacing: -0.01em;
  }

  .hero-actions {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 64px;
  }

  .btn-hero-primary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-body);
    font-size: 14.5px;
    font-weight: 500;
    color: var(--black);
    background: var(--teal);
    padding: 12px 22px;
    border-radius: var(--radius-md);
    text-decoration: none;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
    letter-spacing: -0.02em;
    position: relative;
    overflow: hidden;
  }

  .btn-hero-primary::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, rgba(255,255,255,0.12), transparent);
    pointer-events: none;
  }

  .btn-hero-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 32px rgba(0,212,170,0.3);
  }

  .btn-hero-secondary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-body);
    font-size: 14.5px;
    font-weight: 400;
    color: var(--text-2);
    background: var(--surface-3);
    padding: 12px 22px;
    border-radius: var(--radius-md);
    text-decoration: none;
    border: 1px solid var(--border-mid);
    cursor: pointer;
    transition: all 0.2s;
    letter-spacing: -0.02em;
  }

  .btn-hero-secondary:hover {
    color: var(--text-1);
    border-color: var(--border-strong);
    transform: translateY(-1px);
  }

  /* ─── HERO STATS ─── */
  .hero-stats {
    display: flex;
    align-items: stretch;
    gap: 0;
    background: var(--surface-2);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-xl);
    overflow: hidden;
    width: 100%;
    max-width: 680px;
    margin: 0 auto;
  }

  .hero-stat-item {
    flex: 1;
    padding: 22px 24px;
    text-align: left;
    position: relative;
    transition: background 0.2s;
  }

  .hero-stat-item:not(:last-child) {
    border-right: 1px solid var(--border-subtle);
  }

  .hero-stat-item:hover { background: var(--surface-3); }

  .hero-stat-label {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-3);
    margin-bottom: 8px;
  }

  .hero-stat-value {
    font-family: var(--font-display);
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.04em;
    color: var(--text-1);
    line-height: 1;
  }

  .hero-stat-delta {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 11px;
    font-weight: 500;
    color: var(--teal);
    margin-top: 4px;
  }

  /* ─── DASHBOARD PREVIEW ─── */
  .preview-wrap {
    position: relative;
    padding: 0 40px 100px;
    max-width: 1200px;
    margin: 0 auto;
  }

  .preview-fade-top {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 80px;
    background: linear-gradient(to bottom, var(--black), transparent);
    z-index: 3;
    pointer-events: none;
  }

  .preview-fade-bottom {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 200px;
    background: linear-gradient(to top, var(--black), transparent);
    z-index: 3;
    pointer-events: none;
  }

  .dashboard-mock {
    background: var(--surface-2);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-xl);
    overflow: hidden;
    box-shadow:
      0 0 0 1px rgba(0,212,170,0.05),
      0 32px 80px rgba(0,0,0,0.6),
      0 0 120px rgba(0,212,170,0.04);
  }

  .mock-topbar {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 14px 20px;
    background: var(--surface-1);
    border-bottom: 1px solid var(--border-subtle);
  }

  .mock-dots {
    display: flex;
    gap: 6px;
  }

  .mock-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .mock-dot-r { background: #f25c5c; }
  .mock-dot-y { background: #f5a623; }
  .mock-dot-g { background: #23c55e; }

  .mock-url-bar {
    flex: 1;
    background: var(--surface-3);
    border: 1px solid var(--border-subtle);
    border-radius: 6px;
    height: 26px;
    display: flex;
    align-items: center;
    padding: 0 10px;
    gap: 6px;
    max-width: 300px;
  }

  .mock-url-text {
    font-size: 11px;
    color: var(--text-3);
    letter-spacing: 0.01em;
  }

  .mock-url-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--teal);
    box-shadow: 0 0 6px var(--teal);
  }

  .mock-body {
    display: grid;
    grid-template-columns: 220px 1fr;
    min-height: 420px;
  }

  .mock-sidebar {
    background: var(--surface-1);
    border-right: 1px solid var(--border-subtle);
    padding: 20px 0;
  }

  .mock-sidebar-header {
    padding: 0 16px 16px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-3);
    border-bottom: 1px solid var(--border-subtle);
    margin-bottom: 8px;
  }

  .mock-nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 16px;
    font-size: 13px;
    color: var(--text-2);
    cursor: default;
    transition: background 0.1s;
    border-radius: 0;
  }

  .mock-nav-item:hover { background: var(--surface-3); color: var(--text-1); }

  .mock-nav-item.active {
    color: var(--text-1);
    background: var(--surface-3);
    position: relative;
  }

  .mock-nav-item.active::before {
    content: '';
    position: absolute;
    left: 0;
    top: 4px;
    bottom: 4px;
    width: 2px;
    background: var(--teal);
    border-radius: 0 2px 2px 0;
  }

  .mock-nav-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .mock-main {
    padding: 24px;
    background: var(--surface-2);
  }

  .mock-main-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  }

  .mock-title {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 700;
    color: var(--text-1);
    letter-spacing: -0.03em;
  }

  .mock-status-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 500;
    padding: 4px 10px;
    border-radius: 100px;
  }

  .badge-teal { background: var(--teal-dim); color: var(--teal); border: 1px solid rgba(0,212,170,0.2); }
  .badge-amber { background: var(--amber-dim); color: var(--amber); border: 1px solid rgba(245,166,35,0.2); }
  .badge-blue { background: var(--blue-dim); color: var(--blue); border: 1px solid rgba(79,142,247,0.2); }

  .mock-kpi-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 20px;
  }

  .mock-kpi {
    background: var(--surface-3);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    padding: 16px;
  }

  .mock-kpi-label {
    font-size: 11px;
    color: var(--text-3);
    font-weight: 500;
    letter-spacing: 0.04em;
    margin-bottom: 8px;
  }

  .mock-kpi-value {
    font-family: var(--font-display);
    font-size: 24px;
    font-weight: 700;
    color: var(--text-1);
    letter-spacing: -0.04em;
    margin-bottom: 4px;
  }

  .mock-kpi-bar {
    height: 3px;
    border-radius: 100px;
    background: var(--surface-4);
    overflow: hidden;
    margin-top: 8px;
  }

  .mock-kpi-bar-fill {
    height: 100%;
    border-radius: 100px;
  }

  .mock-table-header {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 1fr;
    gap: 8px;
    padding: 8px 12px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-3);
    border-bottom: 1px solid var(--border-subtle);
  }

  .mock-table-row {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 1fr;
    gap: 8px;
    padding: 10px 12px;
    font-size: 12.5px;
    color: var(--text-2);
    border-bottom: 1px solid var(--border-subtle);
    transition: background 0.1s;
    cursor: default;
  }

  .mock-table-row:hover { background: var(--surface-3); color: var(--text-1); }
  .mock-table-row:last-child { border-bottom: none; }

  .mock-table-id {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .id-hash {
    font-family: 'Courier New', monospace;
    font-size: 11px;
    color: var(--text-3);
  }

  /* ─── SECTION CHROME ─── */
  .section-wrap {
    max-width: 1200px;
    margin: 0 auto;
    padding: 100px 40px;
  }

  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--teal);
    margin-bottom: 16px;
  }

  .eyebrow::before {
    content: '';
    width: 16px;
    height: 1px;
    background: var(--teal);
    opacity: 0.6;
  }

  .section-h2 {
    font-family: var(--font-display);
    font-size: clamp(28px, 3.5vw, 44px);
    font-weight: 800;
    line-height: 1.08;
    letter-spacing: -0.04em;
    color: var(--text-1);
    margin-bottom: 16px;
  }

  .section-p {
    font-size: 15.5px;
    color: var(--text-2);
    line-height: 1.7;
    font-weight: 300;
    max-width: 480px;
    letter-spacing: -0.01em;
  }

  /* ─── FEATURE BENTO ─── */
  .bento-grid {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    grid-template-rows: auto auto;
    gap: 2px;
    background: var(--border-subtle);
    border-radius: var(--radius-xl);
    overflow: hidden;
  }

  .bento-cell {
    background: var(--surface-2);
    padding: 32px;
    position: relative;
    overflow: hidden;
    transition: background 0.2s;
  }

  .bento-cell:hover { background: var(--surface-3); }

  .bento-cell.span-4 { grid-column: span 4; }
  .bento-cell.span-6 { grid-column: span 6; }
  .bento-cell.span-8 { grid-column: span 8; }
  .bento-cell.span-12 { grid-column: span 12; }

  @media (max-width: 900px) {
    .bento-cell.span-4,
    .bento-cell.span-6,
    .bento-cell.span-8 { grid-column: span 12; }
  }

  .bento-cell-accent {
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--teal), transparent);
    opacity: 0;
    transition: opacity 0.3s;
  }

  .bento-cell:hover .bento-cell-accent { opacity: 1; }

  .bento-icon {
    width: 42px;
    height: 42px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-4);
    border: 1px solid var(--border-subtle);
    color: var(--teal);
    margin-bottom: 20px;
  }

  .bento-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-3);
    background: var(--surface-4);
    border: 1px solid var(--border-subtle);
    padding: 3px 8px;
    border-radius: 100px;
    margin-bottom: 14px;
  }

  .bento-h3 {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 700;
    color: var(--text-1);
    letter-spacing: -0.03em;
    margin-bottom: 10px;
    line-height: 1.2;
  }

  .bento-p {
    font-size: 14px;
    color: var(--text-2);
    line-height: 1.65;
    font-weight: 300;
    letter-spacing: -0.005em;
  }

  /* Mini visualizations inside bento cells */
  .mini-vis {
    margin-top: 24px;
    padding: 16px;
    background: var(--surface-1);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
  }

  .sparkline-row {
    display: flex;
    align-items: flex-end;
    gap: 3px;
    height: 40px;
  }

  .sparkline-bar {
    flex: 1;
    border-radius: 2px 2px 0 0;
    background: linear-gradient(to top, rgba(0,212,170,0.15), rgba(0,212,170,0.5));
    transition: opacity 0.2s;
  }

  .sparkline-bar:hover { opacity: 0.7; }

  .anon-meter {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .anon-meter-row {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12px;
    color: var(--text-2);
  }

  .anon-meter-bar {
    flex: 1;
    height: 5px;
    background: var(--surface-4);
    border-radius: 100px;
    overflow: hidden;
  }

  .anon-meter-fill {
    height: 100%;
    border-radius: 100px;
    background: linear-gradient(90deg, var(--teal), var(--blue));
  }

  .anon-meter-pct {
    font-size: 12px;
    color: var(--teal);
    font-weight: 600;
    width: 32px;
    text-align: right;
    letter-spacing: -0.02em;
  }

  /* ─── PROCESS ─── */
  .process-wrap {
    background: var(--surface-1);
    border-top: 1px solid var(--border-subtle);
    border-bottom: 1px solid var(--border-subtle);
  }

  .process-inner {
    max-width: 1200px;
    margin: 0 auto;
    padding: 100px 40px;
  }

  .process-header {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 60px;
    align-items: end;
    margin-bottom: 64px;
  }

  @media (max-width: 768px) {
    .process-header { grid-template-columns: 1fr; gap: 24px; }
  }

  .process-steps {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0;
  }

  @media (max-width: 768px) {
    .process-steps { grid-template-columns: repeat(2, 1fr); gap: 2px; }
  }

  .process-step {
    padding: 32px 28px;
    background: var(--surface-2);
    border-right: 1px solid var(--border-subtle);
    position: relative;
    transition: background 0.2s;
  }

  .process-step:last-child { border-right: none; }
  .process-step:hover { background: var(--surface-3); }

  .process-step-num {
    font-family: var(--font-display);
    font-size: 11px;
    font-weight: 700;
    color: var(--text-3);
    letter-spacing: 0.08em;
    margin-bottom: 20px;
  }

  .process-step-icon {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-md);
    background: var(--surface-4);
    border: 1px solid var(--border-subtle);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--teal);
    margin-bottom: 16px;
  }

  .process-step h4 {
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 700;
    color: var(--text-1);
    letter-spacing: -0.02em;
    margin-bottom: 10px;
  }

  .process-step p {
    font-size: 13.5px;
    color: var(--text-2);
    line-height: 1.6;
    font-weight: 300;
  }

  .process-connector {
    position: absolute;
    top: 44px;
    right: -1px;
    width: 2px;
    height: 20px;
    background: var(--teal);
    opacity: 0.3;
  }

  /* ─── COMPLIANCE SECTION ─── */
  .comp-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 64px;
    align-items: center;
  }

  @media (max-width: 900px) {
    .comp-grid { grid-template-columns: 1fr; gap: 48px; }
  }

  .comp-items {
    display: flex;
    flex-direction: column;
    gap: 2px;
    background: var(--border-subtle);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .comp-item {
    display: flex;
    align-items: flex-start;
    gap: 18px;
    background: var(--surface-2);
    padding: 22px 24px;
    cursor: default;
    transition: background 0.15s, padding-left 0.2s;
    position: relative;
  }

  .comp-item::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 0px;
    background: var(--teal);
    transition: width 0.2s;
  }

  .comp-item:hover { background: var(--surface-3); padding-left: 28px; }
  .comp-item:hover::before { width: 2px; }

  .comp-item-icon {
    width: 38px;
    height: 38px;
    border-radius: var(--radius-sm);
    background: var(--surface-4);
    border: 1px solid var(--border-subtle);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--blue);
  }

  .comp-item-body h3 {
    font-family: var(--font-display);
    font-size: 14.5px;
    font-weight: 700;
    color: var(--text-1);
    letter-spacing: -0.02em;
    margin-bottom: 5px;
  }

  .comp-item-body p {
    font-size: 13px;
    color: var(--text-2);
    line-height: 1.6;
    font-weight: 300;
  }

  /* ─── SOCIAL PROOF ─── */
  .proof-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2px;
    background: var(--border-subtle);
    border-radius: var(--radius-xl);
    overflow: hidden;
    margin-top: 24px;
  }

  @media (max-width: 768px) {
    .proof-row { grid-template-columns: 1fr; }
  }

  .proof-cell {
    background: var(--surface-2);
    padding: 28px;
  }

  .proof-quote {
    font-size: 14px;
    color: var(--text-2);
    line-height: 1.7;
    font-weight: 300;
    font-style: italic;
    letter-spacing: -0.01em;
    margin-bottom: 20px;
  }

  .proof-author {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .proof-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--teal), var(--blue));
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-display);
    font-size: 12px;
    font-weight: 700;
    color: var(--black);
    flex-shrink: 0;
  }

  .proof-name {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--text-1);
    letter-spacing: -0.01em;
  }

  .proof-role {
    font-size: 11.5px;
    color: var(--text-3);
  }

  /* ─── FINAL CTA ─── */
  .cta-wrap {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 40px 100px;
  }

  .cta-block {
    background: var(--surface-2);
    border: 1px solid var(--border-mid);
    border-radius: var(--radius-xl);
    padding: 72px 64px;
    text-align: center;
    position: relative;
    overflow: hidden;
  }

  .cta-block::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 80% 60% at 50% -20%, rgba(0,212,170,0.07) 0%, transparent 60%);
    pointer-events: none;
  }

  .cta-block::after {
    content: '';
    position: absolute;
    top: 0; left: 20%; right: 20%;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(0,212,170,0.4), transparent);
  }

  .cta-block-inner { position: relative; z-index: 1; }

  .cta-h2 {
    font-family: var(--font-display);
    font-size: clamp(30px, 4vw, 48px);
    font-weight: 800;
    letter-spacing: -0.04em;
    color: var(--text-1);
    margin-bottom: 16px;
    line-height: 1.05;
  }

  .cta-p {
    font-size: 15.5px;
    color: var(--text-2);
    line-height: 1.65;
    font-weight: 300;
    max-width: 460px;
    margin: 0 auto 40px;
    letter-spacing: -0.01em;
  }

  .cta-btns {
    display: flex;
    gap: 12px;
    justify-content: center;
    flex-wrap: wrap;
  }

  .btn-cta-outline {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 400;
    color: var(--text-2);
    background: transparent;
    padding: 11px 22px;
    border-radius: var(--radius-md);
    text-decoration: none;
    border: 1px solid var(--border-mid);
    cursor: pointer;
    transition: all 0.2s;
    letter-spacing: -0.01em;
  }

  .btn-cta-outline:hover {
    color: var(--text-1);
    border-color: var(--border-strong);
  }

  /* ─── FOOTER ─── */
  .hp-footer {
    border-top: 1px solid var(--border-subtle);
    padding: 28px 40px;
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  .footer-text {
    font-size: 12.5px;
    color: var(--text-3);
    letter-spacing: -0.01em;
  }

  .footer-links {
    display: flex;
    gap: 20px;
  }

  .footer-link {
    font-size: 12.5px;
    color: var(--text-3);
    text-decoration: none;
    transition: color 0.15s;
  }

  .footer-link:hover { color: var(--text-2); }

  /* ─── ANIMATIONS ─── */
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .fu { animation: fadeUp 0.5s ease both; }
  .fu-1 { animation-delay: 0.05s; }
  .fu-2 { animation-delay: 0.12s; }
  .fu-3 { animation-delay: 0.2s; }
  .fu-4 { animation-delay: 0.3s; }
  .fu-5 { animation-delay: 0.42s; }

  @media (max-width: 640px) {
    .hero-wrap { padding: 60px 24px 40px; }
    .section-wrap { padding: 70px 24px; }
    .preview-wrap { padding: 0 24px 70px; }
    .hp-nav { padding: 0 20px; }
    .hp-footer { padding: 24px; }
    .cta-block { padding: 48px 28px; }
    .cta-wrap { padding: 0 24px 70px; }
  }
`;

/* ─────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────── */

const DashboardPreview = () => {
  const rows = [
    { id: '#a3f1', title: 'Financial misconduct Q3', dept: 'Finance', status: 'badge-amber', statusLabel: 'Under Review', date: '2d ago' },
    { id: '#b9c2', title: 'Workplace harassment', dept: 'HR', status: 'badge-teal', statusLabel: 'Resolved', date: '5d ago' },
    { id: '#d7e8', title: 'Data privacy concern', dept: 'Legal', status: 'badge-blue', statusLabel: 'Assigned', date: '1w ago' },
  ];

  return (
    <div className="dashboard-mock">
      <div className="mock-topbar">
        <div className="mock-dots">
          <div className="mock-dot mock-dot-r" />
          <div className="mock-dot mock-dot-y" />
          <div className="mock-dot mock-dot-g" />
        </div>
        <div className="mock-url-bar">
          <div className="mock-url-dot" />
          <span className="mock-url-text">app.speakup.io/compliance/dashboard</span>
        </div>
      </div>
      <div className="mock-body">
        <div className="mock-sidebar">
          <div className="mock-sidebar-header">Compliance Suite</div>
          {[
            { label: 'Dashboard', dot: '#00d4aa', active: true },
            { label: 'Reports', dot: '#4f8ef7' },
            { label: 'Assigned', dot: '#f5a623' },
            { label: 'Analytics', dot: null },
            { label: 'Team', dot: null },
            { label: 'Settings', dot: null },
          ].map((item) => (
            <div key={item.label} className={`mock-nav-item${item.active ? ' active' : ''}`}>
              {item.dot && <div className="mock-nav-dot" style={{ background: item.dot, boxShadow: `0 0 6px ${item.dot}` }} />}
              {!item.dot && <div style={{ width: 7 }} />}
              {item.label}
            </div>
          ))}
        </div>
        <div className="mock-main">
          <div className="mock-main-header">
            <span className="mock-title">Active Cases</span>
            <span className="mock-status-badge badge-teal"><span style={{ width: 5, height: 5, borderRadius: '50%', background: '#00d4aa', display: 'inline-block' }} /> Live</span>
          </div>
          <div className="mock-kpi-row">
            {[
              { label: 'Open', val: '12', pct: 72, color: '#f5a623' },
              { label: 'Resolved', val: '48', pct: 88, color: '#00d4aa' },
              { label: 'Avg. Days', val: '3.2', pct: 55, color: '#4f8ef7' },
            ].map((k) => (
              <div key={k.label} className="mock-kpi">
                <div className="mock-kpi-label">{k.label}</div>
                <div className="mock-kpi-value">{k.val}</div>
                <div className="mock-kpi-bar">
                  <div className="mock-kpi-bar-fill" style={{ width: `${k.pct}%`, background: k.color }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mock-table-header">
            <span>Case</span><span>Department</span><span>Status</span><span>Time</span>
          </div>
          {rows.map((row) => (
            <div key={row.id} className="mock-table-row">
              <span className="mock-table-id">
                <span className="id-hash">{row.id}</span>
                {row.title}
              </span>
              <span>{row.dept}</span>
              <span className={`mock-status-badge ${row.status}`}>{row.statusLabel}</span>
              <span style={{ color: 'var(--text-3)' }}>{row.date}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────
   Main Component
───────────────────────────────────────────── */
const Home = () => {
  const { user } = useAuthStore();
  const { orgSlug } = useParams();
  const [trustStats, setTrustStats] = useState([
    { label: 'Reports Filed', value: '—', delta: null },
    { label: 'Cases Resolved', value: '—', delta: null },
    { label: 'Anonymous', value: '—', delta: null },
    { label: 'Response Time', value: '—', delta: null },
  ]);

  useEffect(() => {
    const fetchTrustStats = async () => {
      try {
        const data = await reportsAPI.getStats();
        setTrustStats([
          { label: 'Reports Filed', value: data.total_reports ?? '—', delta: '+12%' },
          { label: 'Cases Resolved', value: data.resolved ?? '—', delta: '+8%' },
          { label: 'Anonymous', value: data.anonymous ?? '—', delta: null },
          { label: 'Avg. Response', value: data.avg_response ?? '3.2d', delta: '↓ faster' },
        ]);
      } catch (e) {
        console.error('Error fetching trust indicators:', e);
      }
    };
    fetchTrustStats();
  }, []);

  const dashboardLink =
    user
      ? ['admin', 'super_admin'].includes(user?.role)
        ? `/${user.organization_slug}/admin/dashboard`
        : ['manager', 'officer', 'compliance'].includes(user?.role)
          ? `/${user.organization_slug}/compliance/dashboard`
          : user?.role === 'reviewer'
            ? `/${user.organization_slug}/reviewer/dashboard`
            : `/${user.organization_slug}/reporter/dashboard`
      : '/login';

  const submitLink = `/${user?.organization_slug ?? orgSlug}/submit-anonymous`;

  return (
    <>
      <style>{styles}</style>
      <div className="hp">

        {/* ── NAV ── */}
        {/* <nav className="hp-nav">
          <div className="nav-logo">
            <div className="nav-logo-mark">
              <Shield size={16} color="#050709" strokeWidth={2.5} />
            </div>
            <span className="nav-logo-text">SpeakUp</span>
            <span className="nav-badge">Secure</span>
          </div>
          <div className="nav-actions">
            <Link to="/track-report" className="nav-link">Track Case</Link>
            <Link to={dashboardLink} className="nav-link">{user ? 'Dashboard' : 'Sign In'}</Link>
            <Link to={submitLink} className="nav-cta">Submit Report</Link>
          </div>
        </nav> */}

        {/* ── HERO ── */}
        <section className="hero-wrap">
          <div className="hero-bg-radial" />
          <div className="hero-bg-grid" />

          <div className="hero-content">
            <div className="hero-pill fu">
              <div className="hero-pill-dot">
                <div className="pill-blink" /> Live Platform
              </div>
              End-to-end encrypted &middot; Fully anonymous
            </div>

            <h1 className="hero-h1 fu fu-1">
              Welcome to<br />
              <span className="word-highlight">Xposer AI.</span>
            </h1>

            <p className="hero-sub fu fu-2">
              Enterprise-grade secure reporting infrastructure. Protect your reporters,
              empower your compliance teams, and close cases faster.
            </p>

            <div className="hero-actions fu fu-3">
              <Link to={submitLink} className="btn-hero-primary">
                Submit Anonymous Report <ArrowRight size={15} />
              </Link>
              <Link to={dashboardLink} className="btn-hero-secondary">
                {user ? 'Open Dashboard' : 'Sign in'} <ChevronRight size={14} />
              </Link>
            </div>

            <div className="hero-stats fu fu-4">
              {trustStats.map((s, i) => (
                <div key={s.label} className="hero-stat-item">
                  <div className="hero-stat-label">{s.label}</div>
                  <div className="hero-stat-value">{s.value}</div>
                  {s.delta && <div className="hero-stat-delta"><TrendingUp size={10} />{s.delta}</div>}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── DASHBOARD PREVIEW ── */}
        <div className="preview-wrap fu fu-5">
          <div className="preview-fade-top" />
          <DashboardPreview />
          <div className="preview-fade-bottom" />
        </div>

        {/* ── FEATURE BENTO ── */}
        <div className="section-wrap">
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div className="eyebrow" style={{ justifyContent: 'center' }}>Platform capabilities</div>
            <h2 className="section-h2">Everything built around trust.</h2>
            <p className="section-p" style={{ margin: '0 auto', textAlign: 'center' }}>
              From anonymous submission to final resolution — every layer is designed for security, clarity, and action.
            </p>
          </div>

          <div className="bento-grid">
            {/* Row 1 */}
            <div className="bento-cell span-4">
              <div className="bento-cell-accent" />
              <div className="bento-icon"><Lock size={18} /></div>
              <div className="bento-tag">Privacy</div>
              <div className="bento-h3">Zero-knowledge anonymity</div>
              <div className="bento-p">Your identity is never stored. Reports are stripped of metadata before reaching investigators — even we can't trace them back.</div>
              <div className="mini-vis">
                <div className="anon-meter">
                  {[['IP Masking', 100], ['Metadata Strip', 100], ['Encryption', 98], ['Identity Hidden', 100]].map(([label, pct]) => (
                    <div key={label} className="anon-meter-row">
                      <span style={{ width: 100, flexShrink: 0, fontSize: 11 }}>{label}</span>
                      <div className="anon-meter-bar"><div className="anon-meter-fill" style={{ width: `${pct}%` }} /></div>
                      <span className="anon-meter-pct">{pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bento-cell span-4">
              <div className="bento-cell-accent" />
              <div className="bento-icon" style={{ color: 'var(--blue)' }}><Eye size={18} /></div>
              <div className="bento-tag">Tracking</div>
              <div className="bento-h3">Live case tracking</div>
              <div className="bento-p">Follow your case status in real time using a unique access token — no account required. Get notified when investigators respond.</div>
              <div className="mini-vis">
                <div className="sparkline-row">
                  {[30, 45, 35, 60, 55, 70, 65, 80, 75, 90, 85, 95].map((h, i) => (
                    <div key={i} className="sparkline-bar" style={{ height: `${h}%` }} />
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: 'var(--text-3)' }}>
                  <span>Case activity — last 12 weeks</span>
                  <span style={{ color: 'var(--teal)' }}>↑ 18%</span>
                </div>
              </div>
            </div>

            <div className="bento-cell span-4">
              <div className="bento-cell-accent" />
              <div className="bento-icon" style={{ color: 'var(--amber)' }}><MessageSquare size={18} /></div>
              <div className="bento-tag">Communication</div>
              <div className="bento-h3">Encrypted messaging</div>
              <div className="bento-p">Two-way secure inbox between reporters and compliance teams. Clarify cases, provide evidence, stay informed — always anonymous.</div>
            </div>

            {/* Row 2 */}
            <div className="bento-cell span-6">
              <div className="bento-cell-accent" />
              <div className="bento-icon" style={{ color: 'var(--blue)' }}><BarChart3 size={18} /></div>
              <div className="bento-tag">Analytics</div>
              <div className="bento-h3">Intelligence-driven compliance</div>
              <div className="bento-p">Real-time dashboards surface trends, bottlenecks, and risk signals. Make decisions with data, not gut feel. SLA tracking included.</div>
            </div>

            <div className="bento-cell span-6">
              <div className="bento-cell-accent" />
              <div className="bento-icon" style={{ color: 'var(--teal)' }}><Users size={18} /></div>
              <div className="bento-tag">Team</div>
              <div className="bento-h3">Role-based case management</div>
              <div className="bento-p">Assign cases to officers, leave internal notes, escalate to managers — all with full audit trails. Compliance, from intake to closure.</div>
            </div>
          </div>
        </div>

        {/* ── PROCESS ── */}
        <div className="process-wrap">
          <div className="process-inner">
            <div className="process-header">
              <div>
                <div className="eyebrow">The process</div>
                <h2 className="section-h2">Report to resolution<br />in four steps.</h2>
              </div>
              <p className="section-p" style={{ alignSelf: 'center' }}>
                A transparent, structured workflow from anonymous submission to final outcome.
                Reporters and investigators both have visibility at every stage.
              </p>
            </div>
            <div className="process-steps">
              {[
                { icon: <FileText size={18} />, title: 'Submit', desc: 'File anonymously or with an account. Attach evidence, describe the incident.', n: '01' },
                { icon: <ShieldCheck size={18} />, title: 'Route & Assign', desc: 'Your report is encrypted, categorised, and routed to the right compliance officer.', n: '02' },
                { icon: <MessageSquare size={18} />, title: 'Communicate', desc: 'Investigators may request clarification via secure encrypted messages.', n: '03' },
                { icon: <CheckCircle size={18} />, title: 'Resolve', desc: 'Case is closed with a formal outcome. Reporter is notified anonymously.', n: '04' },
              ].map((step, i) => (
                <div key={step.title} className="process-step">
                  <div className="process-step-num">{step.n}</div>
                  <div className="process-step-icon">{step.icon}</div>
                  <h4>{step.title}</h4>
                  <p>{step.desc}</p>
                  {i < 3 && <div className="process-connector" />}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── COMPLIANCE TOOLS ── */}
        <div className="section-wrap">
          <div className="comp-grid">
            <div>
              <div className="eyebrow">For investigators</div>
              <h2 className="section-h2">Powerful tools for<br />compliance teams.</h2>
              <p className="section-p" style={{ marginBottom: 28 }}>
                Everything your team needs to handle every report with speed, precision, and full accountability.
              </p>
              <Link to={dashboardLink} className="btn-hero-secondary" style={{ display: 'inline-flex' }}>
                View compliance suite <ArrowRight size={14} />
              </Link>
            </div>
            <div className="comp-items">
              {[
                { icon: <Users size={16} />, title: 'Team Collaboration', desc: 'Assign cases, share internal notes, work together with role-based access control and full audit history.' },
                { icon: <BarChart3 size={16} />, title: 'Analytics Dashboard', desc: 'Real-time KPIs, trend charts, department breakdowns, and exportable reports.' },
                { icon: <Clock size={16} />, title: 'SLA & Workflow Management', desc: 'Customisable workflows, deadline tracking, and automated escalation on breached SLAs.' },
                { icon: <AlertTriangle size={16} />, title: 'Risk Prioritisation', desc: 'AI-assisted severity scoring surfaces critical cases. Escalation protocols for high-risk reports.' },
              ].map((item) => (
                <div key={item.title} className="comp-item">
                  <div className="comp-item-icon">{item.icon}</div>
                  <div className="comp-item-body">
                    <h3>{item.title}</h3>
                    <p>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── SOCIAL PROOF ── */}
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px 100px' }}>
          <div className="eyebrow">Trusted by compliance teams</div>
          <div className="proof-row">
            {[
              {
                q: 'We cut average case resolution time by 40% in the first quarter. The SLA tracking alone changed how we run compliance.',
                name: 'Sarah M.',
                role: 'Chief Compliance Officer',
                init: 'SM',
              },
              {
                q: "Our reporters finally trust the system. Knowing they're truly anonymous made submission rates triple within two months.",
                name: 'James T.',
                role: 'Head of HR',
                init: 'JT',
              },
              {
                q: 'The dashboard gives our board the visibility they need. Real-time data, clean exports, and nothing slipping through the cracks.',
                name: 'Priya K.',
                role: 'Legal & Risk Director',
                init: 'PK',
              },
            ].map((p) => (
              <div key={p.name} className="proof-cell">
                <div className="proof-quote">"{p.q}"</div>
                <div className="proof-author">
                  <div className="proof-avatar">{p.init}</div>
                  <div>
                    <div className="proof-name">{p.name}</div>
                    <div className="proof-role">{p.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── CTA ── */}
        <div className="cta-wrap">
          <div className="cta-block">
            <div className="cta-block-inner">
              <div className="eyebrow" style={{ justifyContent: 'center' }}>Get started today</div>
              <h2 className="cta-h2">One report can change<br />everything.</h2>
              <p className="cta-p">
                Anonymous, encrypted, and taken seriously. File a report in minutes — no account required.
              </p>
              <div className="cta-btns">
                <Link to={submitLink} className="btn-hero-primary">
                  Submit Anonymous Report <ArrowRight size={15} />
                </Link>
                <Link
                  to={user?.organization_slug ? `/${user.organization_slug}/track-report` : orgSlug ? `/${orgSlug}/track-report` : "/track-report"}
                  className="btn-cta-outline"
                >
                  Track Existing Case
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* ── FOOTER ── */}
        {/* <footer className="hp-footer">
          <div className="footer-text">© 2025 SpeakUp. All rights reserved.</div>
          <div className="footer-links">
            <a href="#" className="footer-link">Privacy Policy</a>
            <a href="#" className="footer-link">Terms</a>
            <a href="#" className="footer-link">Security</a>
            <a href="#" className="footer-link">Contact</a>
          </div>
        </footer> */}

      </div>
    </>
  );
};

export default Home;