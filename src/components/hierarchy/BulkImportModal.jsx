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
import { Trans, useTranslation } from 'react-i18next';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import { orgHierarchyAPI } from '../../api/orgHierarchy';
import { BULK_FIELDS, BULK_TEMPLATE_HEADER, membersFromPaste } from '../../utils/hierarchy';
import { copyToClipboard } from '../../utils/clipboard';
import { describeError } from '../../utils/errors';
import { useOrgRoles } from '../../hooks/useOrgRoles';

const PREVIEW_LIMIT = 200;

const BulkImportModal = ({ onClose, onImported }) => {
  const { t } = useTranslation('hierarchy');
  const [text, setText] = useState('');
  const [checking, setChecking] = useState(false);
  const [importing, setImporting] = useState(false);
  // The outcome of the last check, for the exact text it was run on.
  const [check, setCheck] = useState(null); // { text, ok, wouldCreate, summary, problems }

  const { allRoles } = useOrgRoles();
  const raw = useMemo(() => membersFromPaste(text), [text]);
  // A Role cell may hold the role's name ("Officer") or its code ("officer");
  // send the code. Anything unknown goes as typed, for the server to refuse.
  const parsed = useMemo(() => {
    const lookup = new Map(allRoles.flatMap((r) => [[r.code.toLowerCase(), r.code], [String(r.name || '').toLowerCase(), r.code]]));
    return {
      ...raw,
      members: raw.members.map((m) =>
        m.role_code ? { ...m, role_code: lookup.get(String(m.role_code).trim().toLowerCase()) || m.role_code } : m,
      ),
    };
  }, [raw, allRoles]);
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
      message:
        problem.row != null
          ? problem.field
            ? t('bulk.rowFieldProblem', { row: problem.row, field: problem.field, message: problem.message })
            : t('bulk.rowProblem', { row: problem.row, message: problem.message })
          : problem.message,
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
      toast.success(t('bulk.added', { count: parsed.members.length }));
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
    if (await copyToClipboard(BULK_TEMPLATE_HEADER)) toast.success(t('bulk.headerCopied'));
  };

  const canCheck = parsed.members.length > 0 && !parsed.error;

  return (
    <Modal
      isOpen
      onClose={checking || importing ? () => {} : onClose}
      title={t('bulk.title')}
      size="xl"
      closeOnOverlayClick={false}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-muted">
            {t('bulk.allOrNothing')}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="secondary" onClick={onClose} disabled={checking || importing}>
              {t('common:actions.cancel')}
            </Button>
            {current?.ok ? (
              <Button startIcon={Upload} onClick={runImport} isLoading={importing}>
                {t('bulk.import', { count: parsed.members.length })}
              </Button>
            ) : (
              <Button startIcon={CheckCircle2} onClick={runCheck} isLoading={checking} disabled={!canCheck}>
                {parsed.members.length > 0 ? t('bulk.checkRows', { count: parsed.members.length }) : t('bulk.checkRowsNone')}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="space-y-2 text-sm text-ink-secondary">
          <p>
            <Trans
              t={t}
              i18nKey="bulk.instructions"
              components={{ strong: <span className="font-medium text-ink" /> }}
            />
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-md border border-line bg-sunken px-2 py-1 font-mono text-[11px] text-ink-secondary">
              {BULK_FIELDS.map((f) => f.label).join(' · ')}
            </code>
            <Button variant="ghost" size="small" startIcon={Copy} onClick={copyHeader}>
              {t('bulk.copyHeader')}
            </Button>
          </div>
        </div>

        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={7}
          spellCheck={false}
          placeholder={`${BULK_TEMPLATE_HEADER}\nOmar Haddad\tE1\tomar@acme.com\tFinance Executive\tFinance\texecutive\tM1`}
          aria-label={t('bulk.pastedRows')}
          className="w-full rounded-lg border border-line bg-subtle p-3 font-mono text-xs text-ink hover:border-line-strong"
        />

        {parsed.error && <Alert variant="error" title={t('bulk.cantRead')}>{parsed.error}</Alert>}

        {parsed.unknownHeaders.length > 0 && (
          <p className="text-xs text-warning-fg">
            {t('bulk.ignoredColumns', { count: parsed.unknownHeaders.length, columns: parsed.unknownHeaders.join(', ') })}
          </p>
        )}

        {current?.ok && (
          <Alert variant="success" title={t('bulk.checksOut')}>
            {t('bulk.willAdd', { count: current.wouldCreate })}
          </Alert>
        )}

        {current && !current.ok && (
          <Alert variant="error" title={current.summary || t('bulk.nothingImported')}>
            <p>{t('bulk.nobodyImported')}</p>
            {unplacedProblems.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 ps-4">
                {unplacedProblems.map((problem, index) => (
                  <li key={index}>{problem.message}</li>
                ))}
              </ul>
            )}
          </Alert>
        )}

        {parsed.members.length > 0 && !parsed.error && (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="min-w-full text-start text-xs">
              <thead className="bg-subtle text-ink-subtle">
                <tr>
                  <th className="px-3 py-2 font-semibold">{t('bulk.row')}</th>
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
                      <td className="whitespace-nowrap px-3 py-2 align-top text-ink-subtle" title={t('bulk.sheetRow', { row: row + 1 })}>
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
                {t('bulk.previewLimit', { limit: PREVIEW_LIMIT, total: parsed.members.length })}
              </p>
            )}
          </div>
        )}

        {text.trim() === '' && (
          <div className="flex items-center gap-2 text-xs text-ink-subtle">
            <ClipboardPaste className="h-4 w-4" aria-hidden="true" /> {t('bulk.pasteToPreview')}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default BulkImportModal;
