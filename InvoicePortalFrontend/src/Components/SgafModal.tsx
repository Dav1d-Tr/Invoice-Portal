import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";
import { LoaderCircle, X } from "lucide-react";

export function SgafModal({ title, onClose, busy = false, children }: {
  title: string; onClose: () => void; busy?: boolean; children: ReactNode;
}) {
  const titleId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  closeRef.current = onClose;
  busyRef.current = busy;
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => Array.from(dialog.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]'
    ) ?? []).filter(element => !element.closest("fieldset:disabled") && !element.hidden);
    (focusable()[0] ?? dialog.current)?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busyRef.current) { event.preventDefault(); closeRef.current(); }
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0]; const last = items[items.length - 1];
      if (!first || !last) { event.preventDefault(); dialog.current?.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !dialog.current?.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.current?.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = oldOverflow;
      previousFocus?.focus();
    };
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4 backdrop-blur-[1px]"
      onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={busy} tabIndex={-1}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl outline-none">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <h3 id={titleId} className="text-base font-bold text-slate-800">{title}</h3>
          <button type="button" aria-label="Cerrar ventana" disabled={busy} onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-50">
            <X size={16} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
export function ModalButtons({ loading, onCancel, onConfirm, confirmText, danger = false, disabled = false }: {
  loading: boolean; onCancel: () => void; onConfirm: () => void; confirmText: string; danger?: boolean; disabled?: boolean;
}) {
  return (
    <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
      <button type="button" disabled={loading} onClick={onCancel}
        className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-600 disabled:opacity-50">Cancelar</button>
      <button type="button" disabled={loading || disabled} onClick={onConfirm}
        className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold text-white disabled:opacity-50 ${danger ? "bg-red-600 hover:bg-red-700" : "bg-[#00739B] hover:bg-[#05627F]"}`}>
        {loading && <LoaderCircle size={13} className="animate-spin" />}
        {loading ? "Procesando..." : confirmText}
      </button>
    </div>
  );
}
