// src/components/hierarchy/MemberEditorModal.jsx
//
// Add a person to the reporting directory by hand, or correct an entry.
//
// A person is placed in the chart by their ROLE: each role sits at one level,
// and `level_code` on the entry is resolved from it, read-only. Moving someone
// means changing their role; if the role itself is at the wrong level, that
// is an edit to the role and moves everyone holding it. Changing the role
// here also changes the role on every account linked to this entry.
//
// For a person who came from the HR sync, the manager set here is stored as a
// correction: the next sync refreshes the raw HR value around it without
// undoing the fix. Only changed fields are sent on an edit, so opening and
// saving an entry never turns an HR value into a correction.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'react-toastify';
import { Trans, useTranslation } from 'react-i18next';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Alert from '../ui/Alert';
import { orgHierarchyAPI } from '../../api/orgHierarchy';
import { describeError } from '../../utils/errors';
import { useOrgRoles } from '../../hooks/useOrgRoles';
import { useAuthStore } from '../../store/authStore';
import { staffPath } from '../../utils/navigation';
import { roleWithLevel, sortRolesByLevel } from '../../utils/roleLevels';
import { useMemberNames } from '../../hooks/useMemberNames';
import MemberPicker from './MemberPicker';

const selectClass =
  'w-full rounded-lg border border-line bg-subtle px-3 py-2.5 text-sm text-ink hover:border-line-strong disabled:opacity-60';

const FIELDS = ['name', 'email', 'designation', 'department', 'role_code', 'manager_external_id'];

/**
 * Props:
 *   member   – the entry to edit; omit to add one
 *   levels   – to name the level a role resolves to
 *   readOnly, onClose, onSaved
 */
