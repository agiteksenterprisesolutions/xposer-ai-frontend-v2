import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { plansAPI } from '../../api';
import {
  CheckCircle,
  Zap,
  Shield,
  Key,
  Mail,
  User,
  Building2,
  Eye,
  EyeOff,
  ArrowLeft,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'react-toastify';
import useSEO from '../../hooks/useSEO';

/* ─────────────────────────────────────────────
   Styles (scoped under .co-root)
   Designed to match the Landing/Pricing aesthetic
───────────────────────────────────────────── */
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Sora:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

  .co-root {
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
    --indigo: #6366f1;
    --indigo-glow: rgba(99,102,241,0.25);

    font-family: 'Sora', sans-serif;
    background: var(--bg-void);
    color: var(--text-primary);
    min-height: 100vh;
    padding-bottom: 80px;
    -webkit-font-smoothing: antialiased;
  }
  .co-root *, .co-root *::before, .co-root *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  /* ══ TOP BAR ══ */
  .co-topbar {
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px;
    display: flex;
    align-items: center;
  }
  .co-back-link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 13.5px;
    color: var(--text-secondary);
    text-decoration: none;
    cursor: pointer;
    transition: color 0.15s;
  }
  .co-back-link:hover {
    color: var(--text-primary);
  }

  /* ══ CONTAINER ══ */
  .co-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 24px;
    display: grid;
    grid-template-columns: 1.4fr 1fr;
    gap: 48px;
    align-items: start;
  }
  @media (max-width: 960px) {
    .co-container {
      grid-template-columns: 1fr;
      gap: 32px;
    }
  }

  /* ══ FORM CARD ══ */
  .co-card {
    background: var(--bg-surface);
    border: 1px solid var(--border-mid);
    border-radius: 16px;
    padding: 40px;
    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.2);
  }
  @media (max-width: 640px) {
    .co-card {
      padding: 24px;
    }
  }
  .co-card-h2 {
    font-family: 'Playfair Display', serif;
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin-bottom: 8px;
  }
  .co-card-sub {
    font-size: 14px;
    color: var(--text-secondary);
    font-weight: 300;
    margin-bottom: 32px;
  }

  .co-section-title {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--green);
    margin: 24px 0 16px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .co-section-title::after {
    content: '';
    flex-grow: 1;
    height: 1px;
    background: var(--border-dim);
  }

  /* ══ INPUTS ══ */
  .co-input-group {
    margin-bottom: 20px;
    position: relative;
  }
  .co-input-label {
    display: block;
    font-size: 12.5px;
    font-weight: 500;
    color: var(--text-secondary);
    margin-bottom: 6px;
  }
  .co-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }
  .co-input-icon {
    position: absolute;
    left: 14px;
    color: var(--text-muted);
    pointer-events: none;
    transition: color 0.2s;
  }
  .co-input {
    width: 100%;
    background: var(--bg-deep);
    border: 1px solid var(--border-mid);
    border-radius: 8px;
    padding: 12px 14px 12px 42px;
    font-family: 'Sora', sans-serif;
    font-size: 13.5px;
    color: var(--text-primary);
    transition: all 0.2s;
  }
  .co-input:focus {
    border-color: var(--green);
    outline: none;
    box-shadow: 0 0 10px var(--green-glow);
  }
  .co-input:focus ~ .co-input-icon {
    color: var(--green);
  }
  .co-input.error {
    border-color: var(--red);
  }
  .co-textarea {
    width: 100%;
    background: var(--bg-deep);
    border: 1px solid var(--border-mid);
    border-radius: 8px;
    padding: 12px 14px;
    font-family: 'Sora', sans-serif;
    font-size: 13.5px;
    color: var(--text-primary);
    resize: none;
    transition: all 0.2s;
  }
  .co-textarea:focus {
    border-color: var(--green);
    outline: none;
    box-shadow: 0 0 10px var(--green-glow);
  }
  .co-textarea.error {
    border-color: var(--red);
  }
  .co-error-text {
    font-size: 11.5px;
    color: var(--red);
    margin-top: 4px;
  }

  .co-slug-preview {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 6px;
    display: block;
  }
  .co-slug-preview span {
    color: var(--green);
  }

  /* Password field suffix */
  .co-password-toggle {
    position: absolute;
    right: 14px;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    transition: color 0.15s;
  }
  .co-password-toggle:hover {
    color: var(--text-primary);
  }

  /* Password strength indicator */
  .co-strength-bar {
    height: 3px;
    background: var(--border-dim);
    border-radius: 3px;
    margin-top: 8px;
    overflow: hidden;
    position: relative;
  }
  .co-strength-fill {
    height: 100%;
    width: 0%;
    transition: width 0.3s, background-color 0.3s;
  }

  /* ══ SUBMIT BUTTON ══ */
  .co-btn-submit {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    background: var(--green);
    color: #000;
    font-family: 'Sora', sans-serif;
    font-size: 14.5px;
    font-weight: 600;
    padding: 14px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: all 0.15s;
    margin-top: 16px;
    box-shadow: 0 0 24px var(--green-glow);
  }
  .co-btn-submit:hover:not(:disabled) {
    background: #00f090;
    transform: translateY(-1px);
    box-shadow: 0 0 36px rgba(0,240,144,0.4);
  }
  .co-btn-submit:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    box-shadow: none;
  }

  /* ══ ORDER SUMMARY ══ */
  .co-summary {
    background: var(--bg-surface);
    border: 1px solid var(--border-mid);
    border-radius: 16px;
    padding: 32px;
    position: sticky;
    top: 32px;
  }
  .co-summary-h3 {
    font-family: 'Playfair Display', serif;
    font-size: 20px;
    font-weight: 700;
    margin-bottom: 20px;
  }
  .co-summary-plan {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 20px;
    border-bottom: 1px solid var(--border-dim);
    margin-bottom: 20px;
  }
  .co-plan-name {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
  }
  .co-plan-desc {
    font-size: 12.5px;
    color: var(--text-secondary);
    margin-top: 4px;
  }
  .co-plan-price {
    font-family: 'JetBrains Mono', monospace;
    font-size: 18px;
    font-weight: 600;
    color: var(--green);
    text-align: right;
  }
  .co-plan-period {
    font-size: 11px;
    color: var(--text-muted);
    display: block;
  }

  .co-summary-features {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 24px;
  }
  .co-summary-feature {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.4;
  }
  .co-summary-feature svg {
    flex-shrink: 0;
    margin-top: 2px;
    color: var(--green);
  }

  .co-secure-box {
    background: var(--bg-deep);
    border: 1px solid var(--border-dim);
    border-radius: 8px;
    padding: 16px;
    display: flex;
    gap: 12px;
  }
  .co-secure-icon {
    color: var(--green);
    flex-shrink: 0;
    margin-top: 2px;
  }
  .co-secure-text {
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.5;
  }
  .co-secure-text strong {
    color: var(--text-primary);
    display: block;
    margin-bottom: 2px;
  }

  /* ══ LOADING/STATUS SCREEN ══ */
  .co-status-card {
    text-align: center;
    max-width: 600px;
    margin: 40px auto 0;
    padding: 48px;
  }
  .co-status-icon-wrap {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: var(--green-dim);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 24px;
    border: 1px solid rgba(0,217,126,0.2);
    box-shadow: 0 0 30px var(--green-glow);
    position: relative;
  }
  .co-status-pulse {
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    border: 2px solid var(--green);
    opacity: 0;
    animation: co-ping 2s cubic-bezier(0.16, 1, 0.3, 1) infinite;
  }
  @keyframes co-ping {
    0% { transform: scale(0.9); opacity: 0.8; }
    100% { transform: scale(1.4); opacity: 0; }
  }

  .co-status-h2 {
    font-family: 'Playfair Display', serif;
    font-size: 32px;
    font-weight: 700;
    margin-bottom: 12px;
  }
  .co-status-p {
    font-size: 15px;
    color: var(--text-secondary);
    line-height: 1.7;
    margin-bottom: 32px;
  }

  .co-status-actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-width: 320px;
    margin: 0 auto;
  }

  .co-btn-status-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: var(--green);
    color: #000;
    font-family: 'Sora', sans-serif;
    font-size: 14px;
    font-weight: 600;
    padding: 12px 24px;
    border-radius: 8px;
    text-decoration: none;
    border: none;
    cursor: pointer;
    transition: all 0.15s;
    box-shadow: 0 0 16px var(--green-glow);
  }
  .co-btn-status-primary:hover {
    background: #00f090;
    transform: translateY(-1px);
    box-shadow: 0 0 24px rgba(0,240,144,0.45);
  }

  .co-btn-status-secondary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: transparent;
    color: var(--text-secondary);
    font-family: 'Sora', sans-serif;
    font-size: 14px;
    font-weight: 500;
    padding: 12px 24px;
    border-radius: 8px;
    text-decoration: none;
    border: 1px solid var(--border-mid);
    cursor: pointer;
    transition: all 0.15s;
  }
  .co-btn-status-secondary:hover {
    color: var(--text-primary);
    border-color: var(--border-bright);
    background: var(--border-dim);
  }

  .co-status-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 500;
    color: var(--amber);
    background: var(--amber-dim);
    border: 1px solid rgba(245,166,35,0.15);
    padding: 4px 10px;
    border-radius: 4px;
    margin-bottom: 20px;
  }
