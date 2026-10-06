import { useState, useEffect, useRef, useCallback } from "react";
import {
  MessageCircle,
  X,
  Ghost,
  Fingerprint,
  Send,
  ArrowLeft,
  CheckCircle2,
  Key,
  Eye,
  EyeOff,
  Copy,
  Download,
  AlertTriangle,
  User,
  Loader2,
  Pause,
  Globe,
  Volume2,
  MessageSquareText,
  Check,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { reportsAPI } from "../../api";
import { Mic, MicOff, Paperclip, FileText, Video as VideoIcon, Image as ImageIcon } from "lucide-react";
import axios from "axios";
import { Room, RoomEvent, Track } from "livekit-client";
import MarkdownMessage from "../ui/MarkDownMessage";
import AudioVisualizer from "../ui/AudioVisualizer";
import LanguagePills from "../ui/LanguagePills";
import { useAuthStore } from "../../store/authStore";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { isStaffUser, isIdentifiedUser } from "../../utils/roles";
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_HINT,
  validateAttachments,
} from "../../utils/attachments";
import {
  getInitialLanguage,
  getLanguageName,
  getModeCopy,
  isRtlLanguage,
  rememberLanguage,
} from "../../utils/languages";
// --- Utility Components ---

const Button = ({
  children,
  onClick,
  variant = "primary",
  className = "",
  icon: Icon,
  disabled = false,
}) => {
  const baseStyle =
    "flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary:
      "bg-accent text-on-accent hover:bg-accent shadow-[0_0_15px_rgba(96,165,250,0.3)]",
    outline:
      "bg-transparent border border-line text-ink-muted hover:text-ink hover:border-line-strong hover:bg-surface",
    ghost:
      "bg-transparent text-ink-muted hover:text-ink hover:bg-surface",
    danger:
      "bg-danger-soft text-danger-fg border border-danger-line hover:bg-danger-soft",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyle} ${variants[variant]} ${className}`}
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
};

// The gap between the reporter finishing a turn and the agent's first word.
// It can be several seconds — the model runs, and in voice mode speech has to
// be synthesised before anything is sent — and an empty panel in that gap
// reads as a dropped call rather than as thinking.
const TypingIndicator = () => (
  <motion.div
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 6 }}
    transition={{ duration: 0.18 }}
    className="flex justify-start"
    role="status"
    aria-label="The assistant is replying"
  >
    <div className="flex items-center gap-1.5 rounded-lg bg-active px-3.5 py-3 sm:px-4">
      {[0, 0.15, 0.3].map((delay) => (
        <motion.span
          key={delay}
          className="block h-1.5 w-1.5 rounded-full bg-ink-subtle"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut", delay }}
        />
      ))}
    </div>
  </motion.div>
);

// --- Toast Notification Component (Simple implementation) ---
//
// Placement matters more than it looks. The panel is z-60 and the launcher
// z-80, so a toast below either of those renders behind the widget — it reads
// as a flash under the chat and then nothing. When the panel is open the toast
// is rendered inside it, pinned to the top, which puts it above the panel's own
// stacking context and in front of the user; when the widget is closed it falls
// back to the corner, above the launcher.
const Toast = ({ message, type, inPanel = false }) => (
  <motion.div
    initial={{ opacity: 0, y: inPanel ? -12 : 50 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: inPanel ? -12 : 50 }}
    className={`${inPanel
      ? "absolute top-3 left-1/2 z-90 w-max max-w-[calc(100%-2rem)] -translate-x-1/2 sm:top-4"
      : "fixed bottom-24 right-6 z-90"
      } px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 ${type === "error"
        ? "bg-danger-solid text-white"
        : "bg-success-solid text-white"
      }`}
  >
    {type === "error" ? (
      <AlertTriangle size={16} />
    ) : (
      <CheckCircle2 size={16} />
    )}
    <span className="text-sm font-medium wrap-break-word">{message}</span>
  </motion.div>
);

// How long the "thinking" dots stay up with nothing arriving before they are
// taken down. A silent agent should leave the transcript looking finished, not
// permanently mid-sentence.
const TYPING_INDICATOR_TIMEOUT_MS = 60000;

// How tall the composer may grow before it starts scrolling instead. Roughly
// five lines — enough for a paragraph without the transcript being squeezed
// off the top of a short panel.
const COMPOSER_MAX_HEIGHT = 120;

/**
 * Folds one transcription chunk into the text collected so far.
 *
 * Chunks normally arrive as pieces to append. A chunk that already starts with
 * everything collected so far is not a piece, though — it is the same
 * utterance re-sent in full, which is how a corrected or finalised
 * transcription is delivered. Appending that gives "hellohello".
 */
const foldTranscriptChunk = (collected, chunk) =>
  collected && chunk.startsWith(collected) ? chunk : collected + chunk;

// The agent publishes lifecycle events for the call on this data topic.
const REPORT_EVENT_TOPIC = "wb-report";

// Where the client asks the agent to start or stop speaking. Separate from the
// event topic above, which only ever carries messages in the other direction.
const VOICE_CONTROL_TOPIC = "wb-control";

// The agent confirms every voice change with a `voice.state` event, so the
// button is never driven optimistically. This is only how long the control
// stays busy before it gives up waiting — a stuck button is worse than one
// that briefly disagrees with an agent that never answered.
const VOICE_STATE_TIMEOUT_MS = 5000;

// How the call opens when the reporter has not chosen for themselves.
//
// Voice everywhere except touch devices: on mobile web, autoplay policies and
// background tabs make audio genuinely unreliable, and this is a whistleblowing
// tool — someone reporting from a desk, a bus or a shared room may not want it
// audible before they have had a chance to say otherwise. Both are one tap from
// the other, and the choice is on screen before the call starts.
const getInitialVoiceOutput = () => {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return !window.matchMedia("(pointer: coarse)").matches;
};

// How long to wait for the assistant's opening message before unlocking the
// composer anyway. Long enough for a slow first token, short enough that a
// silent agent does not trap the reporter.
const AGENT_GREETING_TIMEOUT_MS = 30000;


// The wait between answering the language question and the assistant's first
// word. It covers a token request, a room connection and the agent's own
// startup, so it is rarely instant — and an empty panel with a spinner in the
// corner makes those seconds feel like a fault.
//
// The steps are the real ones, in order, driven by the same state the rest of
// the widget uses. Naming what is happening is what makes a wait tolerable;
// a fake progress bar just moves the anxiety somewhere else.
const CONNECTING_SLOW_MS = 9000;

const ConnectingState = ({ hasToken, isConnected, agentReady, languageName }) => {
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsSlow(true), CONNECTING_SLOW_MS);
    return () => clearTimeout(timer);
  }, []);

  const steps = [
    {
      label: "Preparing a secure room",
      done: hasToken,
    },
    {
      label: languageName ? `Connecting in ${languageName}` : "Connecting",
      done: isConnected,
    },
    {
      label: "Waking the assistant",
      done: agentReady,
    },
  ];
  // The first step that is not finished is the one in progress.
  const activeIndex = steps.findIndex((step) => !step.done);

  return (
    <div className="flex min-h-[85%] flex-col items-center justify-center px-6 py-8 text-center">
      {/* Something alive to look at, so the panel does not read as frozen. */}
      <div className="relative flex h-20 w-20 items-center justify-center">
        {[0, 0.6, 1.2].map((delay) => (
          <motion.span
            key={delay}
            className="absolute inset-0 rounded-full border border-line-accent"
            initial={{ scale: 0.6, opacity: 0.45 }}
            animate={{ scale: 1.35, opacity: 0 }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut", delay }}
          />
        ))}
        <motion.div
          className="relative flex h-14 w-14 items-center justify-center rounded-full border border-line-accent bg-accent-soft text-accent-fg"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <Ghost size={24} />
        </motion.div>
      </div>

      <h3 className="mt-5 text-sm font-semibold text-ink">
        Setting up your conversation
      </h3>
      <p className="mt-1 max-w-[16rem] text-xs leading-relaxed text-ink-muted">
        This takes a few seconds. The assistant will open the conversation.
      </p>

      <ul className="mt-5 w-full max-w-60 space-y-2 text-left">
        {steps.map((step, index) => {
          const isActive = index === activeIndex;
          return (
            <motion.li
              key={step.label}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: index * 0.08 }}
              className={`flex items-center gap-2.5 text-xs ${step.done
                ? "text-ink-muted"
                : isActive
                  ? "text-ink"
                  : "text-ink-subtle"
                }`}
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                {step.done ? (
                  <Check size={13} className="text-success-fg" />
                ) : isActive ? (
                  <Loader2 size={13} className="animate-spin text-accent-fg" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-line-strong" />
                )}
              </span>
              {step.label}
            </motion.li>
          );
        })}
      </ul>

      {/* Only after it has actually been slow — said upfront it would just
          plant the idea. */}
      <AnimatePresence>
        {isSlow && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-5 max-w-[16rem] text-[11px] leading-relaxed text-ink-subtle"
          >
            Still working — a slow connection can make this take a little longer.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
};

// "Login to your account" in the widget sends the visitor to the login page.
// This flag (per tab, so it survives a Google/Microsoft sign-in round trip)
// keeps the widget open there and reopens it once they are signed in.
const LOGIN_HANDOFF_KEY = "xposer-widget-login-handoff";

const readLoginHandoff = () => {
  try {
    return sessionStorage.getItem(LOGIN_HANDOFF_KEY) === "1";
  } catch {
    return false;
  }
};

const writeLoginHandoff = (on) => {
  try {
    if (on) sessionStorage.setItem(LOGIN_HANDOFF_KEY, "1");
    else sessionStorage.removeItem(LOGIN_HANDOFF_KEY);
  } catch {
    // Storage blocked: the widget just won't reopen on its own.
  }
};

// --- Main Application ---

export default function AIChatWidget() {
  const { isAuthenticated, token: authToken, user } = useAuthStore();

  // The widget is a reporting channel, so it is only for people who file
  // reports: logged-out visitors, anonymous tracking sessions and reporter
  // accounts. Compliance, reviewer and admin accounts never see it.
  const isStaff = isStaffUser(user);
  // A signed-in reporter account skips the "anonymous vs account" choice and
  // lands straight on the account-report credentials screen.
  const isReporterAccount = isIdentifiedUser(user) && !isStaff;
  const entryStep = isReporterAccount ? "loggedin-submission" : "home";

  const location = useLocation();
  const onLoginPage = /\/login\/?$/.test(location.pathname);
  const [loginHandoff, setLoginHandoff] = useState(readLoginHandoff);
  // Waiting on the login page: the panel shrinks to a small card so the
  // login form stays usable.
  const awaitingLogin = loginHandoff && onLoginPage && !isAuthenticated;

  const [isOpen, setIsOpen] = useState(loginHandoff);
  const [step, setStep] = useState(entryStep); // 'home', 'password-setup', 'credentials', 'chat'
  const [reportType, setReportType] = useState(null); // 'anonymous' | 'auth'

  // Credential States
  const [useCustomPassword, setUseCustomPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [credentials, setCredentials] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [token, setToken] = useState(null);
  const [isLoadingToken, setIsLoadingToken] = useState(false);
  const [tokenError, setTokenError] = useState(null);
  const roomRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  // The MediaStream behind the published mic track. Held in state (not a ref)
  // because the visualizer has to re-run its analyser when it arrives.
  const [micStream, setMicStream] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const { orgSlug: paramOrgSlug } = useParams();
  const orgSlug = user?.organization_slug ?? paramOrgSlug;
  const isTranscriptionHandlerRegistered = useRef(false);
  const [isAgentResponding, setIsAgentResponding] = useState(false);
  // The assistant opens the conversation. Until its first message has finished
  // arriving the composer stays locked, so a reporter cannot talk over the
  // greeting — which on a voice agent means their opening sentence is spoken
  // into a turn the agent is not listening to, and is simply lost.
  const [agentReady, setAgentReady] = useState(false);
  const agentReadyTimerRef = useRef(null);
  // The language the agent will speak and transcribe. It has to be chosen
  // before the token request: the backend writes it into the room name and the
  // agent builds its speech-to-text engine from that before anyone joins, so it
  // cannot be changed once the call is running.
  const [language, setLanguage] = useState(getInitialLanguage);
  // The room is not opened until this is true. The language has to travel on
  // the token, so picking it is the gate on connecting at all.
  const [languagePicked, setLanguagePicked] = useState(false);
  // Chosen language, waiting on the reply-mode answer. Both travel on the same
  // token, so the call starts on the second answer, not the first.
  const [pendingLanguage, setPendingLanguage] = useState(null);
  // What the token was actually issued with, echoed back by the backend. Shown
  // in the chat header so the caller can see what the agent is listening for.
  const [activeLanguage, setActiveLanguage] = useState(null);
  // How the call opens. This has to travel on the token: the greeting is spoken
  // during session startup, before the client can publish anything, so a call
  // meant to be silent that is only told after connecting says its first line
  // out loud and then goes quiet.
  const [voiceOutput, setVoiceOutput] = useState(getInitialVoiceOutput);
  // What the agent says it is actually doing, from its `voice.state` events.
  // The button renders this rather than the local intent — the two differ for
  // the moment between asking and being answered, and only one of them is true.
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voicePending, setVoicePending] = useState(false);
  const voicePendingTimerRef = useRef(null);
  // Set by the agent's `report.submitted` event. The call deliberately stays
  // open at that point — the agent is still reading the tracking credentials
  // aloud, and closing here would cut it off mid-sentence.
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [submittedReportNumber, setSubmittedReportNumber] = useState(null);
  // Set by `report.closing`: the report is filed and the agent has finished
  // speaking. The widget stays open on a completion screen rather than
  // vanishing — the caller still has to choose what to do next.
  const [callEnded, setCallEnded] = useState(false);
  const stopAgentStreamRef = useRef(false);
  const [isAuthCredentailsGenerated, setIsAuthCredentailsGenerated] =
    useState(false);
  const [isUploading, setIsUploading] = useState(false);
  // Set while the submitted report's id is looked up on the reporter's own
  // account, so the completion button cannot be pressed twice.
  const [isOpeningReport, setIsOpeningReport] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const navigate = useNavigate();
  // Toast State
  const [toast, setToast] = useState(null);

  // Attention seeker (bubble hint near the launcher button)
  const attentionMessages = [
    "We're here!",
    "Got something to report?",
    "Chat with us anytime.",
  ];
  const [attentionIndex, setAttentionIndex] = useState(0);
  const [showAttention, setShowAttention] = useState(false);

  // Chat States
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  // True from the moment the reporter finishes a turn until the agent's first
  // word arrives — the gap the dots fill. Once text is streaming the bubble
  // itself shows the progress, so this goes back to false.
  const [isTyping, setIsTyping] = useState(false);
  const typingTimerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const audioElementRef = useRef(null);
  const agentAudioElsRef = useRef([]);
  const localAudioTrackRef = useRef(null);
  const fileInputRef = useRef(null);
  const composerRef = useRef(null);
  // Toast helper
  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Keep the entry screen in sync when the session changes while mounted
  // (log in / log out), without disturbing an in-progress flow.
  useEffect(() => {
    setStep((current) =>
      current === "home" || current === "loggedin-submission"
        ? entryStep
        : current,
    );
  }, [entryStep]);

  // Finish the login handoff once the visitor has signed in and left the
  // login page. Waiting for that matters: the widget on the login page sees
  // the sign-in first and is then unmounted, and the one on the next page is
  // the one that should open.
  useEffect(() => {
    if (!loginHandoff) return;
    if (isAuthenticated && !onLoginPage) {
      setLoginHandoff(false);
      writeLoginHandoff(false);
      // Only an account reporter continues here. Staff never see the widget,
      // and a report-tracking session isn't the account they went to log into.
      if (isReporterAccount) {
        setStep(entryStep);
        setIsOpen(true);
      }
    } else if (!isAuthenticated && !onLoginPage) {
      // Left the login page without signing in: back to a normal widget.
      setLoginHandoff(false);
      writeLoginHandoff(false);
    }
  }, [loginHandoff, isAuthenticated, onLoginPage, isReporterAccount, entryStep]);

  const startLoginHandoff = () => {
    writeLoginHandoff(true);
    setLoginHandoff(true);
    navigate(orgSlug ? `/${orgSlug}/login` : `/login`);
  };

  const cancelLoginHandoff = () => {
    writeLoginHandoff(false);
    setLoginHandoff(false);
    setIsOpen(false);
  };

  // Check for existing credentials on mount
  useEffect(() => {
    const saved = localStorage.getItem("reportCredentials");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCredentials(parsed);
      } catch (e) {
        localStorage.removeItem("reportCredentials");
      }
    }
  }, []);

  // Scroll to bottom of chat
  useEffect(() => {
    if (step === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, step]);

  // Attention seeker: periodically pop up a helpful hint near the button when the widget is closed
  useEffect(() => {
    if (isOpen) {
      setShowAttention(false);
      return;
    }

    const initialTimer = setTimeout(() => setShowAttention(true), 2000);
    const cycleInterval = setInterval(() => {
      setShowAttention(false);
      setTimeout(() => {
        setAttentionIndex((prev) => (prev + 1) % attentionMessages.length);
        setShowAttention(true);
      }, 400);
    }, 8000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(cycleInterval);
    };
  }, [isOpen]);

  const handleClose = () => {
    setIsOpen(false);
  };


  const handleAnonymousSelect = () => {
    setReportType("anonymous");
    setStep("password-setup");
  };

  // --- NEW: Updated handleInitialize function ---
  const handleInitialize = async () => {
    if (isStaff) {
      showToast("You are signed in to a staff account. Log out to file a report.", "error");
      return null;
    }
    if (useCustomPassword && password.length < 6) {
      showToast("Password must be at least 6 characters", "error");
      return;
    }

    setIsLoading(true);
    try {
      const customPassword = useCustomPassword ? password : null;
      const response = await reportsAPI.startAnonymousReport(
        customPassword,
        orgSlug || undefined
      );

      const newCredentials = {
        reportNumber: response.report_number,
        password: response.password,
        ...(orgSlug ? { organization_slug: orgSlug } : {}),
      };

      // Store immediately before setting state to avoid race condition
      localStorage.setItem("reportCredentials", JSON.stringify(newCredentials));
      console.log(
        "Credentials stored immediately:",
        newCredentials.reportNumber,
      );

      setCredentials(newCredentials);
      setMessages([]); // Clear previous chat history
      setStep("credentials");
    } catch (error) {
      console.error("Failed to initialize:", error);
      showToast(
        error.response?.data?.detail || "Failed to initialize report",
        "error",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthInitialize = async () => {
    if (isStaff) {
      showToast("You are signed in to a staff account. Log out to file a report.", "error");
      return null;
    }
    setIsLoading(true);
    try {
      const initResponse = await reportsAPI.startAuthenticatedReport(orgSlug || undefined);
      if (initResponse) {
        const newCredentials = {
          reportNumber: initResponse.report_number,
          ...(orgSlug ? { organization_slug: orgSlug } : {}),
        };

        localStorage.setItem('reportCredentials', JSON.stringify(newCredentials));
        console.log('Authenticated report credentials stored:', newCredentials.reportNumber);

        setCredentials(newCredentials);
        setMessages([]); // Clear previous chat history
        setIsAuthCredentailsGenerated(true);
        setIsLoading(false);
      }
      console.log(initResponse);
    } catch (error) {
      setIsLoading(false);
      setIsAuthCredentailsGenerated(false);
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!credentials) return;
    // A report filed from an account has no report password — the account is
    // what opens it. Only an anonymous report has one to copy.
    const text = credentials.password
      ? `Report Number: ${credentials.reportNumber}\nPassword: ${credentials.password}`
      : `Report Number: ${credentials.reportNumber}`;
    navigator.clipboard.writeText(text);

    const btn = document.getElementById("copyBtn");
    if (btn) {
      const original = btn.innerHTML;
      btn.innerHTML = '<span class="text-success-fg">Copied!</span>';
      setTimeout(() => (btn.innerHTML = original), 2000);
    }
  };

  const handleCopyReportNumber = () => {
    if (!submittedReportNumber) return;
    navigator.clipboard
      ?.writeText(submittedReportNumber)
      .then(() => showToast("Report number copied"))
      .catch(() => showToast("Could not copy — please write it down", "error"));
  };

  const handleDownloadCredentials = () => {
    if (!credentials) return;
    // Same as the copy above: no password line at all for an account report,
    // rather than a line reading "Password: undefined".
    const content = credentials.password
      ? `