const MemberEditorModal = ({ member = null, levels = [], readOnly = false, onClose, onSaved }) => {
  const { t } = useTranslation('hierarchy');
  const isCreate = !member;
  const fromHr = member?.source === 'hr_sync';

  const [form, setForm] = useState(() => ({
    external_id: member?.external_id || '',
    ...Object.fromEntries(FIELDS.map((field) => [field, member?.[field] || ''])),
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  // 400 role_has_no_level names the role: a one-field fix on the Roles screen.
  const [roleWithoutLevel, setRoleWithoutLevel] = useState(null);
  const { allRoles } = useOrgRoles();
  const roles = useMemo(() => sortRolesByLevel(allRoles.filter((r) => r.is_active !== false)), [allRoles]);
  const chosenRole = allRoles.find((r) => r.code === form.role_code);
  const orgSlug = useAuthStore((state) => state.user?.organization_slug);

  const set = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const levelTitle = (code) => levels.find((l) => l.code === code)?.title || code;
  // Where they will sit: the chosen role's level, else what the server resolved.
  const resolvedLevel = chosenRole ? chosenRole.level_title || (chosenRole.level_code && levelTitle(chosenRole.level_code)) : null;
  // Only the HR value needs a name of its own; the picker names its choice.
  const { nameOf } = useMemberNames([member?.manager_external_id_from_hr]);

  const save = async () => {
    if (!form.name.trim() || saving) return;
    setSaving(true);
    setError(null);
    setRoleWithoutLevel(null);
    try {
      let saved;
      if (isCreate) {
        const body = Object.fromEntries(
          ['external_id', ...FIELDS].map((field) => [field, form[field].trim() || null]),
        );
        saved = await orgHierarchyAPI.createMember(body);
        toast.success(t('member.added', { name: body.name }));
      } else {
        const changes = {};
        FIELDS.forEach((field) => {
          const next = form[field].trim();
          if (next !== (member[field] || '')) changes[field] = next || null;
        });
        if (Object.keys(changes).length === 0) {
          onClose();
          return;
        }
        saved = await orgHierarchyAPI.updateMember(member.id, changes);
        toast.success(t('member.updated', { name: form.name.trim() }));
      }
      onSaved?.(saved);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (detail?.code === 'role_has_no_level') setRoleWithoutLevel(detail.role_code || form.role_code);
      setError(describeError(err));
    } finally {
      setSaving(false);
    }
  };

  const hrNote = (field, value, format = (v) => v) =>
    fromHr && member.has_manual_override && (member[`${field}_from_hr`] ?? null) !== (member[field] ?? null) ? (
      <p className="mt-1 text-xs text-ink-muted">
        {t('member.hrSays')} <span className="font-medium">{value ? format(value) : t('member.none')}</span>
      </p>
    ) : null;

  return (
    <Modal
      isOpen
      onClose={saving ? () => {} : onClose}
      title={isCreate ? t('member.addTitle') : readOnly ? member.name : t('levelEditor.editTitle', { title: member.name })}
      size="large"
      closeOnOverlayClick={false}
      footer={
        readOnly ? (
          <div className="flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              {t('common:actions.close')}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              {t('common:actions.cancel')}
            </Button>
            <Button onClick={save} isLoading={saving} disabled={!form.name.trim()}>
              {isCreate ? t('member.add') : t('levelEditor.save')}
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-5">
        {fromHr && !readOnly && (
          <Alert variant="info" title={t('member.fromHrTitle')}>
            {t('member.fromHrBody')}
          </Alert>
        )}

        {error && (
          <Alert variant="error" title={error.summary}>
            {error.problems.length > 0 && (
              <ul className="list-disc space-y-1 ps-4">
                {error.problems.map((problem, index) => (
                  <li key={index}>{problem.message}</li>
                ))}
              </ul>
            )}
            {roleWithoutLevel && (
              <Link
                to={`${staffPath(orgSlug, 'roles')}?role=${encodeURIComponent(roleWithoutLevel)}`}
                className="mt-2 inline-block font-semibold underline underline-offset-2"
              >
                {t('member.giveRoleLevel')}
              </Link>
            )}
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t('member.fullName')}
            value={form.name}
            onChange={set('name')}
            required
            readOnly={readOnly}
            helperText={t('member.fullNameHelp')}
          />
          <Input
            label={t('member.employeeId')}
            value={form.external_id}
            onChange={set('external_id')}
            readOnly={!isCreate || readOnly}
            className="font-mono"
            helperText={isCreate ? t('member.employeeIdHelpNew') : t('member.employeeIdHelpFixed')}
          />
          <Input label={t('member.email')} type="email" value={form.email} onChange={set('email')} readOnly={readOnly} />
          <Input
            label={t('member.jobTitle')}
            value={form.designation}
            onChange={set('designation')}
            readOnly={readOnly}
            placeholder={t('member.jobTitlePlaceholder')}
          />
          <Input label={t('levelEditor.department')} value={form.department} onChange={set('department')} readOnly={readOnly} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="member-role" className="text-xs font-medium text-ink-secondary">
              {t('member.role')}
            </label>
            <select id="member-role" value={form.role_code} onChange={set('role_code')} disabled={readOnly} className={selectClass}>
              <option value="">{t('member.noRole')}</option>
              {roles.map((role) => (
                <option key={role.code} value={role.code}>
                  {roleWithLevel(role)}
                </option>
              ))}
              {form.role_code && !roles.some((r) => r.code === form.role_code) && (
                <option value={form.role_code}>{t('member.notFound', { code: form.role_code })}</option>
              )}
            </select>
            {form.role_code ? (
              resolvedLevel ? (
                <p className="text-xs text-ink-muted">
                  <Trans t={t} i18nKey="member.sitsAt" values={{ level: resolvedLevel }} components={{ b: <span className="font-medium text-ink" /> }} />
                </p>
              ) : (
                <p className="flex items-start gap-1.5 text-xs text-warning-fg">
                  <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {t('member.roleNoLevel')}
                </p>
              )
            ) : (
              <p className="flex items-start gap-1.5 text-xs text-warning-fg">
                <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {member?.level_from === 'legacy' && member?.level_code
                  ? t('member.legacyLevel', { level: levelTitle(member.level_code) })
                  : t('member.noRoleWarning')}
              </p>
            )}
            <p className="text-xs text-ink-subtle">
              {t('member.moveHelp')}
            </p>
            {!isCreate && (
              <p className="text-xs text-ink-subtle">{t('member.accountSameRole')}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="member-manager" className="text-xs font-medium text-ink-secondary">
              {t('member.directManager')}
            </label>
            <MemberPicker
              id="member-manager"
              value={form.manager_external_id}
              onChange={(id) => setForm((prev) => ({ ...prev, manager_external_id: id }))}
              excludeId={member?.external_id}
              disabled={readOnly}
              className={selectClass}
            />
            {hrNote('manager_external_id', member?.manager_external_id_from_hr, (id) => nameOf(id) || id)}
            <p className="text-xs text-ink-muted">
              {t('member.managerHelp')}
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default MemberEditorModal;
