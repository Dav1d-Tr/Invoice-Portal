import type {
  QueryResultRow,
} from "pg";

import {
  query,
} from "../config/database";

/* =========================================================
   TIPOS PUBLICOS
========================================================= */

export interface ResumenArea {
  totalGestionadas: number;
  pendientesActuales: number;
  aprobadas: number;
  rechazadas: number;
  remitidas: number;
  procesadas: number;
}

export interface HistorialRemisionItem {
  idEvento: number;
  idFactura: number;
  tipoDocumento: "FACTURA" | "NOTA_CREDITO" | null;
  numeroFactura: string | null;
  proveedor: string;
  nit: string | null;
  correo: string | null;
  estadoCodigo: string;
  estado: string;
  areaOrigenFactura: string;
  areaActual: string;
  remitidaDesde: string;
  remitidaA: string;
  fechaRecepcion: string | null;
  fechaRemision: string;
  observacion: string | null;
  valorTotal: string | number | null;
  moneda: string | null;
}

export interface HistorialProcesadaItem {
  idEvento: number;
  idFactura: number;
  tipoDocumento: "FACTURA" | "NOTA_CREDITO" | null;
  numeroFactura: string | null;
  proveedor: string;
  nit: string | null;
  correo: string | null;
  estadoCodigo: string;
  estado: string;
  areaOrigenFactura: string;
  areaActual: string;
  recibidaDesde: string | null;
  fechaRecepcion: string | null;
  fechaProcesada: string;
  observacion: string | null;
  valorTotal: string | number | null;
  moneda: string | null;
}

interface ResumenRow
  extends QueryResultRow {
  total_gestionadas: string | number;
  pendientes_actuales: string | number;
  aprobadas: string | number;
  rechazadas: string | number;
  remitidas: string | number;
  procesadas: string | number;
}

const toNumber = (
  value:
    string |
    number |
    null |
    undefined,
): number => {
  const parsed =
    Number(
      value ?? 0,
    );

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : 0;
};

/* =========================================================
   RESUMEN GLOBAL DEL AREA

   IMPORTANTE:
   - APROBADAS y RECHAZADAS se cuentan por el evento que hizo
     el área, por eso no desaparecen si luego la factura se
     remite a otra área.
   - PENDIENTES representa la bandeja FACTURAS actual.
========================================================= */

