// src/components/hierarchy/HierarchySkeleton.jsx
//
// The open Reporting Hierarchy tab while the hierarchy loads, shaped like that
// tab's panel so nothing jumps when the data arrives.
import { Layers, Users, CheckCircle2, Search } from 'lucide-react';
import Card from '../ui/Card';
import Skeleton from '../ui/Skeleton';
import Table, { TableLoading } from '../ui/Table';
import { EscalationSkeleton } from './EscalationPanel';
import { SyncSkeleton } from './SyncPanel';

const Coverage = () => (
  <div className="space-y-6">
    <div className="rounded-xl border border-line bg-surface p-4">
      <Skeleton.Text className="w-56" />
      <Skeleton.Text className="w-96 max-w-full" />
    </div>
    <div className="rounded-xl border border-line bg-surface p-5">
      <Skeleton.Text size="base" className="mb-3 w-40" />
      <div className="space-y-2">
        <Skeleton.Text className="w-3/4" />
        <Skeleton.Text className="w-2/3" />
      </div>
    </div>
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {[
        [Layers, 'Levels'],
        [Users, 'People'],
        [Users, 'Added by hand'],
        [CheckCircle2, 'Corrected from HR'],
      ].map(([Icon, label]) => (
        <div key={label} className="rounded-xl border border-line bg-surface p-4">
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <Icon className="h-4 w-4" />
            {label}
          </div>
          <Skeleton.Text size="2xl" className="mt-1 w-10" />
        </div>
      ))}
    </div>
  </div>
);

const Chart = () => (
  <div className="space-y-3">
    <Skeleton.Text size="xs" className="w-48" />
    <div className="relative h-[calc(100dvh-17rem)] min-h-[520px] overflow-hidden rounded-xl border border-line bg-canvas">
      <div className="flex h-full flex-col items-center justify-center gap-10">
        <Skeleton className="h-16 w-56 rounded-xl" />
        <div className="flex gap-8">
          <Skeleton className="h-16 w-56 rounded-xl" />
          <Skeleton className="h-16 w-56 rounded-xl" />
        </div>
      </div>
    </div>
  </div>
);

const Levels = ({ canManage }) => (
  <div className="space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-ink-muted">Most senior first. A report escalates up this ladder.</p>
      {canManage && <Skeleton.Button className="w-28" />}
    </div>
    <Card padding="none">
      <ul className="divide-y divide-line-subtle">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="flex items-center gap-4 px-5 py-4">
            <Skeleton.Icon size="h-9 w-9" />
            <div className="flex-1">
              <Skeleton.Text className="w-40" />
              <Skeleton.Text size="xs" className="w-56" />
            </div>
            <Skeleton.Badge className="w-16" />
          </li>
        ))}
      </ul>
    </Card>
  </div>
);

const Directory = ({ canManage }) => (
  <div className="space-y-4">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
          <div className="h-9 w-full rounded-lg border border-line bg-subtle" />
        </div>
        <div className="h-9 rounded-lg border border-line bg-subtle sm:w-52" />
      </div>
      {canManage && (
        <div className="flex gap-2">
          <Skeleton.Button className="w-48" />
          <Skeleton.Button className="w-32" />
        </div>
      )}
    </div>
    <Card padding="none">
      <Table>
        <Table.Header>
          <Table.Row hover={false}>
            <Table.Head>Person</Table.Head>
            <Table.Head>Job title</Table.Head>
            <Table.Head>Level</Table.Head>
            <Table.Head>Manager</Table.Head>
            <Table.Head>Source</Table.Head>
            {canManage && <Table.Head className="text-right">Actions</Table.Head>}
          </Table.Row>
        </Table.Header>
        <Table.Body>
          <TableLoading
            rows={6}
            cells={[
              <div key="p">
                <Skeleton.Text className="w-32" />
                <Skeleton.Text size="xs" className="w-40" />
              </div>,
              <Skeleton.Text key="t" className="w-28" />,
              <Skeleton.Badge key="l" className="w-20" />,
              <Skeleton.Text key="m" className="w-24" />,
              <Skeleton.Badge key="s" className="w-12" />,
              ...(canManage ? [<Skeleton key="a" className="ml-auto h-8 w-16 rounded-lg" />] : []),
            ]}
          />
        </Table.Body>
      </Table>
    </Card>
  </div>
);

/** A generic panel: a card of lines, for tabs that load their own data. */
const Panel = () => (
  <div className="space-y-5">
    <div className="rounded-xl border border-line bg-surface p-6">
      <Skeleton.Text size="base" className="w-56" />
      <Skeleton.Text className="mt-1 w-96 max-w-full" />
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    </div>
    <div className="h-64 rounded-xl border border-line bg-surface p-6">
      <Skeleton.Text size="base" className="w-32" />
    </div>
  </div>
);

const HierarchySkeleton = ({ tab, canManage }) => {
  switch (tab) {
    case 'chart':
      return <Chart />;
    case 'levels':
      return <Levels canManage={canManage} />;
    case 'directory':
      return <Directory canManage={canManage} />;
    case 'coverage':
      return <Coverage />;
    case 'escalation':
      return <EscalationSkeleton />;
    case 'hr':
      return <SyncSkeleton />;
    default:
      return <Panel />;
  }
};

export default HierarchySkeleton;
