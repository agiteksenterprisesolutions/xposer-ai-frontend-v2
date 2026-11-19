// src/pages/admin/Posters.jsx
//
// QR posters (XPAI-227; PORTAL.md §4). A poster opens one portal address —
// the tenant's or an entity's — and carries the admin's own text in English
// and Arabic. The backend stores posters and hands over everything to draw
// (GET /posters/{id}/render); the PDF is generated here in the browser, with
// no other request (utils/posterRender).
//
// Tenant admins see every poster; an entity admin sees their own entity's
// (the backend filters).
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Download, Pencil, Plus, QrCode, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Alert from '../../components/ui/Alert';
import Table, { TableLoading } from '../../components/ui/Table';
import Skeleton from '../../components/ui/Skeleton';
import { ConfirmationModal } from '../../components/ui/Modal';
import PosterForm, { SIZES } from '../../components/posters/PosterForm';
import PosterPreview from '../../components/posters/PosterPreview';
import { portalAPI } from '../../api/portal';
import { errorSummary } from '../../utils/errors';
import useSEO from '../../hooks/useSEO';

const posterId = (poster) => poster?.id ?? poster?._id ?? null;

/** Download buttons for the poster's own sizes. */
const DownloadButtons = ({ poster, busy, onDownload }) => {
  const { t } = useTranslation('posters');
  const id = posterId(poster);
  const reasonId = `poster-${id}-not-downloadable`;
  const sizes = SIZES.filter((s) => (poster.sizes || []).includes(s));
  const disabled = poster.downloadable === false;
  const reason = poster.not_downloadable_message || t('list.notDownloadable');
  return (
    <div className="flex flex-col items-start gap-1">
      {/* A disabled button gets no hover, so the tooltip sits on its wrapper. */}
      <span className="flex flex-wrap gap-1.5" title={disabled ? reason : undefined}>
        {sizes.map((size) => (
          <Button
            key={size}
            variant="secondary"
            size="small"
            startIcon={Download}
            disabled={disabled || Boolean(busy)}
            isLoading={busy === size}
            aria-describedby={disabled ? reasonId : undefined}
            aria-label={t('list.downloadAria', { size, name: poster.name })}
            onClick={() => onDownload(poster, size)}
          >
            {size}
          </Button>
        ))}
      </span>
      {disabled && (
        <span id={reasonId} className="max-w-56 text-xs text-ink-muted" dir="auto">
          {reason}
        </span>
      )}
    </div>
  );
};

