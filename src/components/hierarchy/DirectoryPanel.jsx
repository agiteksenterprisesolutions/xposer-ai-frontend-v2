// src/components/hierarchy/DirectoryPanel.jsx
//
// The people escalation resolves against.
//
// `level_code` and `manager_external_id` on each entry are already the
// effective values; the `*_from_hr` fields are shown only as provenance
// ("HR says …") where a human corrected them. Two badges carry different
// meanings and are kept apart:
//   source "manual"       — added by hand; untouched by every sync.
//   has_manual_override   — synced from HR, then corrected by a person.
import { useMemo, useState } from 'react';
import { Pencil, Plus, Search, Trash2, Upload, Users } from 'lucide-react';
import { toast } from 'react-toastify';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Card from '../ui/Card';
import Table from '../ui/Table';
import { ConfirmationModal } from '../ui/Modal';
import MemberEditorModal from './MemberEditorModal';
import AddPersonModal from '../users/AddPersonModal';
import { useCan } from '../../hooks/useCan';
import { PERM } from '../../utils/permissions';
import BulkImportModal from './BulkImportModal';
import { orgHierarchyAPI } from '../../api/orgHierarchy';
import { errorSummary } from '../../utils/errors';

const SourceBadge = ({ member }) =>
  member.source === 'manual' ? (
    <Badge variant="secondary" size="small" title="Added by hand. Every sync leaves this entry alone.">
      Added by hand
    </Badge>
  ) : (
    <Badge
      size="small"
      title="Your HR system owns this entry. If a later HR pull no longer includes this person, they are deactivated automatically. (Someone added by hand who later appears in HR switches to this badge and keeps their corrections.)"
    >
      From HR
    </Badge>
  );

