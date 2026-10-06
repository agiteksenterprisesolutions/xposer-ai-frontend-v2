// src/components/reportTypeBuilder/ReportTypeEditorSkeleton.jsx
//
// The report type editor while its type loads: the same top bar, outline,
// canvas and settings panel, with the data stubbed, so nothing moves when the
// type arrives.
import { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import Skeleton from '../ui/Skeleton';
import { useUIStore } from '../../store/uiStore';

const ReportTypeEditorSkeleton = () => {
  useEffect(() => {
    useUIStore.setState({ fullBleed: true });
    return () => useUIStore.setState({ fullBleed: false });
  }, []);

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col bg-canvas lg:h-[calc(100dvh-4rem)]" aria-busy="true">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line bg-surface px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-[1_1_16rem] items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-ink-secondary">
            <ArrowLeft className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex h-6.5 items-center gap-2">
              <Skeleton.Text size="base" className="w-48" />
              <Skeleton.Badge className="w-18" />
            </div>
            <Skeleton.Text size="xs" className="mt-0.5 w-28" />
          </div>
        </div>
        <nav className="order-last flex w-full gap-1 rounded-xl bg-active p-1 sm:order-none sm:w-auto" aria-hidden="true">
          {['Questions', 'Handling', 'Review'].map((label, i) => (
            <span
              key={label}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3.5 py-1.5 text-sm sm:flex-none ${
                i === 0 ? 'bg-surface font-semibold text-ink shadow-sm' : 'font-medium text-ink-muted'
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                  i === 0 ? 'bg-accent text-on-accent' : 'border-[1.5px] border-line-strong'
                }`}
              >
                {i + 1}
              </span>
              {label}
            </span>
          ))}
        </nav>
        <div className="flex flex-[1_1_16rem] items-center justify-end gap-2">
          <Skeleton.Button className="w-24" />
          <Skeleton.Button className="w-36" />
          <Skeleton.Button className="w-28" />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="hidden w-68 shrink-0 border-r border-line bg-surface lg:block">
          <div className="flex items-center justify-between px-5 pb-2 pt-5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">Steps</span>
            <Skeleton.Text size="xs" className="w-28" />
          </div>
          <div className="space-y-1 px-3">
            <div className="rounded-xl bg-accent-soft/60 p-1">
              <div className="flex items-center gap-2.5 px-2 py-2">
                <Skeleton.Icon size="h-5.5 w-5.5" className="rounded-md" />
                <Skeleton.Text className="w-32 flex-1" />
              </div>
              <div className="space-y-px py-1 pl-3">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-2.5 px-2 py-1.5">
                    <Skeleton className="h-3.5 w-3.5 rounded" />
                    <Skeleton.Text className={i % 2 ? 'w-28' : 'w-36'} />
                  </div>
                ))}
              </div>
            </div>
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center gap-2.5 px-2 py-2">
                <Skeleton.Icon size="h-5.5 w-5.5" className="rounded-md" />
                <Skeleton.Text className="w-36" />
              </div>
            ))}
          </div>
        </aside>

        <main className="min-w-0 flex-1 bg-canvas">
          <div className="mx-auto w-full max-w-170 space-y-4 px-4 py-6 sm:px-8 sm:py-7">
            <div className="flex h-7 items-center justify-between">
              <Skeleton.Text size="xs" className="w-52" />
              <Skeleton className="h-1 w-24 rounded-full" />
            </div>
            <div className="space-y-1 rounded-2xl border border-line bg-surface px-6 py-5">
              <Skeleton.Text size="xl" className="w-56" />
              <Skeleton.Text className="w-72 max-w-full" />
            </div>
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2 rounded-2xl border border-line bg-surface px-6 py-4.5">
                <Skeleton.Text size="base" className={i === 1 ? 'w-80 max-w-full' : 'w-60'} />
                <Skeleton className={`w-full rounded-lg ${i === 1 ? 'h-20' : 'h-10'}`} />
              </div>
            ))}
          </div>
        </main>

        <aside className="shrink-0 border-t border-line bg-surface lg:w-88 lg:border-l lg:border-t-0">
          <div className="flex items-center gap-3 px-5 py-4">
            <Skeleton.Icon size="h-9 w-9" />
            <div className="flex-1">
              <Skeleton.Text className="w-32" />
              <Skeleton.Text size="xs" className="w-20" />
            </div>
          </div>
          <div className="space-y-4 px-5 pb-5">
            {[0, 1].map((i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton.Text className="w-20" />
                <Skeleton className="h-15.5 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default ReportTypeEditorSkeleton;
