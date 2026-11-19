// src/pages/admin/Posters.jsx
//
// QR posters (XPAI-227; PORTAL.md §4). A poster opens one portal address —
// the tenant's or an entity's — and carries the admin's own text in English
// and Arabic. The backend stores posters and hands over everything to draw
// (GET /posters/{id}/render); the PDF is generated here in the browser, with
// no other request (utils/posterRender).
//
// Poster language (English, Arabic or both) starts at the app's language. In
// the list it's asked in a dialog after A4 / A3 / Print is pressed; in the
// editor it sits under the preview, which follows it, and the buttons there
// use it directly. Only languages the poster has text in are offered; a
// poster written in one language is never asked about.
//
// Tenant admins see every poster; an entity admin sees their own entity's
// (the backend filters).
import { useCallback, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Download, Pencil, Plus, Printer, QrCode, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Alert from '../../components/ui/Alert';
import Table, { TableLoading } from '../../components/ui/Table';
import Skeleton from '../../components/ui/Skeleton';
import Modal, { ConfirmationModal } from '../../components/ui/Modal';
import PosterForm, { SIZES } from '../../components/posters/PosterForm';
import PosterPreview from '../../components/posters/PosterPreview';
import { portalAPI } from '../../api/portal';
import { errorSummary } from '../../utils/errors';
import useSEO from '../../hooks/useSEO';
import { availablePosterLangs, defaultPosterLang, initialPosterLang, renderForLang } from '../../utils/posterLang';

const posterId = (poster) => poster?.id ?? poster?._id ?? null;

/** English / Arabic / both, as a row of radio buttons. */
const PosterLangPicker = ({ options, value, onChange, stacked = false }) => {
  const { t } = useTranslation('posters');
  const name = useId();
  return (
    <fieldset className={stacked ? 'flex flex-col gap-2' : 'flex flex-wrap items-center gap-x-4 gap-y-1'}>
      <legend className={stacked ? 'mb-2 text-sm font-medium text-ink-secondary' : 'float-start me-3 text-sm font-medium text-ink-secondary'}>{t('lang.label')}</legend>
      {options.map((lang) => (
        <label key={lang} className="flex min-h-6 cursor-pointer items-center gap-1.5 text-sm text-ink">
          <input
            type="radio"
            name={name}
            value={lang}
            className="h-4 w-4 border-line-strong"
            checked={value === lang}
            onChange={() => onChange(lang)}
          />
          {t(`lang.${lang}`)}
        </label>
      ))}
    </fieldset>
  );
};

/**
 * Asks which language(s) to print a poster in, after A4 / A3 / Print was
 * pressed in the list. `request` is { poster, action: 'download' | 'print',
 * size }; `onConfirm(lang)` does the work and resolves when it's done.
 */
const PosterLangModal = ({ request, onClose, onConfirm }) => {
  const { t, i18n } = useTranslation('posters');
  const options = availablePosterLangs(request?.poster);
  const [lang, setLang] = useState(() => defaultPosterLang(i18n.resolvedLanguage));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (request) setLang(initialPosterLang(availablePosterLangs(request.poster), i18n.resolvedLanguage));
  }, [request, i18n.resolvedLanguage]);
  const isPrint = request?.action === 'print';
  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm(lang);
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      isOpen={Boolean(request)}
      onClose={busy ? () => {} : onClose}
      title={isPrint ? t('choose.printTitle') : t('choose.downloadTitle', { size: request?.size })}
      size="small"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button variant="secondary" onClick={onClose} disabled={busy}>{t('choose.cancel')}</Button>
          <Button startIcon={isPrint ? Printer : Download} onClick={confirm} isLoading={busy}>
            {isPrint ? t('list.print') : t('choose.download')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-secondary" dir="auto">{request?.poster?.name}</p>
        <PosterLangPicker options={options} value={lang} onChange={setLang} stacked />
      </div>
    </Modal>
  );
};

/**
 * Download (one per size) and print buttons for a poster, shown in the list
 * and under the preview in the editor. `busy` is the size being downloaded or
 * 'print'. A switched-off poster can't be downloaded or printed.
 */
