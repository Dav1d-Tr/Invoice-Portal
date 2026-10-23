import { isRecord } from "./sgafApi";

export interface ResultadoClasificacion {
  alcance: "RECEPCION" | "TODAS";
  registrosRevisados: number;
  coincidencias: number;
  facturasActualizadas: number;
  facturasTransferidas: number;
  yaAsignadas: number;
  ambiguas: number;
  coincidenciasPorCorreo: number;
  coincidenciasPorNombre: number;
}
const counterKeys = ["registrosRevisados", "coincidencias", "facturasActualizadas", "facturasTransferidas",
  "yaAsignadas", "ambiguas", "coincidenciasPorCorreo", "coincidenciasPorNombre"] as const;
export function normalizeClasificacion(value: unknown): ResultadoClasificacion | null {
  if (!isRecord(value) || (value.alcance !== "RECEPCION" && value.alcance !== "TODAS")) return null;
  const result = { alcance: value.alcance } as ResultadoClasificacion;
  for (const key of counterKeys) {
    const raw = value[key];
    const number = typeof raw === "number" || (typeof raw === "string" && raw.trim()) ? Number(raw) : NaN;
    if (!Number.isSafeInteger(number) || number < 0) return null;
    result[key] = number;
  }
  return result;
}
export const normalizeEmail = (email: string): string => email.trim().toLowerCase();
export const isValidEmail = (email: string): boolean => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
export function prepareEmails(emails: readonly string[], draft = ""): string[] {
  const result = [...new Set([...emails, draft].map(normalizeEmail).filter(Boolean))];
  const invalid = result.find(email => !isValidEmail(email));
  if (invalid) throw new Error(`El correo "${invalid}" no es válido.`);
  return result;
}
/** Solo prellenado del formulario. La decision y el barrido siempre son del backend. */
export function structuredSubject(subject: string | null | undefined): { nit: string; proveedor: string; numero: string } | null {
  const parts = (subject ?? "").trim().split(";").map(part => part.trim());
  if (parts.length < 3 || !parts[1] || !parts[2]) return null;
  return { nit: parts[0] ?? "", proveedor: parts[1], numero: parts[2] };
}
export function safeExternalUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch { return null; }
}
export function receptionPermissions(invoice: {
  idAreaActual: number; estadoCodigo: string; activo?: boolean; asignacionManualBloqueada?: boolean;
} | null, areaId: number, areaName: string): { clasificar: boolean } {
  const normalized = areaName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
  const owns = Boolean(invoice && Number(invoice.idAreaActual) === Number(areaId) && invoice.activo !== false);
  return {
    clasificar: normalized === "RECEPCION" && owns && !invoice?.asignacionManualBloqueada && ["PENDIENTE", "APROBADA"].includes(invoice?.estadoCodigo ?? ""),
  };
}
/** Mismo permiso visible de rechazo para todas las areas.
 * El backend vuelve a validar la propiedad y el estado con la funcion existente.
 * No exige proveedor, adjuntos, numero de factura ni estructura de correo.
 */
export function canRejectInvoice(invoice: {
  idAreaActual: number; estadoCodigo: string; activo?: boolean;
} | null, areaId: number): boolean {
  return Boolean(
    invoice && Number.isSafeInteger(areaId) && areaId > 0 &&
    Number(invoice.idAreaActual) === areaId && invoice.activo !== false &&
    ["PENDIENTE", "APROBADA"].includes(invoice.estadoCodigo)
  );
}
export interface PageFeedback {
  title: string;
  message: string;
  warning: string | null;
  clasificacion?: ResultadoClasificacion | null;
  remoto?: { nuevas: number; duplicadas: number; errores: number; erroresMetadatos: number } | null;
}
const feedbackKey = (scope: string) => `sgaf:feedback:v1:${scope}`;
/** Se conserva solo en esta pestana y por cinco minutos. No contiene tokens. */
export function saveFeedback(scope: string, feedback: PageFeedback): boolean {
  try {
    sessionStorage.setItem(feedbackKey(scope), JSON.stringify({ ...feedback, expiresAt: Date.now() + 300000 }));
    return true;
  } catch { return false; }
}
export function peekFeedback(scope: string): PageFeedback | null {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(feedbackKey(scope)) ?? "null");
    if (!isRecord(raw) || typeof raw.expiresAt !== "number" || raw.expiresAt < Date.now() ||
      typeof raw.title !== "string" || typeof raw.message !== "string") return null;
    return {
      title: raw.title, message: raw.message, warning: typeof raw.warning === "string" ? raw.warning : null,
      clasificacion: normalizeClasificacion(raw.clasificacion),
      remoto: isRecord(raw.remoto) ? {
        nuevas: Number(raw.remoto.nuevas) || 0, duplicadas: Number(raw.remoto.duplicadas) || 0,
        errores: Number(raw.remoto.errores) || 0, erroresMetadatos: Number(raw.remoto.erroresMetadatos) || 0,
      } : null
    };
  } catch { return null; }
}
export function clearFeedback(scope: string): void {
  try { sessionStorage.removeItem(feedbackKey(scope)); } catch { /* Storage puede estar deshabilitado. */ }
}
/** Navegacion completa: remonta tambien el layout y sus contadores existentes.
 * useHref() proporciona la ruta con basename o hash de tu Router.
 */
export function goToAndRefresh(href: string): void {
  const target = new URL(href, window.location.href);
  if (target.origin !== window.location.origin) throw new Error("Destino de SGAF no válido.");
  const sameDocument = target.pathname === window.location.pathname && target.search === window.location.search;
  if (sameDocument) {
    window.history.replaceState(window.history.state, "", target.href);
    window.location.reload();
  } else { window.location.replace(target.href); }
}
