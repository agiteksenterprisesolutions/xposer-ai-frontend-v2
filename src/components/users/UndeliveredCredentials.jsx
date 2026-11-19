// src/components/users/UndeliveredCredentials.jsx
//
// Accounts whose welcome email didn't arrive. The provisioned password reaches
// a person only in that email — it isn't stored and can't be read back — so
// each of these is an account nobody can sign in to until its password is
// reset. Each row gets its own Resend, which sets a new password and emails it
// (POST /users/{id}/reset-password).
import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { MailX, RefreshCw, Send } from 'lucide-react';
import Modal from '../layout/Modal';
import Button from '../ui/Button';
import { usersAPI } from '../../api/users';
import { passwordMeetsPolicy } from '../../utils/passwordPolicy';

/** A random password that meets the policy: 14 characters from every class. */
export const generatePassword = () => {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!#$%&*?@'];
  const all = sets.join('');
  const pick = (chars) => chars[crypto.getRandomValues(new Uint32Array(1))[0] % chars.length];
  const chars = [...sets.map(pick), ...Array.from({ length: 10 }, () => pick(all))];
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
};

const ResendModal = ({ person, onClose, onSent }) => {
  const { t } = useTranslation('people');
  const [password, setPassword] = useState(generatePassword);
  const [sending, setSending] = useState(false);
  const valid = passwordMeetsPolicy(password);

  const send = async () => {
    setSending(true);
    try {
      const result = await usersAPI.updatePasswordByAdmin(person.user_id, { new_password: password });
      onSent(result?.email_sent !== false);
    } catch {
      // updatePasswordByAdmin has shown the reason.
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={sending ? () => {} : onClose}
      title={t('undelivered.resendTitle', { name: person.full_name || person.username })}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={sending}>
            {t('common:actions.cancel')}
          </Button>
          <Button startIcon={Send} onClick={send} isLoading={sending} disabled={!valid}>
            {t('undelivered.setAndEmail')}
          </Button>
        </div>
      }
    >
      <div className="space-y-3 text-sm">
        <p>
          <Trans t={t} i18nKey="undelivered.resendBody" values={{ email: person.email }} components={{ b: <span className="font-medium text-ink" dir="ltr" /> }} />
        </p>
        <label htmlFor="resend-password" className="block font-medium text-ink-secondary">
          {t('undelivered.tempPassword')}
        </label>
        <div className="flex gap-2">
          <input
            id="resend-password"
            value={password}
            dir="ltr"
            onChange={(e) => setPassword(e.target.value)}
            className="h-10 min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-3 font-mono text-sm text-ink outline-none focus:border-line-accent"
          />
          <Button variant="secondary" onClick={() => setPassword(generatePassword())} aria-label={t('undelivered.generate')}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        {!valid && <p className="text-xs text-danger-fg">{t('undelivered.policy')}</p>}
        {person.email && /@(example\.(com|net|org|edu)|.*\.(test|invalid|localhost|local))$/i.test(person.email) && (
          <p className="text-xs text-warning-fg">
            {t('undelivered.testDomain')}
          </p>
        )}
      </div>
    </Modal>
  );
};

/**
 * Props:
 *   items – undelivered_credentials rows: { row?, full_name, email, username, user_id, reason }
 */
const UndeliveredCredentials = ({ items }) => {
  const { t } = useTranslation('people');
  const [resending, setResending] = useState(null);
  const [sent, setSent] = useState({});
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <section className="rounded-xl border border-warning-line bg-warning-soft p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-warning-fg">
        <MailX className="h-4 w-4" aria-hidden="true" />
        {t('undelivered.title', { count: items.length })}
      </h3>
      <p className="mt-1 text-xs text-warning-fg">
        {t('undelivered.body')}
      </p>
      <ul className="mt-3 divide-y divide-warning-line/60 rounded-lg border border-warning-line/60 bg-surface">
        {items.map((person) => (
          <li key={person.user_id || person.email} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">
                {person.full_name || person.username}
                {person.row != null && <span className="ms-1.5 text-xs font-normal text-ink-muted">{t('undelivered.row', { row: person.row })}</span>}
              </p>
              <p className="text-xs text-ink-muted">
                {person.email}
                {person.username && <> · <Trans t={t} i18nKey="undelivered.signsInAs" values={{ username: person.username }} components={{ u: <span className="font-mono" dir="ltr" /> }} /></>}
              </p>
              {person.reason && <p className="text-xs text-ink-subtle">{person.reason}</p>}
            </div>
            {sent[person.user_id] ? (
              <span className={`text-xs font-medium ${sent[person.user_id] === 'ok' ? 'text-success-fg' : 'text-warning-fg'}`}>
                {sent[person.user_id] === 'ok' ? t('undelivered.sent') : t('undelivered.stillNot')}
              </span>
            ) : (
              <Button variant="secondary" size="small" startIcon={Send} onClick={() => setResending(person)} disabled={!person.user_id}>
                {t('undelivered.resend')}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {resending && (
        <ResendModal
          person={resending}
          onClose={() => setResending(null)}
          onSent={(ok) => {
            setSent((prev) => ({ ...prev, [resending.user_id]: ok ? 'ok' : 'failed' }));
            setResending(null);
          }}
        />
      )}
    </section>
  );
};

export default UndeliveredCredentials;
