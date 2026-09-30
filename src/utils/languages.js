// src/utils/languages.js
//
// Languages the voice agent can be pinned to. The choice has to be made before
// the LiveKit token is requested: the backend bakes the code into the room
// name (`..._lang_ur`), and the agent builds its speech-to-text engine from
// that before anyone joins. It cannot be changed mid-call — a different
// language means a new session with a fresh token.
//
// Adding a language here is not enough on its own: the agent needs a matching
// entry (including a translated greeting, which is spoken before the model
// runs) or it will fall back to detection.

/**
 * Native names are what the picker shows. Someone looking for Urdu scans for
 * اردو, not "Urdu" — the English name is only a secondary hint.
 */
export const VOICE_LANGUAGES = [
  { code: 'en', native: 'English', english: 'English' },
  { code: 'ar', native: 'العربية', english: 'Arabic', rtl: true },
  { code: 'ur', native: 'اردو', english: 'Urdu', rtl: true },
  { code: 'es', native: 'Español', english: 'Spanish' },
  { code: 'fr', native: 'Français', english: 'French' },
  { code: 'de', native: 'Deutsch', english: 'German' },
  { code: 'hi', native: 'हिन्दी', english: 'Hindi' },
  { code: 'pt', native: 'Português', english: 'Portuguese' },
  { code: 'tr', native: 'Türkçe', english: 'Turkish' },
  { code: 'ru', native: 'Русский', english: 'Russian' },
  { code: 'zh', native: '中文', english: 'Chinese' },
];

/**
 * The fallback the backend already applies when the field is absent or
 * unrecognised: the agent detects the language from speech. Offered explicitly
 * so a caller who speaks something not on the list still has a route.
 */
export const AUTO_LANGUAGE_CODE = 'auto';

export const VOICE_LANGUAGE_OPTIONS = [
  ...VOICE_LANGUAGES,
  {
    code: AUTO_LANGUAGE_CODE,
    native: 'Detect automatically',
    english: 'Detect automatically',
  },
];

const BY_CODE = new Map(VOICE_LANGUAGE_OPTIONS.map((entry) => [entry.code, entry]));

/** Where the caller's last choice is remembered between sessions. */
export const VOICE_LANGUAGE_STORAGE_KEY = 'xposer_voice_language';

/**
 * Reduce anything tag-shaped to a supported code: `ur-PK`, `en_US` and `EN`
 * all resolve. Returns null when the language is not one the agent speaks —
 * callers decide whether that means auto-detect or their own default.
 */
export const normalizeLanguageCode = (value) => {
  if (!value || typeof value !== 'string') return null;
  const base = value.trim().toLowerCase().split(/[-_]/)[0];
  return BY_CODE.has(base) ? base : null;
};

/**
 * The browser's own preference, when the agent speaks it. Anything else falls
 * back to auto-detect rather than English — assuming English is exactly the
 * failure this feature exists to prevent, since Whisper then returns Arabic
 * and Urdu speech as English text.
 */
export const detectBrowserLanguage = () => {
  if (typeof navigator === 'undefined') return AUTO_LANGUAGE_CODE;
  const candidates = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];

  for (const candidate of candidates) {
    const code = normalizeLanguageCode(candidate);
    // Auto is not a browser language; only a real match counts here.
    if (code && code !== AUTO_LANGUAGE_CODE) return code;
  }
  return AUTO_LANGUAGE_CODE;
};

/** The caller's remembered choice, or the browser's language. */
export const getInitialLanguage = () => {
  try {
    const stored = normalizeLanguageCode(
      localStorage.getItem(VOICE_LANGUAGE_STORAGE_KEY),
    );
    if (stored) return stored;
  } catch (error) {
    /* private mode, or storage disabled — fall through to detection */
  }
  return detectBrowserLanguage();
};

export const rememberLanguage = (code) => {
  try {
    localStorage.setItem(VOICE_LANGUAGE_STORAGE_KEY, code);
  } catch (error) {
    /* not worth surfacing: the choice still applies to this call */
  }
};

export const getLanguage = (code) => BY_CODE.get(code) || null;

/** Native name for display, falling back to the raw code. */
export const getLanguageName = (code) => getLanguage(code)?.native || code || '';

