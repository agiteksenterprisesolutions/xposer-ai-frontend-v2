// src/components/users/ImportUsersModal.jsx
//
// Bulk-add people from the import workbook. Each row becomes a login account,
// a directory entry and the link between them, so the three can't drift.
//
// The file is always checked first (dry run) and every problem is shown at
// once, pinned to its sheet, row and column. Importing is all-or-nothing:
// nothing is written unless the whole file is clean.
import { useRef, useState } from 'react';
import { CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { toast } from 'react-toastify';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import { usersAPI } from '../../api';
import { saveBlob } from '../../utils/download';
import { describeError, errorSummary } from '../../utils/errors';
import UndeliveredCredentials from './UndeliveredCredentials';

const PROBLEM_HINTS = {
  'row.unknown_manager': 'Their manager needs an Employee ID on another row.',
  'row.role_escalates': "You can't grant a role carrying permissions you don't hold.",
  'row.unknown_level': 'Use a level your organization has defined.',
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

const ProblemTable = ({ problems, tone = 'error' }) => (
  <div className={`max-h-72 overflow-auto rounded-lg border ${tone === 'warning' ? 'border-warning-line' : 'border-line'}`}>
    <table className="w-full text-left text-xs">
      <thead className="sticky top-0 bg-subtle text-ink-subtle">
        <tr>
          <th className="px-3 py-2 font-semibold">Where</th>
          <th className="px-3 py-2 font-semibold">Problem</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line-subtle">
        {problems.map((problem, index) => (
          <tr key={index} className={`align-top ${tone === 'warning' ? 'bg-warning-soft/40' : ''}`}>
            <td className="whitespace-nowrap px-3 py-2 text-ink-muted">
              {problem.row != null ? `Row ${problem.row}` : 'File'}
              {problem.column && <span className="block text-ink-subtle">{problem.column}</span>}
            </td>
            <td className="px-3 py-2 text-ink">
              {problem.message}
              {problem.value != null && problem.value !== '' && (
                <span className="ml-1 font-mono text-ink-muted">“{String(problem.value)}”</span>
              )}
              {PROBLEM_HINTS[problem.code] && <span className="block text-ink-subtle">{PROBLEM_HINTS[problem.code]}</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

/** Non-blocking: amber, apart from the red problems that stop an import. */
const Warnings = ({ warnings }) =>
  warnings?.length > 0 ? (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-warning-fg">
        {warnings.length === 1 ? '1 thing to check' : `${warnings.length} things to check`} — these won't stop the import
      </p>
      <ProblemTable problems={warnings} tone="warning" />
    </div>
  ) : null;

const ImportUsersModal = ({ onClose, onImported }) => {
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
      title="Import people"
      size="lg"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button variant="secondary" onClick={onClose} disabled={importing}>
            {done ? 'Close' : 'Cancel'}
          </Button>
          {!done && (
            <Button onClick={runImport} isLoading={importing} disabled={!file || checking || !check?.ok}>
              Import
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        {done ? (
          <>
          <div className="py-4 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-success-fg" />
            <p className="mt-3 text-base font-semibold text-ink">Imported</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-ink-secondary">
              {done.message ||
                countsOf(done)
                  .map(([key, value]) => `${humanize(key)}: ${value}`)
                  .join(' · ')}
            </p>
            <p className="mx-auto mt-2 max-w-md text-xs text-ink-muted">
              New accounts start on a temporary password and must set their own when they first sign in.
            </p>
          </div>
          <UndeliveredCredentials items={done.undelivered_credentials} />
          <Warnings warnings={done.warnings} />
          </>
        ) : (
          <>
            <ol className="space-y-3 text-sm text-ink-secondary">
              <li className="flex items-start justify-between gap-3">
                <span>
                  <span className="font-medium text-ink">1. Fill in the template.</span> It comes with a working
                  four-person example — read it before replacing it. Level and role are separate columns on purpose.
                </span>
                <Button variant="outline" size="small" startIcon={Download} onClick={downloadTemplate} className="shrink-0">
                  Template
                </Button>
              </li>
              <li>
                <span className="font-medium text-ink">2. Upload it.</span> It's checked first; nothing is created
                until every row is valid.
              </li>
            </ol>

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-line-strong px-4 py-8 text-center transition-colors hover:border-line-accent hover:bg-hover"
            >
              {file ? <FileSpreadsheet className="h-6 w-6 text-accent-fg" /> : <Upload className="h-6 w-6 text-ink-subtle" />}
              <span className="text-sm font-medium text-ink">{file ? file.name : 'Choose an .xlsx file'}</span>
              {file && <span className="text-xs text-ink-subtle">Choose another to replace it</span>}
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

            {checking && <p className="text-sm text-ink-muted">Checking the file…</p>}

            {check?.ok && (
              <Alert variant="success" title="The file is valid">
                {countsOf(check.result).length > 0
                  ? countsOf(check.result)
                      .map(([key, value]) => `${humanize(key)}: ${value}`)
                      .join(' · ')
                  : 'Ready to import.'}
              </Alert>
            )}
            {check?.ok && <Warnings warnings={check.result?.warnings} />}

            {check && !check.ok && (
              <div className="space-y-3">
                <Alert variant="error" title={check.error.summary}>
                  Fix these in the file and upload it again — nothing was imported.
                </Alert>
                {fileProblems.length > 0 && (
                  <ul className="list-disc space-y-1 pl-5 text-sm text-danger-fg">
                    {fileProblems.map((problem, index) => (
                      <li key={index}>
                        {problem.message}
                        {PROBLEM_HINTS[problem.code] && (
                          <span className="block text-xs text-ink-muted">{PROBLEM_HINTS[problem.code]}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {rowProblems.length > 0 && <ProblemTable problems={rowProblems} />}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};

export default ImportUsersModal;