const Posters = () => {
  const { t } = useTranslation('posters');
  useSEO({ title: t('title'), description: t('seoDescription'), noIndex: true });
  const [posters, setPosters] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // null | 'new' | poster
  const [previewVersion, setPreviewVersion] = useState(0);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [downloading, setDownloading] = useState(null); // { id, size }

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await portalAPI.getPosters();
      setPosters(Array.isArray(data) ? data : data?.items || []);
    } catch (err) {
      setError(errorSummary(err));
      setPosters([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const download = async (poster, size) => {
    const id = posterId(poster);
    setDownloading({ id, size });
    try {
      const render = await portalAPI.renderPoster(id);
      const { posterPdf, posterFileName, saveBlob } = await import('../../utils/posterRender');
      const blob = await posterPdf(render, size);
      saveBlob(blob, posterFileName(render?.qr?.value || render?.poster?.url || poster.url, size));
    } catch (err) {
      toast.error(err?.response?.status === 409 ? t('noAddress') : errorSummary(err) || t('list.downloadFailed'));
    } finally {
      setDownloading(null);
    }
  };

  const confirmDelete = async () => {
    setDeleteBusy(true);
    try {
      await portalAPI.deletePoster(posterId(deleting));
      toast.success(t('toast.deleted'));
      setDeleting(null);
      load();
    } catch {
      /* the global toast says why */
    } finally {
      setDeleteBusy(false);
    }
  };

  // ── Editor: the form, with the live preview beside it ──────────────────
  if (editing) {
    const current = editing === 'new' ? null : editing;
    return (
      <div className="flex flex-col gap-6">
        <div>
          <Button variant="ghost" size="small" startIcon={ArrowLeft} onClick={() => { setEditing(null); load(); }}>
            {t('backToList')}
          </Button>
          <h1 className="mt-2 text-2xl font-bold tracking-[-0.02em] text-ink" dir="auto">
            {current ? t('editTitle', { name: current.name }) : t('newTitle')}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">{t('formIntro')}</p>
        </div>
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
          <Card>
            <PosterForm
              poster={current}
              onCancel={() => { setEditing(null); load(); }}
              onSaved={(saved) => {
                setEditing(saved);
                setPreviewVersion((v) => v + 1);
              }}
            />
          </Card>
          <div className="xl:sticky xl:top-20">
            <PosterPreview posterId={posterId(current)} version={previewVersion} />
          </div>
        </div>
      </div>
    );
  }

  // ── List ───────────────────────────────────────────────────────────────
  const statusBadge = (poster) => (
    <Badge size="small" variant={poster.is_active === false ? 'default' : 'success'} dot>
      {poster.is_active === false ? t('list.inactive') : t('list.active')}
    </Badge>
  );
  const rowActions = (poster) => (
    <div className="flex justify-end gap-1">
      <Button variant="ghost" size="small" aria-label={t('list.editAria', { name: poster.name })} onClick={() => setEditing(poster)}>
        <Pencil className="h-4 w-4" aria-hidden="true" />
      </Button>
      <Button variant="ghost" size="small" aria-label={t('list.deleteAria', { name: poster.name })} onClick={() => setDeleting(poster)}>
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">{t('title')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">{t('intro')}</p>
        </div>
        <Button startIcon={Plus} onClick={() => setEditing('new')}>
          {t('add')}
        </Button>
      </div>

      {error ? (
        <Alert variant="error">{error}</Alert>
      ) : posters?.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
          <QrCode className="h-7 w-7 text-ink-subtle" aria-hidden="true" />
          <p className="text-sm font-semibold text-ink">{t('emptyTitle')}</p>
          <p className="max-w-md text-sm text-ink-muted">{t('emptyBody')}</p>
          <Button className="mt-2" startIcon={Plus} onClick={() => setEditing('new')}>
            {t('add')}
          </Button>
        </div>
      ) : (
        <Card padding="none">
          <Table>
            <Table.Header>
              <Table.Row hover={false}>
                <Table.Head>{t('list.name')}</Table.Head>
                <Table.Head>{t('list.address')}</Table.Head>
                <Table.Head>{t('list.download')}</Table.Head>
                <Table.Head>{t('list.status')}</Table.Head>
                <Table.Head className="text-end">{t('list.actions')}</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {!posters ? (
                <TableLoading
                  rows={3}
                  cells={[
                    <Skeleton.Text key="n" className="w-40" />,
                    <Skeleton.Text key="u" className="w-56" />,
                    <Skeleton.Text key="d" className="w-24" />,
                    <Skeleton.Badge key="s" />,
                    <Skeleton.Text key="a" className="ms-auto w-14" />,
                  ]}
                />
              ) : (
                posters.map((poster) => {
                  const id = posterId(poster);
                  const busy = downloading?.id === id ? downloading.size : null;
                  return (
                    <Table.Row
                      key={id}
                      className={poster.is_active === false ? 'opacity-70' : ''}
                      mobile={
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <span className="min-w-0 truncate font-medium text-ink" dir="auto">{poster.name}</span>
                            {statusBadge(poster)}
                          </div>
                          <p className="break-all font-mono text-xs text-ink-muted" dir="ltr">{poster.url || t('list.noAddress')}</p>
                          <DownloadButtons poster={poster} busy={busy} onDownload={download} />
                          {rowActions(poster)}
                        </div>
                      }
                    >
                      <Table.Cell>
                        <p className="font-medium text-ink" dir="auto">{poster.name}</p>
                        <p className="text-xs text-ink-muted">{t('list.sizes', { sizes: (poster.sizes || []).join(' · ') })}</p>
                      </Table.Cell>
                      <Table.Cell className="text-sm">
                        {poster.url ? (
                          <span className="break-all font-mono text-xs text-ink-secondary" dir="ltr">{poster.url}</span>
                        ) : (
                          <span className="text-ink-muted">{t('list.noAddress')}</span>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <DownloadButtons poster={poster} busy={busy} onDownload={download} />
                      </Table.Cell>
                      <Table.Cell>{statusBadge(poster)}</Table.Cell>
                      <Table.Cell className="text-end">{rowActions(poster)}</Table.Cell>
                    </Table.Row>
                  );
                })
              )}
            </Table.Body>
          </Table>
        </Card>
      )}

      <ConfirmationModal
        isOpen={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title={t('delete.title')}
        message={t('delete.message', { name: deleting?.name || '' })}
        confirmText={t('delete.confirm')}
        isLoading={deleteBusy}
        destructive
      />
    </div>
  );
};

export default Posters;
