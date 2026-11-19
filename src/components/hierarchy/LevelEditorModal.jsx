// src/components/hierarchy/LevelEditorModal.jsx
//
// Create or edit one rung of the reporting hierarchy.
//
// Which roles sit at a level is not edited here: a level is a property of the
// role, so `roles` is derived from where the roles are placed and shown
// read-only, each linking to the role it is changed on.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Alert from '../ui/Alert';
import TagInput from '../ui/TagInput';
import { Checkbox } from '../roles/PermissionPicker';
import { orgHierarchyAPI } from '../../api/orgHierarchy';
import { useOrgRoles } from '../../hooks/useOrgRoles';
import { useAuthStore } from '../../store/authStore';
import { staffPath } from '../../utils/navigation';
import { codeHint, CODE_PATTERN, suggestCode } from '../../utils/codes';
import { describeError } from '../../utils/errors';

/**
 * Props:
 *   level       – the level to edit; omit to create one
 *   defaultRank – suggested rank for a new level
 *   readOnly, onClose, onSaved
 */
const LevelEditorModal = ({ level = null, defaultRank = 10, readOnly = false, onClose, onSaved }) => {
  const { t } = useTranslation('hierarchy');
  const isCreate = !level;
  const { allRoles, nameFor } = useOrgRoles();
  const orgSlug = useAuthStore((state) => state.user?.organization_slug);
  // Derived on the server; for a level not yet saved, nothing sits there.
  const levelRoles = Array.isArray(level?.roles)
    ? level.roles
    : allRoles.filter((role) => level && role.level_code === level.code).map((role) => role.code);

  const [title, setTitle] = useState(level?.title || '');
  const [code, setCode] = useState(level?.code || '');
  const [codeTouched, setCodeTouched] = useState(false);
  const [rank, setRank] = useState(String(level?.rank ?? defaultRank));
  const [department, setDepartment] = useState(level?.department || '');
  const [aliases, setAliases] = useState(level?.designation_aliases || []);
  const [receivesEscalations, setReceivesEscalations] = useState(level?.can_receive_escalations ?? true);
  const [isActive, setIsActive] = useState(level?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isCreate && !codeTouched) setCode(suggestCode(title, 'level'));
  }, [title, isCreate, codeTouched]);

  const rankNumber = Number(rank);
  const rankError = rank === '' || !Number.isInteger(rankNumber) ? t('levelEditor.rankError') : null;
  const codeError = isCreate ? (!code ? t('levelEditor.codeRequired') : !CODE_PATTERN.test(code) ? codeHint() : null) : null;
  const blocked = !title.trim() || Boolean(rankError) || Boolean(codeError);

  const save = async () => {
    if (blocked || saving) return;
    setSaving(true);
    setError(null);
    const body = {
      title: title.trim(),
      rank: rankNumber,
      department: department.trim() || null,
      designation_aliases: aliases,
      can_receive_escalations: receivesEscalations,
    };
    try {
      const saved = isCreate
        ? await orgHierarchyAPI.createLevel({ ...body, code })
        : await orgHierarchyAPI.updateLevel(level.id, { ...body, is_active: isActive });
      toast.success(isCreate ? t('levelEditor.added', { title: body.title }) : t('levelEditor.saved', { title: body.title }));
      onSaved?.(saved);
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
      title={isCreate ? t('levelEditor.newTitle') : readOnly ? level.title : t('levelEditor.editTitle', { title: level.title })}
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
            <Button onClick={save} isLoading={saving} disabled={blocked}>
              {isCreate ? t('levelEditor.add') : t('levelEditor.save')}
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-5">
        {error && (
          <Alert variant="error" title={error.summary}>
            {error.problems.length > 0 && (
              <ul className="list-disc space-y-1 ps-4">
                {error.problems.map((problem, index) => (
                  <li key={index}>{problem.message}</li>
                ))}
              </ul>
            )}
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t('levelEditor.title')}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            readOnly={readOnly}
            placeholder={t('levelEditor.titlePlaceholder')}
          />
          <Input
            label={t('levelEditor.code')}
            value={code}
            onChange={(event) => {
              setCodeTouched(true);
              setCode(event.target.value);
            }}
            readOnly={!isCreate || readOnly}
            required={isCreate}
            error={codeError}
            className="font-mono"
            helperText={isCreate ? t('levelEditor.codeHelpNew') : t('levelEditor.codeHelpFixed')}
          />
          <Input
            label={t('levelEditor.rank')}
            type="number"
            step="1"
            value={rank}
            onChange={(event) => setRank(event.target.value)}
            readOnly={readOnly}
            error={rankError}
            helperText={t('levelEditor.rankHelp')}
          />
          <Input
            label={t('levelEditor.department')}
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
            readOnly={readOnly}
            placeholder={t('levelEditor.departmentPlaceholder')}
            helperText={t('levelEditor.departmentHelp')}
          />
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-medium text-ink">{t('levelEditor.aliasesTitle')}</p>
          <p className="text-xs text-ink-muted">
            {t('levelEditor.aliasesHelp')}
          </p>
          <TagInput
            value={aliases}
            onChange={setAliases}
            readOnly={readOnly}
            placeholder={t('levelEditor.aliasesPlaceholder')}
            emptyText={t('levelEditor.aliasesEmpty')}
            ariaLabel={t('levelEditor.aliasesLabel')}
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-ink">{t('levelEditor.rolesTitle')}</p>
          {levelRoles.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {levelRoles.map((code) => (
                <Link
                  key={code}
                  to={`${staffPath(orgSlug, 'roles')}?role=${encodeURIComponent(code)}`}
                  className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 text-sm text-ink-secondary transition-colors hover:border-line-accent hover:text-accent-fg"
                  title={t('levelEditor.openRole', { role: nameFor(code) })}
                >
                  {nameFor(code)}
                  <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-muted">{isCreate ? t('levelEditor.noneYet') : t('levelEditor.noRoleYet')}</p>
          )}
          <p className="text-xs text-ink-muted">
            {t('levelEditor.rolesHelp')}
          </p>
        </div>

        <label className="flex items-start gap-3">
          <Checkbox
            checked={!receivesEscalations}
            disabled={readOnly}
            onChange={() => setReceivesEscalations((value) => !value)}
            labelledBy="level-no-escalation-label"
          />
          <span>
            <span id="level-no-escalation-label" className="block text-sm font-medium text-ink">
              {t('levelChart.notTarget')}
            </span>
            <span className="block text-xs text-ink-muted">
              {t('levelEditor.notTargetHelp')}
            </span>
          </span>
        </label>

        {!isCreate && (
          <label className="flex items-start gap-3">
            <Checkbox
              checked={isActive}
              disabled={readOnly}
              onChange={() => setIsActive((value) => !value)}
              labelledBy="level-active-label"
            />
            <span>
              <span id="level-active-label" className="block text-sm font-medium text-ink">
                {t('levelEditor.active')}
              </span>
              <span className="block text-xs text-ink-muted">{t('levelEditor.activeHelp')}</span>
            </span>
          </label>
        )}
      </div>
    </Modal>
  );
};

export default LevelEditorModal;
