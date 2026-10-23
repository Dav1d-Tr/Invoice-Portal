import { authFetch } from "./authService";
import { apiUrl, requestJson, requireData, jsonBody, positiveId, SgafApiError, joinWarnings } from "../utils/sgafApi";
import { normalizeClasificacion, prepareEmails } from "../utils/sgafUi";
import type { ResultadoClasificacion } from "../utils/sgafUi";
export type { ResultadoClasificacion } from "../utils/sgafUi";
export { SgafApiError } from "../utils/sgafApi";
export type InvoiceStatusCode = "PENDIENTE" | "APROBADA" | "RECHAZADA" | "REMITIDA" | "PROCESADA";
/* =========================================================
   FACTURA
========================================================= */
export interface Invoice {
  id: number;
  idProveedor: number | null;
  idAreaOrigen: number;
  idAreaActual: number;
  idAreaProveedor?: number | null;
  estadoCodigo: InvoiceStatusCode;
  estado: string;
  tipoDocumento: "FACTURA" | "NOTA_CREDITO" | null;
  numeroFactura: string | null;
  cufe?: string | null;
  asunto: string | null;
  proveedor: string;
  nit: string | null;
  correo: string | null;
  fechaRecepcion: string | null;
  fechaEmision?: string | null;
  fechaVencimiento?: string | null;
  tieneAdjuntos: boolean;
  webLink: string | null;
  bodyPreview?: string | null;
  outlookMessageId?: string | null;
  internetMessageId?: string | null;
  areaOrigen: string;
  areaActual: string;
  areaProveedor?: string | null;
  remitidaDesde?: string | null;
  fechaRemision?: string | null;
  rechazadaPor?: string | null;
  observacionRechazo?: string | null;
  fechaRechazo?: string | null;
  subtotal?: string | number | null;
  impuestos?: string | number | null;
  valorTotal: string | number | null;
  moneda: string | null;
  origen?: string;
  activo?: boolean;
  asignacionManualBloqueada?: boolean;
}
/* =========================================================
   CATALOGOS
========================================================= */
export interface AreaFactura {
  id: number;
  nombre: string;
}
export interface ProveedorFactura {
  id: number;
  nombre: string;
  nit: string | null;
  idArea: number;
  area: string;
  correos: string[];
}
/* =========================================================
   OUTLOOK
========================================================= */
export interface OutlookAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  isInline: boolean;
  contentId: string | null;
  type: string;
}
export interface OutlookDocumentLink {
  url: string;
  label: string;
}
export interface OutlookMessageDetail {
  id: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  to: string[];
  cc: string[];
  receivedDateTime: string | null;
  sentDateTime: string | null;
  bodyHtml: string;
  bodyText: string;
  bodyPreview: string;
  hasAttachments: boolean;
  attachments: OutlookAttachment[];
  documentLinks: OutlookDocumentLink[];
  webLink: string | null;
  internetMessageId: string | null;
}
/* =========================================================
   PROVEEDOR DESDE RECEPCION
========================================================= */
export interface NuevoProveedorFacturaInput {
  nombre: string;
  nit: string | null;
  idArea: number;
  correos: string[];
}
export interface AsignarProveedorResult {
  idProveedor: number;
  proveedor: string;
  nit: string | null;
  idArea: number;
  area: string;
  creado: boolean;
  facturasActualizadas?: number;
  facturasTransferidas?: number;
  correoOrigenRegistrado?: boolean;
  clasificacion: ResultadoClasificacion | null;
  warning?: string | null;
}
/* =========================================================
   HISTORIAL
========================================================= */
export interface FacturaEvento {
  id: number;
  accion: string;
  areaActor: string | null;
  areaOrigen: string | null;
  areaDestino: string | null;
  estadoAnteriorCodigo: string | null;
  estadoAnterior: string | null;
  estadoNuevoCodigo: string | null;
  estadoNuevo: string | null;
  observacion: string | null;
  datos: Record<string, unknown>;
  fechaEvento: string;
}

