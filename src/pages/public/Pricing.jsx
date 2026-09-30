// src/pages/public/PricingPage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, ChevronDown, CheckCircle, Zap } from 'lucide-react';
import PricingTable from '../../components/ui/PricingTable';
import { useAuthStore } from '../../store/authStore';
import { plansAPI } from '../../api';
import useSEO from '../../hooks/useSEO';
import { getHomePath } from '../../utils/navigation';

/* ─────────────────────────────────────────────
   Styles (scoped under .pp-root)
───────────────────────────────────────────── */
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Sora:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

  .pp-root {
    --bg-void: #080c14;
    --bg-deep: #0d1320;
    --bg-surface: #111827;
    --bg-raised: #1a2234;
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
    --red: #ff5c5c;

    font-family: 'Sora', sans-serif;
    background: var(--bg-void);
    color: var(--text-primary);
    overflow-x: hidden;
    -webkit-font-smoothing: antialiased;
  }
  .pp-root *, .pp-root *::before, .pp-root *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  /* ══ HERO ══ */
  .pp-hero {
    padding: 140px 24px 80px;
    text-align: center;
    position: relative;
    overflow: hidden;
  }
  .pp-hero-mesh {
    position: absolute; inset: 0;
    background:
      radial-gradient(ellipse 70% 60% at 50% 0%, rgba(0,217,126,0.07) 0%, transparent 60%),
      radial-gradient(ellipse 50% 40% at 80% 90%, rgba(79,142,247,0.05) 0%, transparent 50%);
  }
  .pp-hero-grid {
    position: absolute; inset: 0;
    background-image:
      linear-gradient(var(--border-dim) 1px, transparent 1px),
      linear-gradient(90deg, var(--border-dim) 1px, transparent 1px);
    background-size: 80px 80px;
    mask-image: radial-gradient(ellipse 80% 70% at 50% 20%, black 30%, transparent 100%);
  }
  .pp-hero-inner {
    position: relative;
    z-index: 2;
    max-width: 760px;
    margin: 0 auto;
  }
  .pp-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 500;
    color: var(--green);
    background: var(--green-dim);
    border: 1px solid rgba(0,217,126,0.15);
    padding: 5px 12px;
    border-radius: 6px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-bottom: 32px;
  }
  .pp-h1 {
    font-family: 'Playfair Display', serif;
    font-size: clamp(44px, 6vw, 80px);
    font-weight: 700;
    line-height: 1.05;
    letter-spacing: -0.03em;
    color: var(--text-primary);
    margin-bottom: 24px;
  }
  .pp-h1 em {
    font-style: italic;
    color: var(--text-secondary);
  }
  .pp-hero-sub {
    font-size: clamp(15px, 2vw, 17px);
    color: var(--text-secondary);
    font-weight: 300;
    line-height: 1.75;
    max-width: 520px;
    margin: 0 auto 16px;
  }

  /* Guarantee strip */
  .pp-guarantee-strip {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 24px;
    margin-top: 40px;
    flex-wrap: wrap;
  }
  .pp-guarantee-item {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 12.5px;
    color: var(--text-muted);
    font-weight: 400;
  }
  .pp-guarantee-item svg { color: var(--green); }
  .pp-guarantee-dot {
    width: 3px; height: 3px;
    border-radius: 50%;
    background: var(--border-bright);
  }
  @media (max-width: 520px) { .pp-guarantee-dot { display: none; } }

  /* ══ TABLE SECTION ══ */
  .pp-table-section {
    padding: 0 24px 100px;
    background: var(--bg-void);
  }

  /* ══ COMPARE SECTION ══ */
  .pp-compare-section {
    background: var(--bg-deep);
    border-top: 1px solid var(--border-dim);
    border-bottom: 1px solid var(--border-dim);
    padding: 100px 24px;
  }
  .pp-section-inner {
    max-width: 1060px;
    margin: 0 auto;
  }
  .pp-section-label {
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
  .pp-section-label::before {
    content: '';
    display: block;
    width: 20px; height: 1px;
    background: var(--green);
    opacity: 0.6;
  }
  .pp-section-h2 {
    font-family: 'Playfair Display', serif;
    font-size: clamp(28px, 4vw, 44px);
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -0.03em;
    margin-bottom: 56px;
  }
  .pp-section-h2 em { font-style: italic; color: var(--text-secondary); }

  /* Comparison table */
  .pp-compare-table-wrap {
    width: 100%;
    overflow-x: auto;
  }
  .pp-compare-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13.5px;
  }
  .pp-compare-table th {
    text-align: left;
    padding: 16px 20px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-muted);
    border-bottom: 1px solid var(--border-dim);
  }
  .pp-compare-table th:not(:first-child) { text-align: center; }
  .pp-compare-table td {
    padding: 14px 20px;
    border-bottom: 1px solid var(--border-dim);
    color: var(--text-secondary);
    font-weight: 300;
    vertical-align: middle;
  }
  .pp-compare-table td:not(:first-child) { text-align: center; }
  .pp-compare-table tr:hover td { background: rgba(255,255,255,0.02); }
  .pp-compare-table .pp-ct-group td {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-muted);
    background: var(--bg-raised);
    padding: 10px 20px;
    border-bottom: none;
  }

  .pp-check-yes { color: var(--green); }
  .pp-check-no  { color: var(--text-muted); opacity: 0.4; }

  .pp-ct-plan-name {
    font-family: 'Playfair Display', serif;
    font-size: 16px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.02em;
  }
  .pp-ct-plan-price {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 4px;
  }
  .pp-ct-featured { color: var(--green) !important; }

  @media (max-width: 640px) {
    .pp-compare-table { font-size: 12px; }
    .pp-compare-table th, .pp-compare-table td { padding: 12px 12px; }
  }

  /* Comparison table status states */
  .pp-ct-status {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 60px 20px;
  }
  .pp-ct-status-text {
    font-size: 14px;
    color: var(--text-secondary);
  }
  .pp-ct-retry-btn {
    font-family: 'Sora', sans-serif;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    background: var(--bg-raised);
    border: 1px solid var(--border-mid);
    padding: 9px 18px;
    border-radius: 8px;
    cursor: pointer;
  }
  .pp-ct-retry-btn:hover { border-color: var(--border-bright); }
  .pp-ct-skel-row {
    height: 14px;
    border-radius: 5px;
    background: var(--bg-raised);
    animation: pp-ct-pulse 1.4s ease-in-out infinite;
    margin: 14px 20px;
  }
  @keyframes pp-ct-pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }

  /* ══ TESTIMONIALS / TRUST ══ */
  .pp-trust-section {
    padding: 100px 24px;
    background: var(--bg-void);
  }
  .pp-trust-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2px;
    background: var(--border-dim);
    border-radius: 16px;
    overflow: hidden;
    margin-top: 56px;
  }
  @media (max-width: 768px) {
    .pp-trust-grid { grid-template-columns: 1fr; background: transparent; gap: 12px; }
  }
  .pp-trust-card {
    background: var(--bg-surface);
    padding: 36px 32px;
    transition: background 0.2s;
  }
  @media (max-width: 768px) {
    .pp-trust-card { border: 1px solid var(--border-dim); border-radius: 12px; }
  }
  .pp-trust-card:hover { background: var(--bg-raised); }
  .pp-trust-quote {
    font-size: 14.5px;
    font-weight: 300;
    color: var(--text-secondary);
    line-height: 1.75;
    margin-bottom: 24px;
    font-style: italic;
  }
  .pp-trust-author {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .pp-trust-avatar {
    width: 36px; height: 36px;
    border-radius: 50%;
    background: var(--bg-raised);
    border: 1px solid var(--border-mid);
    display: flex; align-items: center; justify-content: center;
    font-family: 'Playfair Display', serif;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-secondary);
  }
  .pp-trust-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }
  .pp-trust-role {
    font-size: 11.5px;
    color: var(--text-muted);
    font-weight: 300;
    margin-top: 2px;
  }
  .pp-trust-plan-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 9.5px;
    color: var(--green);
    background: var(--green-dim);
    padding: 2px 7px;
    border-radius: 4px;
    margin-left: auto;
    flex-shrink: 0;
  }

  /* ══ FAQ ══ */
  .pp-faq-section {
    background: var(--bg-deep);
    border-top: 1px solid var(--border-dim);
    padding: 100px 24px;
  }
  .pp-faq-grid {
    display: grid;
    grid-template-columns: 1fr 1.6fr;
    gap: 80px;
    align-items: start;
    max-width: 1060px;
    margin: 0 auto;
  }
  @media (max-width: 820px) {
    .pp-faq-grid { grid-template-columns: 1fr; gap: 48px; }
  }
  .pp-faq-left { position: sticky; top: 100px; }
  .pp-faq-left p {
    font-size: 14.5px;
    color: var(--text-secondary);
    font-weight: 300;
    line-height: 1.75;
    margin-top: 16px;
  }

  .pp-faq-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .pp-faq-item {
    background: var(--bg-surface);
    border: none;
    overflow: hidden;
    transition: background 0.15s;
  }
  .pp-faq-item:first-child { border-radius: 10px 10px 0 0; }
  .pp-faq-item:last-child  { border-radius: 0 0 10px 10px; }
  .pp-faq-item:hover { background: var(--bg-raised); }

  .pp-faq-question {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 20px 24px;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    font-family: 'Sora', sans-serif;
    font-size: 14.5px;
    font-weight: 500;
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }
  .pp-faq-chevron {
    flex-shrink: 0;
    color: var(--text-muted);
    transition: transform 0.2s, color 0.2s;
  }
  .pp-faq-chevron.open { transform: rotate(180deg); color: var(--green); }

  .pp-faq-answer {
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.25s ease;
  }
  .pp-faq-answer.open { max-height: 400px; }
  .pp-faq-answer-inner {
    padding: 0 24px 20px;
    font-size: 13.5px;
    color: var(--text-secondary);
    font-weight: 300;
    line-height: 1.75;
  }

  /* ══ FINAL CTA ══ */
  .pp-cta-section {
    position: relative;
    overflow: hidden;
    background: var(--bg-void);
    padding: 120px 32px;
    text-align: center;
    border-top: 1px solid var(--border-dim);
  }
  .pp-cta-mesh {
    position: absolute; inset: 0;
    background:
      radial-gradient(ellipse 60% 80% at 50% 0%, rgba(0,217,126,0.06) 0%, transparent 60%),
      radial-gradient(ellipse 40% 60% at 30% 100%, rgba(79,142,247,0.04) 0%, transparent 50%);
  }
  .pp-cta-inner {
    position: relative; z-index: 1;
    max-width: 620px;
    margin: 0 auto;
  }
  .pp-cta-h2 {
    font-family: 'Playfair Display', serif;
    font-size: clamp(34px, 5vw, 58px);
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1.06;
    color: var(--text-primary);
    margin-bottom: 20px;
  }
  .pp-cta-sub {
    font-size: 16px;
    color: var(--text-secondary);
    font-weight: 300;
    line-height: 1.7;
    margin-bottom: 44px;
  }
  .pp-cta-buttons {
    display: flex;
    gap: 12px;
    justify-content: center;
    flex-wrap: wrap;
  }
  .pp-btn-primary {
    display: inline-flex; align-items: center; gap: 8px;
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
  .pp-btn-primary:hover {
    background: #00f090;
    transform: translateY(-2px);
    box-shadow: 0 0 40px rgba(0,240,144,0.5), 0 8px 20px rgba(0,0,0,0.3);
  }
  .pp-btn-ghost {
    display: inline-flex; align-items: center; gap: 8px;
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
  .pp-btn-ghost:hover {
    color: var(--text-primary);
    border-color: var(--border-bright);
    background: var(--border-dim);
  }

  /* ══ FOOTER ══ */
  .pp-footer {
    background: var(--bg-deep);
    border-top: 1px solid var(--border-dim);
    padding: 28px 40px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }
`;

/* ─────────────────────────────────────────────
   FAQ data
───────────────────────────────────────────── */
const FAQS = [
  {
    q: 'Can I switch plans at any time?',
    a: 'Yes. You can upgrade or downgrade your plan at any time. Upgrades take effect immediately; downgrades apply at the end of your current billing cycle. Your data and reports are never affected by a plan change.',
  },
  {
    q: 'Is there a free trial?',
    a: 'We offer a 14-day free trial on all plans — no credit card required. You get full access to every feature in your chosen plan tier so you can evaluate it properly.',
  },
  {
    q: 'How does anonymous reporting actually work?',
    a: 'Reports are submitted with no account required. Metadata including IP addresses are stripped before storage. A unique access code lets reporters track progress and communicate with investigators — without ever revealing their identity.',
  },
  {
    q: 'What happens to my data if I cancel?',
    a: 'Your organization\'s data is retained for 30 days after cancellation, giving you time to export. After that period it is securely purged from all systems. You can request immediate deletion at any time.',
  },
  {
    q: 'Do you offer discounts for non-profits or public sector organizations?',
    a: 'Yes. We offer a 30% discount for registered non-profits and public sector bodies. Contact our team with proof of eligibility and we\'ll apply the discount to your account.',
  },
  {
    q: 'Is Xposer AI GDPR and SOC 2 compliant?',
    a: 'Xposer AI is architected to meet GDPR requirements including data minimisation and right to erasure. SOC 2 Type II certification is in progress; we are happy to share our security posture documentation upon request.',
  },
];

/* ─────────────────────────────────────────────
   Component
───────────────────────────────────────────── */
const PricingPage = () => {
  useSEO({
    title: 'Pricing',
    description:
      'Compare Xposer AI plans and find the whistleblowing and case-management package that fits your organization.',
    keywords: ['whistleblowing pricing', 'compliance software plans'],
  });
  const { orgSlug } = useParams();
  const { user } = useAuthStore();
  const [openFaq, setOpenFaq] = useState(null);
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState(null);

  const fetchPlans = async () => {
    setPlansLoading(true);
    setPlansError(null);
    try {
      const data = await plansAPI.getPlans();
      const sorted = [...data].sort((a, b) => a.price - b.price);
      setPlans(sorted);
    } catch (err) {
      setPlansError(
        err?.response?.data?.detail ||
        err?.message ||
        'Failed to load pricing plans. Please try again.'
      );
    } finally {
      setPlansLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const dashboardLink = user
    ? getHomePath(user) || `/${user.organization_slug}`
    : '/login';

  const compareRows = useMemo(() => {
    if (!plans.length) return { structured: [], featureRows: [] };

    const structured = [
      {
        label: 'Max users',
        values: plans.map((p) => (p.max_users === -1 ? 'Unlimited' : String(p.max_users))),
      },
      {
        label: 'Multi-agent compliance',
        values: plans.map((p) => !!p.multiagent_compliance),
      },
    ];

    const seen = new Set();
    const featureRows = [];
    plans.forEach((plan) => {
      (plan.features || []).forEach((feature) => {
        if (seen.has(feature)) return;
        seen.add(feature);
        featureRows.push({
          label: feature,
          values: plans.map((p) => (p.features || []).includes(feature)),
        });
      });
    });

    return { structured, featureRows };
  }, [plans]);

  return (
    <>
      <style>{styles}</style>
      <div className="pp-root">

        {/* ══ HERO ══ */}
        <section className="pp-hero">
          <div className="pp-hero-mesh" />
          <div className="pp-hero-grid" />
          <div className="pp-hero-inner">
            <div className="pp-eyebrow">
              <Zap size={10} />
              Simple, transparent pricing
            </div>
            <h1 className="pp-h1">
              Protection that<br />
              <em>scales with you.</em>
            </h1>
            <p className="pp-hero-sub">
              No hidden fees, no per-report charges. Pick the plan that fits your team
              and get full access to the platform from day one.
            </p>

            <div className="pp-guarantee-strip">
              {[
                { icon: <CheckCircle size={12} />, text: '14-day free trial' },
                { icon: <CheckCircle size={12} />, text: 'No credit card required' },
                { icon: <CheckCircle size={12} />, text: 'Cancel any time' },
                { icon: <CheckCircle size={12} />, text: 'GDPR compliant' },
              ].map((g, i) => (
                <React.Fragment key={g.text}>
                  {i > 0 && <div className="pp-guarantee-dot" />}
                  <div className="pp-guarantee-item">
                    {g.icon}
                    {g.text}
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
        </section>

        {/* ══ PRICING TABLE ══ */}
        <section className="pp-table-section">
          <PricingTable
            loading={plansLoading}
            error={plansError}
            onRetry={fetchPlans}
          />
        </section>

        {/* ══ FULL COMPARISON ══ */}
        {/* <section className="pp-compare-section">
          <div className="pp-section-inner">
            <div className="pp-section-label">Full breakdown</div>
            <h2 className="pp-section-h2">
              Compare every<br />
              <em>feature, side by side.</em>
            </h2>

            {plansLoading && (
              <div>
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="pp-ct-skel-row" style={{ width: `${90 - i * 4}%` }} />
                ))}
              </div>
            )}

            {!plansLoading && plansError && (
              <div className="pp-ct-status">
                <AlertTriangle size={26} color="var(--red)" />
                <span className="pp-ct-status-text">{plansError}</span>
                <button className="pp-ct-retry-btn" onClick={fetchPlans}>Try again</button>
              </div>
            )}

            {!plansLoading && !plansError && plans.length > 0 && (
              <div className="pp-compare-table-wrap">
                <table className="pp-compare-table">
                  <thead>
                    <tr>
                      <th style={{ width: '42%' }}>Feature</th>
                      {plans.map((plan) => (
                        <th key={plan.id || plan.key}>
                          <div className={`pp-ct-plan-name ${plan.key === 'pro' ? 'pp-ct-featured' : ''}`}>
                            {plan.name}
                          </div>
                          <div className="pp-ct-plan-price">
                            {currencySymbol(plan.currency)}{plan.price} / mo
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="pp-ct-group">
                      <td colSpan={plans.length + 1}>Limits</td>
                    </tr>
                    {compareRows.structured.map((row) => (
                      <tr key={row.label}>
                        <td>{row.label}</td>
                        {row.values.map((val, i) => (
                          <td key={i}><CellValue val={val} /></td>
                        ))}
                      </tr>
                    ))}

                    <tr className="pp-ct-group">
                      <td colSpan={plans.length + 1}>Features</td>
                    </tr>
                    {compareRows.featureRows.map((row) => (
                      <tr key={row.label}>
                        <td>{row.label}</td>
                        {row.values.map((val, i) => (
                          <td key={i}><CellValue val={val} /></td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section> */}

        {/* ══ TESTIMONIALS ══ */}
        <section className="pp-trust-section">
          <div className="pp-section-inner">
            <div className="pp-section-label">What teams say</div>
            <h2 className="pp-section-h2">
              Trusted by compliance<br />
              <em>teams that can't afford mistakes.</em>
            </h2>

            <div className="pp-trust-grid">
              {[
                {
                  quote: 'We evaluated four platforms. Xposer AI was the only one where our legal team felt the anonymity guarantees were technically credible, not just a policy promise.',
                  name: 'Sarah M.',
                  role: 'Chief Compliance Officer',
                  initial: 'S',
                  plan: 'Pro',
                },
                {
                  quote: 'The analytics dashboard alone justified the upgrade. We cut our average case resolution time from 28 days to 11 days in the first quarter.',
                  name: 'Daniel R.',
                  role: 'Head of Internal Audit',
                  initial: 'D',
                  plan: 'Max',
                },
                {
                  quote: 'Setup took less than an hour. Our first anonymous report came in the same day — the access-code tracking meant the reporter stayed engaged throughout.',
                  name: 'Priya K.',
                  role: 'Compliance Manager',
                  initial: 'P',
                  plan: 'Basic',
                },
              ].map((t) => (
                <div key={t.name} className="pp-trust-card">
                  <p className="pp-trust-quote">"{t.quote}"</p>
                  <div className="pp-trust-author">
                    <div className="pp-trust-avatar">{t.initial}</div>
                    <div>
                      <div className="pp-trust-name">{t.name}</div>
                      <div className="pp-trust-role">{t.role}</div>
                    </div>
                    <span className="pp-trust-plan-chip">{t.plan}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ FAQ ══ */}
        <section className="pp-faq-section">
          <div className="pp-faq-grid">
            <div className="pp-faq-left">
              <div className="pp-section-label">Common questions</div>
              <h2 className="pp-section-h2" style={{ marginBottom: '0' }}>
                Everything you<br />
                <em>need to know.</em>
              </h2>
              <p>
                Still have questions? Reach out to our team at{' '}
                <a href="/contact" target="_blank" rel="noopener noreferrer"
                  style={{ color: 'var(--green)', textDecoration: 'none' }}>
                  Contact us
                </a>{' '}
                and we'll get back to you as soon as possible.
              </p>
            </div>

            <div className="pp-faq-list">
              {FAQS.map((faq, i) => (
                <div key={i} className="pp-faq-item">
                  <button
                    className="pp-faq-question"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  >
                    {faq.q}
                    <ChevronDown
                      size={16}
                      className={`pp-faq-chevron ${openFaq === i ? 'open' : ''}`}
                    />
                  </button>
                  <div className={`pp-faq-answer ${openFaq === i ? 'open' : ''}`}>
                    <div className="pp-faq-answer-inner">{faq.a}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ FINAL CTA ══ */}
        <section className="pp-cta-section">
          <div className="pp-cta-mesh" />
          <div className="pp-cta-inner">
            <h2 className="pp-cta-h2">
              Ready to get started? <br />
            </h2>
            <p className="pp-cta-sub">
              See why organizations are choosing Xposer AI.
            </p>
            <div className="pp-cta-buttons">
              <Link to={
                orgSlug ? `/${orgSlug}/contact` : '/contact'
              } className="pp-btn-ghost">
                Talk to sales
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default PricingPage;