`;

const currencySymbol = (currency) => {
  switch ((currency || 'USD').toUpperCase()) {
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'GBP': return '£';
    case 'PKR': return 'Rs ';
    default: return '';
  }
};

const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text
};

const Checkout = () => {
  useSEO({
    title: 'Checkout',
    description: 'Complete your Xposer AI subscription.',
    noIndex: true,
  });
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const paramPlan = searchParams.get('plan') || 'pro';

  // API plan states
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [errorPlans, setErrorPlans] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    org_name: '',
    org_description: '',
    admin_username: '',
    admin_email: '',
    admin_full_name: '',
    admin_password: '',
  });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Session & Gateway states
  const [checkoutSession, setCheckoutSession] = useState(null);
  const [paymentWindowOpened, setPaymentWindowOpened] = useState(false);

  // Fetch plans to render selected plan info dynamically
  useEffect(() => {
    const fetchTiers = async () => {
      try {
        setLoadingPlans(true);
        const data = await plansAPI.getPlans();
        const sorted = [...data].sort((a, b) => a.price - b.price);
        setPlans(sorted);
      } catch (err) {
        setErrorPlans(
          err?.response?.data?.detail ||
          err?.message ||
          'Failed to load subscription tiers.'
        );
      } finally {
        setLoadingPlans(false);
      }
    };
    fetchTiers();
  }, []);

  // Retrieve active plan details
  const activePlan = useMemo(() => {
    if (!plans.length) return null;
    return plans.find(p => p.key?.toLowerCase() === paramPlan.toLowerCase()) || plans[1] || plans[0];
  }, [plans, paramPlan]);

  const handleFieldChange = (field, val) => {
    setFormData(prev => ({ ...prev, [field]: val }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Basic validation rules
  const validateForm = () => {
    const tempErrors = {};
    if (!formData.org_name.trim()) tempErrors.org_name = 'Organization name is required';
    if (!formData.admin_full_name.trim()) tempErrors.admin_full_name = 'Full name is required';
    if (!formData.admin_username.trim()) tempErrors.admin_username = 'Admin username is required';

    // Email regex
    if (!formData.admin_email.trim()) {
      tempErrors.admin_email = 'Admin email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.admin_email)) {
      tempErrors.admin_email = 'Please enter a valid email address';
    }

    // Password strength
    if (!formData.admin_password) {
      tempErrors.admin_password = 'Password is required';
    } else if (formData.admin_password.length < 8) {
      tempErrors.admin_password = 'Password must be at least 8 characters';
    }

    setErrors(tempErrors);
    return Object.keys(tempErrors).length === 0;
  };

  // Password strength logic
  const passwordStrength = useMemo(() => {
    const p = formData.admin_password;
    if (!p) return { score: 0, color: 'transparent' };
    let score = 0;
    if (p.length >= 8) score += 20;
    if (/[A-Z]/.test(p)) score += 20;
    if (/[a-z]/.test(p)) score += 20;
    if (/[0-9]/.test(p)) score += 20;
    if (/[^A-Za-z0-9]/.test(p)) score += 20;

    let color = 'var(--red)';
    if (score >= 80) color = 'var(--green)';
    else if (score >= 60) color = 'var(--amber)';
    else if (score >= 40) color = 'var(--blue)';

    return { score, color };
  }, [formData.admin_password]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        tier: activePlan?.key || paramPlan,
        org_description: formData.org_description || 'Onboarded via website pricing page.',
      };

      const session = await plansAPI.initializeCheckout(payload);
      setCheckoutSession(session);

      // Open mock checkout page
      const baseURL = import.meta.env.VITE_API_URL || 'https://demo.agiteks.com/wbt';
      const checkoutUrl = new URL(session.checkout_url, baseURL).href;

      toast.success('Onboarding session initialized!');

      // Open in a new tab
      const newWindow = window.open(checkoutUrl, '_blank');
      setPaymentWindowOpened(true);

      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        toast.error('Popup blocked! Please allow popups or use the link below.', { duration: 6000 });
      }
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || 'Initialization failed. Please try again.';
      toast.error(detail);
      setErrors({ apiError: detail });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReopenPayment = () => {
    if (!checkoutSession) return;
    const baseURL = import.meta.env.VITE_API_URL || 'https://demo.agiteks.com/wbt';
    const checkoutUrl = new URL(checkoutSession.checkout_url, baseURL).href;
    window.open(checkoutUrl, '_blank');
    toast.success('Opening payment gateway...');
  };

  const loginUrl = useMemo(() => {
    const slug = slugify(formData.org_name);
    return `/${slug}/login`;
  }, [formData.org_name]);

  // Payment completed / Onboarding success state
  if (paymentWindowOpened && checkoutSession) {
    return (
      <>
        <style>{styles}</style>
        <div className="co-root">
          <div className="co-topbar">
          </div>

          <div className="co-card co-status-card">
            <div className="co-status-icon-wrap">
              <div className="co-status-pulse" />
              <Zap size={36} color="var(--green)" />
            </div>

            <div className="co-status-badge">
              <Shield size={12} />
              Payment Gateway Active
            </div>

            <h2 className="co-status-h2">Payment Confirmed</h2>

            <p className="co-status-p">
              Your subscription is now active. You can now access your workspace.
            </p>

            <div className="co-status-actions">
              <button
                className="co-btn-status-primary"
                onClick={() => navigate(loginUrl)}
              >
                Go to Workspace Login
              </button>
            </div>

            <div style={{ marginTop: '24px', fontSize: '12px', color: 'var(--text-muted)' }}>
              Workspace URL will be: <span style={{ color: 'var(--green)', fontFamily: 'JetBrains Mono, monospace' }}>{window.location.origin}{loginUrl}</span>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{styles}</style>
      <div className="co-root">

        {/* Navigation Topbar */}
        <div className="co-topbar">
          <button className="co-back-link" onClick={() => navigate('/pricing')}>
            <ArrowLeft size={16} />
            Back to pricing plans
          </button>
        </div>

        <div className="co-container">

          {/* Main Form */}
          <div className="co-card">
            <h2 className="co-card-h2">Set Up Your Organization</h2>
            <p className="co-card-sub">Let's create your workspace and first admin account to get started.</p>

            {errors.apiError && (
              <div style={{ marginBottom: '24px', padding: '12px', background: 'rgba(255,92,92,0.1)', border: '1px solid var(--red)', borderRadius: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <AlertTriangle size={18} color="var(--red)" />
                <span style={{ fontSize: '13px', color: '#ff7c7c' }}>{errors.apiError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>

              {/* SECTION: Org Details */}
              <div className="co-section-title">
                1. Organization Workspace
              </div>

              <div className="co-input-group">
                <label className="co-input-label">Organization Name *</label>
                <div className="co-input-wrapper">
                  <input
                    type="text"
                    required
                    className={`co-input ${errors.org_name ? 'error' : ''}`}
                    placeholder="Acme Corporation"
                    value={formData.org_name}
                    onChange={(e) => handleFieldChange('org_name', e.target.value)}
                  />
                  <Building2 className="co-input-icon" size={16} />
                </div>
                {errors.org_name && <p className="co-error-text">{errors.org_name}</p>}

                {/* {formData.org_name && (
                                    <span className="co-slug-preview">
                                        Workspace URL: <span>{window.location.origin}/{slugify(formData.org_name)}</span>
                                    </span>
                                )} */}
              </div>

              <div className="co-input-group">
                <label className="co-input-label">Workspace Description (Optional)</label>
                <textarea
                  className="co-textarea"
                  rows={3}
                  placeholder="Tell us briefly about the workspace scope..."
                  value={formData.org_description}
                  onChange={(e) => handleFieldChange('org_description', e.target.value)}
                />
              </div>

              {/* SECTION: Admin Details */}
              <div className="co-section-title">
                2. Administrator Account
              </div>

              <div className="co-input-group">
                <label className="co-input-label">Full Name *</label>
                <div className="co-input-wrapper">
                  <input
                    type="text"
                    required
                    className={`co-input ${errors.admin_full_name ? 'error' : ''}`}
                    placeholder="John Doe"
                    value={formData.admin_full_name}
                    onChange={(e) => handleFieldChange('admin_full_name', e.target.value)}
                  />
                  <User className="co-input-icon" size={16} />
                </div>
                {errors.admin_full_name && <p className="co-error-text">{errors.admin_full_name}</p>}
              </div>

              <div className="co-input-group">
                <label className="co-input-label">Email Address *</label>
                <div className="co-input-wrapper">
                  <input
                    type="email"
                    required
                    className={`co-input ${errors.admin_email ? 'error' : ''}`}
                    placeholder="admin@acme.com"
                    value={formData.admin_email}
                    onChange={(e) => handleFieldChange('admin_email', e.target.value)}
                  />
                  <Mail className="co-input-icon" size={16} />
                </div>
                {errors.admin_email && <p className="co-error-text">{errors.admin_email}</p>}
              </div>

              <div className="co-input-group">
                <label className="co-input-label">Username *</label>
                <div className="co-input-wrapper">
                  <input
                    type="text"
                    required
                    className={`co-input ${errors.admin_username ? 'error' : ''}`}
                    placeholder="org_admin"
                    value={formData.admin_username}
                    onChange={(e) => handleFieldChange('admin_username', e.target.value)}
                  />
                  <User className="co-input-icon" size={16} />
                </div>
                {errors.admin_username && <p className="co-error-text">{errors.admin_username}</p>}
              </div>

              <div className="co-input-group">
                <label className="co-input-label">Password *</label>
                <div className="co-input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    className={`co-input ${errors.admin_password ? 'error' : ''}`}
                    placeholder="••••••••"
                    value={formData.admin_password}
                    onChange={(e) => handleFieldChange('admin_password', e.target.value)}
                  />
                  <Key className="co-input-icon" size={16} />
                  <button
                    type="button"
                    className="co-password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.admin_password && <p className="co-error-text">{errors.admin_password}</p>}

                {formData.admin_password && (
                  <div className="co-strength-bar">
                    <div
                      className="co-strength-fill"
                      style={{
                        width: `${passwordStrength.score}%`,
                        backgroundColor: passwordStrength.color
                      }}
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="co-btn-submit"
                disabled={submitting || loadingPlans}
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Initializing Secure Gateway...
                  </>
                ) : (
                  'Proceed to Secure Payment'
                )}
              </button>

            </form>
          </div>

          {/* Right Summary Sidebar */}
          <div className="co-summary">
            <h3 className="co-summary-h3">Your Selection</h3>

            {loadingPlans && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ height: '40px', background: 'var(--bg-raised)', borderRadius: '8px', animation: 'pt-pulse 1.4s ease-in-out infinite' }} />
                <div style={{ height: '120px', background: 'var(--bg-raised)', borderRadius: '8px', animation: 'pt-pulse 1.4s ease-in-out infinite' }} />
              </div>
            )}

            {!loadingPlans && errorPlans && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: 'var(--red)', fontSize: '13px' }}>
                <AlertTriangle size={24} />
                <span>{errorPlans}</span>
              </div>
            )}

            {!loadingPlans && activePlan && (
              <>
                <div className="co-summary-plan">
                  <div>
                    <span className="co-plan-name">{activePlan.name} Plan</span>
                    <span className="co-plan-desc">For active compliance teams</span>
                  </div>
                  <div>
                    <span className="co-plan-price">
                      {currencySymbol(activePlan.currency)}
                      {activePlan.price}
                    </span>
                    <span className="co-plan-period">/ month</span>
                  </div>
                </div>

                <ul className="co-summary-features">
                  <li className="co-summary-feature">
                    <CheckCircle size={14} />
                    <span>Up to <strong>{activePlan.max_users === -1 ? 'Unlimited' : activePlan.max_users}</strong> members</span>
                  </li>
                  <li className="co-summary-feature">
                    <CheckCircle size={14} />
                    <span>Multi-agent compliance: <strong>{activePlan.multiagent_compliance ? 'Yes' : 'No'}</strong></span>
                  </li>
                  {(activePlan.features || []).slice(0, 5).map((feature, i) => (
                    <li className="co-summary-feature" key={i}>
                      <CheckCircle size={14} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="co-secure-box">
              <Shield className="co-secure-icon" size={18} />
              <div className="co-secure-text">
                <strong>SSL Secured & Encrypted</strong>
                All details are stored securely. Payment details are handled by gateway.
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
};

export default Checkout;
