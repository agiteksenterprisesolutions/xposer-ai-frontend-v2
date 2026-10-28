// src/components/reportTypeBuilder/VersionHistory.jsx
//
// A report type's form history: every saved version, newest first, and a
// read-only view of any one. Each report is filed against one of these, so an
// edited type never changes the questions of a report already started.
// GET /report-types/{id}/versions needs report_type:manage, as does the editor.
import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronRight, History } from 'lucide-react';
import Modal from '../layout/Modal';
import Skeleton from '../ui/Skeleton';
import { reportTypesAPI } from '../../api';
import { formatDateTime } from '../../utils/formatters';
import { errorSummary } from '../../utils/errors';
import { normalizeOptions } from '../../utils/reportTypes';
import { typeInfo } from './model';

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);

const VersionForm = ({ typeId, version }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let live = true;
    reportTypesAPI
      .getVersion(typeId, version)
      .then((result) => live && setData(result))
      .catch((err) => live && setError(errorSummary(err)));
    return () => {
      live = false;
    };
  }, [typeId, version]);

  if (error) return <p className="text-sm text-ink-muted">Couldn't load version {version}. {error}</p>;
  if (!data) return <Skeleton.Lines size="sm" lines={6} />;

  const sections = [...(data.sections || [])].sort(byOrder);
  return (
    <div className="space-y-4">
      {sections.map((section, s) => (
        <section key={section.id || s} className="rounded-xl border border-line">
          <h4 className="border-b border-line px-4 py-2.5 text-sm font-semibold text-ink">
            {s + 1}. {section.title || 'Untitled step'}
          </h4>
          <ol className="divide-y divide-line-subtle">
            {[...(section.questions || [])].sort(byOrder).map((question, q) => {
              const options = normalizeOptions(question.options);
              return (
                <li key={question.id || q} className="px-4 py-2.5">
                  <p className="text-sm text-ink">
                    {question.label || question.name}
                    {question.required && <span className="text-danger-fg"> *</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {typeInfo(question.type).label} · <span className="font-mono">{question.name}</span>
                  </p>
                  {options.length > 0 && (
                    <p className="mt-1 text-xs text-ink-secondary">{options.map((o) => o.label).join(' · ')}</p>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      {sections.length === 0 && <p className="text-sm text-ink-muted">This version has no questions.</p>}
    </div>
  );
};

const VersionHistory = ({ isOpen, onClose, typeId, currentVersion }) => {
  const [versions, setVersions] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null); // a version number

  useEffect(() => {
    if (!isOpen) return undefined;
    let live = true;
    setOpen(null);
    setError(null);
    reportTypesAPI
      .listVersions(typeId)
      .then((list) => live && setVersions(list))
      .catch((err) => live && setError(errorSummary(err)));
    return () => {
      live = false;
    };
  }, [isOpen, typeId, currentVersion]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="large"
      title={
        open == null ? (
          'Version history'
        ) : (
          <span className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen(null)}
              aria-label="Back to version history"
              className="rounded-md p-1 text-ink-muted hover:bg-hover hover:text-ink"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            Version {open}
            {open === currentVersion && <span className="text-sm font-normal text-ink-muted">(current)</span>}
          </span>
        )
      }
    >
      {open != null ? (
        <VersionForm typeId={typeId} version={open} />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-ink-muted">
            Each change to the questions saves a new version. A report keeps the version it was started on, so its
            questions never change under it. Name, handling and deadlines aren&apos;t versioned.
          </p>
          {error && <p className="text-sm text-ink-muted">Couldn&apos;t load the history. {error}</p>}
          {!error && !versions && <Skeleton.Lines size="sm" lines={3} />}
          {versions?.length === 0 && <p className="text-sm text-ink-muted">No versions saved yet.</p>}
          {versions?.length > 0 && (
            <ul className="divide-y divide-line-subtle rounded-xl border border-line">
              {versions.map((v) => (
                <li key={v.id || v.version}>
                  <button
                    type="button"
                    onClick={() => setOpen(v.version)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-hover"
                  >
                    <History className="h-4 w-4 shrink-0 text-ink-subtle" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink">
                        Version {v.version}
                        {v.version === currentVersion && <span className="ml-2 text-xs font-normal text-ink-muted">Current</span>}
                      </span>
                      {v.created_at && (
                        <span className="block text-xs text-ink-muted">Saved {formatDateTime(v.created_at)}</span>
                      )}
                    </span>
                    <ChevronRight className="h-4 w-4 text-ink-subtle" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
};

export default VersionHistory;
