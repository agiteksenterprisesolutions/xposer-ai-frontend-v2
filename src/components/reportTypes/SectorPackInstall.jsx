// src/components/reportTypes/SectorPackInstall.jsx
//
// Add a sector pack's report types to this organization (XPAI-87). Choose a
// pack, preview the install (a dry run: what would be created, what's skipped
// because a type with that code exists, and any problem that would refuse
// the whole install), then install. Installed types become the
// organization's own and keep the status written in the pack, draft by
// default, so nothing goes live by itself.
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, MinusCircle, Package, PackageCheck, XCircle } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import Skeleton from '../ui/Skeleton';
import { reportTypesAPI } from '../../api';
import { localized } from '../../api/jurisdiction';
import { describeError } from '../../utils/errors';

const Group = ({ icon: Icon, tone, title, items, render }) =>
  items?.length ? (
    <div>
      <p className={`mb-2 flex items-center gap-1.5 text-sm font-semibold ${tone}`}>
        <Icon className="h-4 w-4" /> {title} ({items.length})
      </p>
      <ul className="max-h-48 divide-y divide-line-subtle overflow-y-auto rounded-lg border border-line scrollbar-thin">
        {items.map((item, i) => (
          <li key={`${item.code || item.name || i}-${i}`} className="px-3 py-2 text-sm">
            {render(item)}
          </li>
        ))}
      </ul>
    </div>
  ) : null;

const TypeLine = ({ type }) => (
  <>
    <span className="text-ink">{type.name}</span> <span className="font-mono text-xs text-ink-muted">{type.code}</span>
    {type.reason && <span className="block text-xs text-ink-muted">{type.reason}</span>}
  </>
);

const SectorPackInstall = ({ isOpen, onClose, onInstalled }) => {
  const [packs, setPacks] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null); // 'preview' | 'install'

  useEffect(() => {
    if (!isOpen) return;
    setCode('');
    setPreview(null);
    setResult(null);
    setError(null);
    setLoadError(null);
    setPacks(null);
    reportTypesAPI
      .sectorPacks()
      .then(setPacks)
      .catch((err) => setLoadError(describeError(err).summary));
  }, [isOpen]);

  const pack = useMemo(() => packs?.find((p) => p.code === code) || null, [packs, code]);

  const choose = (next) => {
    setCode(next);
    setPreview(null);
    setResult(null);
    setError(null);
  };

  const run = async (dryRun) => {
    setBusy(dryRun ? 'preview' : 'install');
    setError(null);
    try {
      const response = await reportTypesAPI.installSectorPack(code, { dryRun });
      if (dryRun) setPreview(response);
      else {
        setResult(response);
        onInstalled?.(response);
      }
    } catch (err) {
      const body = err?.response?.data;
      const problems = body?.problems || body?.detail?.problems;
      if (err?.response?.status === 422 && Array.isArray(problems)) {
        setPreview({ ok: false, problems, would_create: [], skipped: body?.skipped || body?.detail?.skipped || [] });
      } else setError(describeError(err).summary);
    } finally {
      setBusy(null);
    }
  };

  const shown = result || preview;
  const created = shown ? shown.created || shown.would_create || [] : [];
  const problems = shown?.problems || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={busy ? () => {} : onClose}
      title="Install a sector pack"
      size="large"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button variant="secondary" onClick={onClose} disabled={Boolean(busy)}>
            {result ? 'Done' : 'Cancel'}
          </Button>
          {!result && (
            <>
              <Button variant="secondary" onClick={() => run(true)} isLoading={busy === 'preview'} disabled={!code || busy === 'install'}>
                {preview ? 'Preview again' : 'Preview'}
              </Button>
              <Button
                startIcon={PackageCheck}
                onClick={() => run(false)}
                isLoading={busy === 'install'}
                disabled={!preview?.ok || created.length === 0 || busy === 'preview'}
                title={!preview ? 'Preview first' : undefined}
              >
                Install
              </Button>
            </>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-muted">
          A sector pack is a ready-made set of report types for an industry. Installing copies them in as your own
          report types. They arrive as drafts, so you can review them before reporters see them.
        </p>

        {loadError && <Alert variant="error">{loadError}</Alert>}
        {!packs && !loadError && <Skeleton.Lines lines={4} />}
        {packs?.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line-strong px-6 py-8 text-center">
            <Package className="h-6 w-6 text-ink-subtle" />
            <p className="text-sm font-semibold text-ink">No sector packs available yet</p>
            <p className="max-w-sm text-sm text-ink-muted">When Xposer publishes one for your industry, it appears here.</p>
          </div>
        )}

        {packs?.length > 0 && !result && (
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Sector pack">
            {packs.map((p) => {
              const on = p.code === code;
              return (
                <button
                  key={p.code}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => choose(p.code)}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    on ? 'border-line-accent bg-accent-soft' : 'border-line hover:border-line-strong hover:bg-hover'
                  }`}
                >
                  <span className={`block text-sm font-semibold ${on ? 'text-accent-fg' : 'text-ink'}`}>{localized(p.name) || p.code}</span>
                  <span className="mt-0.5 block text-xs text-ink-muted">
                    {(p.report_types || []).length} report types · version {p.version}
                  </span>
                  {localized(p.description) && <span className="mt-1 block text-xs text-ink-secondary">{localized(p.description)}</span>}
                </button>
              );
            })}
          </div>
        )}

        {pack && !shown && (pack.report_types || []).length > 0 && (
          <Group
            icon={Package}
            tone="text-ink-secondary"
            title="In this pack"
            items={pack.report_types}
            render={(t) => (
              <>
                <TypeLine type={t} />
                {t.category && <span className="ml-2 text-xs text-ink-subtle">{t.category}</span>}
              </>
            )}
          />
        )}

        {error && <Alert variant="error">{error}</Alert>}

        {shown && (
          <div className="space-y-4">
            {result ? (
              <Alert variant="success">
                Installed {created.length} report type{created.length === 1 ? '' : 's'} from {localized(pack?.name) || code}
                {result.pack?.version != null && ` (v${result.pack.version})`}. Review them, then activate the ones you want.
              </Alert>
            ) : problems.length ? (
              <Alert variant="error">Nothing can be installed until these are fixed. Nothing was changed.</Alert>
            ) : created.length === 0 ? (
              <Alert variant="info">Nothing new to install: you already have every report type in this pack.</Alert>
            ) : (
              <Alert variant="info">Preview only. Nothing has been changed yet.</Alert>
            )}
            <Group
              icon={XCircle}
              tone="text-danger-fg"
              title="Problems"
              items={problems}
              render={(p) => (
                <>
                  {(p.code || p.name) && <span className="font-mono text-xs text-ink-muted">{p.code || p.name} · </span>}
                  <span className="text-ink">{p.message || String(p)}</span>
                </>
              )}
            />
            <Group icon={CheckCircle2} tone="text-success-fg" title={result ? 'Added' : 'Will be added'} items={created} render={(t) => <TypeLine type={t} />} />
            <Group
              icon={MinusCircle}
              tone="text-ink-muted"
              title="Skipped, you already have these"
              items={shown.skipped}
              render={(t) => <TypeLine type={t} />}
            />
          </div>
        )}
      </div>
    </Modal>
  );
};

export default SectorPackInstall;
