// src/components/forms/ReportTypeBuilderSkeleton.jsx
//
// ReportTypeBuilder while its report type loads: the same top bar, sidebar
// and section list (edit), or the same preview card (view), with the data
// stubbed — so nothing moves when the type arrives.
import { Eye, FileText, Landmark, LayoutTemplate, Plus, Sparkles } from 'lucide-react';
import Skeleton from '../ui/Skeleton';

const Field = ({ tall = false }) => (
  <Skeleton className={`w-full rounded-lg ${tall ? 'h-24' : 'h-13'}`} />
);

const ReportTypeBuilderSkeleton = ({ mode = 'edit' }) => {
  const view = mode === 'view';
  return (
    <div className="min-h-screen bg-subtle pb-20" aria-busy="true">
      <div className="sticky top-0 z-50 bg-surface border-b border-line shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-2 h-auto py-2 sm:h-16 sm:py-0 flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-accent flex items-center justify-center shadow-glow shrink-0">
                <FileText className="w-5 h-5 text-on-accent" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-xl font-bold text-ink truncate">
                  {view ? 'View Report Type' : 'Edit Report Type'}
                </h1>
                <Skeleton.Text size="xs" className="hidden w-48 sm:flex" />
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 ml-auto">
              {view ? (
                <>
                  <span className="px-3 sm:px-4 py-2 text-sm font-medium text-ink-secondary">Back</span>
                  <Skeleton className="h-9 w-36 rounded-lg" />
                </>
              ) : (
                <>
                  <div className="flex bg-active rounded-lg p-1">
                    <span className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-md text-sm font-medium bg-surface text-ink shadow-sm">
                      <LayoutTemplate className="w-4 h-4" />
                      <span className="hidden sm:inline">Builder</span>
                    </span>
                    <span className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-md text-sm font-medium text-ink-muted">
                      <Eye className="w-4 h-4" />
                      <span className="hidden sm:inline">Preview</span>
                    </span>
                  </div>
                  <div className="h-6 w-px bg-active hidden sm:block" />
                  <span className="px-3 sm:px-4 py-2 text-sm font-medium text-ink-secondary">Cancel</span>
                  <Skeleton className="h-9 w-32 rounded-lg" />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        {view ? (
          <div className="max-w-3xl mx-auto">
            <div className="bg-surface rounded-2xl shadow-xl border border-line overflow-hidden">
              <div className="bg-sunken px-4 sm:px-8 py-4 sm:py-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <Skeleton.Text size="xl" className="w-2/3" />
                    <Skeleton.Text className="mt-1 w-1/2" />
                  </div>
                  <Skeleton className="h-9 w-20 rounded-lg" />
                </div>
              </div>
              <div className="p-4 sm:p-8 space-y-6 sm:space-y-8">
                {[3, 2].map((count, sectionIndex) => (
                  <div key={sectionIndex}>
                    <div className="mb-6">
                      <div className="flex items-center gap-3 mb-2">
                        <Skeleton.Circle size="h-8 w-8" />
                        <Skeleton.Text size="lg" className="w-48" />
                      </div>
                      <Skeleton.Text className="ml-11 w-56" />
                    </div>
                    <div className="space-y-5 ml-11">
                      {Array.from({ length: count }).map((_, index) => (
                        <div key={index} className="space-y-2">
                          <Skeleton.Text className="w-44" />
                          <Skeleton className="h-10 w-full rounded-lg" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 xl:col-span-3 space-y-6">
              <div className="bg-surface rounded-xl shadow-sm border border-line p-6">
                <div className="flex items-center gap-2 mb-5">
                  <Sparkles className="w-5 h-5 text-warning-fg" />
                  <h3 className="font-bold text-ink">Basic Settings</h3>
                </div>
                <div className="space-y-5">
                  <Field />
                  <Field tall />
                  <div className="pt-4 border-t border-line-subtle">
                    <div className="flex items-center gap-3 p-3">
                      <Skeleton.Icon size="h-10 w-10" />
                      <div className="flex-1 space-y-0.5">
                        <Skeleton.Text className="w-20" />
                        <Skeleton.Text size="xs" className="w-16" />
                      </div>
                      <Skeleton className="h-6 w-12 rounded-full" />
                    </div>
                  </div>
                  <div className="pt-4 border-t border-line-subtle flex items-center justify-between">
                    <Skeleton.Text className="w-32" />
                    <Skeleton className="h-6 w-11 rounded-full" />
                  </div>
                </div>
              </div>
              <div className="bg-surface rounded-xl shadow-sm border border-line p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Landmark className="w-5 h-5 text-info-fg" />
                  <h3 className="font-bold text-ink">Governance</h3>
                </div>
                <div className="space-y-4">
                  <Skeleton className="h-24 w-full rounded-lg" />
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i}>
                      <Skeleton.Text size="xs" className="mb-1 w-24" />
                      <Skeleton className="h-9 w-full rounded-lg" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-8 xl:col-span-9">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-ink">Form Sections</h2>
                  <p className="text-sm text-ink-muted">Organize your form into logical steps</p>
                </div>
                <span className="flex items-center gap-2 px-4 py-2.5 bg-sunken text-ink text-sm font-medium rounded-lg shadow-md">
                  <Plus className="w-4 h-4" />
                  Add Section
                </span>
              </div>
              <div className="space-y-6">
                {[0, 1].map((i) => (
                  <div key={i} className="rounded-2xl border-2 border-line bg-surface px-4 sm:px-6 py-4 sm:py-5 shadow-sm">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-12 w-12 rounded-xl" />
                      <div className="flex-1">
                        <Skeleton.Text size="lg" className="w-48" />
                        <Skeleton.Text className="mt-1 w-40" />
                      </div>
                      <Skeleton className="h-9 w-9 rounded-lg" />
                    </div>
                  </div>
                ))}
                <div className="w-full py-4 border-2 border-dashed border-line-strong rounded-2xl text-ink-muted flex items-center justify-center gap-2 font-medium">
                  <Plus className="w-5 h-5" />
                  Add Another Section
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportTypeBuilderSkeleton;
