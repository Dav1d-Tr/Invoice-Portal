import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../types/auth.types';
import { isIP } from 'node:net';
import { buscarFacturasRevision, corregirAsignacionFactura, getFacturaRevision, RevisionError } from '../services/revisionFacturasService';
import type { CorregirAsignacionInput, FiltrosRevision } from '../services/revisionFacturasService';

const idValue = (value: unknown): number | null => {
  if ((typeof value !== 'string' && typeof value !== 'number') || !/^\d+$/.test(String(value))) return null;
  const id = Number(value); return Number.isSafeInteger(id) && id > 0 ? id : null;
};
const text = (value: unknown, label: string, max: number, fallback = ''): string => {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'string' || value.length > max) throw new RevisionError(`${label} no valido.`);
  return value.trim();
};
export const validDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
export function parseRevisionFilters(query: Record<string, unknown>): FiltrosRevision {
  const buscar = text(query.buscar, 'Busqueda', 180);
  if (buscar && buscar.replace(/[^a-zA-Z0-9\u00c0-\u00ff]/g, '').length < 3) throw new RevisionError('Escribe al menos 3 letras o numeros para buscar por similitud.');
  const estado = text(query.estado, 'Estado', 20);
  if (estado && !['PENDIENTE', 'APROBADA', 'RECHAZADA', 'PROCESADA', 'REMITIDA'].includes(estado)) throw new RevisionError('Estado no valido.');
  const idArea = query.idArea === undefined || query.idArea === '' ? null : idValue(query.idArea);
  if (query.idArea !== undefined && query.idArea !== '' && !idArea) throw new RevisionError('Area no valida.');
  const desde = text(query.desde, 'Fecha inicial', 10), hasta = text(query.hasta, 'Fecha final', 10);
  if ((desde && !validDate(desde)) || (hasta && !validDate(hasta)) || (desde && hasta && desde > hasta)) throw new RevisionError('Rango de fechas no valido.');
  const pagina = query.pagina === undefined ? 1 : idValue(query.pagina);
  const tamano = query.tamano === undefined ? 25 : idValue(query.tamano);
  if (!pagina || pagina > 1000000 || !tamano || ![25, 50, 100].includes(tamano)) throw new RevisionError('Paginacion no valida.');
  const s = query.similitud === undefined ? '0.35' : text(query.similitud, 'Similitud', 5);
  const similitud = Number(s);
  if (!s || !Number.isFinite(similitud) || similitud < 0.2 || similitud > 1) throw new RevisionError('La similitud debe estar entre 0.20 y 1.00.');
  return { buscar, estado, idArea, desde, hasta, pagina, tamano, similitud };
}
export function parseCorrectionInput(body: unknown): CorregirAsignacionInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new RevisionError('Datos no validos.');
  const value = body as Record<string, unknown>;
  const idProveedor = idValue(value.idProveedor), idAreaDestino = idValue(value.idAreaDestino);
  if (!idProveedor || !idAreaDestino) throw new RevisionError('Selecciona proveedor y area destino.');
  const motivo = text(value.motivo, 'Motivo', 2000);
  if (motivo.length < 5) throw new RevisionError('Describe el motivo de la correccion (minimo 5 caracteres).');
  const version = text(value.version, 'Version', 20);
  if (!/^\d+$/.test(version)) throw new RevisionError('Falta la version de la factura. Abre otra vez el formulario.');
  if (typeof value.protegerAsignacion !== 'boolean') throw new RevisionError('protegerAsignacion debe ser booleano.');
  return { idProveedor, idAreaDestino, motivo, version, protegerAsignacion: value.protegerAsignacion };
}
function fail(error: unknown, res: Response) {
  const e = error as { statusCode?: number; code?: string; message?: string };
  if (e.statusCode && e.statusCode >= 400 && e.statusCode < 500) {
    res.status(e.statusCode).json({ success: false, message: e.message }); return;
  }
  if (['40001', '40P01', '55P03'].includes(e.code ?? '')) {
    res.status(409).json({ success: false, message: 'Otro proceso esta trabajando con estos registros. Actualiza y vuelve a intentar.' }); return;
  }
  if (e.code === '57014') {
    res.status(503).json({ success: false, message: 'La consulta excedio el tiempo permitido. Agrega un rango de fechas o un nombre mas preciso.' }); return;
  }
  if (e.code === '23505') {
    res.status(409).json({ success: false, message: 'La correccion entra en conflicto con una restriccion de duplicados. No se guardaron cambios.' }); return;
  }
  console.error('Revision de asignaciones:', error);
  res.status(500).json({ success: false, message: 'No se pudo completar la operacion. Verifica la migracion de revision y el registro del servidor.' });
}
function actor(req: Request, res: Response): number | null {
  const id = idValue((req as AuthenticatedRequest).auth?.areaId);
  if (!id) res.status(401).json({ success: false, message: 'Sesion no valida.' });
  return id;
}
export async function buscarRevisionController(req: Request, res: Response): Promise<void> {
  const areaId = actor(req, res); if (!areaId) return;
  try { res.json({ success: true, data: await buscarFacturasRevision(areaId, parseRevisionFilters(req.query)) }); }
  catch (error) { fail(error, res); }
}
export async function detalleRevisionController(req: Request, res: Response): Promise<void> {
  const areaId = actor(req, res); if (!areaId) return;
  try {
    const id = idValue(req.params.id); if (!id) throw new RevisionError('Factura no valida.');
    res.json({ success: true, data: await getFacturaRevision(areaId, id) });
  } catch (error) { fail(error, res); }
}
export async function corregirRevisionController(req: Request, res: Response): Promise<void> {
  const areaId = actor(req, res); if (!areaId) return;
  try {
    const id = idValue(req.params.id); if (!id) throw new RevisionError('Factura no valida.');
    const data = await corregirAsignacionFactura(areaId, id, parseCorrectionInput(req.body),
      req.ip && isIP(req.ip) ? req.ip : null, req.get('user-agent') ?? null);
    res.json({ success: true, message: data.sinCambios ? 'La asignacion ya tenia esos valores.' : 'Asignacion corregida.', data });
  } catch (error) { fail(error, res); }
}
