// src/components/posters/PosterPreview.jsx
//
// Live preview of a saved poster, drawn by the same renderer as the PDF
// (utils/posterRender), from GET /posters/{id}/render. `version` changes after
// each save, so the preview redraws with what was saved.
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Image as ImageIcon } from 'lucide-react';
import { portalAPI } from '../../api/portal';
import Skeleton from '../ui/Skeleton';

const PREVIEW_WIDTH = 520;

/** Text alternative for the drawn poster: what it says, in reading order. */
const describe = (render, t) => {
  const p = render?.poster || {};
  const parts = [
    render?.branding?.display_name?.en,
    render?.branding?.display_name?.ar,
    p.heading?.en,
    p.heading?.ar,
    t('preview.altQr', { url: render?.qr?.value }),
    ...(p.instructions || []).flatMap((l) => [l?.en, l?.ar]),
    p.footer?.en,
    p.footer?.ar,
  ];
  return parts.filter((x) => typeof x === 'string' && x.trim()).join('. ');
};

const PosterPreview = ({ posterId, version = 0 }) => {
  const { t } = useTranslation('posters');
  const canvasRef = useRef(null);
  const [state, setState] = useState({ status: posterId ? 'loading' : 'unsaved', render: null });

  useEffect(() => {
    if (!posterId) {
      setState({ status: 'unsaved', render: null });
      return undefined;
    }
    let cancelled = false;
    setState((prev) => ({ ...prev, status: 'loading' }));
    (async () => {
      try {
        const render = await portalAPI.renderPoster(posterId);
        if (cancelled) return;
        setState({ status: 'ready', render });
      } catch (err) {
        if (cancelled) return;
        setState({ status: err?.response?.status === 409 ? 'noAddress' : 'error', render: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [posterId, version]);

  useEffect(() => {
    if (state.status !== 'ready' || !canvasRef.current) return;
    let cancelled = false;
    import('../../utils/posterRender').then(({ drawPoster }) => {
      if (cancelled || !canvasRef.current) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      drawPoster(canvasRef.current, state.render, { width: PREVIEW_WIDTH * dpr });
    });
    return () => {
      cancelled = true;
    };
  }, [state]);

  const box = 'flex aspect-[1/1.414] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong bg-subtle p-6 text-center text-sm text-ink-muted';

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-sm font-semibold text-ink">{t('preview.title')}</figcaption>
      {state.status === 'unsaved' && (
        <div className={box}>
          <ImageIcon className="h-6 w-6 text-ink-subtle" aria-hidden="true" />
          <p>{t('preview.unsaved')}</p>
        </div>
      )}
      {state.status === 'loading' && !state.render && <Skeleton className="aspect-[1/1.414] w-full rounded-xl" />}
      {state.status === 'noAddress' && (
        <div className={box} role="status">
          <AlertTriangle className="h-6 w-6 text-warning-fg" aria-hidden="true" />
          <p>{t('noAddress')}</p>
        </div>
      )}
      {state.status === 'error' && (
        <div className={box} role="alert">
          <AlertTriangle className="h-6 w-6 text-danger-fg" aria-hidden="true" />
          <p>{t('preview.failed')}</p>
        </div>
      )}
      {state.render && (state.status === 'ready' || state.status === 'loading') && (
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={describe(state.render, t)}
          className="h-auto w-full rounded-xl border border-line bg-white shadow-sm"
          style={{ aspectRatio: '1 / 1.414' }}
        />
      )}
      <p className="text-xs text-ink-muted">{t('preview.note')}</p>
    </figure>
  );
};

export default PosterPreview;