export const getResumenArea =
  async (
    idArea:
      number,
  ): Promise<ResumenArea> => {
    const result =
      await query<ResumenRow>(
        `
          WITH relacionadas AS
          (
            SELECT DISTINCT
              f.id

            FROM
              public.facturas f

            WHERE
              f.activo = TRUE

              AND
              (
                f.id_area_origen = $1

                OR f.id_area_actual = $1

                OR EXISTS
                (
                  SELECT
                    1

                  FROM
                    public.factura_eventos ev

                  WHERE
                    ev.id_factura = f.id

                    AND
                    (
                      ev.id_area_actor = $1
                      OR ev.id_area_origen = $1
                      OR ev.id_area_destino = $1
                    )
                )
              )
          ),

          pendientes AS
          (
            SELECT
              COUNT(*) AS total

            FROM
              public.facturas f

            INNER JOIN
              public.estados_factura ef
                ON ef.id = f.id_estado

            WHERE
              f.activo = TRUE

              AND f.id_area_actual = $1

              AND ef.codigo = 'PENDIENTE'

              AND NOT EXISTS
              (
                SELECT
                  1

                FROM
                (
                  SELECT
                    ev.id_area_destino

                  FROM
                    public.factura_eventos ev

                  WHERE
                    ev.id_factura = f.id

                    AND ev.accion = 'REMITIDA'

                  ORDER BY
                    ev.fecha_evento DESC,
                    ev.id DESC

                  LIMIT 1
                ) ultima_remision

                WHERE
                  ultima_remision.id_area_destino = $1
              )
          ),

          aprobadas_area AS
          (
            SELECT DISTINCT
              ev.id_factura

            FROM
              public.factura_eventos ev

            WHERE
              ev.accion = 'APROBADA'

              AND ev.id_area_actor = $1
          ),

          rechazadas_area AS
          (
            SELECT DISTINCT
              ev.id_factura

            FROM
              public.factura_eventos ev

            WHERE
              ev.accion = 'RECHAZADA'

              AND ev.id_area_actor = $1
          ),

          remitidas_area AS
          (
            SELECT
              ev.id

            FROM
              public.factura_eventos ev

            WHERE
              ev.accion = 'REMITIDA'

              AND
              (
                ev.id_area_origen = $1
                OR ev.id_area_actor = $1
              )

              AND NOT
              (
                COALESCE(
                  ev.datos ->> 'automatico',
                  'false'
                ) = 'true'

                AND COALESCE(
                  ev.datos ->> 'motivo',
                  ''
                ) IN
                (
                  'PROVEEDOR_REGISTRADO_O_ASIGNADO',
                  'PROVEEDOR_SINCRONIZADO',
                  'PROVEEDOR_REGISTRADO_O_ACTUALIZADO'
                )
              )
          ),

          procesadas_area AS
          (
            SELECT DISTINCT
              ev.id_factura

            FROM
              public.factura_eventos ev

            WHERE
              ev.accion = 'PROCESADA'

              AND ev.id_area_actor = $1
          )

          SELECT
            (
              SELECT COUNT(*)
              FROM relacionadas
            ) AS total_gestionadas,

            (
              SELECT total
              FROM pendientes
            ) AS pendientes_actuales,

            (
              SELECT COUNT(*)
              FROM aprobadas_area
            ) AS aprobadas,

            (
              SELECT COUNT(*)
              FROM rechazadas_area
            ) AS rechazadas,

            (
              SELECT COUNT(*)
              FROM remitidas_area
            ) AS remitidas,

            (
              SELECT COUNT(*)
              FROM procesadas_area
            ) AS procesadas
        `,
        [
          idArea,
        ],
      );

    const row =
      result.rows[0];

    return {
      totalGestionadas:
        toNumber(
          row?.total_gestionadas,
        ),

      pendientesActuales:
        toNumber(
          row?.pendientes_actuales,
        ),

      aprobadas:
        toNumber(
          row?.aprobadas,
        ),

      rechazadas:
        toNumber(
          row?.rechazadas,
        ),

      remitidas:
        toNumber(
          row?.remitidas,
        ),

      procesadas:
        toNumber(
          row?.procesadas,
        ),
    };
  };

/* =========================================================
   HISTORIAL DE REMISIONES SALIENTES DEL AREA

   Una factura aparece aquí cuando el área la remitió a otra.
   La factura puede estar hoy en cualquier otra área.
========================================================= */

