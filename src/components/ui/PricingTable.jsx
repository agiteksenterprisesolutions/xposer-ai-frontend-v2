// src/components/PricingTable.jsx
import { useState, useEffect, useMemo } from 'react';
import { CheckCircle, ArrowRight, Zap, Star, AlertTriangle } from 'lucide-react';
import { plansAPI } from '../../api';
import { useNavigate, useParams } from 'react-router-dom';
/* ─────────────────────────────────────────────
   Styles (scoped under .pt-root)
───────────────────────────────────────────── */
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Sora:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

  .pt-root {
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
    --red: #ff5c5c;
    font-family: 'Sora', sans-serif;
    -webkit-font-smoothing: antialiased;
    box-sizing: border-box;
  }
  .pt-root *, .pt-root *::before, .pt-root *::after {
    box-sizing: inherit;
  }

  /* Toggle */
  .pt-toggle-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-bottom: 56px;
  }
  .pt-toggle-label {
    font-size: 13.5px;
    font-weight: 500;
    color: var(--text-secondary);
    letter-spacing: -0.01em;
  }
  .pt-toggle-label.active { color: var(--text-primary); }
  .pt-toggle-pill {
    position: relative;
    width: 48px;
    height: 26px;
    background: var(--bg-raised);
    border: 1px solid var(--border-mid);
    border-radius: 100px;
    cursor: pointer;
    transition: border-color 0.2s;
  }
  .pt-toggle-pill.on { border-color: rgba(0,217,126,0.4); }
  .pt-toggle-thumb {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--text-muted);
    transition: all 0.2s;
  }
  .pt-toggle-pill.on .pt-toggle-thumb {
    left: 25px;
    background: var(--green);
    box-shadow: 0 0 8px var(--green-glow);
  }
  .pt-save-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 500;
    color: var(--green);
    background: var(--green-dim);
    border: 1px solid rgba(0,217,126,0.15);
    padding: 3px 8px;
    border-radius: 4px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  /* Grid */
  .pt-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2px;
    background: var(--border-dim);
    border-radius: 20px;
    overflow: hidden;
    max-width: 1060px;
    margin: 0 auto;
  }
  @media (max-width: 820px) {
    .pt-grid { grid-template-columns: 1fr; background: transparent; gap: 16px; }
  }

  /* Card */
  .pt-card {
    background: var(--bg-surface);
    padding: 40px 36px;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
    transition: background 0.2s;
  }
  @media (max-width: 820px) {
    .pt-card {
      border: 1px solid var(--border-mid);
      border-radius: 16px;
    }
  }
  .pt-card:hover { background: var(--bg-raised); }
  .pt-card.featured {
    background: var(--bg-raised);
    z-index: 1;
  }
  @media (max-width: 820px) {
    .pt-card.featured {
      border-color: var(--green);
      box-shadow: 0 0 40px rgba(0,217,126,0.08);
    }
  }

  /* Top accent line */
  .pt-accent {
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 1px;
  }
  .pt-accent-green { background: linear-gradient(90deg, transparent, var(--green), transparent); }
  .pt-accent-blue  { background: linear-gradient(90deg, transparent, var(--blue),  transparent); }
  .pt-accent-amber { background: linear-gradient(90deg, transparent, var(--amber), transparent); }

  /* Featured badge */
  .pt-featured-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 500;
    color: var(--green);
    background: var(--green-dim);
    border: 1px solid rgba(0,217,126,0.2);
    padding: 4px 10px;
    border-radius: 4px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-bottom: 20px;
    align-self: flex-start;
  }

  /* Tier name */
  .pt-tier {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 8px;
  }

  /* Price block */
  .pt-price-row {
    display: flex;
    align-items: flex-end;
    gap: 4px;
    margin-bottom: 6px;
  }
  .pt-currency {
    font-family: 'Playfair Display', serif;
    font-size: 22px;
    font-weight: 600;
    color: var(--text-secondary);
    line-height: 1;
    padding-bottom: 8px;
  }
  .pt-price {
    font-family: 'Playfair Display', serif;
    font-size: 56px;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1;
    letter-spacing: -0.04em;
  }
  .pt-period {
    font-size: 13px;
    color: var(--text-muted);
    font-weight: 400;
    padding-bottom: 10px;
    letter-spacing: -0.01em;
  }

  .pt-annual-note {
    font-size: 12px;
    color: var(--text-muted);
    margin-bottom: 24px;
    font-family: 'JetBrains Mono', monospace;
    letter-spacing: 0.01em;
  }
  .pt-annual-note span { color: var(--green); }

  /* Divider */
  .pt-divider {
    height: 1px;
    background: var(--border-dim);
    margin: 24px 0;
  }

  /* Description */
  .pt-desc {
    font-size: 13.5px;
    color: var(--text-secondary);
    font-weight: 300;
    line-height: 1.7;
    margin-bottom: 28px;
  }

  /* Features */
  .pt-features {
    list-style: none;
    padding: 0;
    margin: 0 0 36px 0;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .pt-feature {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    font-size: 13.5px;
    color: var(--text-secondary);
    font-weight: 400;
    line-height: 1.5;
  }
  .pt-feature svg { flex-shrink: 0; margin-top: 2px; }
  .pt-feature.muted { color: var(--text-muted); }
  .pt-feature.muted svg { opacity: 0.35; }

  /* Section label inside features */
  .pt-feature-section {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-muted);
    padding-top: 4px;
  }

  /* CTA button */
  .pt-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    width: 100%;
    font-family: 'Sora', sans-serif;
    font-size: 14px;
    font-weight: 600;
    padding: 13px 20px;
    border-radius: 8px;
    cursor: pointer;
    border: none;
    transition: all 0.15s;
    letter-spacing: -0.01em;
    text-decoration: none;
  }
  .pt-btn-primary {
    background: var(--green);
    color: #000;
    box-shadow: 0 0 24px var(--green-glow), 0 2px 8px rgba(0,0,0,0.3);
  }
  .pt-btn-primary:hover {
    background: #00f090;
    transform: translateY(-1px);
    box-shadow: 0 0 36px rgba(0,240,144,0.45), 0 8px 20px rgba(0,0,0,0.3);
  }
  .pt-btn-ghost {
    background: transparent;
    color: var(--text-secondary);
    border: 1px solid var(--border-mid);
  }
  .pt-btn-ghost:hover {
    color: var(--text-primary);
    border-color: var(--border-bright);
    background: var(--border-dim);
  }

  /* Loading / error states */
  .pt-status-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 80px 20px;
    max-width: 1060px;
    margin: 0 auto;
  }
  .pt-status-text {
    font-size: 14px;
    color: var(--text-secondary);
    font-weight: 400;
  }
  .pt-spin {
    animation: pt-spin 0.9s linear infinite;
    color: var(--green);
  }
  @keyframes pt-spin {
    to { transform: rotate(360deg); }
  }
  .pt-retry-btn {
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
  .pt-retry-btn:hover {
    border-color: var(--border-bright);
  }

  /* Skeleton */
  .pt-skel-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2px;
    background: var(--border-dim);
    border-radius: 20px;
    overflow: hidden;
    max-width: 1060px;
    margin: 0 auto;
  }
  @media (max-width: 820px) {
    .pt-skel-grid { grid-template-columns: 1fr; background: transparent; gap: 16px; }
  }
  .pt-skel-card {
    background: var(--bg-surface);
    padding: 40px 36px;
    min-height: 520px;
  }
  @media (max-width: 820px) {
    .pt-skel-card {
      border: 1px solid var(--border-mid);
      border-radius: 16px;
    }
  }
  .pt-skel-line {
    background: var(--bg-raised);
    border-radius: 6px;
    animation: pt-pulse 1.4s ease-in-out infinite;
  }
  @keyframes pt-pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }
