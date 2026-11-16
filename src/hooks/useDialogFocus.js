// src/hooks/useDialogFocus.js
//
// Keyboard focus for anything that opens on top of the page (WCAG 2.4.3,
// 2.1.2): on open, focus moves into the dialog; Tab and Shift+Tab cycle
// inside it; on close, focus returns to whatever opened it.
//
//   const ref = useRef(null);
//   useDialogFocus(ref, isOpen);
//   <div ref={ref} role="dialog" aria-modal="true" tabIndex={-1}>…</div>
//
// The first field or button gets focus unless an element inside carries
// `data-autofocus`. A dialog with nothing focusable focuses itself, which is
// why the container needs tabIndex={-1}.
import { useEffect } from 'react';

const FOCUSABLE = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

const focusables = (root) =>
  [...root.querySelectorAll(FOCUSABLE)].filter(
    (el) => !el.closest('[inert]') && (el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0),
  );

// Dialogs can stack (a confirmation over a form); only the top one traps Tab.
const stack = [];

/** True when `root` is the dialog on top, the one Escape should close. */
export const isTopDialog = (root) => !stack.length || stack[stack.length - 1] === root;

export function useDialogFocus(ref, isOpen, { initialFocus = true } = {}) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const root = ref.current;
    if (!root) return undefined;
    const opener = document.activeElement;
    stack.push(root);

    // Wait a frame so the dialog's content (and any autoFocus) has rendered.
    const frame = requestAnimationFrame(() => {
      if (!initialFocus || root.contains(document.activeElement)) return;
      const preferred = root.querySelector('[data-autofocus]');
      const target = preferred || focusables(root).find((el) => !el.hasAttribute('data-dialog-close')) || focusables(root)[0];
      (target || root).focus({ preventScroll: false });
    });

    const onKeyDown = (event) => {
      if (event.key !== 'Tab' || stack[stack.length - 1] !== root) return;
      const items = focusables(root);
      if (!items.length) {
        event.preventDefault();
        root.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!root.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown, true);
      const at = stack.lastIndexOf(root);
      if (at !== -1) stack.splice(at, 1);
      // Back to the control that opened it, if it is still on the page.
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) {
        requestAnimationFrame(() => opener.focus({ preventScroll: true }));
      }
    };
  }, [isOpen, ref, initialFocus]);
}

export default useDialogFocus;
