// src/pages/public/Home.jsx
import React, { useEffect, useState, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Shield, Lock, Eye, Users, BarChart3, MessageSquare,
  CheckCircle, Clock, ArrowRight, Award,
  FileText, ShieldCheck, Zap, Globe, Star
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { reportsAPI } from '../../api';
// import PricingTable from '../../components/ui/PricingTable';

/* ─────────────────────────────────────────────
   Styles
───────────────────────────────────────────── */
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Sora:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

  :root {
    --bg-void: #080c14;
    --bg-deep: #0d1320;
    --bg-surface: #111827;
    --bg-raised: #1a2234;
    --bg-card: #1e2a3a;
    --border-dim: rgba(255,255,255,0.06);
    --border-mid: rgba(255,255,255,0.1);
    --border-bright: rgba(255,255,255,0.18);
    --text-primary: #f0f4ff;
    --text-secondary: rgba(240,244,255,0.6);
    --text-muted: rgba(240,244,255,0.35);
    --green: #00d97e;
    --green-dim: rgba(0,217,126,0.12);
    --green-glow: rgba(0,217,126,0.25);
    --amber: #f5a623;
    --amber-dim: rgba(245,166,35,0.1);
    --blue: #4f8ef7;
    --blue-dim: rgba(79,142,247,0.1);
    --red: #ff4d6d;
  }

  .hp * { box-sizing: border-box; margin: 0; padding: 0; }

  .hp {
    font-family: 'Sora', sans-serif;
    background: var(--bg-void);
    color: var(--text-primary);
    overflow-x: hidden;
    -webkit-font-smoothing: antialiased;
  }

  /* ══════════════════════════════════════════
     NAV BAR
  ══════════════════════════════════════════ */
  .nav {
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 100;
    padding: 0 40px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(8,12,20,0.8);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--border-dim);
  }

  .nav-logo {
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
  }

  .nav-logo-icon {
    width: 32px; height: 32px;
    background: linear-gradient(135deg, var(--green), #00b86a);
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 0 16px var(--green-glow);
  }

  .nav-logo-text {
    font-family: 'Playfair Display', serif;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .nav-links {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .nav-link {
    font-size: 13.5px;
    font-weight: 400;
    color: var(--text-secondary);
    text-decoration: none;
    padding: 6px 14px;
    border-radius: 6px;
    transition: all 0.15s;
    letter-spacing: -0.01em;
  }
  .nav-link:hover { color: var(--text-primary); background: var(--border-dim); }

  .nav-cta {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--green);
    color: #000;
    font-family: 'Sora', sans-serif;
    font-size: 13.5px;
    font-weight: 600;
    padding: 8px 18px;
    border-radius: 7px;
    text-decoration: none;
    transition: all 0.15s;
    letter-spacing: -0.01em;
    box-shadow: 0 0 20px var(--green-glow);
  }
  .nav-cta:hover { background: #00f090; box-shadow: 0 0 28px rgba(0,240,144,0.4); transform: translateY(-1px); }

  @media (max-width: 768px) {
    .nav { padding: 0 20px; }
    .nav-links { display: none; }
  }

  /* ══════════════════════════════════════════
     PRICING SECTION
  ══════════════════════════════════════════ */
  .pricing-section {
    padding: 120px 24px;
    background: var(--bg-deep);
    position: relative;
    overflow: hidden;
  }
  .pricing-header {
    text-align: center;
    max-width: 700px;
    margin: 0 auto 64px;
  }

  /* ══════════════════════════════════════════
     CONTACT SECTION
  ══════════════════════════════════════════ */
  .contact-section {
    padding: 120px 24px;
    max-width: 1100px;
    margin: 0 auto;
  }
  .contact-grid {
    display: grid;
    grid-template-columns: 1fr 1.5fr;
    gap: 80px;
  }
  .contact-info h2 { font-family: 'Playfair Display', serif; font-size: 48px; margin-bottom: 24px; }
  .contact-info p { color: var(--text-secondary); line-height: 1.6; margin-bottom: 32px; }
  .contact-form {
    background: var(--bg-surface);
    padding: 40px;
    border-radius: 20px;
    border: 1px solid var(--border-mid);
  }
  .form-group { margin-bottom: 20px; }
  .form-group label { display: block; font-size: 12px; color: var(--text-muted); margin-bottom: 8px; text-transform: uppercase; }
  .form-input {
    width: 100%;
    background: var(--bg-void);
    border: 1px solid var(--border-mid);
    border-radius: 8px;
    padding: 12px 16px;
    color: var(--text-primary);
    font-family: inherit;
  }
  .form-input:focus { border-color: var(--green); outline: none; }

  @media (max-width: 900px) {
    .pricing-grid, .contact-grid { grid-template-columns: 1fr; }
    .pricing-card.popular { transform: scale(1); }
  }

  /* ══════════════════════════════════════════
     HERO
  ══════════════════════════════════════════ */
  .hero {
    position: relative;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 100px 24px 80px;
    overflow: hidden;
  }

  /* Mesh background */
  .hero-mesh {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,217,126,0.08) 0%, transparent 60%),
      radial-gradient(ellipse 60% 50% at 80% 80%, rgba(79,142,247,0.06) 0%, transparent 50%),
      radial-gradient(ellipse 40% 40% at 20% 70%, rgba(245,166,35,0.04) 0%, transparent 50%);
  }

  /* Grid lines */
  .hero-grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(var(--border-dim) 1px, transparent 1px),
      linear-gradient(90deg, var(--border-dim) 1px, transparent 1px);
    background-size: 80px 80px;
    mask-image: radial-gradient(ellipse 90% 80% at 50% 40%, black 40%, transparent 100%);
  }

  /* Vertical accent lines */
  .hero-lines {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }

  .hero-lines::before, .hero-lines::after {
    content: '';
    position: absolute;
    top: 0; bottom: 0;
    width: 1px;
  }

  .hero-lines::before {
    left: calc(50% - 280px);
    background: linear-gradient(to bottom, transparent, rgba(0,217,126,0.3) 30%, transparent 70%);
  }
  .hero-lines::after {
    right: calc(50% - 280px);
    background: linear-gradient(to bottom, transparent, rgba(79,142,247,0.3) 30%, transparent 70%);
  }

  /* Top status chip */
  .hero-status {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    background: rgba(0,217,126,0.06);
    border: 1px solid rgba(0,217,126,0.2);
    border-radius: 100px;
    padding: 6px 16px 6px 8px;
    margin-bottom: 40px;
    animation: fadeSlide 0.7s ease both;
  }

  .status-dot-wrap {
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--green-dim);
    padding: 4px 10px;
    border-radius: 100px;
  }

  .status-pulse {
    width: 6px; height: 6px;
    background: var(--green);
    border-radius: 50%;
    box-shadow: 0 0 0 0 var(--green-glow);
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(0,217,126,0.5); }
    70% { box-shadow: 0 0 0 6px transparent; }
    100% { box-shadow: 0 0 0 0 transparent; }
  }

  .status-dot-text {
    font-size: 11px;
    font-weight: 600;
    color: var(--green);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .status-text {
    font-size: 13px;
    color: var(--text-secondary);
    font-weight: 400;
  }

  /* Hero headline */
  .hero-content {
    position: relative;
    z-index: 2;
    text-align: center;
    max-width: 860px;
  }

  .hero-h1 {
    font-family: 'Playfair Display', serif;
    font-size: clamp(48px, 7vw, 88px);
    font-weight: 700;
    line-height: 1.04;
    letter-spacing: -0.03em;
    color: var(--text-primary);
    margin-bottom: 28px;
    animation: fadeSlide 0.7s 0.1s ease both;
  }

  .hero-h1 .accent-green {
    color: var(--green);
    font-style: italic;
    position: relative;
  }

  .hero-h1 .accent-green::after {
    content: '';
    position: absolute;
    bottom: 4px;
    left: 0; right: 0;
    height: 2px;
    background: var(--green);
    opacity: 0.4;
    border-radius: 2px;
  }

  .hero-sub {
    font-size: clamp(15px, 2vw, 17px);
    line-height: 1.75;
    color: var(--text-secondary);
    font-weight: 300;
    max-width: 580px;
    margin: 0 auto 44px;
    animation: fadeSlide 0.7s 0.2s ease both;
  }

  .hero-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
    flex-wrap: wrap;
    animation: fadeSlide 0.7s 0.3s ease both;
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--green);
    color: #000;
    font-family: 'Sora', sans-serif;
    font-size: 14.5px;
    font-weight: 600;
    padding: 13px 26px;
    border-radius: 8px;
    text-decoration: none;
    border: none;
    cursor: pointer;
    transition: all 0.15s;
    letter-spacing: -0.01em;
    box-shadow: 0 0 28px var(--green-glow), 0 2px 8px rgba(0,0,0,0.3);
  }
  .btn-primary:hover {
    background: #00f090;
    transform: translateY(-2px);
    box-shadow: 0 0 40px rgba(0,240,144,0.5), 0 8px 20px rgba(0,0,0,0.3);
  }

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: transparent;
    color: var(--text-secondary);
    font-family: 'Sora', sans-serif;
    font-size: 14.5px;
    font-weight: 500;
    padding: 13px 26px;
    border-radius: 8px;
    text-decoration: none;
    border: 1px solid var(--border-mid);
    cursor: pointer;
    transition: all 0.15s;
    letter-spacing: -0.01em;
  }
  .btn-secondary:hover {
    color: var(--text-primary);
    border-color: var(--border-bright);
    background: var(--border-dim);
  }

  /* Hero metrics strip */
  .hero-metrics {
    display: flex;
    justify-content: center;
    gap: 0;
    margin: 72px auto 0;
    border: 1px solid var(--border-dim);
    border-radius: 12px;
    overflow: hidden;
    background: var(--bg-surface);
    animation: fadeSlide 0.7s 0.4s ease both;
    max-width: 680px;
    width: 100%;
  }

  .metric {
    flex: 1;
    padding: 20px 24px;
    text-align: center;
    position: relative;
    transition: background 0.2s;
  }
  .metric:hover { background: var(--bg-raised); }
  .metric + .metric { border-left: 1px solid var(--border-dim); }

  .metric-value {
    font-family: 'Playfair Display', serif;
    font-size: 28px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.03em;
    line-height: 1;
    margin-bottom: 6px;
  }

  .metric-label {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-muted);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  /* ── Social proof logos row ── */
  .social-proof {
    margin-top: 56px;
    text-align: center;
    animation: fadeSlide 0.7s 0.5s ease both;
  }

  .social-proof-label {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-muted);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin-bottom: 20px;
  }

  .trust-badges {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .trust-badge {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 6px 14px;
    background: var(--bg-surface);
    border: 1px solid var(--border-dim);
    border-radius: 100px;
    font-size: 12.5px;
    font-weight: 500;
    color: var(--text-muted);
    transition: all 0.2s;
  }
  .trust-badge:hover { border-color: var(--border-mid); color: var(--text-secondary); }
  .trust-badge svg { opacity: 0.6; }

  @keyframes fadeSlide {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @media (max-width: 600px) {
    .hero { padding: 90px 16px 60px; }
    .hero-metrics { flex-direction: row; }
    .metric { padding: 16px 12px; }
    .metric-value { font-size: 22px; }
    .hero-lines::before, .hero-lines::after { display: none; }
  }

  /* ══════════════════════════════════════════
     BENTO FEATURES
  ══════════════════════════════════════════ */
  .section-wrap {
    max-width: 1160px;
    margin: 0 auto;
    padding: 100px 32px;
  }

  .section-label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--green);
    margin-bottom: 16px;
  }

  .section-label::before {
    content: '';
    display: block;
    width: 20px;
    height: 1px;
    background: var(--green);
    opacity: 0.6;
  }

  .section-h2 {
    font-family: 'Playfair Display', serif;
    font-size: clamp(30px, 4vw, 46px);
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -0.03em;
    max-width: 700px;
    margin-bottom: 20px;
    text-align: inherit;
  }

  .section-h2 em {
    font-style: italic;
    color: var(--text-secondary);
  }

  /* BENTO GRID */
  .bento {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: auto auto;
    gap: 2px;
    background: var(--border-dim);
    border-radius: 16px;
    overflow: hidden;
  }

  @media (max-width: 900px) {
    .bento { grid-template-columns: 1fr 1fr; }
  }
  @media (max-width: 560px) {
    .bento { grid-template-columns: 1fr; }
  }

  .bcard {
    background: var(--bg-surface);
    padding: 36px 32px;
    position: relative;
    overflow: hidden;
    transition: background 0.2s;
  }
  .bcard:hover { background: var(--bg-raised); }

  /* Big feature card spans 2 cols */
  .bcard-wide {
    grid-column: span 2;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    align-items: center;
  }
  @media (max-width: 900px) { .bcard-wide { grid-column: span 2; grid-template-columns: 1fr; } }
  @media (max-width: 560px) { .bcard-wide { grid-column: span 1; } }

  .bcard-accent-line {
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 1px;
  }

  .bcard-icon {
    width: 44px; height: 44px;
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 20px;
    font-size: 0;
  }
  .icon-green { background: var(--green-dim); color: var(--green); }
  .icon-blue  { background: var(--blue-dim);  color: var(--blue); }
  .icon-amber { background: var(--amber-dim); color: var(--amber); }

  .bcard h3 {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 10px;
    letter-spacing: -0.02em;
  }

  .bcard p {
    font-size: 14px;
    font-weight: 300;
    color: var(--text-secondary);
    line-height: 1.7;
  }

  /* Encryption visual */
  .enc-visual {
    background: var(--bg-void);
    border: 1px solid var(--border-dim);
    border-radius: 10px;
    padding: 20px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11.5px;
    color: var(--text-muted);
    overflow: hidden;
    position: relative;
  }

  .enc-line { margin-bottom: 6px; opacity: 0.7; }
  .enc-hl { color: var(--green); opacity: 1; }
  .enc-hl2 { color: var(--blue); opacity: 1; }

  .enc-scan {
    position: absolute;
    left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, var(--green), transparent);
    animation: scan 3s ease-in-out infinite;
    opacity: 0.4;
  }

  @keyframes scan {
    0%   { top: 0%; }
    100% { top: 100%; }
  }

  /* Stat pill */
  .stat-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--bg-void);
    border: 1px solid var(--border-dim);
    border-radius: 8px;
    padding: 10px 16px;
    margin-top: 20px;
  }
  .stat-pill-num {
    font-family: 'Playfair Display', serif;
    font-size: 22px;
    font-weight: 700;
    color: var(--text-primary);
  }
  .stat-pill-label {
    font-size: 12px;
    color: var(--text-muted);
    font-weight: 400;
  }

  /* ══════════════════════════════════════════
     HOW IT WORKS
  ══════════════════════════════════════════ */
  .hiw-bg {
    background: var(--bg-deep);
    border-top: 1px solid var(--border-dim);
    border-bottom: 1px solid var(--border-dim);
  }

  .timeline {
    position: relative;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 24px;
  }

  @media (max-width: 768px) {
    .timeline { grid-template-columns: 1fr 1fr; }
  }
  @media (max-width: 440px) {
    .timeline { grid-template-columns: 1fr; }
  }

  /* Connecting line */
  .timeline::before {
    content: '';
    position: absolute;
    top: 28px;
    left: 5%;
    right: 5%;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--border-mid) 20%, var(--border-mid) 80%, transparent);
  }

  @media (max-width: 768px) { .timeline::before { display: none; } }

  .tl-step {
    position: relative;
    text-align: center;
    padding: 0 8px;
  }

  .tl-num {
    width: 56px; height: 56px;
    margin: 0 auto 24px;
    border-radius: 50%;
    background: var(--bg-surface);
    border: 1px solid var(--border-mid);
    display: flex; align-items: center; justify-content: center;
    position: relative;
    z-index: 1;
    transition: all 0.2s;
  }
  .tl-step:hover .tl-num {
    border-color: var(--green);
    background: var(--green-dim);
    box-shadow: 0 0 20px var(--green-glow);
  }
  .tl-step:hover .tl-num svg { color: var(--green); }
  .tl-num svg { color: var(--text-muted); transition: color 0.2s; }

  .tl-step h4 {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 10px;
    letter-spacing: -0.02em;
  }

  .tl-step p {
    font-size: 13.5px;
    color: var(--text-secondary);
    line-height: 1.65;
    font-weight: 300;
  }

  .tl-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 500;
    color: var(--green);
    background: var(--green-dim);
    padding: 2px 8px;
    border-radius: 4px;
    margin-bottom: 14px;
    letter-spacing: 0.04em;
  }

  /* ══════════════════════════════════════════
     FOR TEAMS SECTION
  ══════════════════════════════════════════ */
  .teams-bg {
    background: var(--bg-void);
  }

  .teams-layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 80px;
    align-items: start;
  }

  @media (max-width: 860px) {
    .teams-layout { grid-template-columns: 1fr; gap: 48px; }
  }

  .teams-left { position: sticky; top: 100px; }

  .teams-checklist {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: 32px;
  }

  .chk-item {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    background: var(--bg-surface);
    border: 1px solid var(--border-dim);
    border-radius: 0;
    padding: 20px 22px;
    transition: all 0.2s;
    position: relative;
    cursor: default;
  }
  .chk-item:first-child { border-radius: 10px 10px 0 0; }
  .chk-item:last-child  { border-radius: 0 0 10px 10px; }
  .chk-item:hover {
    background: var(--bg-raised);
    border-color: var(--border-mid);
    transform: translateX(3px);
  }
  .chk-item:hover .chk-bar { opacity: 1; }

  .chk-bar {
    position: absolute;
    left: 0; top: 8px; bottom: 8px;
    width: 2px;
    background: var(--green);
    border-radius: 2px;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .chk-icon-wrap {
    width: 36px; height: 36px;
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    background: var(--bg-raised);
    border: 1px solid var(--border-dim);
    color: var(--blue);
    transition: all 0.2s;
  }
  .chk-item:hover .chk-icon-wrap {
    background: var(--green-dim);
    border-color: rgba(0,217,126,0.2);
    color: var(--green);
  }

  .chk-title {
    font-size: 14.5px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 5px;
    letter-spacing: -0.01em;
  }

  .chk-desc {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.6;
    font-weight: 300;
  }

  /* Dashboard preview card */
  .dash-preview {
    background: var(--bg-surface);
    border: 1px solid var(--border-dim);
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 40px 80px rgba(0,0,0,0.4);
  }

  .dash-topbar {
    background: var(--bg-raised);
    padding: 12px 20px;
    display: flex;
    align-items: center;
    gap: 8px;
    border-bottom: 1px solid var(--border-dim);
  }

  .dash-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
  }
  .d1 { background: #ff5f57; }
  .d2 { background: #febc2e; }
  .d3 { background: #28c840; }

  .dash-title {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: var(--text-muted);
    margin-left: 8px;
    letter-spacing: 0.04em;
  }

  .dash-body { padding: 20px; }

  .dash-kpis {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-bottom: 16px;
  }

  .kpi {
    background: var(--bg-raised);
    border: 1px solid var(--border-dim);
    border-radius: 8px;
    padding: 14px;
  }

  .kpi-val {
    font-family: 'Playfair Display', serif;
    font-size: 24px;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1;
    margin-bottom: 4px;
  }

  .kpi-lbl {
    font-size: 10px;
    color: var(--text-muted);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .kpi-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 10px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 4px;
    margin-top: 6px;
  }
  .badge-green { background: var(--green-dim); color: var(--green); }
  .badge-amber { background: var(--amber-dim); color: var(--amber); }
  .badge-blue  { background: var(--blue-dim);  color: var(--blue); }

  .dash-table { width: 100%; }

  .dash-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid var(--border-dim);
    font-size: 12px;
  }
  .dash-row:last-child { border-bottom: none; }

  .dash-row-id {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10.5px;
    color: var(--text-muted);
    min-width: 60px;
  }
  .dash-row-label { flex: 1; color: var(--text-secondary); }

  .status-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10.5px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 100px;
    letter-spacing: 0.03em;
  }
  .chip-open    { background: var(--amber-dim); color: var(--amber); }
  .chip-review  { background: var(--blue-dim);  color: var(--blue); }
  .chip-closed  { background: var(--green-dim); color: var(--green); }

  .chip-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }

  /* ══════════════════════════════════════════
     SECURITY TRUST STRIP
  ══════════════════════════════════════════ */
  .trust-strip-bg {
    background: var(--bg-surface);
    border-top: 1px solid var(--border-dim);
    border-bottom: 1px solid var(--border-dim);
  }

  .trust-strip {
    max-width: 1160px;
    margin: 0 auto;
    padding: 40px 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    flex-wrap: wrap;
  }

  .trust-strip-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .trust-strip-badges {
    display: flex;
    align-items: center;
    gap: 20px;
    flex-wrap: wrap;
    flex: 1;
  }

  .ts-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--text-secondary);
    font-weight: 400;
  }
  .ts-badge svg { color: var(--green); flex-shrink: 0; }

  .trust-strip-divider {
    width: 1px;
    height: 20px;
    background: var(--border-dim);
    flex-shrink: 0;
  }

  @media (max-width: 640px) { .trust-strip-divider { display: none; } }