XposerAI Report Credentials
================================
Report Number: ${credentials.reportNumber}
Password: ${credentials.password}

IMPORTANT: Save these credentials. They cannot be recovered if lost.
Track your report at: ${window.location.origin}
Generated: ${new Date().toLocaleString()}
    `
      : `
XposerAI Report Credentials
================================
Report Number: ${credentials.reportNumber}

This report is filed under your account — sign in to open it. No report
password is needed.
Track your report at: ${window.location.origin}
Generated: ${new Date().toLocaleString()}
    `;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report_${credentials.reportNumber}_credentials.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // `languageCode` is passed explicitly by the picker: React state has not
  // updated yet at the moment the pill is clicked, and sending last session's
  // language would be worse than sending none.
  const getToken = useCallback(async (languageCode = language, voiceMode = voiceOutput) => {
    setIsLoadingToken(true);
    setTokenError(null);

    try {
      let freshCredentials = null;
      try {
        const stored = localStorage.getItem("reportCredentials");
        if (stored) {
          freshCredentials = JSON.parse(stored);
          console.log(
            "AIChatWidget - Fresh credentials from localStorage:",
            freshCredentials.reportNumber,
          );
        }
      } catch (e) {
        console.error("Error reading localStorage:", e);
      }

      let requestBody = {};
      let config = {
        timeout: 15000,
        headers: {},
      };

      if (isAuthenticated && authToken) {
        if (!freshCredentials?.reportNumber) {
          throw new Error(
            "Report number not available. Please ensure you have started a report.",
          );
        }

        requestBody = {
          reportNumber: freshCredentials.reportNumber,
          accessToken: authToken,
        };
        const tenant =
          user?.organization_slug ??
          freshCredentials?.organization_slug ??
          orgSlug;
        if (tenant) requestBody.organization_slug = tenant;
      } else if (!isAuthenticated) {
        if (!freshCredentials?.reportNumber || !freshCredentials?.password) {
          throw new Error("Anonymous credentials not available.");
        }

        requestBody = {
          reportNumber: freshCredentials.reportNumber,
          password: freshCredentials.password,
        };
        const tenant =
          freshCredentials?.organization_slug ?? orgSlug;
        if (tenant) requestBody.organization_slug = tenant;
      } else {
        throw new Error("Authentication state unclear.");
      }

      // The whole language integration: one optional field. The backend puts it
      // on the end of the room name (`..._lang_ur`) and stamps it on the token,
      // which is how the agent knows before the first word is spoken. Sending
      // it later would be too late.
      requestBody.language = languageCode;

      // Same reasoning, one layer up: the mode the call starts in cannot be a
      // toggle, because the greeting has already been spoken by the time a
      // toggle could be published. Omitting it would open the call speaking.
      requestBody.voiceOutput = voiceMode;

      const { data } = await axios.post(
        `${import.meta.env.VITE_API_URL}/livekit/getToken`,
        requestBody,
        config,
      );

      if (data.success && data?.data?.participant_token) {
        setToken(data.data.participant_token);
        // Trust the echo over the request: it is what the token was actually
        // issued with, and an unsupported code comes back as auto-detect.
        setActiveLanguage(data.data.language || languageCode);
        // The echo lets the button start correct rather than being derived.
        setVoiceEnabled(
          data.data.voice_output ? data.data.voice_output !== "off" : voiceMode,
        );
        console.log("✅ AIChatWidget - Token set successfully", {
          language: data.data.language,
          // The room name carries the language suffix and is baked into the
          // token grant — logged for support, never rebuilt client-side.
          roomName: data.data.room_name,
        });
      } else {
        throw new Error(data.message || "Invalid token response");
      }
    } catch (error) {
      console.error("❌ AIChatWidget - Error:", {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });

      if (error.response?.status === 401) {
        setTokenError(
          isAuthenticated
            ? "Invalid access token. Please log in again."
            : "Invalid report credentials.",
        );
      } else {
        setTokenError(
          error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to connect.",
        );
      }

      setToken(null);
      // Hand both choices back so the caller can retry instead of facing a
      // dead chat with no way forward.
      setLanguagePicked(false);
      setPendingLanguage(null);
    } finally {
      setIsLoadingToken(false);
    }
  }, [isAuthenticated, authToken, user?.organization_slug, orgSlug, language, voiceOutput]);

  // The language question is the first of two: it is remembered here, and the
  // reply-mode answer below is what actually opens the room. Both have to be
  // on the token — the language builds the agent's speech engine and the mode
  // decides whether the greeting is spoken, and the greeting happens during
  // session startup, before this client can send anything.
  const handleLanguagePick = (code) => {
    setLanguage(code);
    rememberLanguage(code);
    setPendingLanguage(code);
    setTokenError(null);
  };

  // Answering this is what starts the call. Both answers are passed straight
  // through rather than read back from state, which has not updated yet at
  // the moment the button is pressed.
  const handleModePick = (voiceMode) => {
    setVoiceOutput(voiceMode);
    setLanguagePicked(true);
    setTokenError(null);
    getToken(pendingLanguage || language, voiceMode);
  };

  // ==================== Room Connection ====================
  useEffect(() => {
    if (token && isOpen && !roomRef.current) {
      console.log("🚀 AIChatWidget - Connecting to room...");
      connectToRoom();
    }

    return () => {
      if (!isOpen && roomRef.current) {
        disconnectFromRoom();
      }
    };
  }, [token, isOpen]);

  // ==================== Message Deduplication ====================
  // Voice transcription arrives chunk by chunk, and the same chunk can be
  // delivered more than once within a single stream — that repetition is what
  // this removes, and it is the only thing it was ever needed for.
  //
  // The comparison is scoped to the stream the chunks belong to. Keyed on
  // content alone it also collapsed two separate turns that happened to say
  // the same thing: typing "Hi", then "Hi" again, showed one bubble while the
  // agent received both. A repeated message is a normal thing to send, and
  // dropping it from the transcript loses a message the reporter did write.
  const deduplicateMessages = (msgs) => {
    const seen = new Set();

    return msgs.filter((message) => {
      // Typed messages carry no stream, so there is nothing to de-duplicate
      // against and they always stand.
      if (!message.streamId) return true;

      const key = `${message.streamId}_${message.role}_${message.content}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  // ==================== File Handling ====================
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // The picker's `accept` filter is only a hint — "All files" and drag-drop
    // both bypass it — so everything is re-checked here against the same policy
    // the rest of the app uses.
    const { valid: validFiles, errors } = validateAttachments(
      files,
      selectedFiles.length,
    );

    // One toast per problem would stack faster than they clear; the first says
    // enough to fix the selection.
    if (errors.length > 0) showToast(errors[0], "error");

    if (validFiles.length > 0) {
      setSelectedFiles((prev) => [...prev, ...validFiles]);
      console.log(
        `📎 AIChatWidget - ${validFiles.length} file(s) selected:`,
        validFiles.map((f) => f.name),
      );
    }
    // Reset input so same files can be selected again if needed
    e.target.value = "";
  };

  const handlePaperclipClick = () => {
    if (!isConnected || !agentReady) return;
    fileInputRef.current?.click();
  };

  const removeFile = (indexToRemove) => {
    setSelectedFiles((prev) =>
      prev.filter((_, index) => index !== indexToRemove),
    );
  };

  const clearFiles = () => {
    setSelectedFiles([]);
  };

  // ==================== Room Event Handlers ====================
  const setupRoomEventHandlers = (room) => {
    room.on(RoomEvent.Connected, () => {
      console.log("✅ Connected to LiveKit");
      setIsConnected(true);
      setTokenError(null);
    });

    room.on(RoomEvent.Disconnected, (reason) => {
      console.log("Disconnected:", reason);
      setIsConnected(false);
      setIsMicEnabled(false);
      setIsRecording(false);
      setMicStream(null);
      // A dropped room means the next connection gets a fresh greeting, so the
      // composer locks again rather than sending into nothing.
      setAgentReady(false);
      isTranscriptionHandlerRegistered.current = false;

      if (reason === "token_expired") {
        setToken(null);
        setTokenError("Session expired.");
      }
    });

    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (
        track.kind === Track.Kind.Audio &&
        participant.identity !== room.localParticipant.identity
      ) {
        const audioElement = track.attach();
        agentAudioElsRef.current.push(audioElement);
        audioElement.play().catch((e) => {
          document.addEventListener(
            "click",
            () => {
              audioElement.play().catch(console.error);
            },
            { once: true },
          );
        });
      }
    });

    room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      if (
        track.kind === Track.Kind.Audio &&
        participant.identity !== room.localParticipant.identity
      ) {
        const detached = track.detach();
        detached.forEach((el) => {
          agentAudioElsRef.current = agentAudioElsRef.current.filter(
            (existing) => existing !== el,
          );
          el.remove?.();
        });
      }
    });

    // Lifecycle events from the agent. The order of the two that matter is the
    // whole point: `report.submitted` says the report landed, `report.closing`
    // says the agent has stopped talking and the chat can go.
    room.on(RoomEvent.DataReceived, (payload, _participant, _kind, topic) => {
      if (topic !== REPORT_EVENT_TOPIC) return;

      let event;
      try {
        event = JSON.parse(new TextDecoder().decode(payload));
      } catch (error) {
        console.error("AIChatWidget - unreadable report event:", error);
        return;
      }

      console.log("AIChatWidget - report event", event?.type, event);

      // The agent's own report of whether it is speaking. It fires once when
      // the room goes live, so the button starts correct, and after every
      // change — including ones this client did not ask for.
      if (event?.type === "voice.state") {
        clearTimeout(voicePendingTimerRef.current);
        setVoicePending(false);
        setVoiceEnabled(event.enabled !== false);
      }

      if (event?.type === "report.submitted") {
        // Filed, but the agent is still reading out the credentials. Confirm
        // it on screen and leave the call running.
        setReportSubmitted(true);
        setSubmittedReportNumber(event.report_number || null);
      }

      if (event?.type === "report.closing") {
        handleReportClosing(event);
      }
    });

    room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
      if (publication.kind === Track.Kind.Audio) {
        setIsRecording(false);
        setMicStream(null);
      }
    });

    // Use ref to prevent double registration
    if (!isTranscriptionHandlerRegistered.current) {
      room.registerTextStreamHandler(
        "lk.transcription",
        async (reader, participantInfo) => {
          const info = reader.info;
          const isUser =
            participantInfo.identity === room.localParticipant.identity;
          const sender = isUser ? "user" : "agent";

          console.log("AIChatWidget - Transcription stream started", {
            streamId: info.id,
            sender,
            timestamp: new Date().toISOString(),
          });

          if (sender === "agent") {
            // The agent has started composing but no word has landed yet.
            startTypingIndicator();
            stopAgentStreamRef.current = false;
            setIsAgentResponding(true);
            // A fresh response is starting - resume playback in case a
            // previous pause paused the element (muting alone won't
            // resume audio once paused).
            agentAudioElsRef.current.forEach((el) => {
              el.muted = false;
              el.play().catch(() => { });
            });
          }
          // One utterance keeps its segment id across the interim and final
          // transcriptions it is delivered as, where the stream id does not.
          const segmentId = info.attributes?.["lk.segment_id"] || info.id;

          let fullText = "";

          for await (const chunk of reader) {
            if (sender === "agent" && stopAgentStreamRef.current) {
              console.log("AIChatWidget - Agent response paused by user", {
                streamId: info.id,
              });
              break;
            }

            const piece = String(chunk);
            // The agent's replies have always been a plain append and work as
            // they are; only the reporter's own transcription is re-sent.
            fullText =
              sender === "user" ? foldTranscriptChunk(fullText, piece) : fullText + piece;

            if (sender === "agent") {
              // Agent: Merge chunks into one bubble. The reply is on screen
              // now, so the dots give way to the text.
              stopTypingIndicator();

              setMessages((prev) => {
                const existing = prev.find((m) => m.streamId === info.id);
                if (existing) {
                  return prev.map((m) =>
                    m.streamId === info.id
                      ? { ...m, content: fullText, isStreaming: true }
                      : m,
                  );
                } else {
                  return [
                    ...prev,
                    {
                      id: info.id,
                      streamId: info.id,
                      content: fullText,
                      role: sender,
                      messageType: "transcription",
                      timestamp: new Date(),
                      isStreaming: true,
                    },
                  ];
                }
              });
            } else {
              // What the reporter said, merged into one bubble the same way
              // the agent's reply is.
              //
              // Keyed on the segment rather than the stream: one spoken
              // sentence is delivered as an interim transcription and then a
              // final one, each on its own stream but sharing a segment id.
              // Adding them separately showed a single "hello" twice.
              setMessages((prev) => {
                const existing = prev.find((m) => m.streamId === segmentId);
                if (existing) {
                  return prev.map((m) =>
                    m.streamId === segmentId ? { ...m, content: fullText } : m,
                  );
                }
                return [
                  ...prev,
                  {
                    id: `${segmentId}_${Date.now()}`,
                    streamId: segmentId,
                    content: fullText,
                    role: sender,
                    messageType: "transcription",
                    timestamp: new Date(),
                    isStreaming: false,
                  },
                ];
              });
            }
          }

          if (sender === "user") {
            // The reporter has finished speaking; the agent's answer is what
            // comes next, and the wait for it is exactly what the dots are for.
            startTypingIndicator();
          }

          // Mark streaming as complete for agent
          if (sender === "agent") {
            setIsAgentResponding(false);
            // First agent message is done: hand the conversation to the user.
            setAgentReady(true);
            setMessages((prev) =>
              prev.map((m) =>
                m.streamId === info.id ? { ...m, isStreaming: false } : m,
              ),
            );
          }

          console.log("AIChatWidget - Transcription stream completed", {
            sender,
            streamId: info.id,
            finalLength: fullText.length,
          });
        },
      );
      isTranscriptionHandlerRegistered.current = true;
      console.log("AIChatWidget - Transcription handler registered");
    }
  };

  const disconnectFromRoom = () => {
    if (localAudioTrackRef.current) {
      localAudioTrackRef.current.stop();
      localAudioTrackRef.current = null;
    }

    if (roomRef.current) {
      roomRef.current.removeAllListeners();
      roomRef.current.disconnect();
      roomRef.current = null;
    }

    setIsConnected(false);
    setIsMicEnabled(false);
    setIsRecording(false);
    setMicStream(null);
    setIsAgentResponding(false);
    setIsTyping(false);
    clearTimeout(typingTimerRef.current);
    setAgentReady(false);
    setActiveLanguage(null);
    clearTimeout(voicePendingTimerRef.current);
    setVoicePending(false);
    // The next call opens in whichever mode is currently chosen, not in
    // whatever the last one happened to end on.
    setVoiceEnabled(voiceOutput);
    // One language per call: the next session asks again.
    setLanguagePicked(false);
    setPendingLanguage(null);
    isTranscriptionHandlerRegistered.current = false;
    agentAudioElsRef.current = [];
    clearFiles(); // Clear files on disconnect
  };

  // `report.closing` only ever follows a confirmed submission, so reaching here
  // means the report is filed and the agent has finished speaking. A failed
  // submission publishes neither event and the conversation simply continues,
  // so this cannot strand someone on a report that never filed.
  const handleReportClosing = (event) => {
    const reportNumber = event?.report_number || credentials?.reportNumber || null;

    // The call is over, so the room goes; the widget does not. Order matters —
    // disconnectFromRoom resets the per-call state, and the completion screen
    // needs the report number to survive it.
    disconnectFromRoom();
    setToken(null);
    setReportSubmitted(true);
    setSubmittedReportNumber(reportNumber);
    setCallEnded(true);
  };

  // Only the report number travels on the wire — the password is spoken to the
  // caller and never published — so the tracking form is prefilled with the
  // number and asks for the password they were told to write down.
  // Closes the widget down to its entry state and leaves for `to`. The report
  // number has to be read before this runs — the reset clears it.
  const leaveWidgetFor = (to, options) => {
    setIsOpen(false);
    setCallEnded(false);
    setReportSubmitted(false);
    setMessages([]);
    setStep(entryStep);
    navigate(to, options);
  };

  const handleTrackSubmittedReport = async () => {
    const reportNumber = submittedReportNumber || credentials?.reportNumber || null;
    const slug = user?.organization_slug ?? orgSlug;
    const base = slug ? `/${slug}` : "";
    const trackingPage = {
      to: `${base}/track-report`,
      options: { state: { reportNumber, justSubmitted: true } },
    };

    // The tracking form exists so an anonymous reporter can prove a report is
    // theirs with its password. A signed-in one has already proved it and the
    // report is on their dashboard, so they go straight to it.
    //
    // Their own page loads by numeric id, and the call only ever knew the
    // report number — the password is spoken, never published — so the id
    // comes from the reports the account owns.
    if (isReporterAccount && reportNumber) {
      setIsOpeningReport(true);
      try {
        const mine = await reportsAPI.getMyReports();
        const list = Array.isArray(mine) ? mine : mine?.items || mine?.results || [];
        const found = list.find(
          (item) => String(item?.report_number || "") === String(reportNumber),
        );
        if (found?.id) {
          leaveWidgetFor(`${base}/reporter/reports/${found.id}`, {
            state: { report: found, justSubmitted: true },
          });
          return;
        }
      } catch (error) {
        console.error("AIChatWidget - could not open the submitted report:", error);
      } finally {
        setIsOpeningReport(false);
      }
      // Not found yet, or the lookup failed. The tracking page runs the same
      // account lookup and explains itself if it comes up empty, which beats
      // stranding them on a completion screen with nowhere to go.
    }

    leaveWidgetFor(trackingPage.to, trackingPage.options);
  };

  // A new report needs new credentials, so the filed report's are cleared —
  // the same reset the End Session button performs.
  const handleStartNewReport = () => {
    localStorage.removeItem("reportCredentials");
    setCredentials(null);
    setCallEnded(false);
    setReportSubmitted(false);
    setSubmittedReportNumber(null);
    setMessages([]);
    setIsAuthCredentailsGenerated(false);
    setStep(entryStep);
  };

  // Not a mute: the reply is not lost, it arrives as text instead. Turning
  // speech off also skips TTS inference entirely, so text replies land sooner.
  //
  // The button is not moved here — the agent's `voice.state` reply moves it.
  // Anything else would show a mode the call is not actually in.
  const setVoiceMode = async (next) => {
    if (!roomRef.current || !isConnected || voicePending) return;
    // The segmented control has a half for each mode, so pressing the one
    // already in effect must do nothing rather than flip away from it.
    if (next === voiceEnabled) return;

    setVoicePending(true);
    clearTimeout(voicePendingTimerRef.current);

    try {
      await roomRef.current.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ enabled: next })),
        { reliable: true, topic: VOICE_CONTROL_TOPIC },
      );
      voicePendingTimerRef.current = setTimeout(
        () => setVoicePending(false),
        VOICE_STATE_TIMEOUT_MS,
      );
    } catch (error) {
      console.error("AIChatWidget - could not switch reply mode:", error);
      setVoicePending(false);
      showToast("Could not switch modes. Try again.", "error");
    }
  };

  const handlePauseResponse = () => {
    stopAgentStreamRef.current = true;
    setIsAgentResponding(false);
    stopTypingIndicator();
    // Silence the agent's voice response immediately - muting (rather than
    // detaching) keeps the same element usable for the next response.
    agentAudioElsRef.current.forEach((el) => {
      el.muted = true;
      try {
        el.pause();
      } catch (e) {
        /* ignore */
      }
    });
    setMessages((prev) =>
      prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)),
    );
  };

  const connectToRoom = async () => {
    try {
      const livekitUrl = import.meta.env.VITE_LIVEKIT_URL;
      if (!livekitUrl) throw new Error("VITE_LIVEKIT_URL not defined");
      if (!token) throw new Error("Token not available");

      const room = new Room({
        audioCaptureDefaults: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      roomRef.current = room;
      setAgentReady(false);
      setupRoomEventHandlers(room);
      await room.connect(livekitUrl, token);
    } catch (error) {
      console.error("Connection error:", error);
      setTokenError("Failed to connect.");
      setToken(null);
    }
  };

  const addMessage = (text, sender, messageType = "text", streamId = null) => {
    const trimmedText = text?.trim();
    if (!trimmedText) return null;

    const newMessage = {
      // Always unique. A voice turn arrives as many chunks sharing one stream
      // id, so using that as the identity gave every chunk in the turn the
      // same React key.
      id: `${streamId || "msg"}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      content: trimmedText,
      role: sender,
      messageType,
      timestamp: new Date(),
      isStreaming: false,
      ...(streamId && { streamId }),
    };

    setMessages((prev) => {
      const updatedMessages = [...prev, newMessage];
      // Apply deduplication
      return deduplicateMessages(updatedMessages);
    });

    return newMessage;
  };

  // Safety valve. If the agent never speaks first — it crashed, or this
  // deployment's prompt waits for the user — the composer would stay locked
  // forever, so release it after a grace period. Silence is far better handled
  // by an unlocked box than by a dead one.
  useEffect(() => {
    if (!isConnected || agentReady) {
      clearTimeout(agentReadyTimerRef.current);
      return undefined;
    }

    agentReadyTimerRef.current = setTimeout(() => {
      console.warn("AIChatWidget - no opening message from the agent; unlocking the composer");
      setAgentReady(true);
    }, AGENT_GREETING_TIMEOUT_MS);

    return () => clearTimeout(agentReadyTimerRef.current);
  }, [isConnected, agentReady]);

  // The voice-state wait is per-request, so it can outlive the widget.
  useEffect(() => () => clearTimeout(voicePendingTimerRef.current), []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSendMessage = async () => {
    if (
      (!inputValue.trim() && selectedFiles.length === 0) ||
      !roomRef.current ||
      !isConnected ||
      !agentReady
    )
      return;

    const message = inputValue.trim();

    // If there are files, upload them
    if (selectedFiles.length > 0) {
      setIsUploading(true);
      try {
        const reportNumber = credentials?.reportNumber;
        const password = isAuthenticated ? null : credentials?.password;
        const organizationSlug = orgSlug;

        if (!reportNumber) {
          throw new Error("Report number not found.");
        }

        const result = await reportsAPI.uploadAttachments(
          reportNumber,
          selectedFiles,
          password,
          setUploadProgress,
          organizationSlug || undefined
        );

        // Notify AI about the upload
        const fileNames = selectedFiles.map(f => f.name).join(", ");
        const notificationMessage = `I have uploaded the following files: ${fileNames}`;

        // Add to local UI
        addMessage(notificationMessage, "user", "text");

        // Send to LiveKit
        await roomRef.current.localParticipant.sendText(notificationMessage, {
          topic: "lk.chat",
        });

        showToast(result.message || "Files uploaded successfully");
      } catch (error) {
        console.error("Upload failed:", error);
        showToast(error.response?.data?.detail || "Upload failed", "error");
        setIsUploading(false);
        return; // Stop if upload failed
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
      }
    }

    if (message) {
      // Add message (deduplication will prevent if duplicate)
      addMessage(message, "user", "text");
    }

    try {
      if (message) {
        await roomRef.current.localParticipant.sendText(message, {
          topic: "lk.chat",
        });
        setInputValue("");
      }
      clearFiles(); // Clear files after sending
      // The turn is with the agent now. Nothing arrives on the wire until it
      // starts speaking, so without this the panel sits silent after a send.
      startTypingIndicator();
    } catch (error) {
      stopTypingIndicator();
      addMessage("Failed to send.", "assistant", "text");
    }
  };

  // The composer grows with what is being typed and stops at
  // COMPOSER_MAX_HEIGHT, after which it scrolls. Height is reset to `auto`
  // first so the box shrinks again when text is deleted — scrollHeight alone
  // only ever ratchets upward.
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;

    el.style.height = "auto";

    // scrollHeight covers content and padding but not the border, while the
    // height we set is a border-box. Without adding the border back, every
    // size is two pixels short of its own content and the browser shows a
    // scrollbar on a single empty line.
    const styles = window.getComputedStyle(el);
    const border =
      parseFloat(styles.borderTopWidth || 0) + parseFloat(styles.borderBottomWidth || 0);
    const needed = el.scrollHeight + border;

    el.style.height = `${Math.min(needed, COMPOSER_MAX_HEIGHT)}px`;
    // And only let it scroll once it has actually run out of room.
    el.style.overflowY = needed > COMPOSER_MAX_HEIGHT ? "auto" : "hidden";
  }, [inputValue, isMicEnabled]);

  const startTypingIndicator = () => {
    setIsTyping(true);
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(
      () => setIsTyping(false),
      TYPING_INDICATOR_TIMEOUT_MS,
    );
  };

  const stopTypingIndicator = () => {
    clearTimeout(typingTimerRef.current);
    setIsTyping(false);
  };

  useEffect(() => () => clearTimeout(typingTimerRef.current), []);

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleMicrophone = async () => {
    if (!roomRef.current || !isConnected || !agentReady) return;

    try {
      if (isMicEnabled) {
        if (localAudioTrackRef.current) {
          await roomRef.current.localParticipant.unpublishTrack(
            localAudioTrackRef.current,
          );
          localAudioTrackRef.current.stop();
          localAudioTrackRef.current = null;
        }
        await roomRef.current.localParticipant.setMicrophoneEnabled(false);
        setMicStream(null);
        setIsMicEnabled(false);
        setIsRecording(false);
      } else {
        await roomRef.current.localParticipant.setMicrophoneEnabled(true);
        const tracks = Array.from(
          roomRef.current.localParticipant.audioTrackPublications.values(),
        );
        if (tracks.length > 0) {
          localAudioTrackRef.current = tracks[0].audioTrack;
        }
        // Wrap the published track for the visualiser's analyser. This taps the
        // same track that is being sent, so the meter shows exactly what the
        // agent hears; if it is missing the visualiser falls back to its idle
        // animation rather than disappearing.
        const mediaStreamTrack = localAudioTrackRef.current?.mediaStreamTrack;
        setMicStream(mediaStreamTrack ? new MediaStream([mediaStreamTrack]) : null);
        setIsMicEnabled(true);
        setIsRecording(true);
      }
    } catch (error) {
      addMessage("Could not access microphone.", "assistant", "text");
      setIsMicEnabled(false);
      setIsRecording(false);
    }
  };

  const handleToggleChat = useCallback(() => {
    if (!isOpen) {
      console.log("Opening chat:", {
        isAuthenticated,
        hasAuthToken: !!authToken,
      });

      let freshCredentials = null;
      try {
        const stored = localStorage.getItem("reportCredentials");
        if (stored) freshCredentials = JSON.parse(stored);
      } catch (e) {
        /* ignore */
      }

      if (isAuthenticated) {
        if (!authToken) {
          setTokenError("Please log in first");
          return;
        }
        if (!freshCredentials?.reportNumber) {
          setTokenError("No report found.");
          return;
        }
      } else {
        if (!freshCredentials?.reportNumber || !freshCredentials?.password) {
          alert("Please create a report first.");
          return;
        }
      }

      setTokenError(null);
      setIsOpen(true);
    } else {
      setIsOpen(false);
      setTimeout(() => {
        if (roomRef.current) disconnectFromRoom();
        setToken(null);
        setTokenError(null);
        setMessages([]);
        clearFiles();
      }, 300);
    }
  }, [isOpen, isAuthenticated, authToken]);

  // const handleSendMessage = (e) => {
  //   e.preventDefault();
  //   if (!inputMessage.trim()) return;

  //   const userMsg = {
  //     id: Date.now(),
  //     text: inputMessage,
  //     sender: 'user',
  //     time: new Date()
  //   };

  //   setMessages(prev => [...prev, userMsg]);
  //   setInputMessage('');
  //   setIsTyping(true);

  //   setTimeout(() => {
  //     const botResponses = [
  //       "Thank you for that information. Can you provide more specific details about the incident?",
  //       "I understand. This will be kept strictly confidential. What is the approximate date of the occurrence?",
  //       "Noted. For your security, please do not mention specific names yet unless necessary. Can you describe the department involved?",
  //       "This is serious. I'm documenting this carefully. Do you have any evidence files to attach?",
  //       "Thank you for trusting this channel. An investigator will review this within 24 hours."
  //     ];

  //     const randomResponse = botResponses[Math.floor(Math.random() * botResponses.length)];

  //     setMessages(prev => [...prev, {
  //       id: Date.now() + 1,
  //       text: randomResponse,
  //       sender: 'bot',
  //       time: new Date()
  //     }]);
  //     setIsTyping(false);
  //   }, 1500);
  // };

  const clearCredentials = () => {
    localStorage.removeItem("reportCredentials");
    setCredentials(null);
    setStep(entryStep);
    setMessages([
      {
        id: 1,
        text: "Session cleared. How can I help you today?",
        sender: "bot",
        time: new Date(),
      },
    ]);
  };

  // --- Render Steps ---

  const renderHome = () => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex flex-col gap-4"
    >
      <div className="space-y-2">
        <h3 className="text-xl font-semibold text-ink">Submit a Report</h3>
        <p className="text-sm text-ink-muted">
          Choose how you want to proceed with your submission.
        </p>
      </div>

      <div className="grid gap-3">
        <button
          onClick={handleAnonymousSelect}
          className="group flex items-center gap-4 p-4 rounded-xl bg-surface border border-line hover:border-line-strong hover:bg-hover transition-all text-left"
        >
          <div className="p-2.5 bg-canvas rounded-lg border border-line group-hover:border-line-strong text-ink-muted group-hover:text-ink transition-colors">
            <Ghost size={22} />
          </div>
          <div>
            <h4 className="font-medium text-ink text-sm">Anonymous Report</h4>
          </div>
          <ArrowLeft
            className="ml-auto -rotate-180 opacity-0 group-hover:opacity-100 transition-opacity text-ink-muted"
            size={16}
          />
        </button>

        <button
          onClick={() => setStep("loggedin-submission")}
          className="group flex items-center gap-4 p-4 rounded-xl bg-surface border border-line hover:border-line-strong hover:bg-hover transition-all text-left opacity-75 hover:opacity-100"
        >
          <div className="p-2.5 bg-canvas rounded-lg border border-line group-hover:border-line-strong text-ink-muted group-hover:text-ink transition-colors">
            <Fingerprint size={22} />
          </div>
          <div>
            <h4 className="font-medium text-ink text-sm">Account Report</h4>
          </div>
        </button>
      </div>
    </motion.div>
  );

  const renderPasswordSetup = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col gap-4"
    >
      <button
        onClick={() => setStep("home")}
        className="flex items-center gap-1 text-xs text-ink-muted hover:text-ink transition-colors w-fit"
      >
        <ArrowLeft size={12} /> Back
      </button>

      <div className="space-y-1">
        <h3 className="text-lg font-medium text-ink flex items-center gap-2">
          <Key size={16} className="text-ink-muted" /> Secure Credentials
        </h3>
        <p className="text-xs text-ink-muted">
          Create a password to encrypt your report. You'll need this to check
          updates.
        </p>
      </div>

      <div className="space-y-3 mt-2">
        <label
          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${!useCustomPassword ? "border-line bg-raised" : "border-line bg-subtle"}`}
          onClick={() => setUseCustomPassword(false)}
        >
          <div
            className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center ${!useCustomPassword ? "border-line" : "border-line-strong"}`}
          >
            {!useCustomPassword && (
              <div className="w-1.5 h-1.5 bg-accent rounded-full" />
            )}
          </div>
          <div>
            <div className="text-sm font-medium text-ink">
              Auto-generate password
            </div>
            <div className="text-xs text-ink-muted">
              Strongest security (recommended)
            </div>
          </div>
        </label>

        <label
          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${useCustomPassword ? "border-line bg-raised" : "border-line bg-subtle"}`}
          onClick={() => setUseCustomPassword(true)}
        >
          <div
            className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center ${useCustomPassword ? "border-line" : "border-line-strong"}`}
          >
            {useCustomPassword && (
              <div className="w-1.5 h-1.5 bg-accent rounded-full" />
            )}
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-ink">Create my own</div>
            <div className="text-xs text-ink-muted">Minimum 6 characters</div>

            {useCustomPassword && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                className="mt-3 relative"
              >
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full bg-canvas border border-line rounded px-3 py-2 text-sm text-ink focus:border-line-accent outline-none"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPassword(!showPassword);
                  }}
                  className="absolute right-3 top-2.5 text-ink-muted hover:text-ink"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </motion.div>
            )}
          </div>
        </label>
      </div>

      <div className="p-3 bg-warning-soft border border-warning-line rounded-lg flex gap-2 items-start">
        <AlertTriangle size={14} className="text-warning-fg mt-0.5 shrink-0" />
        <p className="text-[10px] text-warning-fg leading-relaxed">
          <strong>Save your credentials!</strong> If you lose your password,
          your report cannot be recovered. We do not store passwords in plain
          text.
        </p>
      </div>

      <Button
        onClick={handleInitialize}
        disabled={isLoading || (useCustomPassword && password.length < 6)}
        icon={isLoading ? Loader2 : null}
        className="w-full mt-2"
      >
        {isLoading ? "Creating..." : "Create Secure ID"}
      </Button>
    </motion.div>
  );

  const renderCredentials = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col gap-4"
    >
      <div className="text-center space-y-2">
        <button
          onClick={() => setStep("home")}
          className="flex items-center gap-1 text-xs text-ink-muted hover:text-ink transition-colors w-fit"
        >
          <ArrowLeft size={12} /> Back
        </button>
        <div className="w-12 h-12 bg-success-soft text-success-fg rounded-full flex items-center justify-center mx-auto border border-success-line">
          <CheckCircle2 size={24} />
        </div>
        <h3 className="text-lg font-medium text-ink">Credentials Created</h3>
        <p className="text-xs text-ink-muted px-4">
          Your secure ID has been generated. Download or copy these details
          immediately.
        </p>
      </div>

      <div className="bg-canvas border border-line rounded-lg p-4 space-y-3 font-mono text-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-transparent via-line-strong to-transparent" />

        <div>
          <div className="text-xs text-ink-muted mb-1 uppercase tracking-wider">
            Report Number
          </div>
          <div className="text-ink text-base sm:text-lg tracking-wider break-all">
            {credentials?.reportNumber}
          </div>
        </div>

        <div>
          <div className="text-xs text-ink-muted mb-1 uppercase tracking-wider">
            Password
          </div>
          <div className="text-ink text-base sm:text-lg tracking-wider break-all">
            {credentials?.password}
          </div>
        </div>

        <div className="h-px bg-raised my-2" />

        <div className="flex gap-2">
          <button
            id="copyBtn"
            onClick={handleCopyCredentials}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-surface hover:bg-raised border border-line rounded text-xs text-ink-secondary transition-colors"
          >
            <Copy size={12} /> Copy
          </button>
          <button
            onClick={handleDownloadCredentials}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-surface hover:bg-raised border border-line rounded text-xs text-ink-secondary transition-colors"
          >
            <Download size={12} /> Download
          </button>
        </div>
      </div>

      {/* Opens the chat, which asks for a language before connecting. */}
      <Button onClick={() => setStep("chat")} className="w-full">
        Continue to Chat
      </Button>
    </motion.div>
  );

  // One source of truth for the composer's enabled state: the room has to be
  // up and the assistant has to have finished opening the conversation.
  const composerLocked = !isConnected || !agentReady;

  // The composer only exists once the call does. While the language question is
  // on screen there is nothing to type into, and hiding the whole footer keeps
  // the choice the only thing to act on. The transcript check keeps it visible
  // after a mid-call drop, so a dropped room never leaves a conversation with
  // no controls at all.
  const showComposer = (isConnected || messages.length > 0) && !callEnded;

  // The reply-mode step is the one thing the caller reads after choosing a
  // language and before the agent exists to translate anything, so it is
  // written in the language they just picked.
  const modeCopy = getModeCopy(pendingLanguage);
  const modeIsRtl = isRtlLanguage(pendingLanguage);

  const renderChat = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-full"
    >
      {/* Chat Header */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-line mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative shrink-0">
            <div className="w-2 h-2 bg-success-solid rounded-full absolute -top-0.5 -right-0.5 border border-line" />
            <Ghost size={16} className="text-ink-muted" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium text-ink truncate">
              {credentials?.organization_slug ? credentials.organization_slug.toUpperCase() : "Anonymous"}
            </div>
            <div className="text-[10px] text-ink-muted font-mono truncate">
              {credentials?.reportNumber}
            </div>
          </div>
          {/* Fixed for the session — changing it means ending the call and
              starting a new one, so this is a label, not a control. */}
          {activeLanguage && (
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line bg-subtle px-2 py-0.5 text-[10px] text-ink-muted"
              title="Language for this conversation. End the session to change it."
            >
              <Globe size={10} />
              {getLanguageName(activeLanguage)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Deliberately not next to the mic: the mic is what the agent
              hears, this is what it does back. A two-sided switch rather than
              one button that swaps label — a caller should be able to see
              which mode they are in without having to work out whether the
              label names the current state or the one it would change to.
              Labelled Voice/Text rather than muted/unmuted, because nothing is
              lost either way. */}
          {isConnected && !callEnded && (
            <div
              role="group"
              aria-label="How the assistant replies"
              className="flex shrink-0 items-center gap-0.5 rounded-full border border-line bg-subtle p-0.5"
            >
              {[
                {
                  enabled: true,
                  label: "Voice",
                  Icon: Volume2,
                  title: "The assistant speaks its replies",
                },
                {
                  enabled: false,
                  label: "Text",
                  Icon: MessageSquareText,
                  title: "The assistant replies silently, in text",
                },
              ].map(({ enabled, label, Icon, title }) => {
                const active = voiceEnabled === enabled;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setVoiceMode(enabled)}
                    disabled={voicePending}
                    aria-pressed={active}
                    title={title}
                    className={`relative inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${active ? "text-on-accent" : "text-ink-muted hover:text-ink"
                      }`}
                  >
                    {/* Slides between the halves — the movement is what makes
                        the change readable at this size. */}
                    {active && (
                      <motion.span
                        layoutId="voice-mode-thumb"
                        transition={{ type: "spring", stiffness: 420, damping: 34 }}
                        className="absolute inset-0 rounded-full bg-accent"
                      />
                    )}
                    <span className="relative flex items-center gap-1">
                      {/* The spinner sits on the half being moved to, since
                          the thumb stays put until the agent confirms. */}
                      {!active && voicePending ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <Icon size={11} />
                      )}
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {!callEnded && (
            <button
              onClick={() => {
                disconnectFromRoom();
                localStorage.removeItem("reportCredentials");
                setCredentials(null);
                setMessages([]);
                setStep(entryStep);
                setIsAuthCredentailsGenerated(false);
                setReportSubmitted(false);
                setSubmittedReportNumber(null);
                setCallEnded(false);
              }}
              className="text-[10px] px-2 py-1 bg-danger-solid text-white rounded hover:text-danger-fg"
            >
              End Session
            </button>
          )}
          <button
            onClick={() => {
              disconnectFromRoom();
              setIsOpen(false);
            }}
            className="md:hidden p-1 rounded text-ink-muted hover:text-ink hover:bg-raised transition-colors"
            title="Close chat"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2 custom-scrollbar scrollbar-thin">
        {/* The language question. Not a message from the agent — nothing is
            connected yet — but it reads as the opening turn, because the answer
            is what the room is built from. */}
        {!languagePicked && !callEnded && (
          <div className="space-y-3">
            {["Hey there! I'm your reporting assistant.", "Which language should we talk in?"].map(
              (line, index) => (
                <motion.div
                  key={line}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.12 }}
                  className="flex justify-start"
                >
                  <div className="min-w-0 max-w-[88%] sm:max-w-[80%] rounded-lg bg-active px-3.5 py-2 text-sm text-ink wrap-anywhere sm:px-4 sm:py-2.5">
                    {line}
                  </div>
                </motion.div>
              ),
            )}

            {!pendingLanguage && (
              <LanguagePills onSelect={handleLanguagePick} disabled={isLoadingToken} />
            )}

            {/* The language answer, kept in the thread as the caller's own
                reply, so the second question reads as the next turn. */}
            {pendingLanguage && (
              <>
                <div className="flex justify-end">
                  <div
                    dir="auto"
                    className="min-w-0 max-w-[88%] rounded-lg bg-accent px-3.5 py-2 text-sm text-on-accent wrap-anywhere sm:max-w-[80%] sm:px-4 sm:py-2.5"
                  >
                    {getLanguageName(pendingLanguage)}
                  </div>
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex justify-start"
                >
                  <div
                    dir={modeIsRtl ? "rtl" : "ltr"}
                    lang={pendingLanguage}
                    className="min-w-0 max-w-[88%] sm:max-w-[80%] rounded-lg bg-active px-3.5 py-2 text-sm text-ink wrap-anywhere sm:px-4 sm:py-2.5"
                  >
                    {modeCopy.question}
                  </div>
                </motion.div>

                {/* The mode has to be settled before the room opens: the
                    greeting is spoken during session startup, so a call that
                    opens speaking cannot be made silent in time. Answering is
                    what starts the call. */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: 0.1 }}
                  dir={modeIsRtl ? "rtl" : "ltr"}
                  lang={pendingLanguage}
                  className="mx-auto w-full max-w-sm pt-2"
                >
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      onClick={() => handleModePick(true)}
                      disabled={isLoadingToken}
                      icon={Volume2}
                      className="flex-1"
                    >
                      {modeCopy.speak}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleModePick(false)}
                      disabled={isLoadingToken}
                      icon={MessageSquareText}
                      className="flex-1"
                    >
                      {modeCopy.text}
                    </Button>
                  </div>
                  <p className="mt-2 text-center text-[11px] leading-snug text-ink-subtle">
                    {modeCopy.hint}
                  </p>
                  <button
                    type="button"
                    onClick={() => setPendingLanguage(null)}
                    disabled={isLoadingToken}
                    className="mx-auto mt-2 block text-[11px] text-ink-subtle underline underline-offset-2 transition-colors hover:text-ink disabled:opacity-50"
                  >
                    {modeCopy.changeLanguage}
                  </button>
                </motion.div>
              </>
            )}

            {tokenError && (
              <p className="pt-1 text-center text-xs text-danger-fg">
                {tokenError} Pick a language to try again.
              </p>
            )}
          </div>
        )}

        {/* Once answered, the choice stays in the thread as the caller's own
            first reply. */}
        {languagePicked && (
          <div className="flex justify-end">
            <div
              dir="auto"
              className="min-w-0 max-w-[88%] rounded-lg bg-accent px-3.5 py-2 text-sm text-on-accent wrap-anywhere sm:max-w-[80%] sm:px-4 sm:py-2.5"
            >
              {getLanguageName(activeLanguage || language)}
            </div>
          </div>
        )}

        {languagePicked && messages.length === 0 && (
          composerLocked ? (
            <ConnectingState
              hasToken={Boolean(token)}
              isConnected={isConnected}
              agentReady={agentReady}
              languageName={getLanguageName(activeLanguage || language)}
            />
          ) : (
            <div className="mt-8 text-center text-ink-subtle">
              How can I help you today?
            </div>
          )
        )}
        {messages.map((msg, index) => {
          const isUser = msg.role === "user";
          const isTranscription = msg.messageType === "transcription";

          return (
            <div
              key={msg.id || index}
              className={`flex ${isUser ? "justify-end" : "justify-start"}`}
            >
              {/* min-w-0 lets the bubble shrink inside the flex row, and
                  breaking anywhere keeps an unbroken run — a long URL, a
                  reference number — inside it instead of over the edge. */}
              <div
                className={`min-w-0 max-w-[88%] sm:max-w-[80%] rounded-lg px-3.5 py-2 sm:px-4 sm:py-2.5 text-sm wrap-anywhere ${isUser
                  ? isTranscription
                    ? "bg-accent text-on-accent"
                    : "bg-accent text-on-accent"
                  : isTranscription
                    ? "bg-active text-ink"
                    : "bg-active text-ink"
                  }`}
              >
                {isTranscription && isUser && (
                  <div className="text-xs opacity-60 mb-1 flex items-center gap-1">
                    <Mic size={10} />
                    <span>Voice</span>
                  </div>
                )}

                {/* dir="auto" so Arabic and Urdu transcripts lay out
                    right-to-left, judged per message from its own text. */}
                {msg.role === "agent" ? (
                  <div dir="auto">
                    <MarkdownMessage
                      content={msg.isStreaming ? `${msg.content}▌` : msg.content}
                    />
                  </div>
                ) : (
                  <span dir="auto" className="block whitespace-pre-wrap wrap-break-word">
                    {msg.content}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        <AnimatePresence>{isTyping && <TypingIndicator />}</AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* Selected Files List */}
      <AnimatePresence>
        {selectedFiles.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex flex-wrap gap-2 mb-3 bg-subtle p-3 rounded-xl border border-line"
          >
            {selectedFiles.map((file, index) => (
              <motion.div
                key={`${file.name}-${index}`}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-2 bg-raised border border-line px-3 py-1.5 rounded-lg text-[10px] text-ink group"
              >
                {file.type.startsWith("image/") ? (
                  <ImageIcon size={12} className="text-accent-fg" />
                ) : file.type.startsWith("video/") ? (
                  <VideoIcon size={12} className="text-accent-fg" />
                ) : (
                  <FileText size={12} className="text-ink-muted" />
                )}
                <span className="truncate max-w-30">{file.name}</span>
                <button
                  onClick={() => removeFile(index)}
                  className="text-ink-muted hover:text-danger-fg transition-colors ml-1"
                >
                  <X size={12} />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reportSubmitted && !callEnded && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="mb-3 flex items-start gap-2 rounded-xl border border-success-line bg-success-soft p-3"
          >
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success-fg" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-ink">
                Report filed
                {submittedReportNumber && (
                  <span className="font-mono font-normal text-ink-muted">
                    {" "}
                    · {submittedReportNumber}
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-ink-muted">
                Write down your report number and password now — the assistant is reading
                them out, and the password is never stored where it can be recovered.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The call is over but the widget is not: the caller still has to get to
          their report, or file another one. */}
      <AnimatePresence>
        {callEnded && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="rounded-2xl border border-line bg-surface p-4 shadow-md"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-success-line bg-success-soft text-success-fg">
                <CheckCircle2 size={18} />
              </span>
              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-ink">Report submitted</h4>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
                  Your report has been filed and is now with the compliance team. Nothing
                  further is needed from you right now.
                </p>
              </div>
            </div>

            {submittedReportNumber && (
              <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-line-subtle bg-subtle px-3 py-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-ink-subtle">
                    Report number
                  </p>
                  <p className="truncate font-mono text-sm font-semibold tracking-wider text-ink">
                    {submittedReportNumber}
                  </p>
                </div>
                {/* The number can be copied; the password never can, which is
                    exactly why it is worth saying so below. */}
                <button
                  onClick={handleCopyReportNumber}
                  className="shrink-0 rounded-lg border border-line p-2 text-ink-muted transition-colors hover:bg-hover hover:text-ink"
                  title="Copy report number"
                  aria-label="Copy report number"
                >
                  <Copy size={14} />
                </button>
              </div>
            )}

            <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-snug text-ink-subtle">
              <Key size={12} className="mt-0.5 shrink-0" />
              <span>
                {isReporterAccount
                  ? "This report is filed under your account — sign in with this number to follow it. Keep the number somewhere safe."
                  : "You will need this number and the password the assistant read out. The password is never stored, so it cannot be sent to you again — keep the copy you wrote down somewhere safe."}
              </span>
            </p>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button
                onClick={handleTrackSubmittedReport}
                disabled={isOpeningReport}
                className="flex-1"
              >
                {isOpeningReport ? "Opening report..." : isReporterAccount ? "View report" : "Track report"}
              </Button>
              <Button
                variant="outline"
                onClick={handleStartNewReport}
                className="flex-1"
              >
                Start new report
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Area - Consistent spacing. Absent entirely until the call is up:
          see showComposer. */}
      {/* items-end so the buttons stay level with the last line once the
          composer has grown past one row. */}
      {showComposer && (
        <div className="flex items-end gap-1.5 sm:gap-2">
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept={ATTACHMENT_ACCEPT}
            multiple
          />

          {/* Paperclip Button with Badge */}
          <div className="relative shrink-0">
            <button
              onClick={handlePaperclipClick}
              disabled={composerLocked}
              className="p-2 sm:p-2.5 rounded-full transition-colors bg-active text-ink-secondary hover:bg-active disabled:opacity-50"
              title={`Attach evidence — ${ATTACHMENT_HINT}`}
            >
              <Paperclip size={18} className="sm:w-5 sm:h-5" />
            </button>

            {/* File Count Badge */}
            {selectedFiles.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-danger-solid text-white text-xs font-bold rounded-full min-w-4.5 h-4.5 flex items-center justify-center px-1 border-2 border-line">
                {selectedFiles.length}
              </span>
            )}
          </div>

          {/* Text input, or the live mic meter while recording. The two swap in
            the same slot so the row's height and the buttons either side never
            move. */}
          <div className="relative flex min-w-0 flex-1 items-end">
            <AnimatePresence mode="wait" initial={false}>
              {isMicEnabled ? (
                <motion.div
                  key="visualizer"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.18 }}
                  className="flex min-w-0 flex-1"
                >
                  <AudioVisualizer stream={micStream} active={isMicEnabled} showTimer={false} />
                </motion.div>
              ) : (
                <motion.textarea
                  key="text-input"
                  ref={composerRef}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.18 }}
                  rows={1}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder={
                    !languagePicked
                      ? 'Choose a language to begin...'
                      : composerLocked
                        ? 'Waiting for the assistant...'
                        : 'Type a message...'
                  }
                  disabled={composerLocked}
                  // Enter sends and Shift+Enter breaks the line, so the box
                  // must never take a scroll wheel away from the transcript
                  // until it has actually filled up.
                  style={{ maxHeight: COMPOSER_MAX_HEIGHT }}
                  className="min-w-0 flex-1 resize-none overflow-y-hidden scrollbar-thin rounded-3xl border border-line-strong bg-canvas px-3 py-2 text-sm leading-relaxed text-ink focus:border-line-accent focus:outline-none disabled:opacity-50 sm:px-4 sm:py-2.5"
                />
              )}
            </AnimatePresence>
          </div>

          {/* Microphone Button */}
          <button
            onClick={toggleMicrophone}
            disabled={composerLocked}
            title={
              composerLocked
                ? "Wait for the assistant to finish"
                : isMicEnabled
                  ? "Stop recording"
                  : "Start recording"
            }
            aria-label={isMicEnabled ? "Stop recording" : "Start recording"}
            aria-pressed={isMicEnabled}
            className={`shrink-0 p-2 sm:p-2.5 rounded-full transition-colors ${isMicEnabled ? "bg-danger-solid text-white" : "bg-active text-ink-secondary hover:bg-active"} disabled:opacity-50`}
          >
            {isMicEnabled ? <MicOff size={18} className="sm:w-5 sm:h-5" /> : <Mic size={18} className="sm:w-5 sm:h-5" />}
          </button>

          {/* Send / Pause Button */}
          <button
            onClick={isAgentResponding ? handlePauseResponse : handleSendMessage}
            disabled={
              isAgentResponding
                ? false
                : composerLocked ||
                (!inputValue.trim() && selectedFiles.length === 0) ||
                isUploading
            }
            title={isAgentResponding ? "Pause response" : "Send message"}
            className="shrink-0 bg-accent text-on-accent p-2 sm:p-2.5 rounded-full hover:bg-accent disabled:opacity-50 transition-colors flex items-center justify-center min-w-10 sm:min-w-11"
          >
            {isUploading ? (
              <Loader2 size={18} className="sm:w-5 sm:h-5 animate-spin" />
            ) : isAgentResponding ? (
              <Pause size={18} className="sm:w-5 sm:h-5" />
            ) : (
              <Send size={18} className="sm:w-5 sm:h-5" />
            )}
          </button>
        </div>
      )}

      {showComposer && (
        <p className="mt-2 px-2 text-center text-[10px] leading-snug text-ink-subtle sm:text-[11px]">
          AI can make mistakes. Verify important details.
        </p>
      )}
    </motion.div>
  );

  const renderLoggedInSubmission = () => (
    <div>
      {isAuthenticated ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col gap-4"
        >
          {!isAuthCredentailsGenerated ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col gap-8"
            >
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-accent-soft text-accent-fg rounded-full flex items-center justify-center mx-auto border border-line-accent">
                  <User size={24} />
                </div>
                <h3 className="text-lg font-medium text-ink">
                  Welcome back, {user?.username || "User"}
                </h3>
                <p className="text-xs text-ink-muted px-4">
                  You are now logged in as {user?.username || "User"}
                </p>
              </div>

              <Button
                onClick={handleAuthInitialize}
                className="w-full flex items-center justify-center gap-2"
              >
                <Key size={16} /> Get Credentials
              </Button>
            </motion.div>
          ) : (
            <>
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-success-soft text-success-fg rounded-full flex items-center justify-center mx-auto border border-success-line">
                  <CheckCircle2 size={24} />
                </div>
                <h3 className="text-lg font-medium text-ink">
                  Credentials fetched
                </h3>
                <p className="text-xs text-ink-muted px-4">
                  Your report number has been fetched. Download or copy these
                  details
                </p>
              </div>

              <div className="bg-canvas border border-line rounded-lg p-4 space-y-3 font-mono text-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-transparent via-line-strong to-transparent" />

                <div>
                  <div className="text-xs text-ink-muted mb-1 uppercase tracking-wider">
                    Report Number
                  </div>
                  <div className="text-ink text-base sm:text-lg tracking-wider break-all">
                    {credentials?.reportNumber}
                  </div>
                </div>

                <div className="h-px bg-raised my-2" />

                <div className="flex gap-2">
                  <button
                    id="copyBtn"
                    onClick={handleCopyCredentials}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-surface hover:bg-raised border border-line rounded text-xs text-ink-secondary transition-colors"
                  >
                    <Copy size={12} /> Copy
                  </button>
                  <button
                    onClick={handleDownloadCredentials}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-surface hover:bg-raised border border-line rounded text-xs text-ink-secondary transition-colors"
                  >
                    <Download size={12} /> Download
                  </button>
                </div>
              </div>

              <Button onClick={() => setStep("chat")} className="w-full">
                Continue to Chat
              </Button>
            </>
          )}
        </motion.div>
      ) : (
        <div className="flex flex-col gap-10">
          <button
            onClick={() => setStep("home")}
            className="flex items-center gap-1 text-xs text-ink-muted hover:text-ink transition-colors w-fit"
          >
            <ArrowLeft size={12} /> Back
          </button>
          <div>
            <Fingerprint size={48} className="mx-auto text-ink-secondary mb-4" />
            <div className="flex flex-col gap-4">
              <h3 className="text-ink font-medium mb-2">Account Login</h3>
              <p className="text-sm text-ink-muted mb-4">
                Login to your account to continue.
              </p>
              <Button variant="outline" onClick={startLoginHandoff}>
                Login to your account
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Compliance / reviewer / admin accounts never get the reporting widget.
  if (isStaff) return null;

  return (
    <div className="max-h-screen bg-surface text-ink font-sans">
      {/* Background Pattern */}
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(#fff 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="fixed bottom-3 right-3 sm:bottom-4 sm:right-6 z-80 flex flex-col items-end pointer-events-none">
        <AnimatePresence>
          {isOpen && awaitingLogin && (
            <motion.div
              key="awaiting-login"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="mb-3 w-[min(20rem,calc(100vw-5.5rem))] max-sm:mr-16 max-sm:-mb-14 rounded-lg border border-line bg-surface p-3 shadow-2xl pointer-events-auto sm:p-4"
              role="status"
            >
              {/* Kept short on phones, where it sits beside the toggle button
                  instead of over the login form's sign-in options. */}
              <div className="flex items-start gap-3">
                <div className="hidden rounded-lg border border-line bg-canvas p-2 text-ink-secondary sm:block">
                  <Fingerprint size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">Sign in to continue your report</p>
                  <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                    <span className="sm:hidden">The assistant reopens once you're signed in.</span>
                    <span className="hidden sm:inline">
                      Use the form on this page. The assistant opens again as soon as you're signed in.
                    </span>
                  </p>
                </div>
              </div>
              <div className="mt-2 flex justify-end sm:mt-3">
                <button
                  type="button"
                  onClick={cancelLoginHandoff}
                  className="text-xs text-ink-muted transition-colors hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
          {isOpen && !awaitingLogin && (
            <motion.div
              key="panel"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="fixed inset-0 z-60 bg-canvas flex flex-col md:inset-auto md:bottom-20 md:right-6 md:w-lg md:max-w-[calc(100vw-2rem)] md:h-150 md:max-h-[80vh] md:rounded-lg md:border md:border-line md:shadow-2xl md:mb-2 overflow-hidden pointer-events-auto"
            >
              {/* Content Container - Fixed padding */}
              <div className="px-4 pb-4 pt-16 sm:px-6 sm:pb-6 sm:pt-20 md:p-6 bg-linear-to-b from-canvas to-transparent h-full flex flex-col relative overflow-hidden">
                {/* Anchored here rather than to the viewport so it lands over
                    the conversation instead of behind the panel. */}
                <AnimatePresence>
                  {toast && (
                    <Toast key="panel-toast" message={toast.message} type={toast.type} inPanel />
                  )}
                </AnimatePresence>

                <AnimatePresence mode="wait">
                  {step === "home" && (
                    <motion.div
                      key="home"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-full flex flex-col"
                    >
                      {renderHome()}
                    </motion.div>
                  )}
                  {step === "password-setup" && (
                    <motion.div
                      key="password"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-full flex flex-col"
                    >
                      {renderPasswordSetup()}
                    </motion.div>
                  )}
                  {step === "credentials" && (
                    <motion.div
                      key="creds"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-full flex flex-col"
                    >
                      {renderCredentials()}
                    </motion.div>
                  )}
                  {step === "chat" && (
                    <motion.div
                      key="chat"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-full flex flex-col"
                    >
                      {renderChat()}
                    </motion.div>
                  )}
                  {step === "loggedin-submission" && (
                    <motion.div
                      key="auth"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-center py-10"
                    >
                      {renderLoggedInSubmission()}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative pointer-events-auto">
          <AnimatePresence>
            {!isOpen && showAttention && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.9 }}
                transition={{ duration: 0.25 }}
                className="absolute bottom-[calc(100%+10px)] right-0 max-w-[70vw] sm:max-w-xs lg:max-w-lg whitespace-nowrap sm:whitespace-normal bg-surface text-ink text-xs sm:text-sm lg:text-base font-medium px-3.5 py-2 sm:px-4 sm:py-2.5 lg:px-5 lg:py-3 rounded-2xl rounded-br-sm shadow-xl border border-line"
              >
                {attentionMessages[attentionIndex]}
                <div className="absolute -bottom-1.5 right-4 w-3 h-3 bg-surface border-r border-b border-line rotate-45" />
              </motion.div>
            )}
          </AnimatePresence>

          {!isOpen && (
            <span className="absolute inset-0 rounded-full bg-accent-soft animate-ping pointer-events-none" />
          )}

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 1.1 }}
            onClick={() => (awaitingLogin ? cancelLoginHandoff() : setIsOpen(!isOpen))}
            className={`
              ${isOpen && step === "chat" ? "hidden sm:flex" : "flex"} items-center justify-center w-14 h-14 rounded-full shadow-glow
              transition-all duration-300 relative z-70
              ${isOpen ? "bg-raised text-ink rotate-90" : "bg-accent text-on-accent hover:opacity-85"}
            `}
          >
            {isOpen ? <X onClick={disconnectFromRoom} size={24} /> : <MessageCircle size={24} />}

            {!isOpen && !credentials && (
              <span className="absolute top-3 right-3.5 w-3 h-3 bg-danger-solid rounded-full border-2 border-line"></span>
            )}
          </motion.button>
        </div>
      </div>

      {/* Toast Notification — only when the panel is closed; an open panel
          renders its own copy inside itself. */}
      <AnimatePresence>
        {toast && !isOpen && (
          <Toast key="corner-toast" message={toast.message} type={toast.type} />
        )}
      </AnimatePresence>
    </div>
  );
}
