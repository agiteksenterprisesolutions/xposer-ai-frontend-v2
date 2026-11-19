// src/components/sso-admin/CopyField.jsx
//
// A read-only URL with a copy button (the connection's redirect URL).
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy } from 'lucide-react';
import { toast } from 'react-toastify';
import { copyToClipboard } from '../../utils/clipboard';

const CopyField = ({ label, value, hint }) => {
  const { t } = useTranslation('ssoAdmin');
  const id = useId();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (await copyToClipboard(value)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } else toast.error(t('copyFailed'));
  };
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-semibold uppercase text-ink-muted">{label}</label>
      <div className="flex items-center gap-1">
        <input
          id={id}
          readOnly
          dir="ltr"
          value={value}
          onFocus={(e) => e.target.select()}
          className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-sunken px-2.5 font-mono text-xs text-ink"
        />
        <button
          type="button"
          onClick={copy}
          aria-label={t('copy', { label })}
          title={t('copy', { label })}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-ink-muted transition-colors hover:bg-hover hover:text-ink"
        >
          {copied ? <Check className="h-4 w-4 text-success-fg" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
      {hint && <p className="text-xs text-ink-muted">{hint}</p>}
    </div>
  );
};

export default CopyField;
