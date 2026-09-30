// src/pages/admin/KnowledgeBase.jsx
//
// Organization policy documents the AI agents may quote. Uploading is
// asynchronous — the API answers 202 with everything "pending" and parsing
// plus embedding a PDF takes 20–40s — so the table polls until nothing is
// unsettled.
//
// Documents and each agent's instructions on the AI Agents page are
// independent and additive: either, both, or neither is a supported setup.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  UploadCloud,
  Trash2,
  Loader2,
  FileText,
  RefreshCw,
  X,
  AlertTriangle,
  Terminal,
} from 'lucide-react';
import { toast } from 'react-toastify';
import Card from '../../components/ui/Card';
import Table, { TableLoading } from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Alert from '../../components/ui/Alert';
import { ConfirmationModal } from '../../components/ui/Modal';
import AgentAssignmentPicker, { DEFAULT_SENTINEL } from '../../components/agents/AgentAssignmentPicker';
import DocumentRolesEditor from '../../components/agents/DocumentRolesEditor';
import ReconcileModal from '../../components/agents/ReconcileModal';
import { staffPath } from '../../utils/navigation';
import { errorSummary } from '../../utils/errors';
import { agentKbAPI } from '../../api';
import { useAuthStore } from '../../store/authStore';
import DashboardTour from '../../components/tour/DashboardTour';
import { useIsDesktop } from '../../components/tour/useIsDesktop';
import useSEO from '../../hooks/useSEO';
import { useCan } from '../../hooks/useCan';
import { PERM } from '../../utils/permissions';
import { formatFileSize, parseServerDate } from '../../utils/formatters';
import {
  KB_ACCEPT_ATTR,
  KB_ACCEPTED_EXTENSIONS,
  KB_MAX_DOCUMENTS_PER_ORG,
  KB_MAX_FILES_PER_REQUEST,
  getKbStatus,
  hasUnsettledDocuments,
  validateKbUpload,
  agentErrorMessage,
  isServiceUnavailable,
  AGENT_ORG_REQUIRED_MESSAGE,
} from '../../utils/agents';

const KNOWLEDGE_BASE_TOUR_KEY = 'xposer_knowledge_base_tour_seen';

// Fast enough to feel live, slow enough not to hammer the service while a
// batch of PDFs is being embedded.
const POLL_INTERVAL_MS = 4000;

