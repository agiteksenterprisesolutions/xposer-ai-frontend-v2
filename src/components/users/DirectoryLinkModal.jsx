// src/components/users/DirectoryLinkModal.jsx
//
// Which directory entry an account belongs to, and that person's level.
//
// Level and role are independent: level is where someone sits and decides
// WHICH reports they see (report:read_subordinates resolves through it); role
// is what they can DO. So this is its own screen, not part of the role picker.
//
// The link is `hierarchy_member_id` (the member's external_id). New accounts
// are auto-matched on email; this corrects or removes that. An unlinked
// account holding report:read_subordinates sees only its own caseload.
import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import { usersAPI } from '../../api';
import { orgHierarchyAPI } from '../../api/orgHierarchy';
import { describeError } from '../../utils/errors';

const fieldClass =
  'w-full rounded-lg border border-line-strong bg-subtle px-3 py-2 text-sm text-ink outline-none focus:border-line-accent disabled:opacity-60';

const DirectoryLinkModal = ({ user, members = [], levels = [], canEditLevel = false, onClose, onSaved }) => {
  const displayName = user.full_name || user.username;
  const [memberId, setMemberId] = useState(user.hierarchy_member_id || '');
  const member = members.find((m) => m.external_id === memberId) || null;
  const [levelCode, setLevelCode] = useState(member?.level_code || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Suggest the entry whose email matches, as the server's auto-match would.
  const emailMatch = useMemo(
    () =>
      user.email ? members.find((m) => m.email && m.email.toLowerCase() === user.email.toLowerCase()) : null,
    [members, user.email],
  );

  const sortedMembers = useMemo(() => [...members].sort((a, b) => (a.name || '').localeCompare(b.name || '')), [members]);
  const levelTitle = (code) => levels.find((l) => l.code === code)?.title || code;

  const pick = (externalId) => {
    setMemberId(externalId);
    setLevelCode(members.find((m) => m.external_id === externalId)?.level_code || '');
  };

  const linkChanged = memberId !== (user.hierarchy_member_id || '');
  const levelChanged = Boolean(member) && levelCode !== (member.level_code || '');

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (linkChanged) await usersAPI.linkDirectoryEntry(user.id, memberId);
      if (levelChanged) await orgHierarchyAPI.updateMember(member.id, { level_code: levelCode || null });
      toast.success(memberId ? `${displayName} is linked to ${member?.name || memberId}.` : `${displayName} is unlinked.`);
      onSaved?.();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={saving ? () => {} : onClose}
      title={`Directory entry for ${displayName}`}
      size="md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} isLoading={saving} disabled={!linkChanged && !levelChanged}>
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-secondary">
          The directory entry decides <span className="font-medium text-ink">which</span> reports this person can see —
          their own team's, through the reporting tree. Their role decides what they can do with them.
        </p>

        <div>
          <label htmlFor="link-member" className="mb-1 block text-xs font-medium text-ink-secondary">
            Directory entry
          </label>
          <select id="link-member" value={memberId} onChange={(event) => pick(event.target.value)} className={fieldClass}>
            <option value="">Not linked</option>
            {sortedMembers.map((m) => (
              <option key={m.external_id} value={m.external_id}>
                {m.name}
                {m.designation ? ` — ${m.designation}` : ''}
                {m.email ? ` (${m.email})` : ''}
              </option>
            ))}
            {memberId && !member && <option value={memberId}>{memberId} (not in the directory)</option>}
          </select>
          {!memberId && emailMatch && (
            <button type="button" onClick={() => pick(emailMatch.external_id)} className="mt-1.5 text-xs font-medium text-link hover:underline">
              Use {emailMatch.name} — same email
            </button>
          )}
          {members.length === 0 && (
            <p className="mt-1.5 text-xs text-ink-muted">The directory is empty. Add people on the Reporting Hierarchy page.</p>
          )}
        </div>

        {member && (
          <div>
            <label htmlFor="link-level" className="mb-1 block text-xs font-medium text-ink-secondary">
              Level
            </label>
            {canEditLevel ? (
              <select id="link-level" value={levelCode} onChange={(event) => setLevelCode(event.target.value)} className={fieldClass}>
                <option value="">No level</option>
                {levels.map((level) => (
                  <option key={level.code} value={level.code}>
                    {level.title}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-ink">{member.level_code ? levelTitle(member.level_code) : 'No level'}</p>
            )}
            <p className="mt-1 text-[11px] text-ink-subtle">
              Changes {member.name}'s directory entry, which the org chart and escalation use too.
            </p>
          </div>
        )}

        {!memberId && (
          <Alert variant="warning">
            Unlinked, anyone allowed to see their team's reports sees only their own cases instead.
          </Alert>
        )}

        {error && <Alert variant="error" title={error.summary} />}
      </div>
    </Modal>
  );
};

export default DirectoryLinkModal;
