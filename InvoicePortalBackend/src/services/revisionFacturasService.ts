import type { PoolClient, QueryResultRow } from 'pg';
import pool from '../config/database';
import { getActorClasificacion, lockClasificacion } from './clasificacionProveedorService';

export class RevisionError extends Error {
  constructor(message: string, public readonly statusCode = 400) { super(message); this.name = 'RevisionError'; }
}
export interface FiltrosRevision {
  buscar: string; estado: string; idArea: number | null;
  desde: string; hasta: string; pagina: number; tamano: number; similitud: number;
}
export interface CorregirAsignacionInput {
  idProveedor: number; idAreaDestino: number; motivo: string;
  version: string; protegerAsignacion: boolean;
}
export interface FacturaRevision extends QueryResultRow {
  id: number; idProveedor: number | null; proveedorAsignado: string; proveedorSnapshot: string;
  nombreEnAsunto: string | null; idAreaActual: number; areaActual: string;
  idAreaProveedor: number | null; areaProveedor: string | null;
  asunto: string | null; correo: string | null; numeroFactura: string | null;
  nit: string | null; fechaRecepcion: string | null; estadoCodigo: string; estado: string;
  protegida: boolean; version: string; similitud: number; editable: boolean;
}
const base = `
 SELECT f.id, f.id_proveedor AS "idProveedor", f.proveedor_snapshot AS "proveedorSnapshot",
   COALESCE(p.nombre, f.proveedor_snapshot, 'SIN PROVEEDOR') AS "proveedorAsignado",
   CASE WHEN BTRIM(SPLIT_PART(COALESCE(f.asunto, ''), ';', 3)) <> ''
     THEN NULLIF(BTRIM(SPLIT_PART(f.asunto, ';', 2)), '') ELSE NULL END AS "nombreEnAsunto",
   f.id_area_actual AS "idAreaActual", a.nombre AS "areaActual",
   p.id_area AS "idAreaProveedor", ap.nombre AS "areaProveedor", f.asunto,
   f.correo_origen AS correo, f.numero_factura AS "numeroFactura", f.nit_snapshot AS nit,
   f.fecha_recepcion AS "fechaRecepcion", e.codigo AS "estadoCodigo", e.nombre AS estado,
   f.asignacion_manual_bloqueada AS protegida, f.xmin::text AS version,
   (e.codigo = 'PENDIENTE') AS editable
 FROM public.facturas f
 JOIN public.estados_factura e ON e.id = f.id_estado
 JOIN public.areas a ON a.id = f.id_area_actual
 LEFT JOIN public.proveedores p ON p.id = f.id_proveedor
 LEFT JOIN public.areas ap ON ap.id = p.id_area
`;
const normalizeRow = (row: FacturaRevision): FacturaRevision => ({ ...row,
  id: Number(row.id), idProveedor: row.idProveedor == null ? null : Number(row.idProveedor),
  idAreaActual: Number(row.idAreaActual), idAreaProveedor: row.idAreaProveedor == null ? null : Number(row.idAreaProveedor),
  similitud: Number(row.similitud ?? 0), version: String(row.version),
});
export async function assertSystems(client: PoolClient, areaId: number) {
  const actor = await getActorClasificacion(client, areaId);
  if (actor.codigo !== 'SISTEMAS') throw new RevisionError('Solo SISTEMAS puede revisar o corregir asignaciones.', 403);
  return actor;
}
export const normalizeSearch = (text: string): string => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const likeLiteral = (text: string) => `%${text.replace(/[\\%_]/g, '\\$&')}%`;

