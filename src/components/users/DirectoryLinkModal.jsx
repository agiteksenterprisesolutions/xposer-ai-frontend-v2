// src/components/users/DirectoryLinkModal.jsx
//
// Which directory entry an account belongs to.
//
// Where someone sits in the hierarchy decides WHICH reports they see
// (report:read_subordinates resolves through it), and it comes from their
// role: each role sits at one level. So the level is shown here, read-only —
// to move someone, change their role; to move a whole role, edit the role.
//
// The link is `hierarchy_member_id` (the member's external_id). New accounts
// are auto-matched on email; this corrects or removes that. An unlinked
// account holding report:read_subordinates sees only its own caseload.
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Trans, useTranslation } from 'react-i18next';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Alert from '../ui/Alert';
import MemberPicker from '../hierarchy/MemberPicker';
import { usersAPI } from '../../api';
import { orgHierarchyAPI } from '../../api/orgHierarchy';
import { useMemberNames } from '../../hooks/useMemberNames';
import { describeError } from '../../utils/errors';

const fieldClass =
  'w-full rounded-lg border border-line-strong bg-subtle px-3 py-2 text-sm text-ink outline-none focus:border-line-accent disabled:opacity-60';

const DirectoryLinkModal = ({ user, levels = [], onClose, onSaved }) => {
  const { t } = useTranslation('people');
  const displayName = user.full_name || user.username;
  const [memberId, setMemberId] = useState(user.hierarchy_member_id || '');
  // The entry chosen in the picker, or the one already linked, looked up by id.
  const [picked, setPicked] = useState(null);
  const { memberOf } = useMemberNames([user.hierarchy_member_id]);
  const member = picked?.external_id === memberId ? picked : memberOf(memberId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Suggest the entry whose email matches, as the server's auto-match would.
  const [emailMatch, setEmailMatch] = useState(null);
  useEffect(() => {
    if (!user.email || user.hierarchy_member_id) return undefined;
    let live = true;
    orgHierarchyAPI
      .listMembers({ search: user.email, pageSize: 5, quiet: true })
      .then(({ items }) => {
        const match = items.find((m) => m.email && m.email.toLowerCase() === user.email.toLowerCase());
        if (live) setEmailMatch(match || null);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [user.email, user.hierarchy_member_id]);

  const levelTitle = (code) => levels.find((l) => l.code === code)?.title || code;

  const pick = (externalId, entry = null) => {
    setMemberId(externalId);
    setPicked(entry);
  };

  const linkChanged = memberId !== (user.hierarchy_member_id || '');

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (linkChanged) await usersAPI.linkDirectoryEntry(user.id, memberId);
      toast.success(memberId ? t('dirLink.linked', { name: displayName, entry: member?.name || memberId }) : t('dirLink.unlinked', { name: displayName }));
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
      title={t('dirLink.title', { name: displayName })}
      size="md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t('common:actions.cancel')}
          </Button>
          <Button onClick={save} isLoading={saving} disabled={!linkChanged}>
            {t('common:actions.save')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-secondary">
          <Trans t={t} i18nKey="dirLink.intro" components={{ b: <span className="font-medium text-ink" /> }} />
        </p>

        <div>
          <label htmlFor="link-member" className="mb-1 block text-xs font-medium text-ink-secondary">
            {t('dirLink.entry')}
          </label>
          <MemberPicker
            id="link-member"
            value={memberId}
            onChange={pick}
            emptyLabel={t('dirLink.notLinked')}
            className={fieldClass}
          />
          {!memberId && emailMatch && (
            <button type="button" onClick={() => pick(emailMatch.external_id, emailMatch)} className="mt-1.5 text-xs font-medium text-link hover:underline">
              {t('dirLink.useMatch', { name: emailMatch.name })}
            </button>
          )}
        </div>

        {member && (
          <div>
            <p className="mb-1 text-xs font-medium text-ink-secondary">{t('dirLink.level')}</p>
            <p className="text-sm text-ink">
              {member.level_code ? levelTitle(member.level_code) : t('dirLink.notPlaced')}
            </p>
            <p className="mt-1 text-[11px] text-ink-subtle">
              {t('dirLink.levelHelp', { name: displayName })}
            </p>
          </div>
        )}

        {!memberId && (
          <Alert variant="warning">
            {t('dirLink.unlinkedWarning')}
          </Alert>
        )}

        {error && <Alert variant="error" title={error.summary} />}
      </div>
    </Modal>
  );
};

export default DirectoryLinkModal;