export const getHistorialRemisionesArea =
  async (
    idArea:
      number,
  ): Promise<HistorialRemisionItem[]> => {
    const result =
      await query(
        `
          SELECT
            ev.id
              AS "idEvento",

            f.id
              AS "idFactura",

            f.tipo_documento
              AS "tipoDocumento",

            f.numero_factura
              AS "numeroFactura",

            f.proveedor_snapshot
              AS proveedor,

            f.nit_snapshot
              AS nit,

            f.correo_origen
              AS correo,

            ef.codigo
              AS "estadoCodigo",

            ef.nombre
              AS estado,

            ao.nombre
              AS "areaOrigenFactura",

            aa.nombre
              AS "areaActual",

            COALESCE(
              ev.area_origen_snapshot,
              actor.nombre,
              'AREA'
            ) AS "remitidaDesde",

            COALESCE(
              ev.area_destino_snapshot,
              destino.nombre,
              'AREA'
            ) AS "remitidaA",

            f.fecha_recepcion
              AS "fechaRecepcion",

            ev.fecha_evento
              AS "fechaRemision",

            ev.observacion,

            f.valor_total
              AS "valorTotal",

            f.moneda

          FROM
            public.factura_eventos ev

          INNER JOIN
            public.facturas f
              ON f.id = ev.id_factura

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
            public.areas actor
              ON actor.id = ev.id_area_actor

          LEFT JOIN
            public.areas destino
              ON destino.id = ev.id_area_destino

          WHERE
            ev.accion = 'REMITIDA'

            AND f.activo = TRUE

            AND
            (
              ev.id_area_origen = $1
              OR ev.id_area_actor = $1
            )

            AND NOT
            (
              COALESCE(
                ev.datos ->> 'automatico',
                'false'
              ) = 'true'

              AND COALESCE(
                ev.datos ->> 'motivo',
                ''
              ) IN
              (
                'PROVEEDOR_REGISTRADO_O_ASIGNADO',
                'PROVEEDOR_SINCRONIZADO',
                'PROVEEDOR_REGISTRADO_O_ACTUALIZADO'
              )
            )

          ORDER BY
            ev.fecha_evento DESC,
            ev.id DESC

          LIMIT 1000
        `,
        [
          idArea,
        ],
      );

    return result.rows.map(
      (
        row:
          any,
      ) => ({
        ...row,
        idEvento:
          Number(
            row.idEvento,
          ),
        idFactura:
          Number(
            row.idFactura,
          ),
      }),
    );
  };

/* =========================================================
   HISTORIAL DE PROCESADAS - CONTABILIDAD
========================================================= */

export const getHistorialProcesadasArea =
  async (
    idArea:
      number,
  ): Promise<HistorialProcesadaItem[]> => {
    const result =
      await query(
        `
          SELECT
            ev.id
              AS "idEvento",

            f.id
              AS "idFactura",

            f.tipo_documento
              AS "tipoDocumento",

            f.numero_factura
              AS "numeroFactura",

            f.proveedor_snapshot
              AS proveedor,

            f.nit_snapshot
              AS nit,

            f.correo_origen
              AS correo,

            ef.codigo
              AS "estadoCodigo",

            ef.nombre
              AS estado,

            ao.nombre
              AS "areaOrigenFactura",

            aa.nombre
              AS "areaActual",

            ultima_remision.area_origen_snapshot
              AS "recibidaDesde",

            f.fecha_recepcion
              AS "fechaRecepcion",

            ev.fecha_evento
              AS "fechaProcesada",

            ev.observacion,

            f.valor_total
              AS "valorTotal",

            f.moneda

          FROM
            public.factura_eventos ev

          INNER JOIN
            public.facturas f
              ON f.id = ev.id_factura

          INNER JOIN
            public.estados_factura ef
              ON ef.id = f.id_estado

          INNER JOIN
            public.areas ao
              ON ao.id = f.id_area_origen

          INNER JOIN
            public.areas aa
              ON aa.id = f.id_area_actual

          LEFT JOIN LATERAL
          (
            SELECT
              r.area_origen_snapshot

            FROM
              public.factura_eventos r

            WHERE
              r.id_factura = f.id

              AND r.accion = 'REMITIDA'

              AND r.id_area_destino = $1

              AND r.fecha_evento <= ev.fecha_evento

            ORDER BY
              r.fecha_evento DESC,
              r.id DESC

            LIMIT 1
          ) ultima_remision
            ON TRUE

          WHERE
            ev.accion = 'PROCESADA'

            AND f.activo = TRUE

            AND ev.id_area_actor = $1

          ORDER BY
            ev.fecha_evento DESC,
            ev.id DESC

          LIMIT 1000
        `,
        [
          idArea,
        ],
      );

    return result.rows.map(
      (
        row:
          any,
      ) => ({
        ...row,
        idEvento:
          Number(
            row.idEvento,
          ),
        idFactura:
          Number(
            row.idFactura,
          ),
      }),
    );
  };
