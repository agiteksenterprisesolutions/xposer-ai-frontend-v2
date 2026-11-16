// src/components/forms/MultiStepReportForm.jsx
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation, Trans } from "react-i18next";
import {
  AlertCircle,
  CheckCircle,
  Copy,
  ChevronRight,
  ChevronLeft,
  Clock,
  Shield,
  Loader,
  FileText,
  ArrowLeft,
  Save,
  Send,
  GitBranch,
  Paperclip,
  Upload,
  Trash2,
  Download,
  X,
} from "lucide-react";
import Card from "../ui/Card";
import Skeleton from "../ui/Skeleton";
import Button from "../ui/Button";
import Input, { Textarea, Select } from "../ui/Input";
import Alert from "../ui/Alert";
import { reportsAPI } from "../../api/reports";
import { reportTypesAPI } from "../../api/reportTypes";
import { useAuthStore } from "../../store/authStore";
import { isValidDate, isValidEmail, isValidPhone } from "../../utils/validators";
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MAX_FILES,
  attachmentHint,
  validateAttachments,
} from "../../utils/attachments";
import { copyToClipboard } from "../../utils/clipboard";
import {
  CURRENCIES,
  DEFAULT_CURRENCY,
  currencyDigits,
  defaultCurrencyFor,
  toAmountPayload,
  fromMinorUnits,
  normalizeOptions,
  normalizeValidation,
  optionValue,
  toMinorUnits,
} from "../../utils/reportTypes";
import { describeError } from "../../utils/errors";
import { organizationAPI } from "../../api/jurisdiction";
import { intlLocale } from "../../utils/locale";

/**
 * A type that refuses anonymous reports doesn't offer "anonymous" on its
 * identity question — the server would refuse the submission anyway.
 */
const withoutRefusedAnonymity = (type) => {
  if (!type || type.allows_anonymous !== false) return type;
  return {
    ...type,
    sections: (type.sections || []).map((section) => ({
      ...section,
      questions: (section.questions || []).map((question) =>
        question.name === "anonymity_election"
          ? {
              ...question,
              options: (question.options || []).filter((option) => optionValue(option) !== "anonymous"),
              default_value: question.default_value === "anonymous" ? "" : question.default_value,
            }
          : question,
      ),
    })),
  };
};
import { toast } from 'react-toastify';
import { useNavigate, useParams } from "react-router-dom";

// ============ FILE SIZE HELPER ============
const formatBytes = (bytes, t) => {
  const n = (value) => value.toLocaleString(intlLocale(), { maximumFractionDigits: 1 });
  if (bytes < 1024) return t("size.bytes", { value: n(bytes) });
  if (bytes < 1048576) return t("size.kb", { value: n(bytes / 1024) });
  return t("size.mb", { value: n(bytes / 1048576) });
};

const MAX_FILE_SIZE_BYTES = ATTACHMENT_MAX_BYTES;
const MAX_ATTACHMENTS = ATTACHMENT_MAX_FILES;
const PHONE_DIGIT_LIMIT = 11;
const NUMBER_DIGIT_LIMIT = 14;
const EMAIL_MAX_LENGTH = 50;
const normalizeQuestionType = (type) =>
  String(type || "").toLowerCase().replace(/_/g, "-");

const getAttachmentDisplayName = (value) => {
  if (!value || typeof value !== "string") return null;
  if (!value.startsWith("reports/")) return value;
  const parts = value.split("/");
  return parts[parts.length - 1] || value;
};

