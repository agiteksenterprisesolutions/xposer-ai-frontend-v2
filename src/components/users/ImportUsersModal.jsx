// src/components/users/ImportUsersModal.jsx
//
// Bulk-add people from the import workbook. Each row becomes a login account,
// a directory entry and the link between them, so the three can't drift.
//
// The file is always checked first (dry run) and every problem is shown at
// once, pinned to its sheet, row and column. Importing is all-or-nothing:
// nothing is written unless the whole file is clean.
//
// The Role column places each person (every role sits at one level); there is
// no level column. Sign-in Method picks Password, Google or Microsoft for rows
// that create a login. A blank Manager Employee ID is filled in when exactly
// one person sits one level above in the same department — those reporting
// lines are listed after the import, since they decide escalation routing.
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { toast } from 'react-toastify';
import { Trans, useTranslation } from 'react-i18next';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import { usersAPI } from '../../api';
import { saveBlob } from '../../utils/download';
import { describeError, errorSummary } from '../../utils/errors';
import UndeliveredCredentials from './UndeliveredCredentials';
import { useAuthStore } from '../../store/authStore';
import { staffPath } from '../../utils/navigation';

// English hints, by problem code; the translations live under
// people:importUsers.hints.<code> and fall back to these.
const PROBLEM_HINTS = {
  'row.unknown_manager': 'Their manager needs an Employee ID on another row.',
  'row.role_escalates': "You can't grant a role carrying permissions you don't hold.",
  'row.unknown_role': 'Use the code or name of a role your organization has.',
  'row.role_has_no_level': 'The role exists but has no level, so the person can’t be placed. Give it one in Roles & Permissions.',
  'row.manager_not_above': 'A manager has to sit above the people who report to them. Check this row’s role or its manager.',
  'row.unknown_sign_in_method': 'Use Password, Google or Microsoft — or leave it blank for Password.',
  'row.ambiguous_sign_in_method': '“SSO” could be Google or Microsoft. Say which.',
  'row.sign_in_method_without_login': 'This row creates no login, so a sign-in method doesn’t apply. Clear it, or set Create Login.',
  'row.email_exists': 'Someone already has this email.',
  'row.undeliverable_domain': 'Fine for a test import; a real person needs a real address.',
  // The pre-flight check doesn't catch two emails that derive the same
  // username (a.khan@eng… and a.khan@fin…), so the write fails with no row.
  'import.failed':
    'If two rows share an email name before the @ (a.khan@eng… and a.khan@fin…), they get the same username — give one of them a Username.',
};

/** The counts the server reports back, whatever it names them. */
const countsOf = (result) =>
  Object.entries(result || {}).filter(([, value]) => typeof value === 'number' && value > 0);

const humanize = (key) => key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

/** The hint for a problem code in the interface language, or undefined. */
const hintFor = (t, code) =>
  PROBLEM_HINTS[code] ? t(`importUsers.hints.${code}`, { defaultValue: PROBLEM_HINTS[code] }) : undefined;

/** "Created: 3 · Linked: 2" — server count keys, translated where we know them. */
const countsText = (t, result) =>
  countsOf(result)
    .map(([key, value]) => `${t(`importUsers.counts.${key}`, { defaultValue: humanize(key) })}: ${value}`)
    .join(' · ');

