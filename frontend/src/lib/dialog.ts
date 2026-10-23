// Guidewise's own message and confirm dialogs, used instead of the browser's alert() and confirm()
// (which show the site address and look like a browser warning). `DialogHost` in the root layout
// renders whatever is requested here.

export interface DialogRequest {
  title: string;
  message?: string;
  confirmLabel?: string;
  /** Without a cancel label the dialog is a plain message with one button. */
  cancelLabel?: string;
  onConfirm?: () => void;
}

type Listener = (request: DialogRequest) => void;
let listener: Listener | null = null;

export function setDialogListener(fn: Listener | null): void {
  listener = fn;
}

export function showDialog(request: DialogRequest): void {
  if (listener) listener(request);
  else if (typeof window !== "undefined") console.warn(request.title, request.message ?? "");
}

/** A short message with an OK button, in place of alert(). */
export function notify(title: string, message?: string): void {
  showDialog({ title, message, confirmLabel: "OK" });
}