/** Filtra y pagina en PostgreSQL sobre TODAS las areas. Nunca limita antes de buscar. */
export async function buscarFacturasRevision(areaId: number, filters: FiltrosRevision) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query("SET LOCAL statement_timeout = '20s'");
    await assertSystems(client, areaId);
    await client.query("SELECT set_config('pg_trgm.word_similarity_threshold', $1, true)", [String(filters.similitud)]);
    const q = normalizeSearch(filters.buscar);
    const values = [q, likeLiteral(q), filters.estado || null, filters.idArea,
      filters.desde || null, filters.hasta || null];
    const where = `WHERE f.activo = TRUE
      AND ($3::text IS NULL OR e.codigo = $3)
      AND ($4::bigint IS NULL OR f.id_area_actual = $4)
      AND ($5::date IS NULL OR f.fecha_recepcion >= ($5::date::timestamp AT TIME ZONE 'America/Bogota'))
      AND ($6::date IS NULL OR f.fecha_recepcion < (($6::date + 1)::timestamp AT TIME ZONE 'America/Bogota'))
      AND ($1::text = ''
        OR public.sgaf_normalizar_busqueda(f.asunto) LIKE $2
        OR public.sgaf_normalizar_busqueda(f.proveedor_snapshot) LIKE $2
        OR public.sgaf_normalizar_busqueda(p.nombre) LIKE $2
        OR public.sgaf_normalizar_busqueda(f.correo_origen) LIKE $2
        OR public.sgaf_normalizar_busqueda(f.numero_factura) LIKE $2
        OR public.sgaf_normalizar_busqueda(f.nit_snapshot) LIKE $2
        OR public.sgaf_normalizar_busqueda(f.asunto) OPERATOR(public.%>) $1
        OR public.sgaf_normalizar_busqueda(f.proveedor_snapshot) OPERATOR(public.%>) $1
        OR public.sgaf_normalizar_busqueda(p.nombre) OPERATOR(public.%>) $1)`;
    const count = await client.query<{ total: string }>(`SELECT COUNT(*)::text AS total FROM (${base} ${where}) b`, values);
    const total = Number(count.rows[0]?.total ?? 0);
    const paginas = Math.max(1, Math.ceil(total / filters.tamano));
    const pagina = Math.min(filters.pagina, paginas);
    const result = await client.query<FacturaRevision>(`SELECT b.*,
      CASE WHEN $1 = '' THEN 0 ELSE GREATEST(
        public.word_similarity($1, public.sgaf_normalizar_busqueda(b.asunto)),
        public.word_similarity($1, public.sgaf_normalizar_busqueda(b."proveedorSnapshot")),
        public.word_similarity($1, public.sgaf_normalizar_busqueda(b."proveedorAsignado")),
        CASE WHEN public.sgaf_normalizar_busqueda(b.correo) LIKE $2
          OR public.sgaf_normalizar_busqueda(b."numeroFactura") LIKE $2 THEN 1 ELSE 0 END
      ) END AS similitud
      FROM (${base} ${where}) b
      ORDER BY similitud DESC, b."fechaRecepcion" DESC NULLS LAST, b.id DESC
      LIMIT $7 OFFSET $8`, [...values, filters.tamano, (pagina - 1) * filters.tamano]);
    await client.query('COMMIT');
    return { items: result.rows.map(normalizeRow), total, pagina, paginas, tamano: filters.tamano };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

export async function getFacturaRevision(areaId: number, idFactura: number) {
  const client = await pool.connect();
  try {
    await assertSystems(client, areaId);
    const result = await client.query<FacturaRevision>(`${base} WHERE f.id = $1 AND f.activo = TRUE`, [idFactura]);
    if (!result.rows[0]) throw new RevisionError('Factura no encontrada o inactiva.', 404);
    return normalizeRow(result.rows[0]);
  } finally { client.release(); }
}