const ProblemTable = ({ problems, tone = 'error' }) => {
  const { t } = useTranslation('people');
  return (
  <div className={`max-h-72 overflow-auto rounded-lg border ${tone === 'warning' ? 'border-warning-line' : 'border-line'}`}>
    <table className="w-full text-start text-xs">
      <thead className="sticky top-0 bg-subtle-solid text-ink-subtle">
        <tr>
          <th className="px-3 py-2 font-semibold">{t('importUsers.where')}</th>
          <th className="px-3 py-2 font-semibold">{t('importUsers.problem')}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line-subtle">
        {problems.map((problem, index) => (
          <tr key={index} className={`align-top ${tone === 'warning' ? 'bg-warning-soft/40' : ''}`}>
            <td className="whitespace-nowrap px-3 py-2 text-ink-muted">
              {problem.row != null ? t('importUsers.row', { row: problem.row }) : t('importUsers.file')}
              {problem.column && <span className="block text-ink-subtle">{problem.column}</span>}
            </td>
            <td className="px-3 py-2 text-ink">
              {problem.message}
              {problem.value != null && problem.value !== '' && (
                <span className="ms-1 font-mono text-ink-muted" dir="auto">“{String(problem.value)}”</span>
              )}
              {hintFor(t, problem.code) && <span className="block text-ink-subtle">{hintFor(t, problem.code)}</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
  );
};

/** Reporting lines the file didn't state and the backend worked out. */
const InferredManagers = ({ items }) => {
  const { t } = useTranslation('people');
  return items?.length > 0 ? (
    <div className="space-y-2 rounded-xl border border-line bg-subtle p-4">
      <p className="text-sm font-semibold text-ink">
        {t('importUsers.inferred.title', { count: items.length })}
      </p>
      <p className="text-xs text-ink-muted">
        {t('importUsers.inferred.body')}
      </p>
      <ul className="max-h-48 space-y-1 overflow-auto text-sm">
        {items.map((item, index) => (
          <li key={index} className="flex flex-wrap gap-x-2">
            {item.row != null && <span className="text-ink-subtle">{t('importUsers.row', { row: item.row })}</span>}
            <span className="font-medium text-ink">{item.full_name}</span>
            <span className="text-ink-muted">
              <Trans t={t} i18nKey="importUsers.inferred.reportsTo" values={{ manager: item.manager_name || item.manager_external_id }} components={{ m: <span className="font-mono" /> }} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  ) : null;
};

/** Non-blocking: amber, apart from the red problems that stop an import. */
const Warnings = ({ warnings }) => {
  const { t } = useTranslation('people');
  return warnings?.length > 0 ? (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-warning-fg">
        {t('importUsers.warnings', { count: warnings.length })}
      </p>
      <ProblemTable problems={warnings} tone="warning" />
    </div>
  ) : null;
};

const ImportUsersModal = ({ onClose, onImported }) => {
  const { t } = useTranslation('people');
  const orgSlug = useAuthStore((state) => state.user?.organization_slug);
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [checking, setChecking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [check, setCheck] = useState(null); // { ok, result?, error? }
  const [done, setDone] = useState(null);

  const downloadTemplate = async () => {
    try {
      const { blob, filename } = await usersAPI.downloadImportTemplate();
      saveBlob(blob, filename);
    } catch (error) {
      toast.error(errorSummary(error));
    }
  };

  const choose = async (picked) => {
    setFile(picked);
    setCheck(null);
    setDone(null);
    if (!picked) return;
    setChecking(true);
    try {
      setCheck({ ok: true, result: await usersAPI.importUsers(picked, { dryRun: true }) });
    } catch (error) {
      setCheck({ ok: false, error: describeError(error) });
    } finally {
      setChecking(false);
    }
  };

  const runImport = async () => {
    setImporting(true);
    try {
      const result = await usersAPI.importUsers(file, { dryRun: false });
      setDone(result || {});
      onImported?.();
    } catch (error) {
      setCheck({ ok: false, error: describeError(error) });
    } finally {
      setImporting(false);
    }
  };

  const fileProblems = check?.error?.problems?.filter((p) => p.row == null) || [];
  const rowProblems = check?.error?.problems?.filter((p) => p.row != null) || [];

  return (
    <Modal
      isOpen
      onClose={importing ? () => {} : onClose}
      title={t('importUsers.title')}
      size="lg"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button variant="secondary" onClick={onClose} disabled={importing}>
            {done ? t('common:actions.close') : t('common:actions.cancel')}
          </Button>
          {!done && (
            <Button onClick={runImport} isLoading={importing} disabled={!file || checking || !check?.ok}>
              {t('importUsers.import')}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        {done ? (
          <>
          <div className="py-4 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-success-fg" aria-hidden="true" />
            <p className="mt-3 text-base font-semibold text-ink">{t('importUsers.imported')}</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-ink-secondary">
              {done.message || countsText(t, done)}
            </p>
            <p className="mx-auto mt-2 max-w-md text-xs text-ink-muted">
              {t('importUsers.doneHelp')}
            </p>
          </div>
          <InferredManagers items={done.managers_inferred} />
          <UndeliveredCredentials items={done.undelivered_credentials} />
          <Warnings warnings={done.warnings} />
          </>
        ) : (
          <>
            <ol className="space-y-3 text-sm text-ink-secondary">
              <li className="flex items-start justify-between gap-3">
                <span>
                  <Trans t={t} i18nKey="importUsers.step1" components={{ b: <span className="font-medium text-ink" /> }} />
                </span>
                <Button variant="outline" size="small" startIcon={Download} onClick={downloadTemplate} className="shrink-0">
                  {t('importUsers.template')}
                </Button>
              </li>
              <li>
                <Trans t={t} i18nKey="importUsers.step2" components={{ b: <span className="font-medium text-ink" /> }} />
              </li>
            </ol>

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-line-strong px-4 py-8 text-center transition-colors hover:border-line-accent hover:bg-hover"
            >
              {file ? <FileSpreadsheet className="h-6 w-6 text-accent-fg" aria-hidden="true" /> : <Upload className="h-6 w-6 text-ink-subtle" aria-hidden="true" />}
              <span className="text-sm font-medium text-ink">{file ? file.name : t('importUsers.choose')}</span>
              {file && <span className="text-xs text-ink-subtle">{t('importUsers.chooseAnother')}</span>}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(event) => {
                choose(event.target.files?.[0] || null);
                event.target.value = '';
              }}
            />

            {checking && <p className="text-sm text-ink-muted">{t('importUsers.checking')}</p>}

            {check?.ok && (
              <Alert variant="success" title={t('importUsers.valid')}>
                {countsOf(check.result).length > 0 ? countsText(t, check.result) : t('importUsers.ready')}
              </Alert>
            )}
            {check?.ok && <Warnings warnings={check.result?.warnings} />}

            {check && !check.ok && (
              <div className="space-y-3">
                <Alert variant="error" title={check.error.summary}>
                  {t('importUsers.fix')}
                </Alert>
                {fileProblems.length > 0 && (
                  <ul className="list-disc space-y-1 ps-5 text-sm text-danger-fg">
                    {fileProblems.map((problem, index) => (
                      <li key={index}>
                        {problem.message}
                        {hintFor(t, problem.code) && (
                          <span className="block text-xs text-ink-muted">{hintFor(t, problem.code)}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {rowProblems.length > 0 && <ProblemTable problems={rowProblems} />}
                {rowProblems.some((p) => p.code === 'row.role_has_no_level' || p.code === 'row.unknown_role') && (
                  <Link to={staffPath(orgSlug, 'roles')} className="inline-block text-sm font-semibold text-link hover:underline">
                    {t('importUsers.openRoles')}
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};

export default ImportUsersModal;
