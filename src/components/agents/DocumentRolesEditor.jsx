// src/components/agents/DocumentRolesEditor.jsx
//
// Which agents may use one knowledge-base document. PATCH neither re-parses
// nor re-embeds the file, so saving is instant and the row updates
// optimistically, rolling back if the request fails.
//
// The cell shows the assignment as stored, marking any agent code that no
// longer points at an agent able to read the document (`stale_roles`) — the
// agent was deleted, deactivated, or can't consult the knowledge base any
// more — so a stale
// assignment is visible on the row, not only in the banner above.
//
// This opens a small modal rather than a popover: the desktop table renders
// inside an `overflow-x-auto` wrapper, which would clip an absolutely
// positioned panel.
import { useEffect, useState } from 'react';
import { Pencil, Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import AgentAssignmentPicker, { DEFAULT_SENTINEL, isAllAgents } from './AgentAssignmentPicker';

const DocumentRolesEditor = ({ doc, agents = [], sentinel = DEFAULT_SENTINEL, onSave, disabled = false }) => {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(doc.roles || []);

  const stored = doc.roles || [];
  const stale = new Set(doc.stale_roles || []);
  const nameOf = (code) => agents.find((agent) => agent.code === code)?.name || code;
  const allAgents = doc.assigned_to_all ?? isAllAgents(stored, sentinel);

  // Start each edit from what the document currently has, not from whatever
  // the last cancelled edit left behind.
  useEffect(() => {
    if (open) setDraft(doc.roles || []);
  }, [open, doc.roles]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-label={`Change which agents can use ${doc.filename}`}
        className="group inline-flex max-w-full items-center gap-1.5 rounded-lg border border-transparent px-1.5 py-1 text-left transition-colors hover:border-line hover:bg-hover disabled:cursor-default focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <span className="flex flex-wrap gap-1">
          {allAgents ? (
            <Badge variant="secondary" size="small">
              All agents
            </Badge>
          ) : stored.length === 0 ? (
            <span className="text-xs text-ink-subtle">No agents</span>
          ) : (
            stored.map((code) =>
              stale.has(code) ? (
                <Badge
                  key={code}
                  variant="warning"
                  size="small"
                  className="line-through"
                  title="This agent no longer exists or can no longer consult the knowledge base, so it can't use this document."
                >
                  {nameOf(code)}
                </Badge>
              ) : (
                <Badge key={code} variant="secondary" size="small">
                  {nameOf(code)}
                </Badge>
              ),
            )
          )}
        </span>
        {!disabled && (
          <Pencil className="h-3 w-3 shrink-0 text-ink-subtle opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
        )}
      </button>

      <Modal
        isOpen={open}
        onClose={() => !saving && setOpen(false)}
        title="Agents allowed to use this document"
        size="sm"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} isLoading={saving}>
              Save
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="truncate text-sm font-medium text-ink" title={doc.filename}>
            {doc.filename}
          </p>

          <AgentAssignmentPicker agents={agents} sentinel={sentinel} value={draft} onChange={setDraft} disabled={saving} />

          <p className="flex items-start gap-1.5 text-xs leading-relaxed text-ink-muted">
            {saving && <Loader2 className="mt-0.5 h-3 w-3 shrink-0 animate-spin" />}
            Takes effect immediately. The document is not re-read or re-indexed, so there
            is nothing to wait for.
          </p>
        </div>
      </Modal>
    </>
  );
};

export default DocumentRolesEditor;