export interface ReadOptions { signal?: AbortSignal; }
const asBoolean = (value: unknown): boolean => value === true || value === "true" || value === "t" || value === 1;
const optionalId = (value: number | null | undefined): number | null => value == null ? null : positiveId(Number(value));
const normalizeInvoice = (invoice: Invoice): Invoice => ({
  ...invoice, id: positiveId(Number(invoice.id)), idProveedor: optionalId(invoice.idProveedor),
  idAreaOrigen: positiveId(Number(invoice.idAreaOrigen)), idAreaActual: positiveId(Number(invoice.idAreaActual)),
  idAreaProveedor: optionalId(invoice.idAreaProveedor), tieneAdjuntos: asBoolean(invoice.tieneAdjuntos),
  ...(invoice.activo === undefined ? {} : { activo: asBoolean(invoice.activo) }),
});
async function readList(path: string, options: ReadOptions): Promise<Invoice[]> {
  const data = requireData(await requestJson<Invoice[]>(path, { method: "GET", signal: options.signal }));
  if (!Array.isArray(data)) throw new Error("El servidor no devolvió una lista de registros.");
  return data.map(normalizeInvoice);
}
export const getFacturas = (options: ReadOptions = {}): Promise<Invoice[]> => readList("/facturas", options);
export const getFacturasRemitidas = (options: ReadOptions = {}): Promise<Invoice[]> => readList("/facturas/panel/remitidas", options);
export const getFacturasRechazadas = (options: ReadOptions = {}): Promise<Invoice[]> => readList("/facturas/panel/rechazadas", options);
export async function getFacturaDetalle(id: number, options: ReadOptions = {}): Promise<Invoice> {
  return normalizeInvoice(requireData(await requestJson<Invoice>(`/facturas/${positiveId(id)}`, { method: "GET", signal: options.signal })));
}
export async function getFacturaCorreoOutlook(id: number, options: ReadOptions = {}): Promise<OutlookMessageDetail> {
  const data = requireData(await requestJson<OutlookMessageDetail>(`/facturas/${positiveId(id)}/correo-outlook`, { method: "GET", signal: options.signal }));
  return {
    ...data, to: Array.isArray(data.to) ? data.to : [], cc: Array.isArray(data.cc) ? data.cc : [],
    attachments: Array.isArray(data.attachments) ? data.attachments : [], documentLinks: Array.isArray(data.documentLinks) ? data.documentLinks : []
  };
}
export async function getAreasFactura(options: ReadOptions = {}): Promise<AreaFactura[]> {
  const data = requireData(await requestJson<AreaFactura[]>("/facturas/catalogos/areas", { method: "GET", signal: options.signal }));
  if (!Array.isArray(data)) throw new Error("Catálogo de áreas no válido.");
  return data.map(item => ({ ...item, id: positiveId(Number(item.id)) }));
}
export async function getProveedoresFactura(options: ReadOptions = {}): Promise<ProveedorFactura[]> {
  const data = requireData(await requestJson<ProveedorFactura[]>("/facturas/catalogos/proveedores", { method: "GET", signal: options.signal }));
  if (!Array.isArray(data)) throw new Error("Catálogo de proveedores no válido.");
  return data.map(item => ({
    ...item, id: positiveId(Number(item.id)), idArea: positiveId(Number(item.idArea)),
    correos: Array.isArray(item.correos) ? item.correos.filter((email): email is string => typeof email === "string") : []
  }));
}
async function simpleAction(id: number, action: string, observacion?: string | null): Promise<void> {
  await requestJson(`/facturas/${positiveId(id)}/${action}`, jsonBody({ observacion: observacion?.trim() || null }));
}
export const aprobarFactura = (id: number, observacion?: string | null): Promise<void> => simpleAction(id, "aprobar", observacion);
/** Rechazo unico para RECEPCION y las demas areas. Nunca envia DELETE. */
export const rechazarFactura = (id: number, observacion?: string | null): Promise<void> => simpleAction(id, "rechazar", observacion);
export const procesarFactura = (id: number, observacion?: string | null): Promise<void> => simpleAction(id, "procesar", observacion);
export const reactivarFactura = (id: number, observacion?: string | null): Promise<void> => simpleAction(id, "reactivar", observacion);
/** Accion independiente: no es un alias de remitirFactura. */
export const remitirFacturaContabilidad = (id: number, observacion?: string | null): Promise<void> => simpleAction(id, "remitir-contabilidad", observacion);
export async function remitirFactura(id: number, idAreaDestino: number, observacion?: string | null): Promise<void> {
  await requestJson(`/facturas/${positiveId(id)}/remitir`, jsonBody({ idAreaDestino: positiveId(idAreaDestino, "Área"), observacion: observacion?.trim() || null }));
}
async function assignProvider(id: number, body: unknown): Promise<AsignarProveedorResult> {
  const envelope = await requestJson<AsignarProveedorResult>(`/facturas/${positiveId(id)}/asignar-proveedor`, jsonBody(body));
  const data = requireData(envelope);
  return {
    ...data, idProveedor: positiveId(Number(data.idProveedor)), idArea: positiveId(Number(data.idArea)),
    clasificacion: normalizeClasificacion(data.clasificacion), warning: joinWarnings(envelope.warning, data.warning)
  };
}
export const asociarProveedorExistente = (idFactura: number, idProveedor: number): Promise<AsignarProveedorResult> =>
  assignProvider(idFactura, { idProveedor: positiveId(idProveedor, "Proveedor") });
