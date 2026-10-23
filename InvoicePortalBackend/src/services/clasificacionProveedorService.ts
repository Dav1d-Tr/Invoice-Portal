import type { PoolClient, QueryResultRow } from 'pg';
import pool from '../config/database';
import { normalizeAreaName } from '../utils/normalizeAreaName';
import { normalizeEmail, parseStructuredInvoiceSubject, perteneceAlProveedor } from '../utils/proveedorMatch';
import type { ProveedorConfig } from '../utils/proveedorMatch';
export class ClasificacionError extends Error {
    constructor(message: string, public readonly statusCode = 400) {
        super(message);
        this.name = 'ClasificacionError';
    }
}
export type AlcanceClasificacion = 'RECEPCION' | 'TODAS';
export interface ActorClasificacion {
    id: number;
    nombre: string;
    codigo: string;
}
export interface ResultadoClasificacion {
    alcance: AlcanceClasificacion;
    registrosRevisados: number;
    coincidencias: number;
    facturasActualizadas: number;
    facturasTransferidas: number;
    yaAsignadas: number;
    ambiguas: number;
    coincidenciasPorCorreo: number;
    coincidenciasPorNombre: number;
}
export interface ClasificacionInput {
    idProveedor: number;
    alcance: AlcanceClasificacion;
    idAreaActor: number;
    idFacturaSeleccionada?: number;
    ip?: string | null;
    userAgent?: string | null;
    proveedorCreado?: boolean;
}
interface ProveedorRow extends QueryResultRow {
    id_proveedor: number | string;
    proveedor: string;
    nit: string | null;
    id_area: number | string;
    area: string;
    id_correo: number | string | null;
    correo: string | null;
}
interface FacturaRow extends QueryResultRow {
    id: number | string;
    id_proveedor: number | string | null;
    id_proveedor_correo: number | string | null;
    id_area_actual: number | string;
    area_actual: string;
    id_estado: number | string;
    estado_codigo: string;
    asunto: string | null;
    correo_origen: string | null;
    proveedor_snapshot: string;
    nit_snapshot: string | null;
    correo_proveedor_snapshot: string | null;
}
/** Mismo orden de bloqueo en creacion, edicion, clasificacion e importacion. */
export const lockClasificacion = async (client: PoolClient): Promise<void> => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('SGAF_PROVEEDORES_CLASIFICACION'))");
};
export const getActorClasificacion = async (client: PoolClient, idAreaActor: number): Promise<ActorClasificacion> => {
    const result = await client.query<{
        id: number | string;
        nombre: string;
        nombre_normalizado: string | null;
    }>('SELECT id, nombre, nombre_normalizado FROM public.areas WHERE id = $1 AND activo = TRUE', [idAreaActor]);
    const area = result.rows[0];
    if (!area)
        throw new ClasificacionError('Area de sesion no valida o inactiva.', 403);
    return { id: Number(area.id), nombre: area.nombre,
        codigo: normalizeAreaName(area.nombre_normalizado || area.nombre) };
};
export const getProveedorConfigs = async (client: PoolClient): Promise<ProveedorConfig[]> => {
    const result = await client.query<ProveedorRow>(`
    SELECT p.id AS id_proveedor, p.nombre AS proveedor, p.nit, p.id_area,
           a.nombre AS area, pc.id AS id_correo, LOWER(BTRIM(pc.correo)) AS correo
    FROM public.proveedores p
    JOIN public.areas a ON a.id = p.id_area AND a.activo = TRUE
    LEFT JOIN public.proveedor_correos pc ON pc.id_proveedor = p.id AND pc.activo = TRUE
    WHERE p.activo = TRUE
    ORDER BY p.id, pc.es_principal DESC, pc.id
  `);
    const map = new Map<number, ProveedorConfig>();
    for (const row of result.rows) {
        const id = Number(row.id_proveedor);
        let p = map.get(id);
        if (!p) {
            p = { idProveedor: id, proveedor: row.proveedor, nit: row.nit,
                idArea: Number(row.id_area), area: row.area, correos: [] };
            map.set(id, p);
        }
        if (row.id_correo != null && row.correo)
            p.correos.push({
                id: Number(row.id_correo), correo: normalizeEmail(row.correo),
            });
    }
    return [...map.values()];
};
const facturaCampos = `
  SELECT f.id, f.id_proveedor, f.id_proveedor_correo, f.id_area_actual,
         aa.nombre AS area_actual, f.id_estado, ef.codigo AS estado_codigo,
         f.asunto, f.correo_origen, f.proveedor_snapshot, f.nit_snapshot,
         f.correo_proveedor_snapshot
  FROM public.facturas f
  JOIN public.estados_factura ef ON ef.id = f.id_estado
  JOIN public.areas aa ON aa.id = f.id_area_actual
`;
export const clasificarProveedorEnTransaccion = async (client: PoolClient, input: ClasificacionInput): Promise<ResultadoClasificacion> => {
    await lockClasificacion(client);
    const actor = await getActorClasificacion(client, input.idAreaActor);
    if (input.alcance === 'TODAS' && actor.codigo !== 'SISTEMAS') {
        throw new ClasificacionError('Solo SISTEMAS puede sincronizar todas las areas.', 403);
    }
    if (input.alcance === 'RECEPCION' && actor.codigo !== 'RECEPCION') {
        throw new ClasificacionError('Esta clasificacion corresponde a RECEPCION.', 403);
    }
    if (input.idFacturaSeleccionada) {
        const protection = await client.query<{ protegida: boolean }>(
            'SELECT asignacion_manual_bloqueada AS protegida FROM public.facturas WHERE id = $1',
            [input.idFacturaSeleccionada]);
        if (protection.rows[0]?.protegida) {
            throw new ClasificacionError('SISTEMAS protegó esta asignación. Debe corregirse desde Revisión de asignaciones.', 409);
        }
    }
    const proveedores = await getProveedorConfigs(client);
    const proveedor = proveedores.find(p => p.idProveedor === input.idProveedor);
    if (!proveedor)
        throw new ClasificacionError('Proveedor no encontrado o inactivo.', 404);
    const recepcionId = input.alcance === 'RECEPCION' ? actor.id : null;
    // La bandeja de RECEPCION incluye PENDIENTE y APROBADA; se conserva el estado.
    // La sincronizacion global de SISTEMAS solo toma PENDIENTE.
    const estadosPermitidos = input.alcance === 'RECEPCION' ? ['PENDIENTE', 'APROBADA'] : ['PENDIENTE'];
    const maxResult = await client.query<{
        max_id: number | string;
    }>('SELECT COALESCE(MAX(id), 0) AS max_id FROM public.facturas');
    const maxId = Number(maxResult.rows[0]?.max_id ?? 0);
    let ultimoId = 0;
    const resumen: ResultadoClasificacion = {
        alcance: input.alcance, registrosRevisados: 0, coincidencias: 0,
        facturasActualizadas: 0, facturasTransferidas: 0, yaAsignadas: 0,
        ambiguas: 0, coincidenciasPorCorreo: 0, coincidenciasPorNombre: 0,
    };
    while (ultimoId < maxId) {
        // Paginacion por ID: recorre todo el conjunto, no solo la pagina de React.
        const lote = await client.query<FacturaRow>(`${facturaCampos}
      WHERE f.id > $1 AND f.id <= $2 AND f.activo = TRUE
        AND f.asignacion_manual_bloqueada = FALSE
        AND ef.codigo = ANY($4::text[])
        AND ($3::bigint IS NULL OR f.id_area_actual = $3)
      ORDER BY f.id ASC LIMIT 250`, [ultimoId, maxId, recepcionId, estadosPermitidos]);
        if (!lote.rows.length)
            break;
        for (const candidata of lote.rows) {
            ultimoId = Number(candidata.id);
            resumen.registrosRevisados++;
            const preliminar = perteneceAlProveedor(candidata, proveedor.idProveedor, proveedores, input.idFacturaSeleccionada);
            if (preliminar.ambiguo)
                resumen.ambiguas++;
            if (!preliminar.coincide)
                continue;
            // Revalidar estado, pertenencia y activo DESPUES de obtener el bloqueo.
            // No se usa SKIP LOCKED: no se omiten registros por otra operacion en curso.
            const locked = await client.query<FacturaRow>(`${facturaCampos}
        WHERE f.id = $1 AND f.activo = TRUE AND f.asignacion_manual_bloqueada = FALSE AND ef.codigo = ANY($3::text[])
          AND ($2::bigint IS NULL OR f.id_area_actual = $2)
        FOR UPDATE OF f`, [candidata.id, recepcionId, estadosPermitidos]);
            const factura = locked.rows[0];
            if (!factura)
                continue;
            const decision = perteneceAlProveedor(factura, proveedor.idProveedor, proveedores, input.idFacturaSeleccionada);
            if (!decision.coincide)
                continue;
            resumen.coincidencias++;
            if (decision.metodo === 'CORREO_EXACTO')
                resumen.coincidenciasPorCorreo++;
            if (decision.metodo === 'NOMBRE_ASUNTO_EXACTO')
                resumen.coincidenciasPorNombre++;
            const correo = normalizeEmail(factura.correo_origen);
            const correoMatch = proveedor.correos.find(c => normalizeEmail(c.correo) === correo);
            const idCorreo = correoMatch?.id ?? null;
            const correoSnapshot = correoMatch?.correo || correo || null;
            // Nunca usar el NIT encontrado en el cuerpo (puede ser el del cliente).
            const nit = proveedor.nit || parseStructuredInvoiceSubject(factura.asunto)?.nit || null;
            const cambiaArea = Number(factura.id_area_actual) !== proveedor.idArea;
            const mismo = Number(factura.id_proveedor) === proveedor.idProveedor && !cambiaArea
                && (factura.id_proveedor_correo == null ? null : Number(factura.id_proveedor_correo)) === idCorreo
                && factura.proveedor_snapshot === proveedor.proveedor
                && factura.nit_snapshot === nit && factura.correo_proveedor_snapshot === correoSnapshot;
            if (mismo) {
                resumen.yaAsignadas++;
                continue;
            }
            const updated = await client.query(`
        UPDATE public.facturas SET id_proveedor = $1, id_proveedor_correo = $2,
          proveedor_snapshot = $3, nit_snapshot = $4, correo_proveedor_snapshot = $5,
          id_area_actual = $6, fecha_actualizacion = NOW()
        WHERE id = $7 AND activo = TRUE AND id_estado = $8 AND id_area_actual = $9
        RETURNING id`, [proveedor.idProveedor, idCorreo, proveedor.proveedor, nit,
                correoSnapshot, proveedor.idArea, factura.id, factura.id_estado, factura.id_area_actual]);
            if (!updated.rows.length)
                continue;
            await client.query(`
        INSERT INTO public.factura_eventos (
          id_factura, accion, id_area_actor, area_actor_snapshot, id_area_origen,
          area_origen_snapshot, id_area_destino, area_destino_snapshot,
          id_estado_anterior, id_estado_nuevo, observacion, ip, user_agent, datos
        ) VALUES ($1, 'PROVEEDOR_ASIGNADO', $2, $3, $4, $5, $6, $7, $8, $8, $9, $10::inet, $11, $12::jsonb)
      `, [factura.id, actor.id, actor.nombre, factura.id_area_actual, factura.area_actual,
                proveedor.idArea, proveedor.area, factura.id_estado,
                input.alcance === 'RECEPCION' ? 'Clasificacion del proveedor desde RECEPCION.'
                    : 'Reclasificacion de pendientes por SISTEMAS.', input.ip ?? null, input.userAgent ?? null,
                JSON.stringify({ automatico: true, motivo: 'PROVEEDOR_SINCRONIZADO',
                    alcance: input.alcance, coincidencia: decision.metodo,
                    id_proveedor: proveedor.idProveedor, id_proveedor_anterior: factura.id_proveedor,
                    proveedor_creado: input.proveedorCreado ?? false,
                    reinicia_bandeja: cambiaArea, estado_conservado: factura.estado_codigo })]);
            resumen.facturasActualizadas++;
            if (cambiaArea)
                resumen.facturasTransferidas++;
        }
    }
    return resumen;
};
export const reclasificarPendientesProveedor = async (input: ClasificacionInput): Promise<ResultadoClasificacion> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await clasificarProveedorEnTransaccion(client, input);
        await client.query('COMMIT');
        return result;
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
};
