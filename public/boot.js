// public/boot.js
//
// Runs before first paint, before the app bundle. Kept as a file on our own
// origin (not inline in index.html) so a strict Content-Security-Policy
// (script-src 'self', XPAI-228) doesn't need 'unsafe-inline' or a hash.
//
// 1. Interface language, so Arabic never flashes left-to-right.
//    src/i18n reads and writes the same key.
// 2. Theme, so the page never flashes the wrong palette. This is the source
//    of truth for the initial value: the theme store reads the data-theme set
//    here rather than resolving it a second time. Light is the default.
(function () {
  var root = document.documentElement;
  try {
    var lang = localStorage.getItem('xposer-lang') || (navigator.language || 'en');
    lang = lang.slice(0, 2).toLowerCase() === 'ar' ? 'ar' : 'en';
    root.setAttribute('lang', lang);
    root.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  } catch (e) {}
  try {
    var stored = localStorage.getItem('xposer-theme');
    root.setAttribute('data-theme', stored === 'light' || stored === 'dark' ? stored : 'light');
  } catch (e) {
    root.setAttribute('data-theme', 'light');
  }
})();