export function registrarProveedorDesdeFactura(idFactura: number, nuevoProveedor: NuevoProveedorFacturaInput): Promise<AsignarProveedorResult> {
  const nombre = nuevoProveedor.nombre.trim();
  if (!nombre) throw new Error("El nombre del proveedor es obligatorio.");
  return assignProvider(idFactura, {
    nuevoProveedor: {
      nombre, nit: nuevoProveedor.nit?.trim() || null,
      idArea: positiveId(nuevoProveedor.idArea, "Área"), correos: prepareEmails(nuevoProveedor.correos)
    }
  });
}
export async function getHistorialFactura(idFactura: number, options: ReadOptions = {}): Promise<FacturaEvento[]> {
  const data = requireData(await requestJson<FacturaEvento[]>(`/facturas/${positiveId(idFactura)}/historial`, { method: "GET", signal: options.signal }));
  if (!Array.isArray(data)) throw new Error("Historial no válido.");
  return data.map(item => ({ ...item, id: Number(item.id), datos: item.datos ?? {} }));
}
function safeFileName(value: string): string {
  return value.replace(/[\\/\u0000-\u001f\u007f]/g, "_").trim() || "adjunto";
}
function dispositionName(header: string | null): string | null {
  if (!header) return null;
  const utf8 = header.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)?.[1];
  if (utf8) { try { return safeFileName(decodeURIComponent(utf8.trim())); } catch { /* Usar filename normal. */ } }
  const simple = header.match(/filename\s*=\s*"([^"]+)"|filename\s*=\s*([^;]+)/i);
  return simple ? safeFileName((simple[1] || simple[2] || "").trim()) : null;
}
export async function obtenerAdjuntoFactura(idFactura: number, attachmentId: string, inline = false): Promise<{ blob: Blob; fileName: string; contentType: string }> {
  positiveId(idFactura);
  if (!attachmentId.trim()) throw new Error("Adjunto no válido.");
  const response = await authFetch(apiUrl(`/facturas/${idFactura}/adjuntos/${encodeURIComponent(attachmentId)}/download${inline ? "?inline=1" : ""}`), { method: "GET", cache: "no-store" });
  if (!response.ok) {
    let message = "No fue posible obtener el archivo.";
    try { const data: { message?: string } = await response.json(); message = data.message || message; } catch { /* Respuesta no JSON. */ }
    throw new SgafApiError(message, response.status);
  }
  const blob = await response.blob();
  return {
    blob, fileName: dispositionName(response.headers.get("Content-Disposition")) || "",
    contentType: response.headers.get("Content-Type") || blob.type || "application/octet-stream"
  };
}
export async function descargarAdjuntoFactura(idFactura: number, attachmentId: string, fallbackName: string): Promise<void> {
  const file = await obtenerAdjuntoFactura(idFactura, attachmentId);
  const url = URL.createObjectURL(file.blob);
  const anchor = document.createElement("a");
  try {
    anchor.href = url;
    anchor.download = safeFileName(file.fileName || fallbackName || "adjunto");
    document.body.appendChild(anchor); anchor.click();
  } finally { anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
export async function abrirAdjuntoFactura(idFactura: number, attachmentId: string): Promise<void> {
  positiveId(idFactura);
  // Abrir SIN esperar a fetch conserva el gesto del usuario. Se corta opener inmediatamente.
  const preview = window.open("about:blank", "_blank");
  if (!preview) throw new Error("El navegador bloqueó la ventana. Permite ventanas emergentes o usa Descargar.");
  preview.opener = null;
  try {
    const file = await obtenerAdjuntoFactura(idFactura, attachmentId, true);
    // La vista previa de la UI es solo para PDF; no ejecutar HTML de un adjunto en el origen SGAF.
    const signature = await file.blob.slice(0, 5).text();
    if (signature !== "%PDF-") throw new Error("Este adjunto no es un PDF válido. Utiliza Descargar.");
    const pdf = new Blob([file.blob], { type: "application/pdf" });
    const url = URL.createObjectURL(pdf);
    if (preview.closed) { URL.revokeObjectURL(url); return; }
    preview.location.replace(url);
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) { preview.close(); throw error; }
}