interface Locked extends QueryResultRow {
  id: string; id_proveedor: string | null; id_proveedor_correo: string | null;
  id_area_actual: string; id_estado: string; estado: string; area: string;
  proveedor_snapshot: string; nit_snapshot: string | null; correo_proveedor_snapshot: string | null;
  correo_origen: string | null; asignacion_manual_bloqueada: boolean; version: string;
}
export async function corregirAsignacionFactura(areaId: number, idFactura: number,
  input: CorregirAsignacionInput, ip: string | null, userAgent: string | null) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '8s'");
    await lockClasificacion(client); // Mismo orden que la sincronizacion y altas de proveedores.
    const actor = await assertSystems(client, areaId);
    const result = await client.query<Locked>(`
      SELECT f.*, f.xmin::text AS version, e.codigo AS estado, a.nombre AS area
      FROM public.facturas f JOIN public.estados_factura e ON e.id = f.id_estado
      JOIN public.areas a ON a.id = f.id_area_actual
      WHERE f.id = $1 AND f.activo = TRUE FOR UPDATE OF f`, [idFactura]);
    const f = result.rows[0];
    if (!f) throw new RevisionError('Factura no encontrada o inactiva.', 404);
    if (f.version !== input.version) throw new RevisionError('La factura cambio desde que abriste el formulario. Cierra y vuelve a abrir Corregir para revisar los datos actuales.', 409);
    if (f.estado !== 'PENDIENTE') throw new RevisionError('Solo se corrigen asignaciones de facturas PENDIENTES. No se modifica una aprobacion, rechazo o procesamiento desde este modulo.', 409);
    const provider = await client.query<{ id: string; nombre: string; nit: string | null }>(`
      SELECT p.id, p.nombre, p.nit FROM public.proveedores p
      JOIN public.areas a ON a.id = p.id_area AND a.activo = TRUE
      WHERE p.id = $1 AND p.activo = TRUE FOR SHARE OF p`, [input.idProveedor]);
    const p = provider.rows[0];
    if (!p) throw new RevisionError('Proveedor no encontrado o inactivo.', 400);
    const destination = await client.query<{ id: string; nombre: string }>(
      'SELECT id, nombre FROM public.areas WHERE id = $1 AND activo = TRUE FOR SHARE', [input.idAreaDestino]);
    const area = destination.rows[0];
    if (!area) throw new RevisionError('Area destino no encontrada o inactiva.', 400);
    const sender = (f.correo_origen ?? '').trim().toLowerCase();
    const emails = await client.query<{ id: string; correo: string }>(`
      SELECT id, correo FROM public.proveedor_correos
      WHERE id_proveedor = $1 AND activo = TRUE AND LOWER(BTRIM(correo)) = $2
      ORDER BY es_principal DESC, id LIMIT 1`, [p.id, sender]);
    const idCorreo = emails.rows[0]?.id ?? null;
    const correoSnapshot = emails.rows[0]?.correo ?? (sender || null);
    const cambiaAsignacion = Number(f.id_proveedor) !== Number(p.id) || Number(f.id_area_actual) !== Number(area.id);
    const iguales = !cambiaAsignacion && f.proveedor_snapshot === p.nombre && f.nit_snapshot === p.nit &&
      String(f.id_proveedor_correo ?? '') === String(idCorreo ?? '') && f.correo_proveedor_snapshot === correoSnapshot &&
      f.asignacion_manual_bloqueada === input.protegerAsignacion;
    if (iguales) { await client.query('COMMIT'); return { idFactura, sinCambios: true, proveedor: p.nombre, area: area.nombre, protegida: input.protegerAsignacion }; }
    await client.query(`UPDATE public.facturas SET id_proveedor = $1, id_proveedor_correo = $2,
      proveedor_snapshot = $3, nit_snapshot = $4, correo_proveedor_snapshot = $5,
      id_area_actual = $6, asignacion_manual_bloqueada = $7, fecha_actualizacion = NOW()
      WHERE id = $8`, [p.id, idCorreo, p.nombre, p.nit, correoSnapshot, area.id, input.protegerAsignacion, idFactura]);
    // PROVEEDOR_ASIGNADO ya existe en el CHECK de tu proyecto; no se inventa otro estado.
    await client.query(`INSERT INTO public.factura_eventos
      (id_factura, accion, id_area_actor, area_actor_snapshot, id_area_origen, area_origen_snapshot,
       id_area_destino, area_destino_snapshot, id_estado_anterior, id_estado_nuevo, observacion, ip, user_agent, datos)
      VALUES ($1, 'PROVEEDOR_ASIGNADO', $2, $3, $4, $5, $6, $7, $8, $8, $9, $10::inet, $11, $12::jsonb)`,
    [idFactura, actor.id, actor.nombre, f.id_area_actual, f.area, area.id, area.nombre, f.id_estado,
      input.motivo, ip, userAgent, JSON.stringify({ automatico: false, motivo: 'CORRECCION_MANUAL_SISTEMAS',
        reinicia_bandeja: cambiaAsignacion,
        anterior: { idProveedor: f.id_proveedor, proveedor: f.proveedor_snapshot, nit: f.nit_snapshot,
          idArea: f.id_area_actual, area: f.area, protegida: f.asignacion_manual_bloqueada },
        nuevo: { idProveedor: Number(p.id), proveedor: p.nombre, nit: p.nit,
          idArea: Number(area.id), area: area.nombre, protegida: input.protegerAsignacion },
        estado_conservado: f.estado })]);
    await client.query('COMMIT');
    return { idFactura, sinCambios: false, proveedor: p.nombre, area: area.nombre, protegida: input.protegerAsignacion };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
