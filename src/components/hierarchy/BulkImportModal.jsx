// src/components/hierarchy/BulkImportModal.jsx
//
// Paste a spreadsheet into the reporting directory.
//
// The load is all-or-nothing: every row is validated — including against the
// other rows, so row 40 may name row 90 as its manager — before anything is
// written, and one bad row imports nothing. So the flow is always check first
// (dry_run=true, which writes nothing), show each problem on the exact row and
// cell, then import. Someone who pasted 300 rows needs to know they have not
// half-loaded.
import { useMemo, useState } from 'react';
import { CheckCircle2, ClipboardPaste, Copy, Upload } from 'lucide-react';
import { toast } from 'react-toastify';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import { orgHierarchyAPI } from '../../api/orgHierarchy';
import { BULK_FIELDS, BULK_TEMPLATE_HEADER, membersFromPaste } from '../../utils/hierarchy';
import { copyToClipboard } from '../../utils/clipboard';
import { describeError } from '../../utils/errors';

const PREVIEW_LIMIT = 200;

const BulkImportModal = ({ onClose, onImported }) => {
  const [text, setText] = useState('');
  const [checking, setChecking] = useState(false);
  const [importing, setImporting] = useState(false);
  // The outcome of the last check, for the exact text it was run on.
  const [check, setCheck] = useState(null); // { text, ok, wouldCreate, summary, problems }

  const parsed = useMemo(() => membersFromPaste(text), [text]);
  const current = check && check.text === text ? check : null;
  const shownFields = BULK_FIELDS.filter((f) => parsed.columns.includes(f.field));

  // row (1-indexed) → field → message; a problem with no field marks the row.
  const problemsByRow = useMemo(() => {
    const map = new Map();
    (current?.problems || []).forEach((problem) => {
      if (problem.row == null) return;
      if (!map.has(problem.row)) map.set(problem.row, new Map());
      map.get(problem.row).set(problem.field || '_row', problem.message);
    });
    return map;
  }, [current]);
  // Problems with no row, or on a row past the preview, are listed in the
  // summary instead so none goes unseen.
  const unplacedProblems = (current?.problems || [])
    .filter((problem) => problem.row == null || problem.row > PREVIEW_LIMIT)
    .map((problem) => ({
      ...problem,
      message: problem.row != null ? `Row ${problem.row}${problem.field ? ` (${problem.field})` : ''}: ${problem.message}` : problem.message,
    }));

  const runCheck = async () => {
    setChecking(true);
    try {
      const result = await orgHierarchyAPI.bulkCreateMembers(parsed.members, { dryRun: true });
      setCheck({ text, ok: true, wouldCreate: result?.would_create ?? parsed.members.length, problems: [] });
    } catch (error) {
      const { summary, problems } = describeError(error);
      setCheck({ text, ok: false, summary, problems });
    } finally {
      setChecking(false);
    }
  };

  const runImport = async () => {
    setImporting(true);
    try {
      await orgHierarchyAPI.bulkCreateMembers(parsed.members);
      toast.success(`${parsed.members.length} ${parsed.members.length === 1 ? 'person' : 'people'} added to the directory.`);
      onImported?.();
    } catch (error) {
      // The data changed on the server between check and import; show why.
      const { summary, problems } = describeError(error);
      setCheck({ text, ok: false, summary, problems });
    } finally {
      setImporting(false);
    }
  };

  const copyHeader = async () => {
    if (await copyToClipboard(BULK_TEMPLATE_HEADER)) toast.success('Header row copied — paste it into row 1 of your sheet.');
  };

  const canCheck = parsed.members.length > 0 && !parsed.error;

  return (
    <Modal
      isOpen
      onClose={checking || importing ? () => {} : onClose}
      title="Import people from a spreadsheet"
      size="xl"
      closeOnOverlayClick={false}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-muted">
            All-or-nothing: if any row has a problem, nobody is imported.
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="secondary" onClick={onClose} disabled={checking || importing}>
              Cancel
            </Button>
            {current?.ok ? (
              <Button startIcon={Upload} onClick={runImport} isLoading={importing}>
                Import {parsed.members.length} {parsed.members.length === 1 ? 'person' : 'people'}
              </Button>
            ) : (
              <Button startIcon={CheckCircle2} onClick={runCheck} isLoading={checking} disabled={!canCheck}>
                Check {parsed.members.length > 0 ? `${parsed.members.length} rows` : 'rows'}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="space-y-2 text-sm text-ink-secondary">
          <p>
            Copy the rows from your spreadsheet — header row included — and paste them below. Columns can be in any order;
            only <span className="font-medium text-ink">Name</span> is required. Managers can be anyone in the same paste
            or already in the directory.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-md border border-line bg-sunken px-2 py-1 font-mono text-[11px] text-ink-secondary">
              {BULK_FIELDS.map((f) => f.label).join(' · ')}
            </code>
            <Button variant="ghost" size="small" startIcon={Copy} onClick={copyHeader}>
              Copy header row
            </Button>
          </div>
        </div>

        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={7}
          spellCheck={false}
          placeholder={`${BULK_TEMPLATE_HEADER}\nOmar Haddad\tE1\tomar@acme.com\tFinance Executive\tFinance\texecutive\tM1`}
          aria-label="Pasted rows"
          className="w-full rounded-lg border border-line bg-subtle p-3 font-mono text-xs text-ink hover:border-line-strong"
        />

        {parsed.error && <Alert variant="error" title="Can't read these rows">{parsed.error}</Alert>}

        {parsed.unknownHeaders.length > 0 && (
          <p className="text-xs text-warning-fg">
            Ignored column{parsed.unknownHeaders.length === 1 ? '' : 's'}: {parsed.unknownHeaders.join(', ')}.
          </p>
        )}

        {current?.ok && (
          <Alert variant="success" title="Everything checks out">
            {current.wouldCreate} {current.wouldCreate === 1 ? 'person' : 'people'} will be added. Nothing has been
            written yet.
          </Alert>
        )}

        {current && !current.ok && (
          <Alert variant="error" title={current.summary || 'Nothing was imported'}>
            <p>Nobody was imported — the directory is exactly as it was. Fix the highlighted rows and check again.</p>
            {unplacedProblems.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {unplacedProblems.map((problem, index) => (
                  <li key={index}>{problem.message}</li>
                ))}
              </ul>
            )}
          </Alert>
        )}

        {parsed.members.length > 0 && !parsed.error && (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-subtle text-ink-subtle">
                <tr>
                  <th className="px-3 py-2 font-semibold">Row</th>
                  {shownFields.map((f) => (
                    <th key={f.field} className="whitespace-nowrap px-3 py-2 font-semibold">
                      {f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle">
                {parsed.members.slice(0, PREVIEW_LIMIT).map((member, index) => {
                  const row = index + 1;
                  const rowProblems = problemsByRow.get(row);
                  return (
                    <tr key={row} className={rowProblems ? 'bg-danger-soft' : ''}>
                      <td className="whitespace-nowrap px-3 py-2 align-top text-ink-subtle" title={`Sheet row ${row + 1}`}>
                        {row}
                        {rowProblems?.get('_row') && (
                          <p className="mt-1 max-w-48 whitespace-normal text-danger-fg">{rowProblems.get('_row')}</p>
                        )}
                      </td>
                      {shownFields.map((f) => {
                        const message = rowProblems?.get(f.field);
                        return (
                          <td
                            key={f.field}
                            className={`px-3 py-2 align-top ${message ? 'text-danger-fg' : 'text-ink'}`}
                          >
                            <span className={message ? 'rounded bg-surface px-1 ring-1 ring-danger-line' : ''}>
                              {member[f.field] || <span className="text-ink-subtle">—</span>}
                            </span>
                            {message && <p className="mt-1 max-w-64 whitespace-normal text-[11px]">{message}</p>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {parsed.members.length > PREVIEW_LIMIT && (
              <p className="border-t border-line-subtle px-3 py-2 text-xs text-ink-muted">
                Showing the first {PREVIEW_LIMIT} of {parsed.members.length} rows. Every row is checked.
              </p>
            )}
          </div>
        )}

        {text.trim() === '' && (
          <div className="flex items-center gap-2 text-xs text-ink-subtle">
            <ClipboardPaste className="h-4 w-4" /> Paste to see a preview.
          </div>
        )}
      </div>
    </Modal>
  );
};

export default BulkImportModal;