const formatUploadedAt = (dateString) => {
  const date = parseServerDate(dateString);
  if (!date) return '—';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const StatusCell = ({ document: doc }) => {
  const status = getKbStatus(doc.status);

  return (
    <div className="space-y-1">
      <Badge variant={status.variant} size="small" dot={!status.spinner}>
        {status.spinner && <Loader2 className="h-3 w-3 animate-spin" />}
        {status.label}
      </Badge>
      {doc.status === 'failed' && doc.error && (
        // Shown verbatim: the backend's message is the only thing that tells
        // the admin whether to re-upload as .txt or fix the file itself.
        <p className="max-w-xs text-[11px] leading-snug text-danger-fg">{doc.error}</p>
      )}
    </div>
  );
};

const KnowledgeBase = () => {
  useSEO({
    title: 'Agent Knowledge Base',
    description: 'Upload the policy documents your AI agents may quote when handling reports.',
    noIndex: true,
  });

  const { user } = useAuthStore();
  // agent:read opens this page; uploading, reassigning and deleting documents
  // need agent:manage.
  const canManage = useCan()(PERM.agentManage);
  const isDesktop = useIsDesktop();
  const tourRef = useRef(null);
  const fileInputRef = useRef(null);
  const pollRef = useRef(null);

  // The agents documents can be assigned to — only active agents that can
  // actually consult the knowledge base — and the "every agent" sentinel.
  const [agents, setAgents] = useState([]);
  const [agentsLoaded, setAgentsLoaded] = useState(false);
  const [sentinel, setSentinel] = useState(DEFAULT_SENTINEL);
  const [reconciling, setReconciling] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [serviceError, setServiceError] = useState(null);

  const [pendingFiles, setPendingFiles] = useState([]);
  const [selectedRoles, setSelectedRoles] = useState([DEFAULT_SENTINEL]);
  const [validationErrors, setValidationErrors] = useState([]);
  const [isDragging, setIsDragging] = useState(false);

  const [documentToDelete, setDocumentToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Super admins have no organization, and every one of these endpoints is
  // org-scoped — the resulting 400 reads like a bug unless it is explained.
  const missingOrganization = !user?.organization_id;

  const fetchDocuments = useCallback(async ({ silent = false } = {}) => {
    if (missingOrganization) {
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const data = await agentKbAPI.listDocuments();
      setDocuments(Array.isArray(data) ? data : []);
      setServiceError(null);
    } catch (error) {
      console.error('Error fetching knowledge base documents:', error);
      // The interceptor already toasts; the panel explains what it means.
      if (isServiceUnavailable(error)) {
        setServiceError(agentErrorMessage(error, 'The AI agent service is not available right now.'));
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [missingOrganization]);

  // Agents come from the API, not a fixed list: an agent the organization
  // invents appears as soon as it can consult the knowledge base, and drops
  // out when it can't. New uploads default to every such agent.
  const loadAgents = useCallback(async () => {
    if (missingOrganization) return;
    try {
      const data = await agentKbAPI.listRoles();
      const list = Array.isArray(data?.agents)
        ? data.agents
        : (data?.roles || []).map((code) => ({ code, name: code }));
      setAgents(list);
      setSentinel(data?.all_agents_sentinel || DEFAULT_SENTINEL);
      setAgentsLoaded(true);
    } catch (error) {
      console.error('Error fetching knowledge base agents:', error);
      if (isServiceUnavailable(error)) {
        setServiceError(agentErrorMessage(error, 'The AI agent service is not available right now.'));
      }
    }
  }, [missingOrganization]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Poll only while something is still parsing or indexing, and stop as soon
  // as every document has settled on ready or failed.
  const isPolling = hasUnsettledDocuments(documents);
  useEffect(() => {
    if (!isPolling) return undefined;

    pollRef.current = setInterval(() => {
      fetchDocuments({ silent: true });
    }, POLL_INTERVAL_MS);

    return () => clearInterval(pollRef.current);
  }, [isPolling, fetchDocuments]);

  const addFiles = (incoming) => {
    const files = Array.from(incoming || []);
    if (files.length === 0) return;

    // De-duplicate by name + size so dropping the same file twice doesn't
    // spend one of the ten slots.
    setPendingFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}:${f.size}`));
      const merged = [...prev];
      files.forEach((file) => {
        const key = `${file.name}:${file.size}`;
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(file);
        }
      });
      return merged;
    });
    setValidationErrors([]);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    if (uploading || serviceError) return;
    addFiles(event.dataTransfer?.files);
  };

  const handleFileInput = (event) => {
    addFiles(event.target.files);
    // Reset so picking the same file again still fires onChange.
    event.target.value = '';
  };

  const removePendingFile = (index) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
    setValidationErrors([]);
  };

  const handleUpload = async () => {
    // The server validates the whole batch before storing anything, so a
    // rejection means none of the files were saved. Checking here first keeps
    // that round trip out of the way for the obvious cases.
    const errors = validateKbUpload(pendingFiles, documents.length);
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setUploading(true);
    setValidationErrors([]);
    try {
      const result = await agentKbAPI.uploadDocuments(pendingFiles, selectedRoles);
      toast.success(result?.message || `${pendingFiles.length} document(s) accepted for ingestion`);
      setPendingFiles([]);
      // 202 means "queued", not "indexed" — refresh so the new rows appear and
      // the poller picks them up.
      await fetchDocuments({ silent: true });
    } catch (error) {
      console.error('Error uploading knowledge base documents:', error);
      setValidationErrors([errorSummary(error) || 'Upload failed. Nothing was saved.']);
      // The usual 400 is "no agent can consult the knowledge base" — refresh
      // the agent list so the page shows that as its empty state.
      loadAgents();
    } finally {
      setUploading(false);
    }
  };

  const handleRolesChange = async (doc, nextRoles) => {
    const previous = doc.roles;
    // Optimistic: PATCH neither re-parses nor re-embeds, so it is quick, and
    // the checkbox should not feel like it lags.
    setDocuments((prev) =>
      prev.map((d) => (d.id === doc.id ? { ...d, roles: nextRoles } : d))
    );
    try {
      const updated = await agentKbAPI.updateDocumentRoles(doc.id, nextRoles);
      setDocuments((prev) => prev.map((d) => (d.id === doc.id ? { ...d, ...updated } : d)));
      // stale_roles / orphaned are derived server-side; re-read them.
      fetchDocuments({ silent: true });
    } catch (error) {
      console.error('Error updating document roles:', error);
      setDocuments((prev) =>
        prev.map((d) => (d.id === doc.id ? { ...d, roles: previous } : d))
      );
    }
  };

  const handleDelete = async () => {
    if (!documentToDelete) return;
    setDeleting(true);
    try {
      await agentKbAPI.deleteDocument(documentToDelete.id);
      setDocuments((prev) => prev.filter((d) => d.id !== documentToDelete.id));
      toast.success('Document deleted');
      setDocumentToDelete(null);
    } catch (error) {
      console.error('Error deleting document:', error);
    } finally {
      setDeleting(false);
    }
  };

  const readyCount = documents.filter((doc) => doc.status === 'ready').length;
  const remainingSlots = Math.max(KB_MAX_DOCUMENTS_PER_ORG - documents.length, 0);
  const noConsultingAgents = agentsLoaded && agents.length === 0;
  const uploadDisabled = Boolean(serviceError) || missingOrganization || noConsultingAgents;
  const staleCount = documents.filter((doc) => doc.stale_roles?.length > 0).length;
  const orphanedCount = documents.filter((doc) => doc.orphaned).length;

  const tourSteps = useMemo(() => {
    const steps = [];
    if (isDesktop) {
      steps.push({
        target: '[data-tour="sidebar-knowledge-base"]',
        title: 'Knowledge Base',
        content: 'Upload the policies your AI agents should quote when they handle a report.',
        placement: 'right',
        skipBeacon: true,
      });
    }

    steps.push(
      {
        target: '[data-tour="kb-upload"]',
        title: 'Add documents',
        content: 'Drop policy files here, choose which agents may read them, then upload. Parsing and indexing takes up to a minute.',
        placement: 'bottom',
        skipBeacon: !isDesktop,
      },
      {
        target: '[data-tour="kb-table"]',
        title: 'Your documents',
        content: 'Watch each document move from queued to ready. Change which agents can use it, or delete it, at any time.',
        placement: 'top',
      }
    );

    steps.push({
      target: '[data-tour="tour-user-menu"]',
      title: 'Your account',
      content: 'Manage your profile or log out from here.',
      placement: 'bottom',
    });

    return steps;
  }, [isDesktop]);

  if (missingOrganization) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Agent Knowledge Base</h1>
          <p className="text-sm text-ink-muted">Policy documents your AI agents may quote.</p>
        </div>
        <Alert variant="warning" title="No organization on this account">
          {AGENT_ORG_REQUIRED_MESSAGE}
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <DashboardTour ref={tourRef} storageKey={KNOWLEDGE_BASE_TOUR_KEY} steps={tourSteps} />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Agent Knowledge Base</h1>
          <p className="text-sm text-ink-muted">
            Policy documents your AI agents may quote when they triage and investigate reports.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            startIcon={RefreshCw}
            onClick={() => fetchDocuments()}
            isLoading={loading}
          >
            Refresh
          </Button>
        </div>
      </div>

      {serviceError && (
        <Alert variant="warning" title="AI knowledge base unavailable">
          {serviceError} Reports are still processed normally — the knowledge base is an
          enhancement, not a dependency.
        </Alert>
      )}

      {/* Instructions and documents are additive, and admins routinely assume
          it is one or the other. */}
      <Alert variant="info" title="Documents and instructions work together">
        <span className="block">
          Agents combine what you upload here with each agent's own instructions on the{' '}
          <Link to={`/${user?.organization_slug}/staff/agents`} className="text-link hover:underline">
            AI Agents
          </Link>{' '}
          page. With neither, agents work from the report alone and say so plainly. Where the
          two conflict, your instructions win.
        </span>
      </Alert>

      {!canManage && (
        <Alert variant="info" title="View only">
          Your role can see the knowledge base but not change it. Uploading, reassigning and deleting documents
          needs the agent:manage permission.
        </Alert>
      )}

      {noConsultingAgents && (
        <Alert variant="warning" title="No agent can consult the knowledge base yet">
          Documents are only useful once an agent can read them. Give an agent the "Consult the knowledge base"
          capability — and a role carrying agent:kb_read — then upload here.{' '}
          <Link to={staffPath(user?.organization_slug, 'agents')} className="font-medium text-link hover:underline">
            Open AI Agents →
          </Link>
        </Alert>
      )}

      {/* Upload panel */}
      {canManage && !noConsultingAgents && (
      <Card title="Upload documents" icon={UploadCloud} data-tour="kb-upload">
        <div className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (!uploadDisabled) setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => !uploadDisabled && fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !uploadDisabled) {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
              uploadDisabled
                ? 'cursor-not-allowed border-line-subtle opacity-60'
                : isDragging
                  ? 'cursor-pointer border-line-accent bg-accent-soft'
                  : 'cursor-pointer border-line hover:border-line-strong hover:bg-hover'
            }`}
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent-fg">
              <UploadCloud className="h-5 w-5" />
            </span>
            <p className="text-sm font-semibold text-ink">
              Drop files here, or click to browse
            </p>
            <p className="max-w-md text-xs text-ink-muted">
              Up to {KB_MAX_FILES_PER_REQUEST} files per upload, 10 MB each.{' '}
              {remainingSlots} of {KB_MAX_DOCUMENTS_PER_ORG} document slots remaining.
            </p>
            <p className="max-w-lg text-[11px] text-ink-subtle">
              {KB_ACCEPTED_EXTENSIONS.join('  ')}
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={KB_ACCEPT_ATTR}
            className="hidden"
            onChange={handleFileInput}
          />

          {pendingFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.04em] text-ink-subtle">
                Ready to upload ({pendingFiles.length})
              </p>
              <ul className="space-y-1.5">
                {pendingFiles.map((file, index) => (
                  <li
                    key={`${file.name}-${file.size}-${index}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-line-subtle bg-subtle px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-ink-subtle" />
                      <span className="truncate text-sm text-ink">{file.name}</span>
                      <span className="shrink-0 text-xs text-ink-subtle">
                        {formatFileSize(file.size)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removePendingFile(index)}
                      disabled={uploading}
                      aria-label={`Remove ${file.name}`}
                      className="shrink-0 rounded-md p-1 text-ink-subtle transition-colors hover:bg-hover hover:text-ink disabled:opacity-50"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.04em] text-ink-subtle">
              Agents allowed to use these documents
            </p>
            <AgentAssignmentPicker
              agents={agents}
              sentinel={sentinel}
              value={selectedRoles}
              onChange={setSelectedRoles}
              disabled={uploading || uploadDisabled}
            />
            <p className="mt-2 text-[11px] text-ink-muted">
              Only agents that can consult the knowledge base are listed. Keep "every agent" unless a policy is only
              relevant to some of them.
            </p>
          </div>

          {validationErrors.length > 0 && (
            <Alert variant="error" title="Nothing was uploaded">
              <ul className="list-disc space-y-1 pl-4">
                {validationErrors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </Alert>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-ink-subtle">
              Parsing and indexing a document takes 20–40 seconds. You can leave this page —
              ingestion continues on the server.
            </p>
            <Button
              startIcon={UploadCloud}
              onClick={handleUpload}
              isLoading={uploading}
              disabled={pendingFiles.length === 0 || uploadDisabled}
            >
              Upload {pendingFiles.length > 0 ? `${pendingFiles.length} file(s)` : 'documents'}
            </Button>
          </div>
        </div>
      </Card>
      )}

      {/* A document can index perfectly and still never be read: its agent was
          deleted, deactivated, lost consult_kb, or had agent:kb_read stripped
          from its role. Nothing failed, so nothing else would say so. */}
      {staleCount > 0 && (
        <Alert variant={orphanedCount > 0 ? 'error' : 'warning'} title="Some documents are assigned to agents that can't read them">
          <span className="block">
            {staleCount} document{staleCount === 1 ? '' : 's'} {staleCount === 1 ? 'is' : 'are'} assigned to agents that
            no longer exist or can no longer consult the knowledge base
            {orphanedCount > 0 && `, and ${orphanedCount} ${orphanedCount === 1 ? 'is' : 'are'} read by no agent at all`}.
          </span>
          {canManage && (
            <Button className="mt-3" variant="outline" size="small" onClick={() => setReconciling(true)}>
              Review and fix
            </Button>
          )}
        </Alert>
      )}

      {/* Document table */}
      <Card padding="none" data-tour="kb-table">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-subtle px-4 py-3 sm:px-5">
          <h3 className="text-base font-semibold tracking-[-0.01em] text-ink">Documents</h3>
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            {isPolling && (
              <span className="inline-flex items-center gap-1.5 text-accent-fg">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Indexing in progress
              </span>
            )}
            <span>
              {readyCount} ready · {documents.length} of {KB_MAX_DOCUMENTS_PER_ORG} used
            </span>
          </div>
        </div>

        <Table>
          <Table.Header>
            <Table.Row hover={false}>
              <Table.Head>Document</Table.Head>
              <Table.Head>Size</Table.Head>
              <Table.Head>Agents</Table.Head>
              <Table.Head>Status</Table.Head>
              <Table.Head>Chunks</Table.Head>
              <Table.Head>Uploaded</Table.Head>
              <Table.Head className="text-right">Actions</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {loading ? (
              <TableLoading colSpan={7} rows={4} />
            ) : documents.length === 0 ? (
              <Table.Empty
                message="No documents uploaded"
                description="Agents will work from the report and your written instructions alone."
                icon={BookOpen}
                action={
                  canManage && !uploadDisabled && (
                    <Button
                      variant="secondary"
                      startIcon={UploadCloud}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Upload your first policy
                    </Button>
                  )
                }
              />
            ) : (
              documents.map((doc) => (
                <Table.Row key={doc.id}>
                  <Table.Cell>
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-ink-subtle" />
                      <span className="truncate text-sm font-semibold text-ink">
                        {doc.filename}
                      </span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="whitespace-nowrap text-xs text-ink-muted">
                      {formatFileSize(doc.size || 0)}
                    </span>
                  </Table.Cell>
                  <Table.Cell>
                    <DocumentRolesEditor
                      doc={doc}
                      agents={agents}
                      sentinel={sentinel}
                      onSave={(nextRoles) => handleRolesChange(doc, nextRoles)}
                      disabled={Boolean(serviceError) || !canManage}
                    />
                  </Table.Cell>
                  <Table.Cell>
                    <StatusCell document={doc} />
                    {/* Separate from status on purpose: "ready" and orphaned can both be true. */}
                    {doc.orphaned && (
                      <Badge
                        variant="danger"
                        size="small"
                        className="mt-1"
                        title="Indexed fine, but no agent can retrieve it."
                      >
                        Orphaned — no agent reads it
                      </Badge>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm tabular-nums text-ink">
                        {doc.chunk_count ?? 0}
                      </span>
                      {/* A large file that produced almost nothing is usually a
                          scanned, image-only PDF. */}
                      {doc.status === 'ready' && doc.chunk_count <= 1 && (
                        <span
                          title="Very few searchable chunks — the file may be a scanned or image-only document."
                          className="text-warning-fg"
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <span className="whitespace-nowrap text-xs text-ink-muted">
                      {formatUploadedAt(doc.created_at)}
                    </span>
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    {canManage && (
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="small"
                          title="Delete document"
                          aria-label={`Delete ${doc.filename}`}
                          onClick={() => setDocumentToDelete(doc)}
                        >
                          <Trash2 className="h-4 w-4 text-danger-fg" />
                        </Button>
                      </div>
                    )}
                  </Table.Cell>
                </Table.Row>
              ))
            )}
          </Table.Body>
        </Table>
      </Card>

      {documents.some((doc) => doc.status === 'failed') && (
        <Alert variant="warning" title="Some documents could not be indexed" showIcon>
          <span className="flex items-start gap-2">
            <Terminal className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              A failed document is not used by any agent. If a PDF or Office file failed to
              parse, uploading a plain-text (.txt or .md) version of the same policy always
              works.
            </span>
          </span>
        </Alert>
      )}

      {reconciling && (
        <ReconcileModal
          agents={agents}
          onClose={() => setReconciling(false)}
          onDone={() => {
            setReconciling(false);
            fetchDocuments({ silent: true });
          }}
        />
      )}

      <ConfirmationModal
        isOpen={Boolean(documentToDelete)}
        onClose={() => setDocumentToDelete(null)}
        onConfirm={handleDelete}
        title="Delete this document?"
        message={
          documentToDelete
            ? `"${documentToDelete.filename}" and every search index built from it will be removed permanently. Agents will stop quoting it immediately. This cannot be undone.`
            : ''
        }
        confirmText="Delete document"
        destructive
        isLoading={deleting}
      />
    </div>
  );
};

export default KnowledgeBase;