const DirectoryPanel = ({ members, levels, canManage, onChanged }) => {
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState(null); // { member } — null member means add
  const [importing, setImporting] = useState(false);
  // Adding someone goes through the same form as Users → Add person, with its
  // "Create a login" switch, when the viewer may create users (POST
  // /users/person needs user:create). Without it, the directory-only form.
  const canCreateUsers = useCan()(PERM.userCreate);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);

  const levelTitle = useMemo(() => new Map(levels.map((l) => [l.code, l.title])), [levels]);
  const nameById = useMemo(() => new Map(members.map((m) => [m.external_id, m.name])), [members]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return members
      .filter((m) => showInactive || m.is_active !== false)
      .filter((m) => {
        if (!levelFilter) return true;
        if (levelFilter === '__none') return !m.level_code;
        return m.level_code === levelFilter;
      })
      .filter(
        (m) =>
          !term ||
          [m.name, m.email, m.designation, m.department, m.external_id].some((v) => (v || '').toLowerCase().includes(term)),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [members, search, levelFilter, showInactive]);

  const inactiveCount = members.filter((m) => m.is_active === false).length;

  const confirmRemove = async () => {
    setBusy(true);
    try {
      await orgHierarchyAPI.deleteMember(removing.id);
      toast.success(
        removing.source === 'manual' ? `${removing.name} removed.` : `${removing.name} deactivated.`,
      );
      setRemoving(null);
      onChanged();
    } catch (error) {
      toast.error(errorSummary(error));
    } finally {
      setBusy(false);
    }
  };

  const provenance = (member, field, format) => {
    if (!member.has_manual_override) return null;
    const hr = member[`${field}_from_hr`] ?? null;
    if (hr === (member[field] ?? null)) return null;
    return <p className="text-[11px] text-ink-subtle">HR says: {hr ? format(hr) : '(none)'}</p>;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email, title…"
              aria-label="Search the directory"
              className="w-full rounded-lg border border-line bg-subtle py-2 pl-9 pr-3 text-sm text-ink outline-none transition-colors hover:border-line-strong focus:border-line-accent focus:ring-2 focus:ring-accent-ring"
            />
          </div>
          <select
            value={levelFilter}
            onChange={(event) => setLevelFilter(event.target.value)}
            aria-label="Filter by level"
            className="rounded-lg border border-line bg-subtle px-3 py-2 text-sm text-ink sm:w-52"
          >
            <option value="">All levels</option>
            <option value="__none">No level</option>
            {levels.map((level) => (
              <option key={level.code} value={level.code}>
                {level.title}
              </option>
            ))}
          </select>
          {inactiveCount > 0 && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-secondary">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(event) => setShowInactive(event.target.checked)}
                className="h-4 w-4 rounded border-line-strong"
              />
              Inactive ({inactiveCount})
            </label>
          )}
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" startIcon={Upload} onClick={() => setImporting(true)}>
              Paste from spreadsheet
            </Button>
            <Button startIcon={Plus} onClick={() => (canCreateUsers ? setAdding(true) : setEditing({ member: null }))}>
              Add person
            </Button>
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
            {visible.length === 0 ? (
              <Table.Empty
                message={members.length === 0 ? 'No one in the directory yet' : 'No one matches'}
                description={
                  members.length === 0
                    ? 'Add people by hand, paste a spreadsheet, or connect your HR system.'
                    : 'Try a different search or level.'
                }
                icon={Users}
              />
            ) : (
              visible.map((member) => (
                <Table.Row key={member.id} className={member.is_active === false ? 'opacity-60' : ''}>
                  <Table.Cell>
                    <p className="text-sm font-medium text-ink">{member.name}</p>
                    <p className="text-xs text-ink-muted">{member.email || member.external_id}</p>
                  </Table.Cell>
                  <Table.Cell>
                    <p className="text-sm text-ink-secondary">{member.designation || '—'}</p>
                    {member.department && <p className="text-xs text-ink-subtle">{member.department}</p>}
                  </Table.Cell>
                  <Table.Cell>
                    {member.level_code ? (
                      <p className="text-sm text-ink">{levelTitle.get(member.level_code) || member.level_code}</p>
                    ) : (
                      <Badge variant="warning" size="small">No level</Badge>
                    )}
                    {provenance(member, 'level_code', (code) => levelTitle.get(code) || code)}
                  </Table.Cell>
                  <Table.Cell>
                    <p className="text-sm text-ink-secondary">
                      {member.manager_external_id ? nameById.get(member.manager_external_id) || member.manager_external_id : '—'}
                    </p>
                    {provenance(member, 'manager_external_id', (id) => nameById.get(id) || id)}
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex flex-wrap gap-1">
                      <SourceBadge member={member} />
                      {member.has_manual_override && (
                        <Badge variant="info" size="small" title="A person corrected what HR sent. The correction survives syncs.">
                          Corrected
                        </Badge>
                      )}
                      {member.is_active === false && <Badge variant="warning" size="small">Inactive</Badge>}
                    </div>
                  </Table.Cell>
                  {canManage && (
                    <Table.Cell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="small"
                          onClick={() => setEditing({ member })}
                          aria-label={`Edit ${member.name}`}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {member.is_active !== false && (
                          <Button
                            variant="ghost"
                            size="small"
                            onClick={() => setRemoving(member)}
                            aria-label={`${member.source === 'manual' ? 'Remove' : 'Deactivate'} ${member.name}`}
                            title={member.source === 'manual' ? 'Remove' : 'Deactivate'}
                          >
                            <Trash2 className="h-4 w-4 text-danger-fg" />
                          </Button>
                        )}
                      </div>
                    </Table.Cell>
                  )}
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table>
      </Card>

      {editing && (
        <MemberEditorModal
          member={editing.member}
          levels={levels.filter((l) => l.is_active !== false)}
          members={members}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      )}

      <AddPersonModal
        isOpen={adding}
        onClose={() => setAdding(false)}
        levels={levels.filter((l) => l.is_active !== false)}
        members={members}
        onAdded={() => onChanged()}
      />

      {importing && (
        <BulkImportModal
          onClose={() => setImporting(false)}
          onImported={() => {
            setImporting(false);
            onChanged();
          }}
        />
      )}

      <ConfirmationModal
        isOpen={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={confirmRemove}
        title={removing?.source === 'manual' ? 'Remove this person?' : 'Deactivate this person?'}
        message={
          removing?.source === 'manual'
            ? `${removing.name} was added by hand and will be removed from the directory permanently.`
            : removing
              ? `${removing.name} comes from your HR system, so they are deactivated rather than deleted — a real delete would be undone by the next sync. To remove them for good, remove them in HR.`
              : ''
        }
        confirmText={removing?.source === 'manual' ? 'Remove' : 'Deactivate'}
        destructive
        isLoading={busy}
      />
    </div>
  );
};

export default DirectoryPanel;