// ============ ATTACHMENTS PANEL ============
const AttachmentsPanel = ({ reportNumber, password, isAnonymous, organizationSlug, onAttachmentsChange }) => {
  const { t } = useTranslation("form");
  const anonymousOrgSlug = isAnonymous && organizationSlug ? organizationSlug : null;
  const [attachments, setAttachments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deletingKey, setDeletingKey] = useState(null);
  const fileInputRef = useRef(null);

  const fetchAttachments = useCallback(async () => {
    try {
      const data = await reportsAPI.getAttachments(
        reportNumber,
        isAnonymous ? password : null,
        anonymousOrgSlug || undefined
      );
      const list = data || [];
      setAttachments(list);
      onAttachmentsChange?.(list);
    } catch {
      // Silently fail — attachments are optional
    } finally {
      setIsLoading(false);
    }
  }, [reportNumber, password, isAnonymous, organizationSlug, onAttachmentsChange]);

  useEffect(() => {
    if (reportNumber) fetchAttachments();
  }, [fetchAttachments]);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    // Type, size and count all come from the shared evidence policy. This form
    // previously checked size and count but not type, so any file at all could
    // be attached here.
    const { valid, errors } = validateAttachments(files, attachments.length);
    if (errors.length > 0) toast.error(errors[0]);
    if (valid.length === 0) {
      e.target.value = "";
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    try {
      const result = await reportsAPI.uploadAttachments(
        reportNumber,
        valid,
        isAnonymous ? password : null,
        setUploadProgress,
        anonymousOrgSlug || undefined
      );
      // Refresh list
      await fetchAttachments();
      toast.success(result.message || t("panel.uploaded"));
    } catch (err) {
      const msg = err.response?.data?.detail || t("panel.uploadFailed");
      toast.error(msg);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      e.target.value = "";
    }
  };

  const handleDownload = async (attachment) => {
    try {
      const result = await reportsAPI.getAttachmentDownloadUrl(
        reportNumber,
        attachment.key,
        isAnonymous ? password : null,
        anonymousOrgSlug || undefined
      );
      window.open(result.download_url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error(t("panel.downloadFailed"));
    }
  };

  const handleDelete = async (attachment) => {
    if (!window.confirm(t("panel.deleteConfirm", { name: attachment.filename }))) return;
    setDeletingKey(attachment.key);
    try {
      await reportsAPI.deleteAttachment(
        reportNumber,
        attachment.key,
        isAnonymous ? password : null,
        anonymousOrgSlug || undefined
      );
      setAttachments((prev) => {
        const next = prev.filter((a) => a.key !== attachment.key);
        onAttachmentsChange?.(next);
        return next;
      });
      toast.success(t("panel.deleted"));
    } catch {
      toast.error(t("panel.deleteFailed"));
    } finally {
      setDeletingKey(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <div
        className="border-2 border-dashed border-line rounded-xl bg-subtle p-6 sm:p-8 text-center transition-colors cursor-pointer hover:border-line-accent hover:bg-hover"
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ATTACHMENT_ACCEPT}
          className="hidden"
          onChange={handleFileSelect}
          disabled={isUploading || attachments.length >= MAX_ATTACHMENTS}
        />
        {isUploading ? (
          <div className="space-y-2">
            <Loader className="w-8 h-8 text-accent-fg animate-spin mx-auto" />
            <p className="text-sm text-ink-muted">{t("panel.uploading", { percent: uploadProgress })}</p>
            <div className="w-full bg-active rounded-full h-2">
              <div
                className="bg-accent h-2 rounded-full transition-all"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <>
            <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-accent-soft text-accent-fg mb-3">
              <Upload className="w-5 h-5" />
            </span>
            <p className="text-sm font-medium text-ink">
              {attachments.length >= MAX_ATTACHMENTS
                ? t("panel.maxReached", { count: MAX_ATTACHMENTS })
                : t("panel.dropHere")}
            </p>
            <p className="text-xs text-ink-muted mt-1">{attachmentHint()}</p>
          </>
        )}
      </div>

      {/* File list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader className="w-5 h-5 text-ink-subtle animate-spin me-2" />
          <span className="text-sm text-ink-muted">{t("panel.loading")}</span>
        </div>
      ) : attachments.length === 0 ? (
        <p className="text-sm text-center text-ink-subtle py-2">{t("panel.empty")}</p>
      ) : (
        <ul className="divide-y divide-line-subtle">
          {attachments.map((att) => (
            <li
              key={att.key}
              className="flex items-center justify-between py-3 px-2 hover:bg-subtle rounded-lg"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-5 h-5 text-accent-fg shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{att.filename}</p>
                  <p className="text-xs text-ink-subtle">
                    {formatBytes(att.size, t)} · {att.content_type}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ms-4">
                <button
                  onClick={() => handleDownload(att)}
                  className="p-1 text-ink-muted hover:text-accent-fg"
                  title={t("panel.download")}
                  aria-label={t("panel.downloadFile", { name: att.filename })}
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(att)}
                  disabled={deletingKey === att.key}
                  className="p-1 text-ink-muted hover:text-danger-fg disabled:opacity-50"
                  title={t("panel.delete")}
                  aria-label={t("panel.deleteFile", { name: att.filename })}
                >
                  {deletingKey === att.key ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ============ MAIN FORM ============
const MultiStepReportForm = ({
  reportTypeId,
  reportNumber,
  password,
  organizationSlug = null,
  onSuccess,
  onCancel,
  isAnonymous = false,
  // ---- Draft editing ----
  // When set, the form resumes this report instead of initialising a new one.
  existingReportNumber = null,
  // Previously answered values, keyed by question name. Only populated once a
  // report is submitted, so drafts pass initialStepData instead.
  initialFormData = null,
  // Saved draft answers as the server stores them: { "<stepIndex>": { question: value } }.
  initialStepData = null,
  // Step the reporter left off on (server's current_step).
  initialStep = null,
  // The draft already has its type; re-selecting it server-side would be a no-op
  // at best and could clear saved answers, so it is skipped.
  skipTypeSelection = false,
  isEditingDraft = false,
  // The form version the draft was started on (report_type_version), or the
  // pinned form itself when the caller already has it (tracking returns it).
  // A draft keeps its version's questions even after the type is edited.
  pinnedVersion = null,
  pinnedForm = null,
}) => {
  const anonymousOrgSlug = isAnonymous && organizationSlug ? organizationSlug : null;
  const [stage, setStage] = useState("loading");
  const [currentStep, setCurrentStep] = useState(0);
  const [reportType, setReportType] = useState(null);
  const [stepData, setStepData] = useState({});
  const [allFormData, setAllFormData] = useState({});
  const [attachments, setAttachments] = useState([]);
  const [progressInfo, setProgressInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [stepErrors, setStepErrors] = useState({});
  const [savedProgress, setSavedProgress] = useState(null);
  const [generatedReportNumber, setGeneratedReportNumber] = useState(null);
  const navigate = useNavigate();
  const { t } = useTranslation("form");
  const { user, isAuthenticated } = useAuthStore();

  // The organization's default_currency and region, for money questions'
  // starting currency. By slug, which is public, so anonymous reporters get it too.
  const [organization, setOrganization] = useState(null);
  const orgSlugForCurrency = organizationSlug || user?.organization_slug || null;
  useEffect(() => {
    if (!orgSlugForCurrency) return;
    organizationAPI.bySlug(orgSlugForCurrency).then(setOrganization).catch(() => {});
  }, [orgSlugForCurrency]);

  const hasInitialized = useRef(false);
  const initPromiseRef = useRef(null);

  // ============ CONDITIONAL LOGIC EVALUATION ============
  const evaluateRule = useCallback((rule, formData) => {
    const { when_question, operator, value, values } = rule;
    const answer = formData[when_question];

    switch (operator) {
      case "equals": return answer == value;
      case "not_equals": return answer != value;
      case "contains":
        return typeof answer === "string" && typeof value === "string"
          ? answer.toLowerCase().includes(value.toLowerCase())
          : false;
      case "not_contains":
        return typeof answer === "string" && typeof value === "string"
          ? !answer.toLowerCase().includes(value.toLowerCase())
          : true;
      case "greater_than": return Number(answer) > Number(value);
      case "less_than": return Number(answer) < Number(value);
      case "in":
      case "is_one_of":
        if (!values || !Array.isArray(values)) return false;
        return Array.isArray(answer) ? answer.some((a) => values.includes(a)) : values.includes(answer);
      case "not_in":
      case "is_not_one_of":
        if (!values || !Array.isArray(values)) return true;
        return Array.isArray(answer) ? !answer.some((a) => values.includes(a)) : !values.includes(answer);
      case "is_empty":
        return !answer || answer === "" || (Array.isArray(answer) && answer.length === 0);
      case "is_not_empty":
        return answer && answer !== "" && (!Array.isArray(answer) || answer.length > 0);
      case "starts_with":
        return typeof answer === "string" && typeof value === "string"
          ? answer.toLowerCase().startsWith(value.toLowerCase())
          : false;
      case "ends_with":
        return typeof answer === "string" && typeof value === "string"
          ? answer.toLowerCase().endsWith(value.toLowerCase())
          : false;
      default:
        console.warn(`Unknown operator: ${operator}`);
        return true;
    }
  }, []);

  const evaluateConditionalLogic = useCallback((conditionalLogic, formData) => {
    if (!conditionalLogic?.rules?.length) return true;
    const { rules, logic_type } = conditionalLogic;
    const results = rules.map((rule) => evaluateRule(rule, formData));
    return logic_type === "or" ? results.some(Boolean) : results.every(Boolean);
  }, [evaluateRule]);

  const isSectionVisible = useCallback((section) => {
    if (!section.conditional_logic) return true;
    const result = evaluateConditionalLogic(section.conditional_logic, allFormData);
    const conditionType = section.conditional_logic.rules[0]?.condition_type || "show";
    return conditionType === "skip" ? !result : result;
  }, [allFormData, evaluateConditionalLogic]);

  const isQuestionVisible = useCallback((question) => {
    if (!question.conditional_logic) return true;
    const result = evaluateConditionalLogic(question.conditional_logic, allFormData);
    const conditionType = question.conditional_logic.rules[0]?.condition_type || "show";
    return conditionType === "skip" ? !result : result;
  }, [allFormData, evaluateConditionalLogic]);

  const visibleSections = useMemo(() => {
    if (!reportType?.sections) return [];
    return reportType.sections.filter((section) => isSectionVisible(section));
  }, [reportType, isSectionVisible]);

  const getVisibleQuestions = useCallback((section) => {
    if (!section?.questions) return [];
    return section.questions.filter((question) => isQuestionVisible(question));
  }, [isQuestionVisible]);

  // A question's `default_value` has always been *displayed* as the field's
  // value, but it was never written into the answers. A required field left at
  // its default therefore passed client validation (which applies the same
  // fallback) and was then submitted with the key missing, so the server
  // rejected the report for unanswered required fields. Seeding the defaults
  // into the answers keeps what is shown, what is validated, and what is sent
  // in agreement.
  const collectDefaults = useCallback((questions) => {
    const defaults = {};
    (questions || []).forEach((question) => {
      const fallback = question.default_value;
      if (fallback !== undefined && fallback !== null && fallback !== "") {
        defaults[question.name] = fallback;
      }
    });
    return defaults;
  }, []);

  // ============ INITIALIZATION ============
  useEffect(() => {
    if (hasInitialized.current || !reportTypeId) return;
    if (!isAnonymous && isAuthenticated === undefined) return;
    if (initPromiseRef.current) return;

    const initializeForm = async () => {
      setIsLoading(true);
      setError("");

      try {
        let type;
        try {
          type = await reportTypesAPI.getReportType(reportTypeId, true, { quiet: true });
          // Only the form is versioned; the type's other settings stay live.
          const pinned = existingReportNumber
            ? pinnedForm?.sections
              ? pinnedForm
              : pinnedVersion != null
                ? await reportTypesAPI.getVersion(reportTypeId, pinnedVersion).catch(() => null)
                : null
            : null;
          if (pinned?.sections) type = { ...type, sections: pinned.sections };
          type = withoutRefusedAnonymity(type);
        } catch (err) {
          // Types that need sign-in are hidden from anonymous reporters, and
          // answer 404 to a direct link.
          throw new Error(
            err?.response?.status === 404
              ? isAnonymous
                ? t("load.typeUnavailableAnonymous")
                : t("load.typeUnavailable")
              : t("load.formFailed"),
          );
        }
        setReportType(type);

        let currentReportNumber = existingReportNumber || reportNumber;
        let currentPassword = password;

        if (existingReportNumber) {
          // Resuming a draft — the report already exists, so no init call.
          setGeneratedReportNumber(existingReportNumber);
        } else if (!isAnonymous && isAuthenticated) {
          try {
            const initResponse = await reportsAPI.startAuthenticatedReport(organizationSlug || undefined);
            currentReportNumber = initResponse.report_number;
            setGeneratedReportNumber(currentReportNumber);
            toast.success(t("load.started"));
          } catch (err) {
            // 403 reporters_only: a staff account can't file; say so plainly.
            const detail = err?.response?.data?.detail;
            throw new Error(
              detail?.code === "reporters_only" ? detail.message : t("load.startFailed"),
            );
          }
        }

        if (currentReportNumber && !skipTypeSelection) {
          try {
            await reportsAPI.selectReportType(
              currentReportNumber,
              reportTypeId,
              !isAuthenticated ? currentPassword : null,
              isAnonymous ? (anonymousOrgSlug || undefined) : (organizationSlug || undefined),
              { quiet: true },
            );
            toast.success(t("load.typeSelected", { name: type.name }));
          } catch (err) {
            // 403 anonymous_not_allowed: this type needs a signed-in reporter
            // (an old link, say). Nothing else can be filed on it.
            if (err?.response?.status === 403) throw new Error(describeError(err).summary);
            console.error("Failed to select report type:", err);
          }
        }

        setStage("form");
      } catch (err) {
        setError(err.message || describeError(err).summary || t("load.formFailed"));
        setStage("unavailable");
      } finally {
        setIsLoading(false);
        initPromiseRef.current = null;
      }
    };

    hasInitialized.current = true;
    initPromiseRef.current = initializeForm();
  }, [reportTypeId, isAnonymous, isAuthenticated, anonymousOrgSlug, existingReportNumber, skipTypeSelection]);

  const currentReportNumber = isAnonymous ? reportNumber : generatedReportNumber;

  // ============ DRAFT PREFILL ============
  // Saved drafts arrive keyed by step index — the same indices saveStep posted,
  // so they map straight onto stepData. Reports that only expose a flat
  // form_data are matched back to their sections by question name instead,
  // which needs allFormData seeded first so conditional logic can resolve
  // which sections are visible.
  const seededFlatData = useRef(false);
  const hasSeeded = useRef(false);

  const flatDraftData = useMemo(() => {
    if (initialStepData && Object.keys(initialStepData).length > 0) {
      const merged = {};
      Object.values(initialStepData).forEach((answers) => {
        if (answers && typeof answers === "object") Object.assign(merged, answers);
      });
      return merged;
    }
    if (initialFormData && Object.keys(initialFormData).length > 0) {
      return initialFormData;
    }
    return null;
  }, [initialStepData, initialFormData]);

  useEffect(() => {
    if (seededFlatData.current || !reportType || !flatDraftData) return;
    seededFlatData.current = true;
    setAllFormData(flatDraftData);
  }, [reportType, flatDraftData]);

  useEffect(() => {
    if (hasSeeded.current) return;
    // A draft has to be folded into allFormData first, so that conditional
    // logic resolves which sections are visible before answers are mapped onto
    // them. A brand-new report has no draft to wait for — gating on that flag
    // regardless meant this never ran at all for new reports.
    if (flatDraftData && !seededFlatData.current) return;
    if (!visibleSections.length) return;
    hasSeeded.current = true;

    // Declared defaults go in first; saved answers layer over them, so a value
    // the reporter actually entered always wins over the default.
    const seeded = {};
    visibleSections.forEach((section, index) => {
      const defaults = collectDefaults(section.questions);
      if (Object.keys(defaults).length > 0) seeded[index] = defaults;
    });

    if (initialStepData && Object.keys(initialStepData).length > 0) {
      Object.entries(initialStepData).forEach(([key, answers]) => {
        const index = Number(key);
        if (!Number.isInteger(index) || !answers || typeof answers !== "object") return;
        if (Object.keys(answers).length > 0) {
          seeded[index] = { ...(seeded[index] || {}), ...answers };
        }
      });
    } else {
      visibleSections.forEach((section, index) => {
        const answers = {};
        (section.questions || []).forEach((question) => {
          const value = flatDraftData?.[question.name];
          if (value !== undefined && value !== null && value !== "") {
            answers[question.name] = value;
          }
        });
        if (Object.keys(answers).length > 0) {
          seeded[index] = { ...(seeded[index] || {}), ...answers };
        }
      });
    }
    setStepData(seeded);

    // The summary screen and the conditional-logic evaluator both read the flat
    // map, so it needs the same defaults.
    const flatDefaults = {};
    visibleSections.forEach((section) => {
      Object.assign(flatDefaults, collectDefaults(section.questions));
    });
    setAllFormData((prev) => ({ ...flatDefaults, ...prev }));

    // Resume where the reporter left off, falling back to the first step
    // without saved answers.
    const lastIndex = visibleSections.length - 1;
    // A step holding nothing but defaults has not been answered yet, so it must
    // not count as somewhere to resume past.
    const wasAnswered = (index) => {
      const answers = seeded[index];
      if (!answers) return false;
      const defaults = collectDefaults(visibleSections[index]?.questions);
      return Object.keys(answers).some((name) => answers[name] !== defaults[name]);
    };
    const resumeAt =
      Number.isInteger(initialStep) && initialStep >= 0
        ? Math.min(initialStep, lastIndex)
        : visibleSections.findIndex((_, index) => !wasAnswered(index));
    setCurrentStep(resumeAt > 0 ? resumeAt : 0);
  }, [visibleSections, initialStepData, flatDraftData, initialStep, collectDefaults]);

  // ============ FORM DATA MANAGEMENT ============
  const handleStepDataChange = useCallback((fieldName, value) => {
    setStepData((prev) => ({
      ...prev,
      [currentStep]: { ...prev[currentStep], [fieldName]: value },
    }));
    setAllFormData((prev) => ({ ...prev, [fieldName]: value }));
    setStepErrors((prev) => {
      const currentStepErrors = { ...(prev[currentStep] || {}) };
      if (!currentStepErrors[fieldName]) return prev;
      delete currentStepErrors[fieldName];
      return { ...prev, [currentStep]: currentStepErrors };
    });
  }, [currentStep]);

  // Most of these constraints aren't enforced by the server (it checks only
  // max_length, pattern and email format), so this is the only check there is.
  const validateQuestionValue = useCallback((question, rawValue) => {
    const label = question.label || question.name || t("validation.field");
    const normalizedType = normalizeQuestionType(question.type);
    const rules = normalizeValidation(question.validation);

    if (normalizedType === "currency") {
      const minor = rawValue && typeof rawValue === "object" ? rawValue.amount_minor : null;
      if (minor === null || minor === undefined) return question.required ? t("validation.required", { label }) : "";
      const currency = rawValue.currency || DEFAULT_CURRENCY;
      const amount = minor / 10 ** currencyDigits(currency);
      if (amount < 0) return t("validation.negative", { label });
      if (rules.min_value !== undefined && amount < Number(rules.min_value)) return t("validation.minAmount", { label, min: rules.min_value, currency });
      if (rules.max_value !== undefined && amount > Number(rules.max_value)) return t("validation.maxAmount", { label, max: rules.max_value, currency });
      return "";
    }

    const value = Array.isArray(rawValue) ? rawValue : String(rawValue ?? "").trim();
    const isEmpty = value === "" || value === null || value === undefined || (Array.isArray(value) && value.length === 0);

    if (question.required && isEmpty) {
      return t("validation.required", { label });
    }
    if (isEmpty) return "";

    if (normalizedType === "multiselect") {
      if (rules.min_selections !== undefined && value.length < Number(rules.min_selections)) {
        return t("validation.chooseAtLeast", { count: Number(rules.min_selections) });
      }
      if (rules.max_selections !== undefined && value.length > Number(rules.max_selections)) {
        return t("validation.chooseAtMost", { count: Number(rules.max_selections) });
      }
      return "";
    }

    if (["text", "textarea"].includes(normalizedType)) {
      if (rules.min_length !== undefined && value.length < Number(rules.min_length)) {
        return t("validation.minLength", { label, count: Number(rules.min_length) });
      }
      if (rules.max_length !== undefined && value.length > Number(rules.max_length)) {
        return t("validation.maxLength", { label, count: Number(rules.max_length) });
      }
    }

    if (rules.pattern) {
      try {
        if (!new RegExp(rules.pattern).test(String(value))) return t("validation.pattern", { label });
      } catch {
        // A pattern the browser can't compile is the server's to judge.
      }
    }

    if (normalizedType === "email" && !isValidEmail(String(value))) {
      return t("validation.email", { label });
    }

    if (normalizedType === "phone" && !isValidPhone(String(value))) {
      return t("validation.phone", { label });
    }

    if (normalizedType === "phone" && String(value).replace(/\D/g, "").length > PHONE_DIGIT_LIMIT) {
      return t("validation.phoneDigits", { label, count: PHONE_DIGIT_LIMIT });
    }

    if (normalizedType === "number") {
      const numberValue = Number(value);
      if (Number.isNaN(numberValue)) {
        return t("validation.number", { label });
      }
      const minValue = rules.min_value ?? 0;
      if (numberValue < Number(minValue)) {
        return Number(minValue) === 0
          ? t("validation.nonNegative", { label })
          : t("validation.minValue", { label, min: minValue });
      }
      if (rules.max_value !== undefined && numberValue > Number(rules.max_value)) {
        return t("validation.maxValue", { label, max: rules.max_value });
      }
    }

    if (normalizedType === "time" && !/^\d{2}:\d{2}(:\d{2})?$/.test(String(value))) {
      return t("validation.time", { label });
    }

    const isDate = normalizedType === "date";
    const isDateTime = ["datetime", "datetime-local", "date-time"].includes(normalizedType);
    if (isDate || isDateTime) {
      if (isDateTime) {
        const datetimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;
        if (!datetimeRegex.test(String(value)) || !isValidDate(String(value))) {
          return t("validation.dateTime", { label });
        }
      } else if (!isValidDate(String(value))) {
        return t("validation.date", { label });
      }
      const day = String(value).slice(0, 10);
      const minDate = resolveDateBound(rules.min_date);
      // With no latest date set, a report can't describe the future.
      const maxDate = resolveDateBound(rules.max_date) || localToday();
      if (minDate && day < minDate) return t("validation.before", { label, date: minDate });
      if (day > maxDate) {
        return rules.max_date ? t("validation.after", { label, date: maxDate }) : t("validation.future", { label });
      }
      if (isDateTime && !rules.max_date && new Date(String(value)) > new Date()) {
        return t("validation.futureDateTime", { label });
      }
    }

    return "";
  }, [t]);

  const validateCurrentStep = useCallback(() => {
    const section = visibleSections[currentStep];
    if (!section) return true;
    const visibleQuestions = getVisibleQuestions(section);
    const currentData = stepData[currentStep] || {};
    const errors = {};

    visibleQuestions.forEach((question) => {
      const value = currentData[question.name] ?? question.default_value ?? "";
      const fieldError = validateQuestionValue(question, value);
      if (fieldError) errors[question.name] = fieldError;
    });

    setStepErrors((prev) => ({ ...prev, [currentStep]: errors }));
    return Object.keys(errors).length === 0;
  }, [currentStep, getVisibleQuestions, stepData, validateQuestionValue, visibleSections]);

  const validateQuestionOnBlur = useCallback((question, value) => {
    const fieldError = validateQuestionValue(question, value);
    setStepErrors((prev) => {
      const currentStepErrors = { ...(prev[currentStep] || {}) };
      if (fieldError) currentStepErrors[question.name] = fieldError;
      else delete currentStepErrors[question.name];
      return { ...prev, [currentStep]: currentStepErrors };
    });
  }, [currentStep, validateQuestionValue]);

  const extractFormAttachmentKeys = useCallback((formData) => {
    const keys = [];
    Object.values(formData || {}).forEach((value) => {
      if (typeof value === "string" && value.startsWith("reports/")) {
        keys.push(value);
      }
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (typeof item === "string" && item.startsWith("reports/")) {
            keys.push(item);
          }
        });
      }
    });
    return keys;
  }, []);

  // ============ NAVIGATION ============
  const findNextVisibleStep = useCallback((fromStep) => {
    for (let i = fromStep + 1; i < visibleSections.length; i++) return i;
    return null;
  }, [visibleSections]);

  const findPreviousVisibleStep = useCallback((fromStep) => {
    for (let i = fromStep - 1; i >= 0; i--) return i;
    return null;
  }, []);

  const handleSaveStep = useCallback(async () => {
    if (!currentReportNumber) { toast.error(t("steps.notInitialized")); return false; }
    // Defaults are seeded up front, but a question revealed later by
    // conditional logic missed that pass — so fold them in again here. An
    // explicit answer, including one the reporter cleared to "", still wins.
    const visibleQuestions = getVisibleQuestions(visibleSections[currentStep]);
    const visibleDefaults = collectDefaults(visibleQuestions);
    // A question hidden by conditional logic is omitted, not submitted blank.
    const visibleNames = new Set(visibleQuestions.map((question) => question.name));
    const currentData = Object.fromEntries(
      Object.entries({ ...visibleDefaults, ...(stepData[currentStep] || {}) }).filter(([name]) => visibleNames.has(name)),
    );
    const isStepValid = validateCurrentStep();
    if (!isStepValid) {
      toast.error(t("steps.fixErrors"));
      // Take the reporter to the first field with a problem (WCAG 3.3.1).
      requestAnimationFrame(() => {
        const first = document.querySelector('main [aria-invalid="true"]');
        first?.focus();
        first?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
      return false;
    }
    setIsSaving(true);
    setError("");
    try {
      // Money goes to the API as { amount, currency }; the form keeps the
      // { amount_minor, currency } shape the API sends back.
      const payload = Object.fromEntries(Object.entries(currentData).map(([name, answer]) => [name, toAmountPayload(answer)]));
      const response = await reportsAPI.saveStep(
        currentReportNumber,
        currentStep,
        payload,
        isAnonymous ? password : null,
        anonymousOrgSlug || undefined
      );
      setProgressInfo(response);
      setStepData((prev) => ({ ...prev, [currentStep]: currentData }));
      setAllFormData((prev) => ({ ...prev, ...currentData }));
      toast.success(t("steps.saved", { step: currentStep + 1 }));
      return true;
    } catch (err) {
      const message = err.response?.data?.detail || t("steps.saveFailed");
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [currentReportNumber, currentStep, stepData, isAnonymous, password, validateCurrentStep,
      anonymousOrgSlug, collectDefaults, getVisibleQuestions, visibleSections, t]);

  const handleSaveAndContinue = useCallback(async () => {
    const didSave = await handleSaveStep();
    if (!didSave) return;
    const nextStep = findNextVisibleStep(currentStep);
    if (nextStep !== null) setCurrentStep(nextStep);
    else setStage("attachments"); // Go to attachments before summary
  }, [handleSaveStep, currentStep, findNextVisibleStep]);

  const handlePreviousStep = useCallback(() => {
    const prevStep = findPreviousVisibleStep(currentStep);
    if (prevStep !== null) { setCurrentStep(prevStep); setError(""); }
  }, [currentStep, findPreviousVisibleStep]);

  const handleGoToStep = useCallback((stepIndex) => {
    if (stepIndex >= 0 && stepIndex < visibleSections.length) {
      setCurrentStep(stepIndex); setError("");
    }
  }, [visibleSections]);

  // ============ SUBMISSION ============
  const handleFinalSubmit = useCallback(async () => {
    if (!currentReportNumber) { toast.error(t("steps.notInitialized")); return; }
    setIsSubmitting(true);
    setError("");
    try {
      let latestAttachments = attachments;
      try {
        const data = await reportsAPI.getAttachments(
          currentReportNumber,
          isAnonymous ? password : null,
          anonymousOrgSlug || undefined
        );
        latestAttachments = Array.isArray(data) ? data : [];
        setAttachments(latestAttachments);
      } catch {
        // Keep local attachment state if refresh fails
      }

      const uploadedAttachmentKeys = latestAttachments
        .map((item) => item.key)
        .filter(Boolean);
      const inlineAttachmentKeys = extractFormAttachmentKeys(allFormData);
      const attachmentKeys = [...new Set([...uploadedAttachmentKeys, ...inlineAttachmentKeys])];

      const response = await reportsAPI.submitReport(
        currentReportNumber,
        { attachment_keys: attachmentKeys },
        isAnonymous ? password : null,
        anonymousOrgSlug || undefined
      );
      setProgressInfo(response);
      setStage("success");
      toast.success(t("submit.success"));
      if (onSuccess) onSuccess(response);
    } catch (err) {
      // Old errors put a string in `detail`; the new ones an object with
      // `code`, `message` and sometimes `field`.
      const detail = err?.response?.data?.detail;
      const message = describeError(err).summary || t("submit.failed");
      setError(message);
      toast.error(message);
      // A refused answer (anonymity on a type that needs a name): take the
      // reporter back to the step holding it, with the field marked. The
      // report is still an editable draft.
      const field = detail && typeof detail === "object" ? detail.field : null;
      const stepIndex = field
        ? visibleSections.findIndex((section) => (section.questions || []).some((q) => q.name === field))
        : -1;
      if (stepIndex !== -1) {
        setStepErrors((prev) => ({ ...prev, [stepIndex]: { ...(prev[stepIndex] || {}), [field]: message } }));
        setCurrentStep(stepIndex);
        setStage("form");
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [currentReportNumber, isAnonymous, password, onSuccess, attachments, allFormData, extractFormAttachmentKeys, anonymousOrgSlug, visibleSections, t]);

  const handleCopyCredentials = useCallback(async () => {
    const text = t("credentials.clipboard", { number: reportNumber, password });
    if (await copyToClipboard(text)) {
      toast.success(t("credentials.copied"));
    } else {
      toast.error(t("credentials.copyFailed"));
    }
  }, [reportNumber, password, t]);

  // ============ RENDER FUNCTIONS ============

  const renderLoading = () => (
    <ReportFormSkeleton
      onBack={onCancel}
      message={
        isEditingDraft
          ? t("loading.restoring")
          : isAnonymous
            ? t("loading.anonymous")
            : t("loading.linking")
      }
    />
  );

  // Attachments stage — shown after completing all steps, before final submit
  const renderAttachmentsStage = () => (
    <div className="max-w-4xl mx-auto">
      <Card>
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-accent-soft rounded-full mb-3">
            <Paperclip className="w-6 h-6 text-accent-fg" />
          </div>
          <h2 className="text-xl font-bold text-ink">{t("attachStage.title")}</h2>
          <p className="text-ink-muted text-sm mt-1">
            {t("attachStage.description", { hint: attachmentHint() })}
          </p>
        </div>

        {currentReportNumber ? (
          <AttachmentsPanel
            reportNumber={currentReportNumber}
            password={password}
            isAnonymous={isAnonymous}
            organizationSlug={organizationSlug}
            onAttachmentsChange={setAttachments}
          />
        ) : (
          <Alert variant="warning">{t("attachStage.notInitialized")}</Alert>
        )}

        <div className="mt-8 space-y-3 pt-6 border-t border-line">
          <Button
            variant="secondary"
            onClick={() => setStage("form")}
            startIcon={ArrowLeft}
            className="w-full"
          >
            {t("attachStage.backToForm")}
          </Button>
          <Button
            onClick={() => setStage("summary")}
            endIcon={ChevronRight}
            className="w-full"
            variant="primary"
          >
            {t("attachStage.continueToReview")}
          </Button>
        </div>
      </Card>
    </div>
  );

  const renderSummaryStage = () => {
    const completedSteps = Object.keys(stepData).length;
    const totalSteps = visibleSections.length;
    const allStepsCompleted = completedSteps === totalSteps;

    return (
      <div className="max-w-4xl mx-auto">
        <Card>
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-accent-soft rounded-full mb-4">
              <CheckCircle className="h-8 w-8 text-accent-fg" />
            </div>
            <h2 className="text-2xl font-bold text-ink">{t("summary.title")}</h2>
            <p className="text-ink-muted mt-2">
              {t("summary.completed", { completed: completedSteps, total: totalSteps })}
            </p>
          </div>

          <div className="mb-8">
            {/* 2-up on phones, 4-up from md — a 4-col grid squashes these
                numbers below ~380px */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="text-center p-4 rounded-xl bg-success-soft border border-success-line">
                <div className="text-2xl font-bold text-success-fg tabular-nums">{completedSteps}</div>
                <div className="text-xs text-ink-muted mt-0.5">{t("summary.stepsCompleted")}</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-accent-soft border border-line-accent">
                <div className="text-2xl font-bold text-accent-fg tabular-nums">{totalSteps}</div>
                <div className="text-xs text-ink-muted mt-0.5">{t("summary.visibleSteps")}</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-info-soft border border-info-line">
                <div className="text-2xl font-bold text-info-fg tabular-nums">
                  {t("summary.percent", { value: Math.round((completedSteps / totalSteps) * 100) })}
                </div>
                <div className="text-xs text-ink-muted mt-0.5">{t("summary.completion")}</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-warning-soft border border-warning-line">
                <div className="text-2xl font-bold text-warning-fg tabular-nums">{attachments.length}</div>
                <div className="text-xs text-ink-muted mt-0.5">{t("summary.attachments")}</div>
              </div>
            </div>

            <div className="bg-subtle rounded-xl p-6 mb-6">
              <h3 className="font-semibold text-ink mb-4">{t("summary.reportInfo")}</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-ink-muted">{t("summary.reportType")}</div>
                  <div className="text-lg font-semibold text-ink">{reportType?.name}</div>
                </div>
                {currentReportNumber && (
                  <div>
                    <div className="text-sm font-medium text-ink-muted">{t("summary.reportNumber")}</div>
                    <div className="text-lg font-semibold text-accent-fg font-mono">{currentReportNumber}</div>
                  </div>
                )}
              </div>
            </div>

            {!allStepsCompleted && (
              <Alert variant="warning" className="mb-6">
                <div className="flex items-start">
                  <div>
                    <p className="font-medium text-sm">{t("summary.incompleteTitle")}</p>
                    <p className="text-xs mt-1">
                      {t("summary.incompleteBody", { completed: completedSteps, total: totalSteps })}
                    </p>
                  </div>
                </div>
              </Alert>
            )}
          </div>

          {error && (
            <Alert variant="error" className="mb-6">
              <div className="flex items-center">
                {error}
              </div>
            </Alert>
          )}

          <div className="space-y-3">
            <Button
              onClick={() => setStage("attachments")}
              variant="secondary"
              startIcon={Paperclip}
              className="w-full"
            >
              {t("summary.manageAttachments")}
            </Button>

            <Button
              onClick={() => setStage("form")}
              variant="secondary"
              startIcon={ArrowLeft}
              className="w-full"
            >
              {t("summary.reviewSteps")}
            </Button>

            <Button
              onClick={handleFinalSubmit}
              isLoading={isSubmitting}
              disabled={isSubmitting}
              startIcon={Send}
              className="w-full"
              variant="primary"
            >
              {t("summary.submit")}
            </Button>
          </div>
        </Card>
      </div>
    );
  };

  const renderFormStage = () => {
    if (!reportType || visibleSections.length === 0) {
      return (
        <div className="max-w-4xl mx-auto">
          <Card>
            <Alert variant="info">
              <div className="flex items-start">
                <GitBranch className="w-5 h-5 me-2 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">{t("formStage.noSectionsTitle")}</p>
                  <p className="text-xs mt-1">
                    {t("formStage.noSectionsBody")}
                  </p>
                </div>
              </div>
            </Alert>
            <div className="mt-4 space-y-3">
              <Button onClick={() => setCurrentStep(0)} variant="secondary" className="w-full">
                {t("formStage.reviewAnswers")}
              </Button>
              <Button onClick={() => setStage("attachments")} variant="secondary" className="w-full">
                {t("formStage.continueToAttachments")}
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    const section = visibleSections[currentStep];
    if (!section) return renderLoading();

    const visibleQuestions = getVisibleQuestions(section);
    const currentStepData = stepData[currentStep] || {};
    const currentStepErrors = stepErrors[currentStep] || {};
    const totalSteps = visibleSections.length;

    return (
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <button
              onClick={onCancel}
              className="inline-flex items-center gap-1 text-sm text-ink-muted transition-colors hover:text-ink"
            >
              <ArrowLeft className="w-4 h-4" />
              {t("formStage.back")}
            </button>
            {isEditingDraft ? (
              <div className="text-sm text-ink-muted">
                <Trans
                  t={t}
                  i18nKey="formStage.editingDraft"
                  values={{ number: currentReportNumber }}
                  components={{ number: <span className="font-mono font-semibold text-ink" dir="ltr" /> }}
                />
              </div>
            ) : isAnonymous ? (
              <div className="text-sm text-ink-muted">
                <Trans
                  t={t}
                  i18nKey="formStage.reportNumber"
                  values={{ number: currentReportNumber }}
                  components={{ number: <span className="font-mono font-semibold text-ink" dir="ltr" /> }}
                />
              </div>
            ) : (
              <div className="text-sm text-success-fg flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 shrink-0" />
                {t("formStage.linked")}
              </div>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-ink capitalize tracking-[-0.02em]">{reportType.name}</h1>
          <p className="text-sm text-ink-muted mt-1">
            {t("formStage.sectionStep", { section: section.title, current: currentStep + 1, total: totalSteps })}
          </p>
        </div>

        {/* Progress indicator */}
        <div className="mb-6">
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-xs font-medium text-ink-muted">
              {t("formStage.stepOf", { current: currentStep + 1, total: totalSteps })}
            </span>
            <span className="text-xs text-ink-subtle tabular-nums">
              {t("summary.percent", { value: Math.round(((currentStep + 1) / totalSteps) * 100) })}
            </span>
          </div>
          <div className="w-full bg-subtle rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-accent h-full rounded-full transition-[width] duration-300 ease-out-xp"
              style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
            />
          </div>

          {/* Step pips scroll horizontally — a long section list would
              otherwise squash into unreadable slivers on a phone. */}
          <div className="flex gap-2 mt-4 overflow-x-auto scrollbar-thin pb-1 -mx-1 px-1">
            {visibleSections.map((_, index) => {
              const isDone = index < currentStep || Boolean(stepData[index]);
              const isCurrent = index === currentStep;
              return (
                <button
                  key={index}
                  onClick={() => handleGoToStep(index)}
                  disabled={isLoading || isSaving}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                    isCurrent
                      ? 'border-line-accent bg-accent-soft text-accent-fg'
                      : isDone
                        ? 'border-success-line bg-success-soft text-success-fg'
                        : 'border-line bg-subtle text-ink-subtle hover:text-ink hover:border-line-strong'
                  }`}
                >
                  {isDone && !isCurrent
                    ? <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                    : <span className="tabular-nums">{index + 1}</span>}
                  <span className="whitespace-nowrap">{t("formStage.step", { number: index + 1 })}</span>
                </button>
              );
            })}
          </div>
        </div>

        <Card>
          <div className="mb-8">
            <h2 className="text-xl font-bold text-ink capitalize">{section.title}</h2>
            {section?.description && (
              <p className="text-ink-muted mt-2">{section.description}</p>
            )}
          </div>

          {error && (
            <Alert variant="error" className="mb-6">
              <div className="flex items-center">
                {error}
              </div>
            </Alert>
          )}

          {visibleQuestions.length < (section.questions?.length || 0) && (
            <Alert variant="info" className="mb-6">
              <div className="flex items-start">
                <GitBranch className="w-5 h-5 me-2 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">{t("formStage.conditionalTitle")}</p>
                  <p className="text-xs mt-1">
                    {t("formStage.conditionalBody", { visible: visibleQuestions.length, count: section.questions?.length || 0 })}
                  </p>
                </div>
              </div>
            </Alert>
          )}

          {/* Form fields */}
          <div className="space-y-6 mb-8">
            {visibleQuestions.length === 0 ? (
              <div className="text-center py-8">
                <GitBranch className="w-12 h-12 text-ink-subtle mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-ink mb-2">{t("formStage.noQuestionsTitle")}</h3>
                <p className="text-ink-muted">
                  {t("formStage.noQuestionsBody")}
                </p>
              </div>
            ) : (
              visibleQuestions.map((question, idx) => {
                const value = currentStepData[question.name] ?? question.default_value ?? "";
                const isRequired = question.required || false;
                const fieldError = currentStepErrors[question.name];
                const normalizedType = normalizeQuestionType(question.type);
                const isPhoneField = normalizedType === "phone";
                const isEmailField = normalizedType === "email";
                const isDateField = normalizedType === "date";
                const isDateTimeField =
                  ["datetime", "datetime-local", "date-time"].includes(normalizedType);

                const handleBooleanChange = (checked) =>
                  handleStepDataChange(question.name, checked ? "1" : "0");

                // The question text names its field (or its group of options) for
                // screen readers; placeholders are not labels (WCAG 1.3.1, 4.1.2).
                const labelId = `q-${question.id || question.name || idx}-label`;
                const named = { "aria-labelledby": labelId };
                const group = { role: "group", "aria-labelledby": labelId };

                return (
                  <div key={question.id || idx} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label id={labelId} className="block text-sm font-medium text-ink">
                        {question.label}
                        {isRequired && <span className="text-danger-fg ms-1">*</span>}
                      </label>
                    </div>

                    {normalizedType === "textarea" ? (
                      <Textarea
                        {...named}
                        value={value}
                        onChange={(e) => handleStepDataChange(question.name, e.target.value)}
                        onBlur={(e) => validateQuestionOnBlur(question, e.target.value)}
                        placeholder={question.placeholder || question?.label}
                        rows={4}
                        required={isRequired}
                        disabled={isLoading || isSaving}
                        error={fieldError}
                        className="outline-none focus:ring-1"
                      />
                    ) : normalizedType === "select" ? (
                      <Select
                        {...named}
                        value={value}
                        onChange={(e) => handleStepDataChange(question.name, e.target.value)}
                        onBlur={(e) => validateQuestionOnBlur(question, e.target.value)}
                        required={isRequired}
                        disabled={isLoading || isSaving}
                        options={normalizeOptions(question.options)}
                        placeholder={question.placeholder || t("fields.selectPlaceholder")}
                        error={fieldError}
                        className="outline-none focus:ring-1"
                      >
                        <option value="">{question.placeholder || t("fields.selectPlaceholder")}</option>
                        {normalizeOptions(question.options).map((option, optIdx) => (
                          <option key={optIdx} value={option.value}>{option.label}</option>
                        ))}
                      </Select>
                    ) : normalizedType === "multiselect" ? (
                      <div className="space-y-2" {...group}>
                        {normalizeOptions(question.options).map((option, optIdx) => {
                          const optionValue = option.value;
                          const optionLabel = option.label;
                          return (
                            <label key={optIdx} className="flex items-center">
                              <input
                                type="checkbox"
                                checked={Array.isArray(value) && value.includes(optionValue)}
                                onChange={(e) => {
                                  const newValue = Array.isArray(value) ? [...value] : [];
                                  if (e.target.checked) newValue.push(optionValue);
                                  else { const i = newValue.indexOf(optionValue); if (i > -1) newValue.splice(i, 1); }
                                  handleStepDataChange(question.name, newValue);
                                }}
                                className="rounded border-line-strong text-accent-fg focus:ring-accent-ring"
                                disabled={isLoading || isSaving}
                              />
                              <span className="ms-2 text-sm text-ink-secondary">{optionLabel}</span>
                            </label>
                          );
                        })}
                      </div>
                    ) : normalizedType === "boolean" ? (
                      <div className="flex gap-6" role="radiogroup" aria-labelledby={labelId}>
                        <label className="flex items-center">
                          <input
                            type="radio" name={question.name} value="1"
                            checked={value === "1" || value === true || value === 1}
                            onChange={() => handleBooleanChange(true)}
                            className="w-4 h-4 text-accent-fg border-line-strong focus:ring-accent-ring"
                            disabled={isLoading || isSaving} required={isRequired}
                          />
                          <span className="ms-2 text-sm text-ink-secondary">{t("fields.yes")}</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio" name={question.name} value="0"
                            checked={value === "0" || value === false || value === 0}
                            onChange={() => handleBooleanChange(false)}
                            className="w-4 h-4 text-accent-fg border-line-strong focus:ring-accent-ring"
                            disabled={isLoading || isSaving} required={isRequired}
                          />
                          <span className="ms-2 text-sm text-ink-secondary">{t("fields.no")}</span>
                        </label>
                      </div>
                    ) : normalizedType === "file" ? (
                      // Inline file questions in the form save the file reference in stepData,
                      // but the actual upload happens via the AttachmentsPanel.
                      // We auto-upload when the file is selected.
                      <div {...group}>
                      <InlineFileUpload
                        question={question}
                        value={value}
                        reportNumber={currentReportNumber}
                        password={isAnonymous ? password : null}
                        organizationSlug={anonymousOrgSlug || undefined}
                        isDisabled={isLoading || isSaving}
                        onAttachmentSync={setAttachments}
                        onUploaded={(filename) => handleStepDataChange(question.name, filename)}
                      />
                      </div>
                    ) : normalizedType === "currency" ? (
                      <div {...group}>
                      <CurrencyField
                        value={value && typeof value === "object" ? value : null}
                        defaultCurrency={defaultCurrencyFor(question, organization)}
                        placeholder={question.placeholder}
                        disabled={isLoading || isSaving}
                        required={isRequired}
                        error={fieldError}
                        onChange={(next) => handleStepDataChange(question.name, next)}
                        onBlur={(next) => validateQuestionOnBlur(question, next)}
                      />
                      </div>
                    ) : isDateTimeField ? (
                      // Firefox's datetime-local picker only offers the calendar — the
                      // time has to be typed blind — so the field is split in two and
                      // recombined into the same YYYY-MM-DDTHH:MM string.
                      <div {...group}>
                      <DateTimeField
                        value={value}
                        disabled={isLoading || isSaving}
                        required={isRequired}
                        error={fieldError}
                        onChange={(next) => handleStepDataChange(question.name, next)}
                        onBlur={(next) => validateQuestionOnBlur(question, next)}
                      />
                      </div>
                    ) : (
                      <Input
                        {...named}
                        type={
                          normalizedType === "email" ? "email"
                            : normalizedType === "phone" ? "tel"
                              : normalizedType === "number" ? "number"
                                : normalizedType === "date" ? "date"
                                  : normalizedType === "time" ? "time"
                                    : "text"
                        }
                        value={value}
                        onChange={(e) => {
                          let nextValue = e.target.value;
                          if (isEmailField) {
                            nextValue = nextValue.slice(0, EMAIL_MAX_LENGTH);
                          }
                          if (isPhoneField) {
                            nextValue = nextValue.replace(/\D/g, "").slice(0, PHONE_DIGIT_LIMIT);
                          }
                          if (normalizedType === "number") {
                            if (nextValue.replace(/[^0-9]/g, "").length > NUMBER_DIGIT_LIMIT) return;
                          }
                          if (isDateField) {
                            const validDate = /^\d{4}-\d{2}-\d{2}$/;
                            if (nextValue !== "" && !validDate.test(nextValue)) return;
                          }
                          handleStepDataChange(question.name, nextValue);
                        }}
                        onFocus={(e) => {
                          if (isDateField && typeof e.target.showPicker === "function") {
                            e.target.showPicker();
                          }
                        }}
                        onBlur={(e) => validateQuestionOnBlur(question, e.target.value)}
                        placeholder={question.placeholder || question?.label}
                        required={isRequired}
                        title={question.type === 'phone' ? t("fields.phoneTitle") : ''}
                        disabled={isLoading || isSaving}
                        min={
                          normalizedType === "number" ? (normalizeValidation(question.validation).min_value ?? 0) :
                            normalizedType === "date" ? resolveDateBound(normalizeValidation(question.validation).min_date) || undefined :
                              undefined
                        }
                        max={
                          normalizedType === "number" ? normalizeValidation(question.validation).max_value :
                            normalizedType === "date" ? resolveDateBound(normalizeValidation(question.validation).max_date) || localToday() :
                              undefined
                        }
                        maxLength={isPhoneField ? PHONE_DIGIT_LIMIT : isEmailField ? EMAIL_MAX_LENGTH : normalizedType === "number" ? NUMBER_DIGIT_LIMIT : undefined}
                        inputMode={
                          isPhoneField
                            ? "numeric"
                            : normalizedType === "number"
                              ? "decimal"
                              : undefined
                        }
                        pattern={isPhoneField ? "[0-9]*" : undefined}
                        error={fieldError}
                        className="outline-none focus:ring-1 placeholder:text-ink-subtle"
                      />
                    )}

                    {fieldError && ["multiselect", "boolean", "file"].includes(question.type) && (
                      <p className="text-xs text-danger-fg">{fieldError}</p>
                    )}

                    {question.help_text && (
                      <p className="text-xs text-ink-muted">{question.help_text}</p>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Navigation buttons */}
          {/* Actions stack full-width on mobile and split left/right from sm up,
              so nothing overflows on a narrow viewport */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-3 pt-6 border-t border-line">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Button
                variant="outline"
                onClick={handlePreviousStep}
                disabled={currentStep === 0 || isLoading || isSaving}
                startIcon={ChevronLeft}
              >
                {t("formStage.previous")}
              </Button>
              <Button
                variant="secondary"
                onClick={handleSaveStep}
                isLoading={isSaving}
                disabled={isLoading || isSaving}
                startIcon={Save}
              >
                {t("formStage.saveStep")}
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              {isAnonymous && currentReportNumber && (
                <Button
                  variant="outline"
                  onClick={handleCopyCredentials}
                  disabled={isLoading || isSaving}
                  startIcon={Copy}
                >
                  {t("credentials.copy")}
                </Button>
              )}
              <Button
                onClick={handleSaveAndContinue}
                isLoading={isSaving}
                disabled={isLoading || isSaving}
                endIcon={currentStep === totalSteps - 1 ? Paperclip : ChevronRight}
                variant="primary"
              >
                {currentStep === totalSteps - 1 ? t("formStage.saveAndAttach") : t("formStage.saveAndContinue")}
              </Button>
            </div>
          </div>
        </Card>

        {!isAnonymous && isAuthenticated && (
          <Alert variant="success" className="mt-4">
            <p className="text-sm">{t("formStage.linkedNoPassword")}</p>
          </Alert>
        )}
      </div>
    );
  };

  const renderSuccessStage = () => (
    <div className="max-w-2xl mx-auto">
      <Card>
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-success-soft rounded-full mb-4">
            <CheckCircle className="h-8 w-8 text-success-fg" />
          </div>
          <h2 className="text-2xl font-bold text-ink">{t("success.title")}</h2>
          <p className="text-ink-muted mt-2">
            {isAnonymous ? t("success.receivedAnonymous") : t("success.receivedAccount")}
          </p>
        </div>

        {isAnonymous ? (
          <>
            <div className="bg-subtle rounded-xl p-6 mb-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-sm font-medium text-ink-muted mb-2">{t("summary.reportNumber")}</div>
                  <div className="text-2xl font-bold text-accent-fg font-mono" dir="ltr">{currentReportNumber}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium text-ink-muted mb-2">{t("success.password")}</div>
                  <div className="text-2xl font-bold text-ink font-mono" dir="ltr">{password}</div>
                </div>
              </div>
            </div>
            <Alert variant="warning" className="mb-6">
              <div className="flex items-start">
                <Shield className="w-5 h-5 me-2 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">{t("success.saveTitle")}</p>
                  <p className="text-xs mt-1">
                    <Trans t={t} i18nKey="success.saveBody" components={{ strong: <strong /> }} />
                  </p>
                </div>
              </div>
            </Alert>
            <div className="space-y-3">
              <Button onClick={handleCopyCredentials} startIcon={Copy} className="w-full" variant="secondary">
                {t("credentials.copy")}
              </Button>
              <Button
                onClick={() => navigate(`/${user?.organization_slug}/track-report?report=${currentReportNumber}`)}
                className="w-full" variant="secondary"
              >
                {t("success.trackThis")}
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="bg-success-soft rounded-xl p-6 mb-6">
              <div className="text-center">
                <div className="text-sm font-medium text-ink-muted mb-2">{t("success.yourNumber")}</div>
                <div className="text-2xl font-bold text-accent-fg font-mono">{currentReportNumber}</div>
                <p className="text-sm text-ink-muted mt-2">{t("success.linkedNote")}</p>
              </div>
            </div>
            <Alert variant="success" className="mb-6">
              <p className="text-sm">{t("success.linkedAlert")}</p>
            </Alert>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button variant="secondary" onClick={() => navigate(`/${user?.organization_slug}/reporter/dashboard`)}>
                {t("success.dashboard")}
              </Button>
              <Button onClick={() => navigate(`/${user?.organization_slug}/reporter/submit`)} variant="secondary">
                {t("success.another")}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );

  // Main render
  if (stage === "loading" || isLoading) return renderLoading();
  if (stage === "form") return renderFormStage();
  if (stage === "attachments") return renderAttachmentsStage();
  if (stage === "summary") return renderSummaryStage();
  if (stage === "success") return renderSuccessStage();

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-ink-subtle mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-ink mb-2">
            {stage === "unavailable" ? t("error.unavailable") : t("error.generic")}
          </h2>
          <p className="mx-auto mb-4 max-w-md text-ink-muted">{error || t("error.body")}</p>
          <Button onClick={onCancel} variant="secondary">{t("error.goBack")}</Button>
        </div>
      </Card>
    </div>
  );
};

// ============ DATE + TIME FIELD (for "datetime" type questions) ============
// A native datetime-local is only half a control in Firefox: the picker shows a
// calendar and nothing for the time, which has to be typed into segments the
// calendar keeps covering. Two inputs sidestep that and still emit the exact
// same "YYYY-MM-DDTHH:MM" string the validator and API expect.
const splitDateTime = (value) => {
  const [datePart = "", timePart = ""] = String(value ?? "").split("T");
  return { date: datePart, time: timePart.slice(0, 5) };
};

const localNow = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString();

// `today` in a date bound is resolved here, at render, as the server does.
const localToday = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0];
const resolveDateBound = (bound) => (bound === "today" ? localToday() : bound || null);

/**
 * Amount plus currency. The answer is `{ amount_minor, currency }` — money is
 * stored as an integer in the currency's smallest unit, never as a float.
 */
const CurrencyField = ({ value, defaultCurrency, disabled, required, error, placeholder, onChange, onBlur }) => {
  const { t } = useTranslation("form");
  const currency = value?.currency || defaultCurrency || DEFAULT_CURRENCY;
  const [draft, setDraft] = useState(() => fromMinorUnits(value?.amount_minor, currency));

  useEffect(() => {
    const shown = toMinorUnits(draft, currency);
    if (shown !== (value?.amount_minor ?? null)) setDraft(fromMinorUnits(value?.amount_minor, currency));
    // Only an outside change (a loaded draft) should overwrite what's typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.amount_minor, currency]);

  const emit = (amount, code) => {
    const next = { amount_minor: toMinorUnits(amount, code), currency: code };
    onChange(next.amount_minor === null && amount === "" ? "" : next);
    return next;
  };

  const options = CURRENCIES.includes(currency) ? CURRENCIES : [currency, ...CURRENCIES];
  return (
    <div>
      <div className="flex gap-2">
        <select
          value={currency}
          onChange={(e) => emit(draft, e.target.value)}
          disabled={disabled}
          aria-label={t("fields.currency")}
          className="w-24 shrink-0 rounded-lg border border-line bg-subtle px-3 py-2.5 text-sm text-ink outline-none focus:border-line-accent"
        >
          {options.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
        <input
          type="text"
          inputMode="decimal"
          dir="ltr"
          aria-label={t("fields.amount")}
          value={draft}
          required={required}
          disabled={disabled}
          placeholder={placeholder || (0).toFixed(currencyDigits(currency))}
          onChange={(e) => {
            const next = e.target.value.replace(/[^0-9.]/g, "");
            const [whole, fraction] = next.split(".");
            if (fraction !== undefined && fraction.length > currencyDigits(currency)) return;
            setDraft(fraction === undefined ? whole : `${whole}.${fraction}`);
            emit(next, currency);
          }}
          onBlur={() => onBlur(emit(draft, currency))}
          aria-invalid={error ? "true" : undefined}
          className={`min-w-0 flex-1 rounded-lg border bg-subtle px-3 py-2.5 text-sm text-ink outline-none focus:border-line-accent ${
            error ? "border-danger-line" : "border-line"
          }`}
        />
      </div>
      {error && <p className="mt-1 text-xs text-danger-fg">{error}</p>}
    </div>
  );
};

const DateTimeField = ({ value, disabled, required, error, onChange, onBlur }) => {
  const { t } = useTranslation("form");
  const [parts, setParts] = useState(() => splitDateTime(value));

  // Follow the value when it changes from outside (draft prefill, step switch),
  // but never clobber a half-entered pair the reporter is still working through.
  useEffect(() => {
    const incoming = splitDateTime(value);
    setParts((prev) =>
      `${prev.date}T${prev.time}` === `${incoming.date}T${incoming.time}` ? prev : incoming
    );
  }, [value]);

  const nowIso = localNow();
  const maxDate = nowIso.split("T")[0];
  const maxTime = parts.date === maxDate ? nowIso.slice(11, 16) : undefined;

  // A date on its own is not a valid answer, so a lone date defaults its time to
  // midnight rather than leaving the field silently empty.
  const commit = (next) => {
    setParts(next);
    const combined = next.date ? `${next.date}T${next.time || "00:00"}` : "";
    onChange(combined);
    return combined;
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          type="date"
          aria-label={t("fields.date")}
          value={parts.date}
          max={maxDate}
          required={required}
          disabled={disabled}
          aria-invalid={error ? "true" : undefined}
          onFocus={(e) => typeof e.target.showPicker === "function" && e.target.showPicker()}
          onChange={(e) => commit({ ...parts, date: e.target.value })}
          onBlur={() => onBlur(parts.date ? `${parts.date}T${parts.time || "00:00"}` : "")}
          className={`outline-none focus:ring-1 ${error ? "border-danger-line" : ""}`}
        />
        <Input
          type="time"
          aria-label={t("fields.time")}
          value={parts.time}
          max={maxTime}
          required={required}
          disabled={disabled}
          aria-invalid={error ? "true" : undefined}
          onChange={(e) => commit({ ...parts, time: e.target.value.slice(0, 5) })}
          onBlur={() => onBlur(parts.date ? `${parts.date}T${parts.time || "00:00"}` : "")}
          className={`outline-none focus:ring-1 ${error ? "border-danger-line" : ""}`}
        />
      </div>
      {error && <p className="text-xs text-danger-fg">{error}</p>}
    </>
  );
};

// ============ INLINE FILE UPLOAD (for "file" type questions) ============
// Immediately uploads to R2 when a file is chosen, storing the S3 key in stepData.
/**
 * The report form while it loads: the same header, progress and card, with
 * the fields stubbed — and what is happening, where the report number will
 * be. Pages that load a draft before mounting the form show it too, so the
 * two loads read as one.
 */
export const ReportFormSkeleton = ({ message, onBack }) => {
  const { t } = useTranslation("form");
  return (
  <div className="max-w-4xl mx-auto" aria-busy="true">
    <div className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("formStage.back")}
        </button>
        <span className="flex items-center gap-1.5 text-sm text-ink-muted">
          <Loader className="w-3.5 h-3.5 animate-spin" />
          {message}
        </span>
      </div>
      <Skeleton.Text size="2xl" className="w-72" />
      <Skeleton.Text className="mt-1 w-48" />
    </div>
    <div className="mb-6">
      <div className="flex items-center justify-between gap-3 mb-2">
        <Skeleton.Text size="xs" className="w-20" />
        <Skeleton.Text size="xs" className="w-8" />
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
      <div className="flex gap-2 mt-4 pb-1">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-7 w-20 rounded-full" />
        ))}
      </div>
    </div>
    <Card>
      <div className="mb-8">
        <Skeleton.Text size="xl" className="w-56" />
        <Skeleton.Text size="base" className="mt-2 w-72" />
      </div>
      <div className="space-y-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton.Text className="w-48" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
        ))}
      </div>
      <div className="flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-3 pt-6 mt-6 border-t border-line">
        <div className="flex gap-3">
          <Skeleton.Button className="w-28" />
          <Skeleton.Button className="w-32" />
        </div>
        <Skeleton.Button className="w-40" />
      </div>
    </Card>
  </div>
  );
};

const InlineFileUpload = ({
  question,
  value,
  reportNumber,
  password,
  organizationSlug = null,
  isDisabled,
  onAttachmentSync,
  onUploaded,
}) => {
  const { t } = useTranslation("form");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedAttachmentKey, setUploadedAttachmentKey] = useState(
    typeof value === "string" && value.startsWith("reports/") ? value : null
  );
  const [uploadedFilename, setUploadedFilename] = useState(
    getAttachmentDisplayName(value)
  );
  const orgParam = organizationSlug || undefined;

  useEffect(() => {
    setUploadedAttachmentKey(
      typeof value === "string" && value.startsWith("reports/") ? value : null
    );
    setUploadedFilename(getAttachmentDisplayName(value));
  }, [value]);

  const handleChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const { valid, errors } = validateAttachments([file], 0);
    if (valid.length === 0) {
      toast.error(errors[0]);
      e.target.value = "";
      return;
    }
    if (!reportNumber) {
      toast.error(t("upload.notInitialized"));
      e.target.value = "";
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    try {
      const result = await reportsAPI.uploadAttachments(
        reportNumber,
        [file],
        password,
        setUploadProgress,
        orgParam
      );
      const uploaded = result.attachments?.[0] || result.attachment;
      if (uploaded) {
        setUploadedAttachmentKey(uploaded.key);
        setUploadedFilename(uploaded.filename);
        onUploaded(uploaded.key); // Store the S3 key as the form field value
        const list = await reportsAPI.getAttachments(reportNumber, password, orgParam);
        onAttachmentSync?.(Array.isArray(list) ? list : []);
        toast.success(t("upload.uploaded", { name: uploaded.filename }));
      }
    } catch (err) {
      const msg = err.response?.data?.detail || t("upload.failed");
      toast.error(msg);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-2">
      {isUploading ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-ink-muted">
            <Loader className="w-4 h-4 animate-spin text-accent-fg" />
            <span>{t("panel.uploading", { percent: uploadProgress })}</span>
          </div>
          <div className="w-full bg-active rounded-full h-1.5">
            <div
              className="bg-accent h-1.5 rounded-full transition-all"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      ) : uploadedFilename ? (
        <div className="flex items-center gap-2 text-sm text-ink-muted bg-success-soft p-2 rounded border border-success-line">
          <CheckCircle className="w-4 h-4 text-success-fg" />
          <span className="flex-1 truncate">{uploadedFilename}</span>
          <button
            type="button"
            onClick={async () => {
              if (uploadedAttachmentKey && reportNumber) {
                try {
                  await reportsAPI.deleteAttachment(reportNumber, uploadedAttachmentKey, password, orgParam);
                  const list = await reportsAPI.getAttachments(reportNumber, password, orgParam);
                  onAttachmentSync?.(Array.isArray(list) ? list : []);
                } catch {
                  toast.error(t("panel.deleteFailed"));
                  return;
                }
              }
              setUploadedAttachmentKey(null);
              setUploadedFilename(null);
              onUploaded("");
            }}
            className="inline-flex h-7 w-7 items-center justify-center rounded text-ink-subtle hover:text-danger-fg"
            aria-label={t("upload.remove", { name: uploadedFilename })}
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <input
          type="file"
          aria-label={question.label}
          onChange={handleChange}
          accept={ATTACHMENT_ACCEPT}
          disabled={isDisabled}
          required={question.required}
          className="block w-full text-sm text-ink-muted file:me-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-accent-soft file:text-accent-fg hover:file:bg-accent-soft"
        />
      )}
    </div>
  );
};

export default MultiStepReportForm;
