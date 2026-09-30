// src/utils/clipboard.js

/**
 * Copies text to the clipboard, reporting whether it actually landed there.
 *
 * `navigator.clipboard` only exists in a secure context — https, or localhost.
 * Served over plain http (a LAN address in development, or an http
 * deployment) it is `undefined`, so `navigator.clipboard.writeText(...)`
 * throws a TypeError *synchronously*: a `.catch()` chained onto that call
 * never attaches, which is why the copy buttons used to fail silently rather
 * than show their error toast. The async API can also reject when the
 * document lacks focus or clipboard-write permission.
 *
 * Falls back to a hidden textarea + `document.execCommand('copy')`, which is
 * deprecated but still the only thing that works on those origins.
 *
 * @param {string} text
 * @returns {Promise<boolean>} true if the text reached the clipboard
 */
export const copyToClipboard = async (text) => {
  if (!text) return false;

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Insecure origin, unfocused document, or denied permission — fall through.
    }
  }

  if (typeof document === 'undefined') return false;

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    // Keep it off-screen but still selectable; `display: none` can't be selected.
    textarea.style.position = 'fixed';
    textarea.style.top = '-1000px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const succeeded = document.execCommand('copy');
    textarea.remove();
    return succeeded;
  } catch {
    return false;
  }
};

export default copyToClipboard;