const PosterActions = ({ poster, busy, onDownload, onPrint }) => {
  const { t } = useTranslation('posters');
  const id = posterId(poster);
  const reasonId = `poster-${id}-not-downloadable`;
  const sizes = SIZES.filter((s) => (poster.sizes || []).includes(s));
  const disabled = poster.downloadable === false || poster.is_active === false;
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
        {sizes.length > 0 && (
          <Button
            variant="secondary"
            size="small"
            startIcon={Printer}
            disabled={disabled || Boolean(busy)}
            isLoading={busy === 'print'}
            aria-describedby={disabled ? reasonId : undefined}
            aria-label={t('list.printAria', { name: poster.name })}
            onClick={() => onPrint(poster, sizes[0])}
          >
            {t('list.print')}
          </Button>
        )}
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
  const { t, i18n } = useTranslation('posters');
  const [posterLang, setPosterLang] = useState(() => defaultPosterLang(i18n.resolvedLanguage));
  useSEO({ title: t('title'), description: t('seoDescription'), noIndex: true });
  const [posters, setPosters] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // null | 'new' | poster
  const [previewVersion, setPreviewVersion] = useState(0);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [downloading, setDownloading] = useState(null); // { id, size | 'print' }
  const [langRequest, setLangRequest] = useState(null); // list: { poster, action, size }

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

  // `render` is passed when the editor's preview already has it; the list
  // fetches it.
  const pdfFor = async (poster, size, render, lang) => {
    const data = renderForLang(render || (await portalAPI.renderPoster(posterId(poster))), lang);
    const lib = await import('../../utils/posterRender');
    const blob = await lib.posterPdf(data, size);
    return { blob, lib, name: lib.posterFileName(data?.qr?.value || data?.poster?.url || poster.url, size, lang) };
  };

  const failed = (err) =>
    toast.error(err?.response?.status === 409 ? t('noAddress') : errorSummary(err) || t('list.downloadFailed'));

  const download = async (poster, size, render, lang) => {
    setDownloading({ id: posterId(poster), size });
    try {
      const { blob, lib, name } = await pdfFor(poster, size, render, lang);
      lib.saveBlob(blob, name);
    } catch (err) {
      failed(err);
    } finally {
      setDownloading(null);
    }
  };

  const print = async (poster, size, render, lang) => {
    setDownloading({ id: posterId(poster), size: 'print' });
    try {
      const { blob, lib } = await pdfFor(poster, size, render, lang);
      await lib.printBlob(blob);
    } catch (err) {
      failed(err);
    } finally {
      setDownloading(null);
    }
  };

  // List buttons: ask for the language only when the poster has both.
  const fromList = (action) => (poster, size) => {
    const options = availablePosterLangs(poster);
    if (options.length > 1) setLangRequest({ poster, action, size });
    else (action === 'print' ? print : download)(poster, size, null, options[0]);
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
    const langOptions = availablePosterLangs(current);
    const editorLang = langOptions.includes(posterLang) ? posterLang : initialPosterLang(langOptions, i18n.resolvedLanguage);
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
            <PosterPreview
              posterId={posterId(current)}
              version={previewVersion}
              lang={editorLang}
              actions={(render) => (
                <div className="flex flex-col gap-3">
                  {langOptions.length > 1 && (
                    <PosterLangPicker options={langOptions} value={editorLang} onChange={setPosterLang} />
                  )}
                  <PosterActions
                  poster={current}
                  busy={downloading?.id === posterId(current) ? downloading.size : null}
                  onDownload={(p, size) => download(p, size, render, editorLang)}
                  onPrint={(p, size) => print(p, size, render, editorLang)}
                  />
                </div>
              )}
            />
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
                          <PosterActions poster={poster} busy={busy} onDownload={fromList('download')} onPrint={fromList('print')} />
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
                        <PosterActions poster={poster} busy={busy} onDownload={fromList('download')} onPrint={fromList('print')} />
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

      <PosterLangModal
        request={langRequest}
        onClose={() => setLangRequest(null)}
        onConfirm={(lang) =>
          (langRequest.action === 'print' ? print : download)(langRequest.poster, langRequest.size, null, lang)
        }
      />

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
