// src/components/roles/PermissionPicker.jsx
//
// The permission checkbox tree, built from GET /org-roles/permissions. Shared
// by the roles editor and by agents given a custom permission set — the same
// catalog, grouping and prerequisite rules apply to both.
//
// A permission the signed-in user does not hold (`granted: false`) is locked:
// nobody can hand out access they don't have, and the save would 403.
import { useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Lock, Plus, XCircle } from 'lucide-react';
import { PERMISSION_HINTS, permissionLabel, permissionLabels } from '../../utils/permissions';

/** permission → catalog entry ({ permission, granted, requires_any_of }). */
export const catalogEntries = (catalog) =>
  new Map((catalog?.groups || []).flatMap((group) => group.permissions.map((entry) => [entry.permission, entry])));

/**
 * Prerequisites the catalog already shows are missing, for instant feedback
 * while boxes are ticked. `requires_any_of` means at least one of, never all.
 */
export const localPrerequisiteErrors = (selected, entries) => {
  const errors = new Map();
  selected.forEach((permission) => {
    const requires = entries.get(permission)?.requires_any_of || [];
    if (requires.length && !requires.some((p) => selected.has(p))) {
      errors.set(permission, { requires, message: `Needs ${permissionLabels(requires)} as well.` });
    }
  });
  return errors;
};

export const Checkbox = ({ checked, disabled, onChange, labelledBy, title }) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={checked}
    aria-labelledby={labelledBy}
    disabled={disabled}
    onClick={onChange}
    title={title}
    className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50 ${
      checked ? 'border-accent bg-accent text-on-accent' : 'border-line-strong bg-surface'
    }`}
  >
    {checked && <Check className="h-3 w-3" strokeWidth={3} />}
  </button>
);

const PermissionOption = ({ entry, checked, readOnly, error, warning, fixes, onToggle, onFix, hint }) => {
  const { permission, granted } = entry;
  const locked = !granted;
  const id = `perm-${permission.replace(/[^a-z0-9]/g, '-')}`;

  return (
    <div
      className={`rounded-lg border px-3 py-2.5 ${
        error ? 'border-danger-line bg-danger-soft' : checked ? 'border-line-accent bg-accent-soft' : 'border-line bg-surface'
      }`}
      title={locked && !readOnly ? "You can't grant a permission you don't hold yourself." : undefined}
    >
      <div className="flex items-start gap-3">
        <Checkbox checked={checked} disabled={readOnly || locked} onChange={onToggle} labelledBy={id} />
        <div className="min-w-0 flex-1">
          <p id={id} className="flex items-center gap-1.5 text-sm font-medium text-ink">
            {permissionLabel(permission)}
            {locked && !readOnly && <Lock className="h-3 w-3 shrink-0 text-ink-subtle" aria-label="Not grantable by you" />}
          </p>
          {hint && <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>}

          {error && (
            <div className="mt-2 space-y-2">
              <p className="flex items-start gap-1.5 text-xs text-danger-fg">
                <XCircle className="mt-px h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </p>
              {fixes.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {fixes.map((fix) => (
                    <button
                      key={fix}
                      type="button"
                      onClick={() => onFix(fix)}
                      className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] text-ink-secondary transition-colors hover:border-line-accent hover:text-accent-fg"
                    >
                      <Plus className="h-3 w-3" />
                      {permissionLabel(fix)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {!error && warning && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-warning-fg">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              <span>{warning}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const PermissionGroup = ({ group, children, selectedCount }) => {
  const [open, setOpen] = useState(true);
  return (
    <section className="rounded-xl border border-line">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left transition-colors hover:bg-hover"
      >
        <span className="text-sm font-semibold text-ink">{group.label}</span>
        <span className="flex items-center gap-2">
          <span className="text-xs text-ink-subtle">
            {selectedCount} of {group.permissions.length}
          </span>
          <ChevronDown className={`h-4 w-4 text-ink-subtle transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && <div className="grid gap-2 px-3 pb-3 sm:grid-cols-2">{children}</div>}
    </section>
  );
};

/**
 * Props:
 *   catalog            – GET /org-roles/permissions
 *   selected           – Set of permission strings
 *   onToggle(p)        – tick or untick one
 *   onAdd(p)           – tick one (the quick-fix buttons under an error)
 *   errorsByPermission – Map permission → { message, requires }
 *   warningsByPermission – Map permission → message
 *   hints              – permission → explanation, over PERMISSION_HINTS (an
 *                        agent's set explains some permissions differently)
 *   readOnly
 */
const PermissionPicker = ({
  catalog,
  selected,
  onToggle,
  onAdd,
  errorsByPermission = new Map(),
  warningsByPermission = new Map(),
  hints = {},
  readOnly = false,
}) => {
  const entries = catalogEntries(catalog);

  return (
    <div className="space-y-3">
      {(catalog?.groups || []).map((group) => (
        <PermissionGroup
          key={group.key}
          group={group}
          selectedCount={group.permissions.filter((entry) => selected.has(entry.permission)).length}
        >
          {group.permissions.map((entry) => {
            const error = errorsByPermission.get(entry.permission);
            return (
              <PermissionOption
                key={entry.permission}
                entry={entry}
                checked={selected.has(entry.permission)}
                readOnly={readOnly}
                error={error?.message}
                warning={warningsByPermission.get(entry.permission)}
                fixes={(error?.requires || []).filter((p) => entries.get(p)?.granted && !selected.has(p))}
                onToggle={() => onToggle(entry.permission)}
                onFix={onAdd}
                hint={hints[entry.permission] ?? PERMISSION_HINTS[entry.permission]}
              />
            );
          })}
        </PermissionGroup>
      ))}
    </div>
  );
};

export default PermissionPicker;
