import { requestJson, requireData, positiveId } from '../utils/sgafApi';
export interface FacturaRevision {
  id: number; idProveedor: number | null; proveedorAsignado: string; proveedorSnapshot: string;
  nombreEnAsunto: string | null; idAreaActual: number; areaActual: string;
  idAreaProveedor: number | null; areaProveedor: string | null;
  asunto: string | null; correo: string | null; numeroFactura: string | null; nit: string | null;
  fechaRecepcion: string | null; estadoCodigo: string; estado: string;
  protegida: boolean; version: string; similitud: number; editable: boolean;
}
export interface FiltrosRevision { buscar: string; estado: string; idArea: string; desde: string; hasta: string; pagina: number; tamano: number; similitud: number }
export interface ListaRevision { items: FacturaRevision[]; total: number; pagina: number; paginas: number; tamano: number }
export interface CorreccionInput { idProveedor: number; idAreaDestino: number; motivo: string; version: string; protegerAsignacion: boolean }
export interface CorreccionResult { idFactura: number; sinCambios: boolean; proveedor: string; area: string; protegida: boolean }
export async function buscarRevision(filters: FiltrosRevision, signal?: AbortSignal): Promise<ListaRevision> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value !== '') params.set(key, String(value));
  return requireData(await requestJson<ListaRevision>(`/facturas/sistemas/revision?${params}`, { method: 'GET', signal }));
}
export async function getRevision(id: number, signal?: AbortSignal): Promise<FacturaRevision> {
  return requireData(await requestJson<FacturaRevision>(`/facturas/sistemas/revision/${positiveId(id)}`, { method: 'GET', signal }));
}
export async function corregirRevision(id: number, input: CorreccionInput): Promise<CorreccionResult> {
  return requireData(await requestJson<CorreccionResult>(`/facturas/sistemas/revision/${positiveId(id)}/asignacion`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  }));
}
