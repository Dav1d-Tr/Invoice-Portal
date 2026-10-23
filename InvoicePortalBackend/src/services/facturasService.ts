import { lockClasificacion, getActorClasificacion, clasificarProveedorEnTransaccion } from './clasificacionProveedorService';
import { crearProveedorEnTransaccion } from './proveedoresService';
import { normalizeEmail as normalizeProviderEmail, isValidEmail as isValidProviderEmail, parseStructuredInvoiceSubject } from '../utils/proveedorMatch';
import { ultimaRutaSql } from '../utils/bandejaSql';
import type { PoolClient, QueryResultRow, } from "pg";
import pool, { query, } from "../config/database";
import { normalizeAreaName, } from "../utils/normalizeAreaName";
import type { ExtractedInvoiceMetadata, } from "./invoiceMetadataService";
/* =========================================================
   TIPOS PUBLICOS
========================================================= */
export interface AreaCatalogo {
    id: number;
    nombre: string;
}
export interface ProveedorCatalogo {
    id: number;
    nombre: string;
    nit: string | null;
    idArea: number;
    area: string;
    correos: string[];
}
export interface NuevoProveedorFacturaInput {
    nombre: string;
    nit: string | null;
    idArea: number;
    correos: string[];
}
export interface AsignarProveedorFacturaInput {
    idProveedor?: number | null;
    nuevoProveedor?: NuevoProveedorFacturaInput | null;
}
export interface RemitirFacturaInput {
    idAreaDestino: number;
    observacion: string | null;
}
/* =========================================================
   ERROR
========================================================= */
export class FacturasError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 400) {
        super(message);
        this.name =
            "FacturasError";
        this.statusCode =
            statusCode;
    }
}
/* =========================================================
   ROWS
========================================================= */
interface AreaRow extends QueryResultRow {
    id: number | string;
    nombre: string;
    nombre_normalizado?: string | null;
}
interface ProveedorRow extends QueryResultRow {
    id: number | string;
    nombre: string;
    nit: string | null;
    id_area: number | string;
    area: string;
    id_correo_match: number | string | null;
    correo_principal: string | null;
}
interface FacturaLockedRow extends QueryResultRow {
    id: number | string;
    id_proveedor: number | string | null;
    id_area_origen: number | string;
    id_area_actual: number | string;
    id_estado: number | string;
    estado_codigo: string;
    area_origen: string;
    area_actual: string;
    proveedor_snapshot: string;
    correo_origen: string | null;
}
/* =========================================================
   SELECT BASE
========================================================= */
const facturaSelect = `
  SELECT
    f.id,
    f.id_proveedor
      AS "idProveedor",
    f.id_area_origen
      AS "idAreaOrigen",
    f.id_area_actual
      AS "idAreaActual",
    ef.codigo
      AS "estadoCodigo",
    ef.nombre
      AS estado,
    f.tipo_documento
      AS "tipoDocumento",
    f.numero_factura
      AS "numeroFactura",
    f.cufe,
    f.asunto,
    f.proveedor_snapshot
      AS proveedor,
    f.nit_snapshot
      AS nit,
    f.correo_origen
      AS correo,
    f.fecha_recepcion
      AS "fechaRecepcion",
    f.fecha_emision
      AS "fechaEmision",
    f.fecha_vencimiento
      AS "fechaVencimiento",
    f.tiene_adjuntos
      AS "tieneAdjuntos",
    f.web_link
      AS "webLink",
    f.body_preview
      AS "bodyPreview",
    f.outlook_message_id
      AS "outlookMessageId",
    f.internet_message_id
      AS "internetMessageId",
    ao.nombre
      AS "areaOrigen",
    aa.nombre
      AS "areaActual",
    p.id_area
      AS "idAreaProveedor",
    ap.nombre
      AS "areaProveedor",
    f.subtotal,
    f.impuestos,
    f.valor_total
      AS "valorTotal",
    f.moneda,
    f.origen,
    f.activo,
    f.asignacion_manual_bloqueada AS "asignacionManualBloqueada",
    f.fecha_creacion
      AS "fechaCreacion",
    f.fecha_actualizacion
      AS "fechaActualizacion"
  FROM
    public.facturas f
  INNER JOIN
    public.estados_factura ef
      ON ef.id = f.id_estado
  INNER JOIN
    public.areas ao
      ON ao.id = f.id_area_origen
  INNER JOIN
    public.areas aa
      ON aa.id = f.id_area_actual
  LEFT JOIN
    public.proveedores p
      ON p.id = f.id_proveedor
  LEFT JOIN
    public.areas ap
      ON ap.id = p.id_area
`;
const getProveedorById = async (client: PoolClient, idProveedor: number, correoOrigen?: string | null): Promise<ProveedorRow> => {
    const correo = correoOrigen
        ?.trim()
        .toLowerCase() ||
        null;
    const result = await client.query<ProveedorRow>(`
        SELECT
          p.id,
          p.nombre,
          p.nit,
          p.id_area,
          a.nombre
            AS area,
          (
            SELECT
              pc.id
            FROM
              public.proveedor_correos pc
            WHERE
              pc.id_proveedor =
                p.id
              AND pc.activo =
                  TRUE
              AND $2::text
                  IS NOT NULL
              AND LOWER(
                    BTRIM(pc.correo)
                  ) =
                  LOWER(
                    BTRIM($2)
                  )
            ORDER BY
              pc.es_principal DESC,
              pc.id ASC
            LIMIT 1
          )
            AS id_correo_match,
          (
            SELECT
              pc.correo
            FROM
              public.proveedor_correos pc
            WHERE
              pc.id_proveedor =
                p.id
              AND pc.activo =
                  TRUE
            ORDER BY
              pc.es_principal DESC,
              pc.id ASC
            LIMIT 1
          )
            AS correo_principal
        FROM
          public.proveedores p
        INNER JOIN
          public.areas a
            ON a.id =
               p.id_area
        WHERE
          p.id = $1
          AND p.activo =
              TRUE
          AND a.activo =
              TRUE
        LIMIT 1
      `, [
        idProveedor,
        correo,
    ]);
    const proveedor = result.rows[0];
    if (!proveedor) {
        throw new FacturasError("Proveedor no encontrado o inactivo.", 404);
    }
    return proveedor;
};
const getFacturaForUpdate = async (client: PoolClient, idFactura: number): Promise<FacturaLockedRow> => {
    const result = await client.query<FacturaLockedRow>(`
        SELECT
          f.id,
          f.id_proveedor,
          f.id_area_origen,
          f.id_area_actual,
          f.id_estado,
          ef.codigo
            AS estado_codigo,
          ao.nombre
            AS area_origen,
          aa.nombre
            AS area_actual,
          f.proveedor_snapshot,
          f.correo_origen
        FROM
          public.facturas f
        INNER JOIN
          public.estados_factura ef
            ON ef.id =
               f.id_estado
        INNER JOIN
          public.areas ao
            ON ao.id =
               f.id_area_origen
        INNER JOIN
          public.areas aa
            ON aa.id =
               f.id_area_actual
        WHERE
          f.id = $1
          AND f.activo =
              TRUE
        FOR UPDATE OF f
      `, [
        idFactura,
    ]);
    const factura = result.rows[0];
    if (!factura) {
        throw new FacturasError("Factura no encontrada.", 404);
    }
    return factura;
};
export const getFacturasArea = async (idArea: number) => {
    const result = await query(`${facturaSelect}
    LEFT JOIN LATERAL (${ultimaRutaSql('f')}) ruta ON TRUE
    WHERE f.id_area_actual = $1 AND f.origen = 'OUTLOOK' AND f.activo = TRUE
      AND ef.codigo IN ('PENDIENTE', 'APROBADA')
      AND NOT COALESCE(ruta.es_remision AND ruta.id_area_destino = f.id_area_actual, FALSE)
    ORDER BY f.fecha_recepcion DESC NULLS LAST, f.id DESC`, [idArea]);
    return result.rows;
};
/* =========================================================
   DETALLE
========================================================= */
export const getFacturaDetalle = async (idFactura: number, idArea: number) => {
    const result = await query(`
          ${facturaSelect}
          WHERE
            f.id = $1
            AND f.activo =
                TRUE
            AND
            (
              /* SISTEMAS puede auditar cualquier factura activa. */
              EXISTS
              (
                SELECT
                  1
                FROM
                  public.areas sistema
                WHERE
                  sistema.id = $2
                  AND sistema.activo = TRUE
                  AND
                  (
                    sistema.nombre_normalizado = 'SISTEMAS'
                    OR UPPER(BTRIM(sistema.nombre)) = 'SISTEMAS'
                  )
              )
              OR
              f.id_area_origen =
                $2
              OR
              f.id_area_actual =
                $2
              OR EXISTS
              (
                SELECT
                  1
                FROM
                  public.factura_eventos ev
                WHERE
                  ev.id_factura =
                    f.id
                  AND
                  (
                    ev.id_area_actor =
                      $2
                    OR
                    ev.id_area_origen =
                      $2
                    OR
                    ev.id_area_destino =
                      $2
                  )
              )
            )
          LIMIT 1
        `, [
        idFactura,
        idArea,
    ]);
    const factura = result.rows[0];
    if (!factura) {
        throw new FacturasError("Factura no encontrada o sin acceso.", 404);
    }
    return factura;
};
export const getFacturasRemitidas = async (idArea: number) => {
    const result = await query(`
    SELECT base.*, ruta.area_origen_snapshot AS "remitidaDesde", ruta.fecha_evento AS "fechaRemision"
    FROM (${facturaSelect}) base
    JOIN LATERAL (${ultimaRutaSql('base')}) ruta ON TRUE
    WHERE base."idAreaActual" = $1 AND base.activo = TRUE
      AND base."estadoCodigo" IN ('PENDIENTE', 'APROBADA')
      AND ruta.es_remision = TRUE AND ruta.id_area_destino = $1
    ORDER BY ruta.fecha_evento DESC, base.id DESC`, [idArea]);
    return result.rows;
};
/* =========================================================
   FACTURAS RECHAZADAS
   - Cada area ve las facturas que rechazo y que siguen
     actualmente en estado RECHAZADA.
   - SISTEMAS ve todas las rechazadas de todas las areas.
   - Si SISTEMAS reactiva una, deja de aparecer aqui porque
     vuelve a estado PENDIENTE.
========================================================= */
export const getFacturasRechazadas = async (idArea: number) => {
    const result = await query(`
          WITH actor AS
          (
            SELECT
              CASE
                WHEN
                  nombre_normalizado = 'SISTEMAS'
                  OR UPPER(BTRIM(nombre)) = 'SISTEMAS'
                THEN TRUE
                ELSE FALSE
              END AS es_sistemas
            FROM
              public.areas
            WHERE
              id = $1
              AND activo = TRUE
            LIMIT 1
          )
          SELECT
            base.*,
            rechazo.area_actor_snapshot
              AS "rechazadaPor",
            rechazo.observacion
              AS "observacionRechazo",
            rechazo.fecha_evento
              AS "fechaRechazo"
          FROM
          (
            ${facturaSelect}
          ) base
          INNER JOIN LATERAL
          (
            SELECT
              ev.id_area_actor,
              ev.area_actor_snapshot,
              ev.observacion,
              ev.fecha_evento,
              ev.id
            FROM
              public.factura_eventos ev
            WHERE
              ev.id_factura = base.id
              AND ev.accion = 'RECHAZADA'
            ORDER BY
              ev.fecha_evento DESC,
              ev.id DESC
            LIMIT 1
          ) rechazo
            ON TRUE
          WHERE
            base.activo = TRUE
            AND base."estadoCodigo" = 'RECHAZADA'
            AND
            (
              COALESCE(
                (SELECT es_sistemas FROM actor),
                FALSE
              ) = TRUE
              OR rechazo.id_area_actor = $1
            )
          ORDER BY
            rechazo.fecha_evento DESC,
            base.id DESC
        `, [
        idArea,
    ]);
    return result.rows;
};
/* =========================================================
   CATALOGO AREAS
========================================================= */
export const getAreasCatalogo = async (): Promise<AreaCatalogo[]> => {
    const result = await query<AreaRow>(`
          SELECT
            id,
            nombre
          FROM
            public.areas
          WHERE
            activo =
              TRUE
          ORDER BY
            nombre ASC
        `);
    return result.rows.map((row) => ({
        id: Number(row.id),
        nombre: row.nombre,
    }));
};
/* =========================================================
   CATALOGO PROVEEDORES
========================================================= */
export const getProveedoresCatalogo = async (): Promise<ProveedorCatalogo[]> => {
    const result = await query(`
          SELECT
            p.id,
            p.nombre,
            p.nit,
            p.id_area
              AS "idArea",
            a.nombre
              AS area,
            COALESCE
            (
              ARRAY
              (
                SELECT
                  pc.correo
                FROM
                  public.proveedor_correos pc
                WHERE
                  pc.id_proveedor =
                    p.id
                  AND pc.activo =
                      TRUE
                ORDER BY
                  pc.es_principal DESC,
                  pc.id ASC
              ),
              ARRAY[]::VARCHAR[]
            )
              AS correos
          FROM
            public.proveedores p
          INNER JOIN
            public.areas a
              ON a.id =
                 p.id_area
          WHERE
            p.activo =
              TRUE
            AND a.activo =
                TRUE
          ORDER BY
            p.nombre ASC
        `);
    return result.rows.map((row: any) => ({
        id: Number(row.id),
        nombre: String(row.nombre),
        nit: row.nit ??
            null,
        idArea: Number(row.idArea),
        area: String(row.area),
        correos: Array.isArray(row.correos)
            ? row.correos
                .map(String)
            : [],
    }));
};
export const actualizarMetadatosFactura = async (idFactura: number, metadata: ExtractedInvoiceMetadata): Promise<void> => {
    await query(`UPDATE public.facturas f SET
    tipo_documento = COALESCE($1, f.tipo_documento),
    numero_factura = COALESCE($2, f.numero_factura),
    nit_snapshot = CASE WHEN f.id_proveedor IS NOT NULL
      THEN (SELECT p.nit FROM public.proveedores p WHERE p.id = f.id_proveedor)
      ELSE f.nit_snapshot END,
    valor_total = COALESCE($3::numeric, f.valor_total),
    moneda = COALESCE($4, f.moneda), fecha_actualizacion = NOW()
    WHERE f.id = $5 AND f.activo = TRUE`, [metadata.tipoDocumento, metadata.numeroDocumento, metadata.valorTotal, metadata.moneda, idFactura]);
};
/* =========================================================
   APROBAR
========================================================= */
export const aprobarFactura = async (idFactura: number, idArea: number, observacion: string | null, ip: string | null, userAgent: string | null) => {
    await query(`
        SELECT
          public.fn_aprobar_factura
          (
            $1,
            $2,
            $3,
            $4::inet,
            $5
          )
      `, [
        idFactura,
        idArea,
        observacion,
        ip,
        userAgent,
    ]);
};
/* =========================================================
   RECHAZAR (MISMA OPERACION PARA TODAS LAS AREAS, INCLUIDA RECEPCION)
   La funcion PostgreSQL existente valida la pertenencia y el estado,
   cambia a RECHAZADA y registra el evento. No se desactiva la factura.
   No hay una implementacion alternativa de eliminacion para RECEPCION.
========================================================= */
export const rechazarFactura = async (idFactura: number, idArea: number, observacion: string | null, ip: string | null, userAgent: string | null): Promise<void> => {
    await query(`
        SELECT
          public.fn_rechazar_factura
          (
            $1,
            $2,
            $3,
            $4::inet,
            $5
          )
      `, [
        idFactura,
        idArea,
        observacion,
        ip,
        userAgent,
    ]);
};
/* =========================================================
   REMITIR ENTRE AREAS
   Disponible para cualquier area como ORIGEN.
   CONTABILIDAD como DESTINO usa la ruta dedicada.
========================================================= */
export const remitirFactura = async (idFactura: number, idAreaActor: number, input: RemitirFacturaInput, ip: string | null, userAgent: string | null): Promise<void> => {
    if (!Number.isInteger(input.idAreaDestino) ||
        input.idAreaDestino <=
            0) {
        throw new FacturasError("El área destino no es válida.");
    }
    /*
      CONTABILIDAD tiene una ruta dedicada porque solo una
      factura APROBADA puede enviarse allí. De esta forma
      nadie puede saltarse esa regla llamando manualmente
      al endpoint genérico.
    */
    const destinoResult = await query<AreaRow>(`
          SELECT
            id,
            nombre,
            nombre_normalizado
          FROM
            public.areas
          WHERE
            id = $1
            AND activo =
                TRUE
          LIMIT 1
        `, [
        input.idAreaDestino,
    ]);
    const destino = destinoResult.rows[0];
    if (!destino) {
        throw new FacturasError("El área destino no existe o está inactiva.", 404);
    }
    const destinoNormalizado = destino
        .nombre_normalizado ??
        normalizeAreaName(destino.nombre);
    if (destinoNormalizado ===
        "CONTABILIDAD") {
        throw new FacturasError("Para remitir una factura a CONTABILIDAD primero debes aprobarla y utilizar la opción 'Remitir a Contabilidad'.", 400);
    }
    await query(`
        SELECT
          public.fn_remitir_factura
          (
            $1,
            $2,
            $3,
            $4,
            $5::inet,
            $6
          )
      `, [
        idFactura,
        idAreaActor,
        input
            .idAreaDestino,
        input
            .observacion,
        ip,
        userAgent,
    ]);
};
/* =========================================================
   REMITIR A CONTABILIDAD
   Regla:
   - La factura debe pertenecer actualmente al área que ejecuta.
   - Debe estar APROBADA.
   - El destino se resuelve en backend y siempre es CONTABILIDAD.
   - Se conserva el estado APROBADA; la remisión es un movimiento.
========================================================= */
export const remitirFacturaContabilidad = async (idFactura: number, idAreaActor: number, observacion: string | null, ip: string | null, userAgent: string | null): Promise<void> => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const factura = await getFacturaForUpdate(client, idFactura);
        if (Number(factura
            .id_area_actual) !==
            idAreaActor) {
            throw new FacturasError("La factura ya no pertenece actualmente a tu área.", 409);
        }
        if (factura
            .estado_codigo !==
            "APROBADA") {
            throw new FacturasError("Solo una factura APROBADA puede remitirse a CONTABILIDAD.", 400);
        }
        const contabilidadResult = await client.query<AreaRow>(`
            SELECT
              id,
              nombre,
              nombre_normalizado
            FROM
              public.areas
            WHERE
              activo =
                TRUE
              AND
              (
                nombre_normalizado =
                  'CONTABILIDAD'
                OR UPPER(
                     BTRIM(nombre)
                   ) =
                   'CONTABILIDAD'
              )
            ORDER BY
              id ASC
            LIMIT 1
          `);
        const contabilidad = contabilidadResult.rows[0];
        if (!contabilidad) {
            throw new FacturasError("No existe un área CONTABILIDAD activa.", 404);
        }
        const idContabilidad = Number(contabilidad.id);
        if (idContabilidad ===
            idAreaActor) {
            throw new FacturasError("La factura ya se encuentra en CONTABILIDAD.", 409);
        }
        await client.query(`
          SELECT
            public.fn_remitir_factura
            (
              $1,
              $2,
              $3,
              $4,
              $5::inet,
              $6
            )
        `, [
            idFactura,
            idAreaActor,
            idContabilidad,
            observacion,
            ip,
            userAgent,
        ]);
        await client.query("COMMIT");
    }
    catch (error) {
        await client.query("ROLLBACK");
        throw error;
    }
    finally {
        client.release();
    }
};
export const asignarProveedorFactura = async (idFactura: number, idAreaActor: number, input: AsignarProveedorFacturaInput, ip: string | null, userAgent: string | null) => {
    const existente = Number.isSafeInteger(input.idProveedor) && Number(input.idProveedor) > 0;
    if (Number(existente) + Number(Boolean(input.nuevoProveedor)) !== 1) {
        throw new FacturasError('Selecciona un proveedor existente o registra uno nuevo.');
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Bloqueo global ANTES de bloquear la factura seleccionada: evita deadlocks
        // entre dos registros simultaneos desde facturas distintas de RECEPCION.
        await lockClasificacion(client);
        const actor = await getActorClasificacion(client, idAreaActor);
        if (actor.codigo !== 'RECEPCION')
            throw new FacturasError('Solo RECEPCION puede clasificar desde una factura.', 403);
        const factura = await getFacturaForUpdate(client, idFactura);
        if (Number(factura.id_area_actual) !== idAreaActor) {
            throw new FacturasError('El registro ya no pertenece a RECEPCION.', 409);
        }
        if (!['PENDIENTE', 'APROBADA'].includes(factura.estado_codigo)) {
            throw new FacturasError('Solo se pueden clasificar registros activos de la bandeja de RECEPCION.', 409);
        }
        let idProveedor = Number(input.idProveedor);
        const creado = !existente;
        let correoOrigenRegistrado = false;
        if (!existente) {
            const nuevo = input.nuevoProveedor!;
            let correos = [...(nuevo.correos ?? [])];
            // Al registrar desde un aviso sin estructura y sin correos especificados,
            // asociar su remitente real. NO registrar remitentes compartidos de asuntos estructurados.
            const subject = await client.query<{
                asunto: string | null;
            }>('SELECT asunto FROM public.facturas WHERE id = $1', [idFactura]);
            const email = normalizeProviderEmail(factura.correo_origen);
            if (!correos.length && !parseStructuredInvoiceSubject(subject.rows[0]?.asunto) && isValidProviderEmail(email)) {
                correos = [email];
                correoOrigenRegistrado = true;
            }
            const nuevoGuardado = await crearProveedorEnTransaccion(client, { ...nuevo, correos });
            idProveedor = nuevoGuardado.id;
        }
        const proveedor = await getProveedorById(client, idProveedor, factura.correo_origen);
        const clasificacion = await clasificarProveedorEnTransaccion(client, {
            idProveedor, alcance: 'RECEPCION', idAreaActor, idFacturaSeleccionada: idFactura,
            proveedorCreado: creado, ip, userAgent,
        });
        await client.query('COMMIT');
        return { idProveedor, proveedor: proveedor.nombre, nit: proveedor.nit,
            idArea: Number(proveedor.id_area), area: proveedor.area, creado,
            facturasActualizadas: clasificacion.facturasActualizadas,
            facturasTransferidas: clasificacion.facturasTransferidas,
            correoOrigenRegistrado, clasificacion };
    }
    catch (error) {
        await client.query('ROLLBACK');
        if ((error as {
            code?: string;
        })?.code === '23505') {
            throw new FacturasError('Ya existe un proveedor con ese nombre, NIT o correo. Asocia el existente.', 409);
        }
        throw error;
    }
    finally {
        client.release();
    }
};
/* =========================================================
   REACTIVAR FACTURA RECHAZADA
   Exclusivo de SISTEMAS por ruta y nuevamente validado
   dentro de PostgreSQL.
========================================================= */
export const reactivarFactura = async (idFactura: number, idArea: number, observacion: string | null, ip: string | null, userAgent: string | null) => {
    await query(`
        SELECT
          public.fn_reactivar_factura
          (
            $1::bigint,
            $2::bigint,
            $3::text,
            $4::inet,
            $5::text
          )
      `, [
        idFactura,
        idArea,
        observacion,
        ip,
        userAgent,
    ]);
};
/* =========================================================
   PROCESAR
========================================================= */
export const procesarFactura = async (idFactura: number, idArea: number, observacion: string | null, ip: string | null, userAgent: string | null) => {
    await query(`
        SELECT
          public.fn_procesar_factura
          (
            $1,
            $2,
            $3,
            $4::inet,
            $5
          )
      `, [
        idFactura,
        idArea,
        observacion,
        ip,
        userAgent,
    ]);
};
/* =========================================================
   HISTORIAL COMPLETO
   Primero validamos acceso a la factura.
========================================================= */
export const getHistorialFactura = async (idFactura: number, idArea: number) => {
    await getFacturaDetalle(idFactura, idArea);
    const result = await query(`
          SELECT
            ev.id,
            ev.accion,
            ev.area_actor_snapshot
              AS "areaActor",
            ev.area_origen_snapshot
              AS "areaOrigen",
            ev.area_destino_snapshot
              AS "areaDestino",
            anterior.codigo
              AS "estadoAnteriorCodigo",
            anterior.nombre
              AS "estadoAnterior",
            nuevo.codigo
              AS "estadoNuevoCodigo",
            nuevo.nombre
              AS "estadoNuevo",
            ev.observacion,
            ev.datos,
            ev.fecha_evento
              AS "fechaEvento"
          FROM
            public.factura_eventos ev
          LEFT JOIN
            public.estados_factura anterior
              ON anterior.id =
                 ev.id_estado_anterior
          LEFT JOIN
            public.estados_factura nuevo
              ON nuevo.id =
                 ev.id_estado_nuevo
          WHERE
            ev.id_factura =
              $1
          ORDER BY
            ev.fecha_evento ASC,
            ev.id ASC
        `, [
        idFactura,
    ]);
    return result.rows;
};