`;

/* ─────────────────────────────────────────────
   Presentation config keyed by backend `key`
   (the API only sends raw plan data — these are
   purely visual choices the UI layer owns)
───────────────────────────────────────────── */
const TIER_PRESENTATION = {
  basic: { accent: 'pt-accent-blue', featured: false, btnVariant: 'pt-btn-ghost' },
  pro: { accent: 'pt-accent-green', featured: true, btnVariant: 'pt-btn-primary' },
  max: { accent: 'pt-accent-amber', featured: false, btnVariant: 'pt-btn-ghost' },
};

const TIER_DESCRIPTIONS = {
  basic: 'For small teams taking their first step toward a compliant reporting culture.',
  pro: 'For growing compliance teams that need full case management and real-time insights.',
  max: 'For enterprises with rigorous audit, compliance, and multi-region requirements.',
};

const getPresentation = (key) =>
  TIER_PRESENTATION[key?.toLowerCase()] || { accent: 'pt-accent-blue', featured: false, btnVariant: 'pt-btn-ghost' };

/* ─────────────────────────────────────────────
   Skeleton loader
───────────────────────────────────────────── */
const PricingSkeleton = () => (
  <div className="pt-skel-grid">
    {[0, 1, 2].map((i) => (
      <div className="pt-skel-card" key={i}>
        <div className="pt-skel-line" style={{ width: '40%', height: 12, marginBottom: 20 }} />
        <div className="pt-skel-line" style={{ width: '55%', height: 44, marginBottom: 16 }} />
        <div className="pt-skel-line" style={{ width: '70%', height: 12, marginBottom: 32 }} />
        <div className="pt-skel-line" style={{ width: '100%', height: 1, marginBottom: 24 }} />
        {[...Array(6)].map((_, j) => (
          <div className="pt-skel-line" key={j} style={{ width: `${85 - j * 5}%`, height: 12, marginBottom: 14 }} />
        ))}
      </div>
    ))}
  </div>
);

/* ─────────────────────────────────────────────
   Component
───────────────────────────────────────────── */
const PricingTable = () => {
  const { orgSlug } = useParams();
  const [annual, setAnnual] = useState(false);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const fetchPlans = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await plansAPI.getPlans();
      // Sort by price ascending so tiers render Basic -> Pro -> Max
      const sorted = [...data].sort((a, b) => a.price - b.price);
      setPlans(sorted);
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
        err?.message ||
        'Failed to load pricing plans. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const getPrice = (monthly) => {
    if (!annual) return monthly;
    return Math.round((monthly * 12 * 0.8) / 12); // 20% off annually
  };

  const getAnnualNote = (monthly, currency) => {
    const annualTotal = Math.round(monthly * 12 * 0.8);
    return `${currencySymbol(currency)}${annualTotal} billed annually`;
  };

  const currencySymbol = (currency) => {
    switch ((currency || 'USD').toUpperCase()) {
      case 'USD': return '$';
      case 'EUR': return '€';
      case 'GBP': return '£';
      case 'PKR': return 'Rs ';
      default: return '';
    }
  };

  const decoratedPlans = useMemo(() => {
    return plans.map((plan) => {
      const presentation = getPresentation(plan.key);
      return {
        ...plan,
        accent: presentation.accent,
        featured: presentation.featured,
        btnVariant: presentation.btnVariant,
        description: TIER_DESCRIPTIONS[plan.key?.toLowerCase()] || `The ${plan.name} plan.`,
      };
    });
  }, [plans]);

  const handleSelectPlan = (tier) => {
    navigate(orgSlug ? `/${orgSlug}/checkout?plan=${tier}` : `/checkout?plan=${tier}`)
    console.log(`Selected ${tier}`);
  };

  return (
    <div className="pt-root">
      <style>{styles}</style>

      {/* Billing toggle */}
      {!loading && !error && (
        <div className="pt-toggle-wrap">
          <span className={`pt-toggle-label ${!annual ? 'active' : ''}`}>Monthly</span>
          <div
            className={`pt-toggle-pill ${annual ? 'on' : ''}`}
            onClick={() => setAnnual(!annual)}
            role="switch"
            aria-checked={annual}
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ' ? setAnnual(!annual) : null)}
          >
            <div className="pt-toggle-thumb" />
          </div>
          <span className={`pt-toggle-label ${annual ? 'active' : ''}`}>Annual</span>
          {annual && <span className="pt-save-badge"><Zap size={9} /> Save 20%</span>}
        </div>
      )}

      {/* Loading state */}
      {loading && <PricingSkeleton />}

      {/* Error state */}
      {!loading && error && (
        <div className="pt-status-wrap">
          <AlertTriangle size={28} color="var(--red)" />
          <span className="pt-status-text">{error}</span>
          <button className="pt-retry-btn" onClick={fetchPlans}>Try again</button>
        </div>
      )}

      {/* Cards */}
      {!loading && !error && (
        <div className="pt-grid">
          {decoratedPlans.map((plan) => (
            <div
              key={plan.id || plan.key}
              className={`pt-card${plan.featured ? ' featured' : ''}`}
            >
              <div className={`pt-accent ${plan.accent}`} />

              {plan.featured && (
                <div className="pt-featured-badge">
                  <Star size={9} />
                  Most popular
                </div>
              )}

              <div className="pt-tier">{plan.name}</div>

              <div className="pt-price-row">
                <span className="pt-currency">{currencySymbol(plan.currency)}</span>
                <span className="pt-price">{getPrice(plan.price)}</span>
                <span className="pt-period">/ mo</span>
              </div>

              {annual
                ? <div className="pt-annual-note"><span>{getAnnualNote(plan.price, plan.currency)}</span></div>
                : <div className="pt-annual-note">billed monthly</div>
              }

              <p className="pt-desc">{plan.description}</p>

              <div className="pt-divider" />

              <ul className="pt-features">
                {plan.features.map((text, i) => (
                  <li key={i} className="pt-feature">
                    <CheckCircle size={14} color="var(--green)" strokeWidth={2.5} />
                    {text}
                  </li>
                ))}
              </ul>

              <button
                className={`pt-btn ${plan.btnVariant}`}
                onClick={() => handleSelectPlan?.(plan.key)}
              >
                Get started
                {plan.featured && <ArrowRight size={14} />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PricingTable;