`;

/* ─────────────────────────────────────────────
   Component
───────────────────────────────────────────── */
const Home = () => {
  const { user } = useAuthStore();
  const { orgSlug } = useParams();
  const [trustStats, setTrustStats] = useState([
    { label: 'Reports', value: '—' },
    { label: 'Resolved', value: '—' },
    { label: 'Anonymous', value: '—' },
    { label: 'Active Users', value: '—' },
  ]);

  useEffect(() => {
    const fetchTrustStats = async () => {
      try {
        const data = await reportsAPI.getStats();
        setTrustStats([
          { label: 'Reports', value: data.total_reports ?? '—' },
          { label: 'Resolved', value: data.resolved ?? '—' },
          { label: 'Anonymous', value: data.anonymous ?? '—' },
          { label: 'Active Users', value: data.active_users ?? '—' },
        ]);
      } catch (e) {
        console.error('Error fetching trust indicators:', e);
      }
    };
    fetchTrustStats();
  }, []);

  const dashboardLink = user
    ? ['admin', 'super_admin'].includes(user?.role)
      ? `/${user.organization_slug}/admin/dashboard`
      : ['manager', 'officer', 'compliance'].includes(user?.role)
        ? `/${user.organization_slug}/compliance/dashboard`
        : user?.role === 'reviewer'
          ? `/${user.organization_slug}/reviewer/dashboard`
          : `/${user.organization_slug}/reporter/dashboard`
    : '/login';

  return (
    <>
      <style>{styles}</style>
      <div className="hp">

        {/* ══ HERO ══ */}
        <section className="hero">
          <div className="hero-mesh" />
          <div className="hero-grid" />
          <div className="hero-lines" />

          <div className="hero-content" style={{ position: 'relative', zIndex: 2 }}>
            <div className="hero-status">
              <div className="status-dot-wrap">
                <div className="status-pulse" />
                <span className="status-dot-text">Live</span>
              </div>
              <span className="status-text">End-to-end encrypted · GDPR compliant · SOC 2 ready</span>
            </div>

            <h1 className="hero-h1">
              Speak up.<br />
              <span className="accent-green">Stay protected.</span>
            </h1>

            <p className="hero-sub">
              A confidential reporting platform that shields whistleblowers with
              military-grade encryption — and gives compliance teams the intelligence to act.
            </p>

            <div className="hero-actions">
              {orgSlug && (
                <Link
                  to={`/${user?.organization_slug ?? orgSlug}/submit-anonymous`}
                  className="btn-primary"
                >
                  Submit Anonymous Report
                  <ArrowRight size={15} />
                </Link>
              )}
              <Link to={dashboardLink} className="btn-secondary">
                {user ? 'Open Dashboard' : 'Team Login'}
              </Link>
            </div>

            <div className="hero-metrics">
              {trustStats.map((s, i) => (
                <div key={s.label} className="metric">
                  <div className="metric-value">{s.value}</div>
                  <div className="metric-label">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="social-proof">
              <div className="social-proof-label">Trusted by compliance teams worldwide</div>
              <div className="trust-badges">
                {[
                  { icon: <ShieldCheck size={12} />, label: 'SOC 2 Ready' },
                  { icon: <Globe size={12} />, label: 'GDPR Compliant' },
                  { icon: <Lock size={12} />, label: 'AES-256 Encrypted' },
                  { icon: <Award size={12} />, label: 'ISO 27001 Aligned' },
                  { icon: <Zap size={12} />, label: '99.9% Uptime SLA' },
                ].map((b) => (
                  <div key={b.label} className="trust-badge">
                    {b.icon}
                    {b.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══ SECURITY TRUST STRIP ══ */}
        <div className="trust-strip-bg">
          <div className="trust-strip">
            <span className="trust-strip-label">Security</span>
            {[
              { icon: <Lock size={14} />, label: 'Zero-knowledge architecture' },
              { icon: <Shield size={14} />, label: 'No IP logging' },
              { icon: <Eye size={14} />, label: 'Anonymous by default' },
              { icon: <ShieldCheck size={14} />, label: 'Tamper-proof audit logs' },
              // { icon: <Globe size={14} />, label: 'Multi-region data residency' },
            ].map((b, i) => (
              <React.Fragment key={b.label}>
                {i > 0 && <div className="trust-strip-divider" />}
                <div className="ts-badge">
                  {b.icon}
                  {b.label}
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* ══ FEATURES BENTO ══ */}
        <div id="features" style={{ background: 'var(--bg-void)' }}>
          <div className="section-wrap">
            <div className="section-label">Platform capabilities</div>
            <h2 className="section-h2">
              Built for trust.<br />
              <em>Engineered for action.</em>
            </h2>

            <div className="bento">
              {/* Wide card – anonymity + code preview */}
              <div className="bcard bcard-wide">
                <div
                  className="bcard-accent-line"
                  style={{ background: 'linear-gradient(90deg, var(--green), var(--blue))' }}
                />
                <div>
                  <div className="bcard-icon icon-green">
                    <Lock size={20} />
                  </div>
                  <h3>Zero-identity reporting</h3>
                  <p>
                    Submit reports with no account required. Our zero-knowledge design means even we can't
                    trace reports back to you. Every submission is stripped of metadata before storage.
                  </p>
                  <div className="stat-pill">
                    <span className="stat-pill-num">100%</span>
                    <span className="stat-pill-label">of anonymous reporters protected</span>
                  </div>
                </div>
                <div className="enc-visual">
                  <div className="enc-scan" />
                  <div className="enc-line">INIT <span className="enc-hl">AES-256-GCM</span> cipher</div>
                  <div className="enc-line">reporter_id → <span className="enc-hl">NULL</span></div>
                  <div className="enc-line">ip_addr → <span className="enc-hl">STRIPPED</span></div>
                  <div className="enc-line">payload → <span className="enc-hl2">0x4f8a2c...</span></div>
                  <div className="enc-line">metadata → <span className="enc-hl">PURGED</span></div>
                  <div className="enc-line">status → <span className="enc-hl">SECURE ✓</span></div>
                </div>
              </div>

              {/* Card – tracking */}
              <div className="bcard">
                <div
                  className="bcard-accent-line"
                  style={{ background: 'var(--blue)' }}
                />
                <div className="bcard-icon icon-blue">
                  <Eye size={20} />
                </div>
                <h3>Real-time case tracking</h3>
                <p>
                  Track your report's progress at every stage using a unique access code.
                  No login, no exposure.
                </p>
              </div>

              {/* Card – messaging */}
              <div className="bcard">
                <div
                  className="bcard-accent-line"
                  style={{ background: 'var(--amber)' }}
                />
                <div className="bcard-icon icon-amber">
                  <MessageSquare size={20} />
                </div>
                <h3>Encrypted messaging</h3>
                <p>
                  Communicate directly with investigators through a secure, end-to-end encrypted channel — anonymously.
                </p>
              </div>

              {/* Card – analytics */}
              <div className="bcard">
                <div
                  className="bcard-accent-line"
                  style={{ background: 'var(--green)' }}
                />
                <div className="bcard-icon icon-green">
                  <BarChart3 size={20} />
                </div>
                <h3>Compliance analytics</h3>
                <p>
                  Real-time dashboards, trend reports, and SLA tracking give leadership full visibility
                  without compromising reporter privacy.
                </p>
              </div>

              {/* Card – teams */}
              <div className="bcard">
                <div
                  className="bcard-accent-line"
                  style={{ background: 'var(--blue)' }}
                />
                <div className="bcard-icon icon-blue">
                  <Users size={20} />
                </div>
                <h3>Role-based access</h3>
                <p>
                  Granular permissions for admins, compliance officers, investigators, and reviewers.
                  Need-to-know, always.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ══ PRICING ══ */}
        {/* <section id="pricing" className="pricing-section">
          <div className="pricing-header">
            <h2 className="section-h2">Tailored for Your Enterprise</h2>
            <p className="section-sub">We offer flexible, enterprise-grade solutions tailored to your organization's specific compliance requirements.</p>
          </div>
          <PricingTable />
        </section> */}

        {/* ══ FOR TEAMS ══ */}
        <div id="for-teams" className="teams-bg">
          <div className="section-wrap">
            <div className="teams-layout">
              <div className="teams-left">
                <div className="section-label">For compliance teams</div>
                <h2 className="section-h2">
                  Command-centre for<br />
                  <em>investigators.</em>
                </h2>
                <p style={{ fontSize: '15px', color: 'var(--text-secondary)', fontWeight: 300, lineHeight: 1.75, marginBottom: '8px' }}>
                  Give your team the tools to move fast — without ever compromising
                  reporter confidentiality or audit integrity.
                </p>

                <div className="teams-checklist">
                  {[
                    { icon: <Users size={15} />, title: 'Team collaboration', desc: 'Assign cases, leave internal notes, and co-investigate with full version history.' },
                    { icon: <BarChart3 size={15} />, title: 'Analytics dashboard', desc: 'Live KPIs, trend analysis, and export-ready reports for board-level review.' },
                    { icon: <Clock size={15} />, title: 'SLA & workflow engine', desc: 'Customisable workflows with automated reminders and deadline enforcement.' },
                    // { icon: <AlertTriangle size={15} />, title: 'Risk prioritisation', desc: 'Auto-scored severity levels surface the highest-risk cases to the right people first.' },
                    // { icon: <FileText size={15} />, title: 'Immutable audit trail', desc: 'Every action is cryptographically signed and tamper-evident — forever.' },
                  ].map((item) => (
                    <div key={item.title} className="chk-item">
                      <div className="chk-bar" />
                      <div className="chk-icon-wrap">{item.icon}</div>
                      <div>
                        <div className="chk-title">{item.title}</div>
                        <div className="chk-desc">{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dashboard mockup */}
              <div>
                <div className="dash-preview">
                  <div className="dash-topbar">
                    <div className="dash-dot d1" />
                    <div className="dash-dot d2" />
                    <div className="dash-dot d3" />
                    <span className="dash-title">compliance · dashboard</span>
                  </div>
                  <div className="dash-body">
                    <div className="dash-kpis">
                      <div className="kpi">
                        <div className="kpi-val">24</div>
                        <div className="kpi-lbl">Open cases</div>
                        <div className="kpi-badge badge-amber">↑ 3 this week</div>
                      </div>
                      <div className="kpi">
                        <div className="kpi-val">91%</div>
                        <div className="kpi-lbl">SLA on-time</div>
                        <div className="kpi-badge badge-green">↑ 4%</div>
                      </div>
                      <div className="kpi">
                        <div className="kpi-val">142</div>
                        <div className="kpi-lbl">Resolved YTD</div>
                        <div className="kpi-badge badge-blue">+12 mo</div>
                      </div>
                    </div>

                    <div style={{ marginBottom: '12px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Recent reports</div>

                    <div className="dash-table">
                      {[
                        { id: '#RPT-091', label: 'Financial misconduct', chip: 'chip-open', status: 'Open' },
                        { id: '#RPT-089', label: 'Workplace harassment', chip: 'chip-review', status: 'In Review' },
                        { id: '#RPT-087', label: 'Data privacy breach', chip: 'chip-review', status: 'In Review' },
                        { id: '#RPT-085', label: 'Conflict of interest', chip: 'chip-closed', status: 'Closed' },
                        { id: '#RPT-083', label: 'Bribery allegation', chip: 'chip-closed', status: 'Closed' },
                      ].map((row) => (
                        <div key={row.id} className="dash-row">
                          <span className="dash-row-id">{row.id}</span>
                          <span className="dash-row-label">{row.label}</span>
                          <span className={`status-chip ${row.chip}`}>
                            <span className="chip-dot" />
                            {row.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>


        {/* ══ HOW IT WORKS ══ */}
        <div id="how-it-works" className="hiw-bg">
          <div className="section-wrap">
            <div className="section-label">The process</div>
            <h2 className="section-h2" style={{ marginBottom: '48px' }}>
              From report<br />
              <em>to resolution.</em>
            </h2>

            <div className="timeline">
              {[
                {
                  tag: '01 · SUBMIT',
                  icon: <FileText size={22} />,
                  title: 'Submit anonymously',
                  desc: 'File a report in minutes with no account needed. Your identity is never stored or inferred.',
                },
                {
                  tag: '02 · ROUTE',
                  icon: <ShieldCheck size={22} />,
                  title: 'Secure routing',
                  desc: 'Reports are encrypted and assigned to the right compliance officer by severity and category.',
                },
                {
                  tag: '03 · COMMUNICATE',
                  icon: <MessageSquare size={22} />,
                  title: 'Stay in the loop',
                  desc: 'Provide extra context or receive updates — all through your private, anonymous channel.',
                },
                {
                  tag: '04 · RESOLVE',
                  icon: <CheckCircle size={22} />,
                  title: 'Case closed',
                  desc: 'A final outcome is documented in the immutable audit log and shared with you securely.',
                },
              ].map((step) => (
                <div key={step.title} className="tl-step">
                  <div className="tl-num">{step.icon}</div>
                  <div className="tl-tag">{step.tag}</div>
                  <h4>{step.title}</h4>
                  <p>{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ══ CONTACT ══ */}
        <section id="contact" className="contact-section">
          <div className="contact-grid">
            <div className="contact-info">
              <h2>Let's Talk Security.</h2>
              <p>Ready to protect your organization? Our team of security experts is here to help you implement a robust whistleblowing system.</p>
              {/* <div className="contact-methods">
                <div style={{ marginBottom: '16px' }}><strong>Email:</strong> hello@whistleblower.com</div>
                <div><strong>Location:</strong> London, United Kingdom</div>
              </div> */}
              <div className="contact-methods" style={{ marginTop: '24px' }}>
                <div><strong>For more info contact:</strong> <a href="https://agiteks.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--green)' }}>agiteks.com</a></div>
              </div>
            </div>
            <div className="contact-form">
              <div className="form-group">
                <label>Full Name</label>
                <input type="text" className="form-input" placeholder="John Doe" />
              </div>
              <div className="form-group">
                <label>Work Email</label>
                <input type="email" className="form-input" placeholder="john@company.com" />
              </div>
              <div className="form-group">
                <label>Message</label>
                <textarea className="form-input" rows="4" placeholder="How can we help?"></textarea>
              </div>
              <button className="btn-primary" style={{ width: '100%' }}>Send Message</button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default Home;