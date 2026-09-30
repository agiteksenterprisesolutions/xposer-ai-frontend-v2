// src/components/forms/MultiStepReportForm.jsx
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
import Button from "../ui/Button";
import Input, { Textarea, Select } from "../ui/Input";
import Alert from "../ui/Alert";
import { reportsAPI } from "../../api/reports";
import { reportTypesAPI } from "../../api/reportTypes";
import { useAuthStore } from "../../store/authStore";
import { isValidDate, isValidEmail, isValidPhone } from "../../utils/validators";
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_HINT,
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MAX_FILES,
  validateAttachments,
} from "../../utils/attachments";
import { copyToClipboard } from "../../utils/clipboard";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";

// ============ FILE SIZE HELPER ============
const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
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
      toast.success(result.message || "File(s) uploaded successfully");
    } catch (err) {
      const msg = err.response?.data?.detail || "Upload failed";
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
      toast.error("Failed to get download link");
    }
  };

  const handleDelete = async (attachment) => {
    if (!window.confirm(`Delete "${attachment.filename}"?`)) return;
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
      toast.success("Attachment deleted");
    } catch {
      toast.error("Failed to delete attachment");
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
            <p className="text-sm text-ink-muted">Uploading… {uploadProgress}%</p>
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
                ? "Maximum 10 files reached"
                : "Click or drag files here to upload"}
            </p>
            <p className="text-xs text-ink-muted mt-1">{ATTACHMENT_HINT}</p>
          </>
        )}
      </div>

      {/* File list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader className="w-5 h-5 text-ink-subtle animate-spin mr-2" />
          <span className="text-sm text-ink-muted">Loading attachments…</span>
        </div>
      ) : attachments.length === 0 ? (
        <p className="text-sm text-center text-ink-subtle py-2">No attachments yet</p>
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
                    {formatBytes(att.size)} · {att.content_type}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                <button
                  onClick={() => handleDownload(att)}
                  className="p-1 text-ink-muted hover:text-accent-fg"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(att)}
                  disabled={deletingKey === att.key}
                  className="p-1 text-ink-muted hover:text-danger-fg disabled:opacity-50"
                  title="Delete"
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
  const { user, isAuthenticated } = useAuthStore();

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
        const type = await reportTypesAPI.getReportType(reportTypeId, true);
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
            toast.success("Report initialized. Your report is linked to your account.");
          } catch (err) {
            throw new Error("Failed to start report. Please try again.");
          }
        }

        if (currentReportNumber && !skipTypeSelection) {
          try {
            await reportsAPI.selectReportType(
              currentReportNumber,
              reportTypeId,
              !isAuthenticated ? currentPassword : null,
              isAnonymous ? (anonymousOrgSlug || undefined) : (organizationSlug || undefined)
            );
            toast.success(`Report type "${type.name}" selected`);
          } catch (err) {
            console.error("Failed to select report type:", err);
          }
        }

        setStage("form");
      } catch (err) {
        setError(err.message || err.response?.data?.detail || "Failed to load report form");
        toast.error("Failed to load report form");
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

  const validateQuestionValue = useCallback((question, rawValue) => {
    const label = question.label || question.name || "Field";
    const value = Array.isArray(rawValue) ? rawValue : String(rawValue ?? "").trim();
    const isEmpty = value === "" || value === null || value === undefined || (Array.isArray(value) && value.length === 0);
    const normalizedType = normalizeQuestionType(question.type);

    if (question.required && isEmpty) {
      return `${label} is required`;
    }
    if (isEmpty) return "";

    if (normalizedType === "email" && !isValidEmail(String(value))) {
      return `${label} must be a valid email address`;
    }

    if (normalizedType === "phone" && !isValidPhone(String(value))) {
      return `${label} must be a valid phone number`;
    }

    if (normalizedType === "phone" && String(value).replace(/\D/g, "").length > PHONE_DIGIT_LIMIT) {
      return `${label} must be at most ${PHONE_DIGIT_LIMIT} digits`;
    }

    if (normalizedType === "number") {
      const numberValue = Number(value);
      if (Number.isNaN(numberValue)) {
        return `${label} must be a number`;
      }
      const minValue = question.validation?.min ?? 0;
      if (numberValue < Number(minValue)) {
        return Number(minValue) === 0
          ? `${label} must be a non-negative number`
          : `${label} must be at least ${minValue}`;
      }
      if (
        question.validation?.max !== undefined &&
        question.validation?.max !== null &&
        numberValue > Number(question.validation.max)
      ) {
        return `${label} must be at most ${question.validation.max}`;
      }
    }

    if (normalizedType === "date") {
      if (!isValidDate(String(value))) {
        return `${label} must be a valid date`;
      }
      const selectedDate = new Date(String(value).includes('T') ? String(value) : String(value) + 'T00:00:00');
      selectedDate.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate > today) {
        return `${label} cannot be a future date`;
      }
    }

    if (["datetime", "datetime-local", "date-time"].includes(normalizedType)) {
      const datetimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;
      if (!datetimeRegex.test(String(value)) || !isValidDate(String(value))) {
        return `${label} must be a valid date and time`;
      }
      const selectedDateTime = new Date(String(value));
      if (selectedDateTime > new Date()) {
        return `${label} cannot be a future date and time`;
      }
    }

    return "";
  }, []);

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
    if (!currentReportNumber) { toast.error("Report not initialized"); return false; }
    // Defaults are seeded up front, but a question revealed later by
    // conditional logic missed that pass — so fold them in again here. An
    // explicit answer, including one the reporter cleared to "", still wins.
    const visibleDefaults = collectDefaults(getVisibleQuestions(visibleSections[currentStep]));
    const currentData = { ...visibleDefaults, ...(stepData[currentStep] || {}) };
    const isStepValid = validateCurrentStep();
    if (!isStepValid) {
      toast.error("Please fix validation errors before saving");
      return false;
    }
    setIsSaving(true);
    setError("");
    try {
      const response = await reportsAPI.saveStep(
        currentReportNumber,
        currentStep,
        currentData,
        isAnonymous ? password : null,
        anonymousOrgSlug || undefined
      );
      setProgressInfo(response);
      setStepData((prev) => ({ ...prev, [currentStep]: currentData }));
      setAllFormData((prev) => ({ ...prev, ...currentData }));
      toast.success(`Step ${currentStep + 1} saved!`);
      return true;
    } catch (err) {
      const message = err.response?.data?.detail || "Failed to save step";
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [currentReportNumber, currentStep, stepData, isAnonymous, password, validateCurrentStep,
      anonymousOrgSlug, collectDefaults, getVisibleQuestions, visibleSections]);

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
    if (!currentReportNumber) { toast.error("Report not initialized"); return; }
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
      toast.success("Report submitted successfully!");
      if (onSuccess) onSuccess(response);
    } catch (err) {
      const message = err.response?.data?.detail || "Failed to submit report";
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [currentReportNumber, isAnonymous, password, onSuccess, attachments, allFormData, extractFormAttachmentKeys, anonymousOrgSlug]);

  const handleCopyCredentials = useCallback(async () => {
    const text = `Report Number: ${reportNumber}\nPassword: ${password}`;
    if (await copyToClipboard(text)) {
      toast.success("Credentials copied!");
    } else {
      toast.error("Could not copy — please select the credentials and copy them manually.");
    }
  }, [reportNumber, password]);

  // ============ RENDER FUNCTIONS ============

  const renderLoading = () => (
    <div className="max-w-4xl mx-auto">
      <Card>
        <div className="text-center py-12">
          <Loader className="w-8 h-8 text-accent-fg animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-ink mb-2">
            {isEditingDraft
              ? "Loading Your Draft"
              : isAnonymous
                ? "Preparing Anonymous Report"
                : "Initializing Your Report"}
          </h2>
          <p className="text-ink-muted">
            {isEditingDraft
              ? "Restoring your saved answers..."
              : isAnonymous
                ? "Setting up your secure anonymous form..."
                : "Linking report to your account..."}
          </p>
        </div>
      </Card>
    </div>
  );

  // Attachments stage — shown after completing all steps, before final submit
  const renderAttachmentsStage = () => (
    <div className="max-w-4xl mx-auto">
      <Card>
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-accent-soft rounded-full mb-3">
            <Paperclip className="w-6 h-6 text-accent-fg" />
          </div>
          <h2 className="text-xl font-bold text-ink">Attach Supporting Files</h2>
          <p className="text-ink-muted text-sm mt-1">
            Optionally upload evidence or documents to support your report. {ATTACHMENT_HINT}.
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
          <Alert variant="warning">Report not yet initialized — attachments unavailable.</Alert>
        )}

        <div className="mt-8 space-y-3 pt-6 border-t border-line">
          <Button
            variant="secondary"
            onClick={() => setStage("form")}
            startIcon={ArrowLeft}
            className="w-full"
          >
            Back to Form
          </Button>
          <Button
            onClick={() => setStage("summary")}
            endIcon={ChevronRight}
            className="w-full"
            variant="primary"
          >
            Continue to Review
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
            <h2 className="text-2xl font-bold text-ink">Ready to Submit!</h2>
            <p className="text-ink-muted mt-2">
              You've completed {completedSteps} out of {totalSteps} visible steps.
            </p>
          </div>

          <div className="mb-8">
            {/* 2-up on phones, 4-up from md — a 4-col grid squashes these
                numbers below ~380px */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="text-center p-4 rounded-xl bg-success-soft border border-success-line">
                <div className="text-2xl font-bold text-success-fg tabular-nums">{completedSteps}</div>
                <div className="text-xs text-ink-muted mt-0.5">Steps Completed</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-accent-soft border border-line-accent">
                <div className="text-2xl font-bold text-accent-fg tabular-nums">{totalSteps}</div>
                <div className="text-xs text-ink-muted mt-0.5">Visible Steps</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-info-soft border border-info-line">
                <div className="text-2xl font-bold text-info-fg tabular-nums">
                  {Math.round((completedSteps / totalSteps) * 100)}%
                </div>
                <div className="text-xs text-ink-muted mt-0.5">Completion</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-warning-soft border border-warning-line">
                <div className="text-2xl font-bold text-warning-fg tabular-nums">{attachments.length}</div>
                <div className="text-xs text-ink-muted mt-0.5">Attachments</div>
              </div>
            </div>

            <div className="bg-subtle rounded-xl p-6 mb-6">
              <h3 className="font-semibold text-ink mb-4">Report Information</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-ink-muted">Report Type</div>
                  <div className="text-lg font-semibold text-ink">{reportType?.name}</div>
                </div>
                {currentReportNumber && (
                  <div>
                    <div className="text-sm font-medium text-ink-muted">Report Number</div>
                    <div className="text-lg font-semibold text-accent-fg font-mono">{currentReportNumber}</div>
                  </div>
                )}
              </div>
            </div>

            {!allStepsCompleted && (
              <Alert variant="warning" className="mb-6">
                <div className="flex items-start">
                  <div>
                    <p className="font-medium text-sm">Some steps may not have data</p>
                    <p className="text-xs mt-1">
                      You have completed {completedSteps} out of {totalSteps} visible steps. You can go back and fill missing steps or submit as-is.
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
              Manage Attachments
            </Button>

            <Button
              onClick={() => setStage("form")}
              variant="secondary"
              startIcon={ArrowLeft}
              className="w-full"
            >
              Review & Edit Steps
            </Button>

            <Button
              onClick={handleFinalSubmit}
              isLoading={isSubmitting}
              disabled={isSubmitting}
              startIcon={Send}
              className="w-full"
              variant="primary"
            >
              Submit Report
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
                <GitBranch className="w-5 h-5 mr-2 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">No sections to display</p>
                  <p className="text-xs mt-1">
                    Based on your previous answers, no additional sections are available.
                  </p>
                </div>
              </div>
            </Alert>
            <div className="mt-4 space-y-3">
              <Button onClick={() => setCurrentStep(0)} variant="secondary" className="w-full">
                Review Answers
              </Button>
              <Button onClick={() => setStage("attachments")} variant="secondary" className="w-full">
                Continue to Attachments
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
              Back
            </button>
            {isEditingDraft ? (
              <div className="text-sm text-ink-muted">
                Editing draft{" "}
                <span className="font-mono font-semibold text-ink">{currentReportNumber}</span>
              </div>
            ) : isAnonymous ? (
              <div className="text-sm text-ink-muted">
                Report: <span className="font-mono font-semibold text-ink">{currentReportNumber}</span>
              </div>
            ) : (
              <div className="text-sm text-success-fg flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 shrink-0" />
                Linked to your account
              </div>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-ink capitalize tracking-[-0.02em]">{reportType.name}</h1>
          <p className="text-sm text-ink-muted mt-1">
            {section.title} • Step {currentStep + 1} of {totalSteps}
          </p>
        </div>

        {/* Progress indicator */}
        <div className="mb-6">
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-xs font-medium text-ink-muted">
              Step {currentStep + 1} of {totalSteps}
            </span>
            <span className="text-xs text-ink-subtle tabular-nums">
              {Math.round(((currentStep + 1) / totalSteps) * 100)}%
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
                  <span className="whitespace-nowrap">Step {index + 1}</span>
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
                <GitBranch className="w-5 h-5 mr-2 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">Conditional questions active</p>
                  <p className="text-xs mt-1">
                    Showing {visibleQuestions.length} of {section.questions?.length || 0} questions.
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
                <h3 className="text-lg font-semibold text-ink mb-2">No Questions Visible</h3>
                <p className="text-ink-muted">
                  Based on your previous answers, no questions are shown in this section.
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

                return (
                  <div key={question.id || idx} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="block text-sm font-medium text-ink">
                        {question.label}
                        {isRequired && <span className="text-danger-fg ml-1">*</span>}
                      </label>
                    </div>

                    {normalizedType === "textarea" ? (
                      <Textarea
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
                        value={value}
                        onChange={(e) => handleStepDataChange(question.name, e.target.value)}
                        onBlur={(e) => validateQuestionOnBlur(question, e.target.value)}
                        required={isRequired}
                        disabled={isLoading || isSaving}
                        options={question.options || []}
                        placeholder={question.placeholder || "Select an option"}
                        error={fieldError}
                        className="outline-none focus:ring-1"
                      >
                        <option value="">{question.placeholder || "Select an option"}</option>
                        {question.options?.map((option, optIdx) => {
                          const optionValue = typeof option === "object" ? option.value || option : option;
                          const optionLabel = typeof option === "object" ? option.label || option.value || option : option;
                          return <option key={optIdx} value={optionValue}>{optionLabel}</option>;
                        })}
                      </Select>
                    ) : normalizedType === "multiselect" ? (
                      <div className="space-y-2">
                        {question.options?.map((option, optIdx) => {
                          const optionValue = typeof option === "object" ? option.value || option : option;
                          const optionLabel = typeof option === "object" ? option.label || option.value || option : option;
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
                              <span className="ml-2 text-sm text-ink-secondary">{optionLabel}</span>
                            </label>
                          );
                        })}
                      </div>
                    ) : normalizedType === "boolean" ? (
                      <div className="flex gap-6">
                        <label className="flex items-center">
                          <input
                            type="radio" name={question.name} value="1"
                            checked={value === "1" || value === true || value === 1}
                            onChange={() => handleBooleanChange(true)}
                            className="w-4 h-4 text-accent-fg border-line-strong focus:ring-accent-ring"
                            disabled={isLoading || isSaving} required={isRequired}
                          />
                          <span className="ml-2 text-sm text-ink-secondary">Yes</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio" name={question.name} value="0"
                            checked={value === "0" || value === false || value === 0}
                            onChange={() => handleBooleanChange(false)}
                            className="w-4 h-4 text-accent-fg border-line-strong focus:ring-accent-ring"
                            disabled={isLoading || isSaving} required={isRequired}
                          />
                          <span className="ml-2 text-sm text-ink-secondary">No</span>
                        </label>
                      </div>
                    ) : normalizedType === "file" ? (
                      // Inline file questions in the form save the file reference in stepData,
                      // but the actual upload happens via the AttachmentsPanel.
                      // We auto-upload when the file is selected.
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
                    ) : isDateTimeField ? (
                      // Firefox's datetime-local picker only offers the calendar — the
                      // time has to be typed blind — so the field is split in two and
                      // recombined into the same YYYY-MM-DDTHH:MM string.
                      <DateTimeField
                        value={value}
                        disabled={isLoading || isSaving}
                        required={isRequired}
                        error={fieldError}
                        onChange={(next) => handleStepDataChange(question.name, next)}
                        onBlur={(next) => validateQuestionOnBlur(question, next)}
                      />
                    ) : (
                      <Input
                        type={
                          normalizedType === "email" ? "email"
                            : normalizedType === "phone" ? "tel"
                              : normalizedType === "number" ? "number"
                                : normalizedType === "date" ? "date"
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
                        title={question.type === 'phone' ? 'Write phone number including country code and without + symbol (e.g., 251912345678)' : ''}
                        disabled={isLoading || isSaving}
                        min={normalizedType === "number" ? (question.validation?.min ?? 0) : undefined}
                        max={
                          normalizedType === "number" ? question.validation?.max :
                            normalizedType === "date" ? new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0] :
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
                Previous
              </Button>
              <Button
                variant="secondary"
                onClick={handleSaveStep}
                isLoading={isSaving}
                disabled={isLoading || isSaving}
                startIcon={Save}
              >
                Save Step
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
                  Copy Credentials
                </Button>
              )}
              <Button
                onClick={handleSaveAndContinue}
                isLoading={isSaving}
                disabled={isLoading || isSaving}
                endIcon={currentStep === totalSteps - 1 ? Paperclip : ChevronRight}
                variant="primary"
              >
                {currentStep === totalSteps - 1 ? "Save & Attach files" : "Save & Continue"}
              </Button>
            </div>
          </div>
        </Card>

        {!isAnonymous && isAuthenticated && (
          <Alert variant="success" className="mt-4">
            <p className="text-sm">Your report is linked to your account. No password needed!</p>
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
          <h2 className="text-2xl font-bold text-ink">Report Submitted Successfully!</h2>
          <p className="text-ink-muted mt-2">
            Your {isAnonymous ? "anonymous " : ""}report has been received and is being processed.
            {!isAnonymous && " You can track it in your dashboard."}
          </p>
        </div>

        {isAnonymous ? (
          <>
            <div className="bg-subtle rounded-xl p-6 mb-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-sm font-medium text-ink-muted mb-2">Report Number</div>
                  <div className="text-2xl font-bold text-accent-fg font-mono">{currentReportNumber}</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium text-ink-muted mb-2">Password</div>
                  <div className="text-2xl font-bold text-ink font-mono">{password}</div>
                </div>
              </div>
            </div>
            <Alert variant="warning" className="mb-6">
              <div className="flex items-start">
                <Shield className="w-5 h-5 mr-2 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">Save Your Credentials!</p>
                  <p className="text-xs mt-1">
                    You will need both your report number and password to track this report.
                    <strong> These cannot be recovered if lost.</strong>
                  </p>
                </div>
              </div>
            </Alert>
            <div className="space-y-3">
              <Button onClick={handleCopyCredentials} startIcon={Copy} className="w-full" variant="secondary">
                Copy Credentials
              </Button>
              <Button
                onClick={() => navigate(`/${user?.organization_slug}/track-report?report=${currentReportNumber}`)}
                className="w-full" variant="secondary"
              >
                Track This Report
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="bg-success-soft rounded-xl p-6 mb-6">
              <div className="text-center">
                <div className="text-sm font-medium text-ink-muted mb-2">Your Report Number</div>
                <div className="text-2xl font-bold text-accent-fg font-mono">{currentReportNumber}</div>
                <p className="text-sm text-ink-muted mt-2">This report is linked to your account.</p>
              </div>
            </div>
            <Alert variant="success" className="mb-6">
              <p className="text-sm">Your report has been submitted and is linked to your account.</p>
            </Alert>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button variant="secondary" onClick={() => navigate(`/${user?.organization_slug}/reporter/dashboard`)}>
                Go to Dashboard
              </Button>
              <Button onClick={() => navigate(`/${user?.organization_slug}/reporter/submit`)} variant="secondary">
                Submit Another Report
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
          <h2 className="text-xl font-semibold text-ink mb-2">Something went wrong</h2>
          <p className="text-ink-muted mb-4">Unable to load the report form. Please try again.</p>
          <Button onClick={onCancel} variant="secondary">Go Back</Button>
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

const DateTimeField = ({ value, disabled, required, error, onChange, onBlur }) => {
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
      toast.error("Report not initialized for file upload");
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
        toast.success(`"${uploaded.filename}" uploaded`);
      }
    } catch (err) {
      const msg = err.response?.data?.detail || "File upload failed";
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
            <span>Uploading… {uploadProgress}%</span>
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
                  toast.error("Failed to delete attachment");
                  return;
                }
              }
              setUploadedAttachmentKey(null);
              setUploadedFilename(null);
              onUploaded("");
            }}
            className="text-ink-subtle hover:text-danger-fg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <input
          type="file"
          onChange={handleChange}
          accept={ATTACHMENT_ACCEPT}
          disabled={isDisabled}
          required={question.required}
          className="block w-full text-sm text-ink-muted file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-accent-soft file:text-accent-fg hover:file:bg-accent-soft"
        />
      )}
    </div>
  );
};

export default MultiStepReportForm;
