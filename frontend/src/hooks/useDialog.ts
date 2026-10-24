import { useEffect, useRef, type RefObject } from 'react';

/**
 * Keyboard behaviour for a modal (matches DialogHost): Escape closes it, focus moves into it when it
 * opens and goes back to where it was when it closes. Put `tabIndex={-1}` on the dialog element so it
 * can take focus when it has nothing focusable yet (a list still loading).
 */
export function useDialog(open: boolean, onClose: () => void, ref: RefObject<HTMLElement | null>) {
  // The latest onClose, so an inline arrow doesn't re-run the effect (and steal focus) on every render
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    if (dialog && !dialog.contains(document.activeElement)) {
      // A field to type in first (a search box), else the first button (Cancel in a confirm)
      const first =
        dialog.querySelector<HTMLElement>('input:not([disabled]), textarea:not([disabled]), select:not([disabled])') ??
        dialog.querySelector<HTMLElement>('button:not([disabled]), a[href]');
      (first ?? dialog).focus();
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (previous?.isConnected) previous.focus();
    };
  }, [open, ref]);
}
