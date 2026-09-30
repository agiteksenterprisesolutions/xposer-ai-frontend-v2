// src/utils/download.js
//
// Saving files the API generates. The server names them — read the name from
// Content-Disposition rather than constructing one, so a change on the server
// (a date stamp, an organization name) reaches the user without a frontend
// release.

/** The filename in a Content-Disposition header, preferring RFC 5987 `filename*`. */
export const filenameFromDisposition = (header, fallback) => {
  if (!header) return fallback;

  const extended = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(header);
  if (extended) {
    try {
      return decodeURIComponent(extended[1].trim().replace(/^"|"$/g, ''));
    } catch {
      // fall through to the plain form
    }
  }

  const plain = /filename\s*=\s*("?)([^";]+)\1/.exec(header);
  return plain ? plain[2].trim() : fallback;
};

/** Hand a Blob to the browser as a download. */
export const saveBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

/** An axios `responseType: 'blob'` response → `{ blob, filename }`. */
export const blobDownload = (response, fallback) => ({
  blob: response.data,
  filename: filenameFromDisposition(response.headers?.['content-disposition'], fallback),
});
