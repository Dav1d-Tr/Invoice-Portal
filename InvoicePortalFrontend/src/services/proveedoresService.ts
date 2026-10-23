// Servicio FRONTEND. No copiar este archivo al backend.
import { requestJson, requireData, jsonBody, positiveId, joinWarnings } from "../utils/sgafApi";
import { normalizeClasificacion, prepareEmails } from "../utils/sgafUi";
import type { ResultadoClasificacion } from "../utils/sgafUi";
export interface ProveedorCorreo { id: number; correo: string; esPrincipal: boolean; activo: boolean; }
export interface Proveedor {
  id: number; nombre: string; nit: string | null; idArea: number; area: string;
  correos: ProveedorCorreo[]; activo: boolean; fechaCreacion?: string; fechaActualizacion?: string;
}
export interface ProveedorInput { nombre: string; nit?: string | null; idArea: number; correos?: string[]; consultarOutlook?: boolean; }
export type CrearProveedorInput = ProveedorInput;
export type ActualizarProveedorInput = ProveedorInput;
export interface OutlookMailboxSyncResult {
  mensajesRevisados: number; candidatosFactura: number; facturasCreadas: number;
  reconocidas: number; enviadasRecepcion: number; duplicadas: number; errores: number;
  erroresMetadatos: number; desde: string; coincidenciasPorCorreo: number; coincidenciasPorNombre: number;
}
export interface OutlookSyncResult {
  proveedorId: number; proveedor: string; area: string; nit: string | null;
  correosConfigurados: number; mensajesRevisados: number; coincidencias: number;
  coincidenciasPorNombre: number; coincidenciasPorCorreo: number; facturasCreadas: number;
  duplicadas: number; enviadasRecepcion: number; facturasReclasificadas: number; facturasTransferidas: number;
  clasificacion: ResultadoClasificacion | null; outlook: OutlookMailboxSyncResult | null;
  outlookSincronizado: boolean; warning: string | null;
}
export type SincronizacionProveedorResult = OutlookSyncResult;
export interface GuardarProveedorResult {
  id: number; nombre: string; nit: string | null; idArea: number;
  sincronizacion: OutlookSyncResult | null; warning: string | null; message?: string;
}
export interface SincronizarProveedorOptions { consultarOutlook?: boolean; }
const flag = (value: unknown): boolean => value === true || value === "true" || value === "t" || value === 1;
function inputBody(input: ProveedorInput): ProveedorInput {
  const nombre = input.nombre.trim();
  if (!nombre) throw new Error("El nombre es obligatorio.");
  return {
    nombre, nit: input.nit?.trim() || null, idArea: positiveId(input.idArea, "Área"),
    correos: prepareEmails(input.correos ?? []), consultarOutlook: input.consultarOutlook !== false
  };
}
function normalizeSync(data: OutlookSyncResult, warning?: string | null): OutlookSyncResult {
  return {
    ...data, proveedorId: Number(data.proveedorId), clasificacion: normalizeClasificacion(data.clasificacion),
    outlook: data.outlook ?? null, outlookSincronizado: flag(data.outlookSincronizado),
    warning: joinWarnings(warning, data.warning)
  };
}
export async function getProveedores(options: { signal?: AbortSignal } = {}): Promise<Proveedor[]> {
  const data = requireData(await requestJson<Proveedor[]>("/proveedores", { method: "GET", signal: options.signal }));
  if (!Array.isArray(data)) throw new Error("Lista de proveedores no válida.");
  return data.map(item => ({
    ...item, id: Number(item.id), idArea: Number(item.idArea), activo: flag(item.activo),
    correos: (Array.isArray(item.correos) ? item.correos : []).map(email => ({
      ...email, id: Number(email.id),
      activo: flag(email.activo), esPrincipal: flag(email.esPrincipal)
    }))
  }));
}
async function save(path: string, input: ProveedorInput, method: "POST" | "PUT"): Promise<GuardarProveedorResult> {
  const envelope = await requestJson<GuardarProveedorResult>(path, jsonBody(inputBody(input), method));
  const data = requireData(envelope);
  const sync = data.sincronizacion ? normalizeSync(data.sincronizacion, envelope.warning) : null;
  return {
    ...data, id: Number(data.id), idArea: Number(data.idArea), sincronizacion: sync,
    warning: joinWarnings(envelope.warning, data.warning, sync?.warning), message: envelope.message
  };
}
export const crearProveedor = (input: ProveedorInput): Promise<GuardarProveedorResult> => save("/proveedores", input, "POST");
export const actualizarProveedor = (id: number, input: ProveedorInput): Promise<GuardarProveedorResult> => save(`/proveedores/${positiveId(id)}`, input, "PUT");
export async function eliminarProveedor(id: number): Promise<void> {
  await requestJson(`/proveedores/${positiveId(id)}`, { method: "DELETE" });
}
export async function sincronizarProveedor(id: number, options: SincronizarProveedorOptions = {}): Promise<OutlookSyncResult> {
  // Una sola llamada: el backend decide TODAS + PENDIENTE por el perfil autenticado.
  const envelope = await requestJson<OutlookSyncResult>(`/outlook/proveedores/${positiveId(id)}/sincronizar`, jsonBody({ consultarOutlook: options.consultarOutlook !== false }));
  return normalizeSync(requireData(envelope), envelope.warning);
}
export async function agregarCorreoProveedor(id: number, correo: string, options: SincronizarProveedorOptions = {}): Promise<{ id: number; correo: string; sincronizacion: OutlookSyncResult | null; warning: string | null }> {
  const email = prepareEmails([correo])[0];
  if (!email) throw new Error("El correo es obligatorio.");
  const envelope = await requestJson<{ id: number; correo: string; sincronizacion: OutlookSyncResult | null }>(`/proveedores/${positiveId(id)}/correos`, jsonBody({ correo: email, consultarOutlook: options.consultarOutlook !== false }));
  const data = requireData(envelope);
  return {
    ...data, id: Number(data.id), sincronizacion: data.sincronizacion ? normalizeSync(data.sincronizacion, envelope.warning) : null,
    warning: joinWarnings(envelope.warning, data.sincronizacion?.warning)
  };
}