export const isRtlLanguage = (code) => Boolean(getLanguage(code)?.rtl);

/**
 * The reply-mode question, translated.
 *
 * It is asked after the language has been chosen but before the room opens, so
 * nothing has been translated for the caller yet — the agent is not running.
 * Asking someone in English how they would like to be spoken to, immediately
 * after they told us they do not read English, undoes the point of the picker.
 *
 * Adding a language above without adding its copy here is safe: it falls back
 * to English rather than rendering blanks.
 */
const MODE_COPY = {
  en: {
    question: 'And how should I reply?',
    speak: 'Speak out loud',
    text: 'Reply in text',
    hint: 'You can switch at any point during the call, and you can talk to the assistant either way.',
    changeLanguage: 'Change language',
  },
  ar: {
    question: 'وكيف تريد أن أرد؟',
    speak: 'الرد بصوت مسموع',
    text: 'الرد بالكتابة',
    hint: 'يمكنك التبديل في أي وقت أثناء المحادثة، ويمكنك التحدث في الحالتين.',
    changeLanguage: 'تغيير اللغة',
  },
  ur: {
    question: 'اور میں کس طرح جواب دوں؟',
    speak: 'بول کر جواب دیں',
    text: 'لکھ کر جواب دیں',
    hint: 'آپ گفتگو کے دوران کسی بھی وقت تبدیل کر سکتے ہیں، اور دونوں صورتوں میں بول سکتے ہیں۔',
    changeLanguage: 'زبان تبدیل کریں',
  },
  es: {
    question: '¿Y cómo quieres que responda?',
    speak: 'Responder en voz alta',
    text: 'Responder por escrito',
    hint: 'Puedes cambiar en cualquier momento durante la llamada, y podrás hablar de las dos formas.',
    changeLanguage: 'Cambiar idioma',
  },
  fr: {
    question: 'Et comment dois-je répondre ?',
    speak: 'Répondre à voix haute',
    text: 'Répondre par écrit',
    hint: 'Vous pouvez changer à tout moment pendant l’appel, et vous pouvez parler dans les deux cas.',
    changeLanguage: 'Changer de langue',
  },
  de: {
    question: 'Und wie soll ich antworten?',
    speak: 'Gesprochen antworten',
    text: 'Schriftlich antworten',
    hint: 'Sie können jederzeit während des Gesprächs wechseln und in beiden Fällen sprechen.',
    changeLanguage: 'Sprache ändern',
  },
  hi: {
    question: 'और मैं किस तरह जवाब दूँ?',
    speak: 'बोलकर जवाब दें',
    text: 'लिखकर जवाब दें',
    hint: 'आप बातचीत के दौरान कभी भी बदल सकते हैं, और दोनों ही स्थितियों में बोल सकते हैं।',
    changeLanguage: 'भाषा बदलें',
  },
  pt: {
    question: 'E como devo responder?',
    speak: 'Responder em voz alta',
    text: 'Responder por escrito',
    hint: 'Pode mudar a qualquer momento durante a chamada e pode falar nos dois casos.',
    changeLanguage: 'Mudar de idioma',
  },
  tr: {
    question: 'Peki nasıl yanıt vereyim?',
    speak: 'Sesli yanıtla',
    text: 'Yazılı yanıtla',
    hint: 'Görüşme sırasında istediğiniz zaman değiştirebilirsiniz; her iki durumda da konuşabilirsiniz.',
    changeLanguage: 'Dili değiştir',
  },
  ru: {
    question: 'И как мне отвечать?',
    speak: 'Отвечать голосом',
    text: 'Отвечать текстом',
    hint: 'Вы можете переключиться в любой момент разговора, и говорить можно в обоих случаях.',
    changeLanguage: 'Изменить язык',
  },
  zh: {
    question: '我该怎么回复你？',
    speak: '语音回复',
    text: '文字回复',
    hint: '通话中可随时切换，两种方式都可以说话。',
    changeLanguage: '更换语言',
  },
};

/**
 * Copy for the reply-mode step in the chosen language. Auto-detect has no
 * language of its own yet — the agent works it out from speech — so it reads
 * in English until then.
 */
export const getModeCopy = (code) => MODE_COPY[code] || MODE_COPY.en;
