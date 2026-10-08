import type {

  PoolClient,

  QueryResultRow,

} from "pg";



import pool, {

  query,

} from "../config/database";



import {

  normalizeAreaName,

} from "../utils/normalizeAreaName";



import type {

  ExtractedInvoiceMetadata,

} from "./invoiceMetadataService";



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



export class FacturasError

  extends Error {

  statusCode: number;



  constructor(

    message: string,

    statusCode = 400,

  ) {

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



interface AreaRow

  extends QueryResultRow {

  id:

    number | string;



  nombre:

    string;



  nombre_normalizado?:

    string | null;

}



interface ProveedorRow

  extends QueryResultRow {

  id:

    number | string;



  nombre:

    string;



  nit:

    string | null;



  id_area:

    number | string;



  area:

    string;



  id_correo_match:

    number | string | null;



  correo_principal:

    string | null;

}



interface FacturaLockedRow

  extends QueryResultRow {

  id:

    number | string;



  id_proveedor:

    number | string | null;



  id_area_origen:

    number | string;



  id_area_actual:

    number | string;



  id_estado:

    number | string;



  estado_codigo:

    string;



  area_origen:

    string;



  area_actual:

    string;



  proveedor_snapshot:

    string;



  correo_origen:

    string | null;

}





interface FacturaRecepcionProveedorRow

  extends QueryResultRow {

  id:

    number | string;



  id_estado:

    number | string;



  estado_codigo:

    string;



  id_area_actual:

    number | string;



  area_actual:

    string;



  correo_origen:

    string | null;

}



interface CorreoProveedorMatchRow

  extends QueryResultRow {

  id:

    number | string;



  correo:

    string;

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



/* =========================================================

   HELPERS

========================================================= */



const normalizeEmail = (

  value: string,

): string => {

  return value

    .trim()

    .toLowerCase();

};



const normalizeEmails = (

  values:

    string[] | undefined,

): string[] => {

  const unique =

    new Set<string>();



  for (

    const value

    of values ?? []

  ) {

    const email =

      normalizeEmail(

        value,

      );



    if (!email) {

      continue;

    }



    if (

      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(

        email,

      )

    ) {

      throw new FacturasError(

        `El correo "${email}" no es válido.`,

      );

    }



    unique.add(

      email,

    );

  }



  return Array.from(

    unique,

  );

};



const cleanProviderName = (

  value: string,

): string => {

  return value

    .trim()

    .replace(

      /\s+/g,

      " ",

    );

};



const cleanNit = (

  value:

    string |

    null |

    undefined,

): string | null => {

  const clean =

    value

      ?.trim() ??

    "";



  return clean ||

    null;

};



const getAreaById = async (

  client:

    PoolClient,

  idArea:

    number,

): Promise<AreaRow> => {

  const result =

    await client.query<AreaRow>(

      `

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

      `,

      [

        idArea,

      ],

    );



  const area =

    result.rows[0];



  if (!area) {

    throw new FacturasError(

      "El área seleccionada no existe o está inactiva.",

      404,

    );

  }



  return area;

};



const getProveedorById = async (

  client:

    PoolClient,

  idProveedor:

    number,

  correoOrigen?:

    string | null,

): Promise<ProveedorRow> => {

  const correo =

    correoOrigen

      ?.trim()

      .toLowerCase() ||

    null;



  const result =

    await client.query<ProveedorRow>(

      `

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

      `,

      [

        idProveedor,

        correo,

      ],

    );



  const proveedor =

    result.rows[0];



  if (!proveedor) {

    throw new FacturasError(

      "Proveedor no encontrado o inactivo.",

      404,

    );

  }



  return proveedor;

};



const getFacturaForUpdate = async (

  client:

    PoolClient,

  idFactura:

    number,

): Promise<FacturaLockedRow> => {

  const result =

    await client.query<FacturaLockedRow>(

      `

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

      `,

      [

        idFactura,

      ],

    );



  const factura =

    result.rows[0];



  if (!factura) {

    throw new FacturasError(

      "Factura no encontrada.",

      404,

    );

  }



  return factura;

};



const insertEvento = async (

  client:

    PoolClient,

  data: {

    idFactura:

      number;



    accion:

      string;



    idAreaActor:

      number | null;



    areaActor:

      string;



    idAreaOrigen:

      number | null;



    areaOrigen:

      string | null;



    idAreaDestino:

      number | null;



    areaDestino:

      string | null;



    idEstadoAnterior:

      number | null;



    idEstadoNuevo:

      number | null;



    observacion:

      string | null;



    ip:

      string | null;



    userAgent:

      string | null;



    datos?:

      Record<

        string,

        unknown

      >;

  },

): Promise<void> => {

  await client.query(

    `

      INSERT INTO

        public.factura_eventos

      (

        id_factura,

        accion,

        id_area_actor,

        area_actor_snapshot,

        id_area_origen,

        area_origen_snapshot,

        id_area_destino,

        area_destino_snapshot,

        id_estado_anterior,

        id_estado_nuevo,

        observacion,

        ip,

        user_agent,

        datos

      )



      VALUES

      (

        $1,

        $2,

        $3,

        $4,

        $5,

        $6,

        $7,

        $8,

        $9,

        $10,

        $11,

        $12::inet,

        $13,

        $14::jsonb

      )

    `,

    [

      data.idFactura,

      data.accion,

      data.idAreaActor,

      data.areaActor,

      data.idAreaOrigen,

      data.areaOrigen,

      data.idAreaDestino,

      data.areaDestino,

      data.idEstadoAnterior,

      data.idEstadoNuevo,

      data.observacion,

      data.ip,

      data.userAgent,

      JSON.stringify(

        data.datos ??

        {},

      ),

    ],

  );

};



/* =========================================================

   FACTURAS DIRECTAS

========================================================= */



/* =========================================================

   FACTURAS ACTIVAS DEL AREA



   Esta es la bandeja operativa principal.



   Incluye:

   - Facturas directas de Outlook.

   - Facturas clasificadas por RECEPCION hacia CONTABILIDAD.



   Excluye:

   - RECHAZADAS.

   - PROCESADAS.

   - Facturas que realmente fueron REMITIDAS manualmente

     hacia el área actual.



   Excepcion historica:

   - La antigua remision automatica generada por RECEPCION

     hacia CONTABILIDAD NO se considera una remision

     operativa. Estas facturas deben estar en Facturas.

========================================================= */



export const getFacturasArea =

  async (

    idArea:

      number,

  ) => {

    const result =

      await query(

        `

          ${facturaSelect}



          WHERE

            f.id_area_actual =

              $1



            AND f.origen =

                'OUTLOOK'



            AND f.activo =

                TRUE



            /* Solo estados activos */

            AND ef.codigo IN

            (

              'PENDIENTE',

              'APROBADA'

            )



            /*

              Si existe una remision REAL hacia el área

              actual, pertenece al módulo Remitidos.



              Ignoramos específicamente la antigua remisión

              automática RECEPCION -> CONTABILIDAD.

            */

            AND NOT EXISTS

            (

              SELECT

                1



              FROM

                public.factura_eventos ev



              WHERE

                ev.id_factura =

                  f.id



                AND ev.accion =

                    'REMITIDA'



                AND ev.id_area_destino =

                    $1



                AND NOT

                (

                  COALESCE(

                    ev.datos ->> 'motivo',

                    ''

                  ) =

                    'PROVEEDOR_REGISTRADO_O_ASIGNADO'



                  AND



                  UPPER(

                    BTRIM(

                      COALESCE(

                        ev.area_destino_snapshot,

                        ''

                      )

                    )

                  ) =

                    'CONTABILIDAD'

                )

            )



          ORDER BY

            f.fecha_recepcion DESC

            NULLS LAST,



            f.id DESC

        `,

        [

          idArea,

        ],

      );



    return result.rows;

  };



/* =========================================================

   DETALLE

========================================================= */



export const getFacturaDetalle =

  async (

    idFactura:

      number,



    idArea:

      number,

  ) => {

    const result =

      await query(

        `

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

        `,

        [

          idFactura,

          idArea,

        ],

      );



    const factura =

      result.rows[0];



    if (!factura) {

      throw new FacturasError(

        "Factura no encontrada o sin acceso.",

        404,

      );

    }



    return factura;

  };



/* =========================================================

   REMITIDAS AL AREA ACTUAL

========================================================= */



/* =========================================================

   FACTURAS REMITIDAS AL AREA ACTUAL



   Solamente movimientos REALES entre áreas.



   NO incluye:

   - Clasificacion automatica RECEPCION -> CONTABILIDAD.

   - Facturas RECHAZADAS.

   - Facturas PROCESADAS.

========================================================= */



export const getFacturasRemitidas =

  async (

    idArea:

      number,

  ) => {

    const result =

      await query(

        `

          SELECT

            base.*,



            rem.area_origen_snapshot

              AS "remitidaDesde",



            rem.fecha_evento

              AS "fechaRemision"



          FROM

          (

            ${facturaSelect}

          ) base



          INNER JOIN LATERAL

          (

            SELECT

              ev.id_area_origen,



              ev.area_origen_snapshot,



              ev.id_area_destino,



              ev.area_destino_snapshot,



              ev.fecha_evento,



              ev.id



            FROM

              public.factura_eventos ev



            WHERE

              ev.id_factura =

                base.id



              AND ev.accion =

                  'REMITIDA'



              /*

                Ignoramos el movimiento automático histórico

                de RECEPCION hacia CONTABILIDAD.

              */

              AND NOT

              (

                COALESCE(

                  ev.datos ->> 'motivo',

                  ''

                ) =

                  'PROVEEDOR_REGISTRADO_O_ASIGNADO'



                AND



                UPPER(

                  BTRIM(

                    COALESCE(

                      ev.area_destino_snapshot,

                      ''

                    )

                  )

                ) =

                  'CONTABILIDAD'

              )



            ORDER BY

              ev.fecha_evento DESC,

              ev.id DESC



            LIMIT 1

          ) rem

            ON TRUE



          WHERE

            base."idAreaActual" =

              $1



            AND rem.id_area_destino =

                $1



            AND base.activo =

                TRUE



            /*

              Las finalizadas salen de esta bandeja.

            */

            AND base."estadoCodigo" IN

            (

              'PENDIENTE',

              'APROBADA'

            )



          ORDER BY

            rem.fecha_evento DESC,



            base.id DESC

        `,

        [

          idArea,

        ],

      );



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

export const getFacturasRechazadas =
  async (
    idArea:
      number,
  ) => {
    const result =
      await query(
        `
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
        `,
        [
          idArea,
        ],
      );

    return result.rows;
  };


/* =========================================================

   CATALOGO AREAS

========================================================= */



export const getAreasCatalogo =

  async (): Promise<

    AreaCatalogo[]

  > => {

    const result =

      await query<AreaRow>(

        `

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

        `,

      );



    return result.rows.map(

      (

        row,

      ) => ({

        id:

          Number(

            row.id,

          ),



        nombre:

          row.nombre,

      }),

    );

  };



/* =========================================================

   CATALOGO PROVEEDORES

========================================================= */



export const getProveedoresCatalogo =

  async (): Promise<

    ProveedorCatalogo[]

  > => {

    const result =

      await query(

        `

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

        `,

      );



    return result.rows.map(

      (

        row:

          any,

      ) => ({

        id:

          Number(

            row.id,

          ),



        nombre:

          String(

            row.nombre,

          ),



        nit:

          row.nit ??

          null,



        idArea:

          Number(

            row.idArea,

          ),



        area:

          String(

            row.area,

          ),



        correos:

          Array.isArray(

            row.correos,

          )

            ? row.correos

                .map(

                  String,

                )

            : [],

      }),

    );

  };



/* =========================================================

   ACTUALIZAR METADATOS EXTRAIDOS

========================================================= */



export const actualizarMetadatosFactura =

  async (

    idFactura:

      number,



    metadata:

      ExtractedInvoiceMetadata,

  ): Promise<void> => {

    await query(

      `

        UPDATE

          public.facturas



        SET

          tipo_documento =

            COALESCE

            (

              $1,

              tipo_documento

            ),



          numero_factura =

            COALESCE

            (

              $2,

              numero_factura

            ),



          nit_snapshot =

            COALESCE

            (

              nit_snapshot,

              $3

            ),



          valor_total =

            COALESCE

            (

              $4::numeric,

              valor_total

            ),



          moneda =

            COALESCE

            (

              $5,

              moneda

            )



        WHERE

          id = $6

      `,

      [

        metadata

          .tipoDocumento,

        metadata

          .numeroDocumento,

        metadata.nit,

        metadata

          .valorTotal,

        metadata.moneda,

        idFactura,

      ],

    );

  };



/* =========================================================

   APROBAR

========================================================= */



export const aprobarFactura =

  async (

    idFactura:

      number,



    idArea:

      number,



    observacion:

      string | null,



    ip:

      string | null,



    userAgent:

      string | null,

  ) => {

    await query(

      `

        SELECT

          public.fn_aprobar_factura

          (

            $1,

            $2,

            $3,

            $4::inet,

            $5

          )

      `,

      [

        idFactura,

        idArea,

        observacion,

        ip,

        userAgent,

      ],

    );

  };



/* =========================================================

   RECHAZAR

========================================================= */



export const rechazarFactura =

  async (

    idFactura:

      number,



    idArea:

      number,



    observacion:

      string | null,



    ip:

      string | null,



    userAgent:

      string | null,

  ) => {

    await query(

      `

        SELECT

          public.fn_rechazar_factura

          (

            $1,

            $2,

            $3,

            $4::inet,

            $5

          )

      `,

      [

        idFactura,

        idArea,

        observacion,

        ip,

        userAgent,

      ],

    );

  };



/* =========================================================

   REMITIR ENTRE AREAS

   Disponible para cualquier area como ORIGEN.
   CONTABILIDAD como DESTINO usa la ruta dedicada.

========================================================= */



export const remitirFactura =

  async (

    idFactura:

      number,



    idAreaActor:

      number,



    input:

      RemitirFacturaInput,



    ip:

      string | null,



    userAgent:

      string | null,

  ): Promise<void> => {

    if (

      !Number.isInteger(

        input.idAreaDestino,

      ) ||

      input.idAreaDestino <=

        0

    ) {

      throw new FacturasError(

        "El área destino no es válida.",

      );

    }



    /*

      CONTABILIDAD tiene una ruta dedicada porque solo una

      factura APROBADA puede enviarse allí. De esta forma

      nadie puede saltarse esa regla llamando manualmente

      al endpoint genérico.

    */



    const destinoResult =

      await query<AreaRow>(

        `

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

        `,

        [

          input.idAreaDestino,

        ],

      );



    const destino =

      destinoResult.rows[0];



    if (!destino) {

      throw new FacturasError(

        "El área destino no existe o está inactiva.",

        404,

      );

    }



    const destinoNormalizado =

      destino

        .nombre_normalizado ??

      normalizeAreaName(

        destino.nombre,

      );



    if (

      destinoNormalizado ===

      "CONTABILIDAD"

    ) {

      throw new FacturasError(

        "Para remitir una factura a CONTABILIDAD primero debes aprobarla y utilizar la opción 'Remitir a Contabilidad'.",

        400,

      );

    }



    await query(

      `

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

      `,

      [

        idFactura,

        idAreaActor,

        input

          .idAreaDestino,

        input

          .observacion,

        ip,

        userAgent,

      ],

    );

  };



/* =========================================================

   REMITIR A CONTABILIDAD



   Regla:

   - La factura debe pertenecer actualmente al área que ejecuta.

   - Debe estar APROBADA.

   - El destino se resuelve en backend y siempre es CONTABILIDAD.

   - Se conserva el estado APROBADA; la remisión es un movimiento.

========================================================= */



export const remitirFacturaContabilidad =

  async (

    idFactura:

      number,



    idAreaActor:

      number,



    observacion:

      string | null,



    ip:

      string | null,



    userAgent:

      string | null,

  ): Promise<void> => {

    const client =

      await pool.connect();



    try {

      await client.query(

        "BEGIN",

      );



      const factura =

        await getFacturaForUpdate(

          client,

          idFactura,

        );



      if (

        Number(

          factura

            .id_area_actual,

        ) !==

        idAreaActor

      ) {

        throw new FacturasError(

          "La factura ya no pertenece actualmente a tu área.",

          409,

        );

      }



      if (

        factura

          .estado_codigo !==

        "APROBADA"

      ) {

        throw new FacturasError(

          "Solo una factura APROBADA puede remitirse a CONTABILIDAD.",

          400,

        );

      }



      const contabilidadResult =

        await client.query<AreaRow>(

          `

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

          `,

        );



      const contabilidad =

        contabilidadResult.rows[0];



      if (!contabilidad) {

        throw new FacturasError(

          "No existe un área CONTABILIDAD activa.",

          404,

        );

      }



      const idContabilidad =

        Number(

          contabilidad.id,

        );



      if (

        idContabilidad ===

        idAreaActor

      ) {

        throw new FacturasError(

          "La factura ya se encuentra en CONTABILIDAD.",

          409,

        );

      }



      await client.query(

        `

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

        `,

        [

          idFactura,

          idAreaActor,

          idContabilidad,

          observacion,

          ip,

          userAgent,

        ],

      );



      await client.query(

        "COMMIT",

      );

    } catch (

      error

    ) {

      await client.query(

        "ROLLBACK",

      );



      throw error;

    } finally {

      client.release();

    }

  };



/* =========================================================

   RECLASIFICAR FACTURAS DE RECEPCION POR PROVEEDOR



   Regla de coincidencia:

   - La factura debe estar ACTUALMENTE en RECEPCIÓN.

   - El proveedor se toma del SEGUNDO campo del asunto:

       NIT;PROVEEDOR;NUMERO;TIPO;PROVEEDOR;

   - El nombre debe coincidir COMPLETAMENTE con proveedores.nombre.

   - Solo ignoramos mayúsculas/minúsculas y espacios en extremos.

   - NO se eliminan puntos, S.A.S, LTDA, etc.



   La factura seleccionada explícitamente también se incluye.

========================================================= */



const reclasificarFacturasRecepcionProveedor =

  async (

    client:

      PoolClient,



    idFacturaSeleccionada:

      number,



    idAreaRecepcion:

      number,



    actor:

      AreaRow,



    proveedor:

      ProveedorRow,



    creado:

      boolean,



    ip:

      string | null,



    userAgent:

      string | null,

  ): Promise<number> => {

    const proveedorNombre =

      cleanProviderName(

        proveedor.nombre,

      );



    /*

      Bloqueamos todas las facturas candidatas para que dos

      solicitudes concurrentes no reclasifiquen la misma factura.

    */



    const candidatas =

      await client.query<FacturaRecepcionProveedorRow>(

        `

          SELECT

            f.id,



            f.id_estado,



            ef.codigo

              AS estado_codigo,



            f.id_area_actual,



            aa.nombre

              AS area_actual,



            f.correo_origen



          FROM

            public.facturas f



          INNER JOIN

            public.estados_factura ef

              ON ef.id =

                 f.id_estado



          INNER JOIN

            public.areas aa

              ON aa.id =

                 f.id_area_actual



          WHERE

            f.activo =

              TRUE



            AND f.id_area_actual =

                $1



            AND

            (

              /*

                Siempre incluimos la factura desde la cual

                RECEPCIÓN está haciendo la asociación.

              */

              f.id =

                $2



              OR



              (

                /*

                  Para las demás facturas solo tomamos las que

                  todavía no tienen proveedor asignado.

                */

                f.id_proveedor

                  IS NULL



                AND UPPER(

                      BTRIM(

                        SPLIT_PART(

                          COALESCE(

                            f.asunto,

                            ''

                          ),

                          ';',

                          2

                        )

                      )

                    ) =

                    UPPER(

                      BTRIM($3)

                    )

              )

            )



          ORDER BY

            f.id ASC



          FOR UPDATE OF f

        `,

        [

          idAreaRecepcion,

          idFacturaSeleccionada,

          proveedorNombre,

        ],

      );



    let actualizadas =

      0;



    for (

      const facturaMatch

      of candidatas.rows

    ) {

      const idFactura =

        Number(

          facturaMatch.id,

        );



      /*

        Buscamos si el correo origen de ESA factura pertenece

        a los correos configurados del proveedor.

      */



      let idCorreoMatch:

        number |

        null =

          null;



      let correoSnapshot:

        string |

        null =

          proveedor

            .correo_principal ??

          facturaMatch

            .correo_origen ??

          null;



      if (

        facturaMatch

          .correo_origen

      ) {

        const correoResult =

          await client.query<CorreoProveedorMatchRow>(

            `

              SELECT

                pc.id,

                pc.correo



              FROM

                public.proveedor_correos pc



              WHERE

                pc.id_proveedor =

                  $1



                AND pc.activo =

                    TRUE



                AND LOWER(

                      BTRIM(

                        pc.correo

                      )

                    ) =

                    LOWER(

                      BTRIM($2)

                    )



              ORDER BY

                pc.es_principal DESC,

                pc.id ASC



              LIMIT 1

            `,

            [

              Number(

                proveedor.id,

              ),

              facturaMatch

                .correo_origen,

            ],

          );



        const correoMatch =

          correoResult.rows[0];



        if (

          correoMatch

        ) {

          idCorreoMatch =

            Number(

              correoMatch.id,

            );



          correoSnapshot =

            correoMatch.correo;

        }

      }



      /*

        Actualizamos:

        - proveedor;

        - snapshots;

        - área actual.



        id_area_origen NO se toca para conservar la trazabilidad:

        la factura realmente ingresó por RECEPCIÓN.

      */



      await client.query(

        `

          UPDATE

            public.facturas



          SET

            id_proveedor =

              $1,



            id_proveedor_correo =

              $2,



            proveedor_snapshot =

              $3,



            nit_snapshot =

              COALESCE(

                $4,

                nit_snapshot

              ),



            correo_proveedor_snapshot =

              $5,



            id_area_actual =

              $6,



            fecha_actualizacion =

              NOW()



          WHERE

            id =

              $7

        `,

        [

          Number(

            proveedor.id,

          ),



          idCorreoMatch,



          proveedor.nombre,



          proveedor.nit,



          correoSnapshot,



          Number(

            proveedor.id_area,

          ),



          idFactura,

        ],

      );



      /*

        1. Auditoría de asociación de proveedor.

      */



      await insertEvento(

        client,

        {

          idFactura,



          accion:

            "PROVEEDOR_ASIGNADO",



          idAreaActor:

            idAreaRecepcion,



          areaActor:

            actor.nombre,



          idAreaOrigen:

            Number(

              facturaMatch

                .id_area_actual,

            ),



          areaOrigen:

            facturaMatch

              .area_actual,



          idAreaDestino:

            Number(

              proveedor

                .id_area,

            ),



          areaDestino:

            proveedor

              .area,



          idEstadoAnterior:

            Number(

              facturaMatch

                .id_estado,

            ),



          idEstadoNuevo:

            Number(

              facturaMatch

                .id_estado,

            ),



          observacion:

            creado

              ? "Proveedor registrado desde RECEPCIÓN y factura asociada automáticamente."

              : "Factura asociada automáticamente al proveedor existente desde RECEPCIÓN.",



          ip,



          userAgent,



          datos: {

            id_proveedor:

              Number(

                proveedor.id,

              ),



            proveedor:

              proveedor.nombre,



            proveedor_creado:

              creado,



            coincidencia:

              idFactura ===

              idFacturaSeleccionada

                ? "SELECCION_EXPLICITA"

                : "NOMBRE_EXACTO_SEGUNDO_CAMPO_ASUNTO",



            id_area_proveedor:

              Number(

                proveedor

                  .id_area,

              ),



            area_proveedor:

              proveedor

                .area,

          },

        },

      );



      /*

        IMPORTANTE:



        Mover una factura desde RECEPCIÓN hacia el área

        responsable del proveedor NO es una remisión.



        PROVEEDOR_ASIGNADO ya conserva:

        - RECEPCIÓN como área origen del evento;

        - el área responsable como destino;

        - la trazabilidad completa.



        Por eso NO insertamos un evento REMITIDA aquí.

        La factura debe aparecer en el panel FACTURAS del área

        destino, no en REMITIDOS.

      */



      actualizadas +=

        1;

    }



    return actualizadas;

  };



/* =========================================================

   ASIGNAR / REGISTRAR PROVEEDOR DESDE RECEPCION

========================================================= */



export const asignarProveedorFactura =

  async (

    idFactura:

      number,



    idAreaActor:

      number,



    input:

      AsignarProveedorFacturaInput,



    ip:

      string | null,



    userAgent:

      string | null,

  ) => {

    const tieneExistente =

      Number.isInteger(

        input.idProveedor,

      ) &&

      Number(

        input.idProveedor,

      ) >

        0;



    const tieneNuevo =

      Boolean(

        input

          .nuevoProveedor,

      );



    if (

      Number(

        tieneExistente,

      ) +

        Number(

          tieneNuevo,

        ) !==

      1

    ) {

      throw new FacturasError(

        "Debes seleccionar un proveedor existente o registrar uno nuevo.",

      );

    }



    const client =

      await pool.connect();



    try {

      await client.query(

        "BEGIN",

      );



      const factura =

        await getFacturaForUpdate(

          client,

          idFactura,

        );



      if (

        Number(

          factura

            .id_area_actual,

        ) !==

        idAreaActor

      ) {

        throw new FacturasError(

          "La factura ya no pertenece actualmente a tu área.",

          409,

        );

      }



      const actor =

        await getAreaById(

          client,

          idAreaActor,

        );



      const actorNormalized =

        actor

          .nombre_normalizado ??

        normalizeAreaName(

          actor.nombre,

        );



      if (

        actorNormalized !==

        "RECEPCION"

      ) {

        throw new FacturasError(

          "Solo RECEPCIÓN puede registrar o asociar un proveedor desde una factura.",

          403,

        );

      }



      let proveedor:

        ProveedorRow;



      let creado =

        false;



      if (

        tieneExistente

      ) {

        proveedor =

          await getProveedorById(

            client,

            Number(

              input.idProveedor,

            ),

            factura

              .correo_origen,

          );

      } else {

        const nuevo =

          input

            .nuevoProveedor!;



        const nombre =

          cleanProviderName(

            nuevo.nombre,

          );



        if (!nombre) {

          throw new FacturasError(

            "El nombre del proveedor es obligatorio.",

          );

        }



        if (

          !Number.isInteger(

            nuevo.idArea,

          ) ||

          nuevo.idArea <=

            0

        ) {

          throw new FacturasError(

            "Debes seleccionar el área responsable del proveedor.",

          );

        }



        const areaProveedor =

          await getAreaById(

            client,

            nuevo.idArea,

          );



        const nit =

          cleanNit(

            nuevo.nit,

          );



        const emails =

          normalizeEmails(

            nuevo

              .correos,

          );



        const insert =

          await client.query<{

            id:

              number | string;

          }>(

            `

              INSERT INTO

                public.proveedores

              (

                nombre,

                nit,

                id_area,

                activo

              )



              VALUES

              (

                $1,

                $2,

                $3,

                TRUE

              )



              RETURNING

                id

            `,

            [

              nombre,

              nit,

              nuevo.idArea,

            ],

          );



        const idProveedor =

          Number(

            insert.rows[0]

              ?.id,

          );



        if (

          !Number.isInteger(

            idProveedor,

          )

        ) {

          throw new Error(

            "PostgreSQL no devolvió el proveedor creado.",

          );

        }



        let idCorreoMatch:

          number |

          null =

            null;



        let correoPrincipal:

          string |

          null =

            null;



        for (

          let index = 0;

          index <

          emails.length;

          index += 1

        ) {

          const correo =

            emails[index]!;



          const correoInsert =

            await client.query<{

              id:

                number | string;

            }>(

              `

                INSERT INTO

                  public.proveedor_correos

                (

                  id_proveedor,

                  correo,

                  es_principal,

                  activo

                )



                VALUES

                (

                  $1,

                  $2,

                  $3,

                  TRUE

                )



                RETURNING

                  id

              `,

              [

                idProveedor,

                correo,

                index === 0,

              ],

            );



          const idCorreo =

            Number(

              correoInsert

                .rows[0]

                ?.id,

            );



          if (

            index === 0

          ) {

            correoPrincipal =

              correo;

          }



          if (

            factura

              .correo_origen &&

            correo ===

              factura

                .correo_origen

                .trim()

                .toLowerCase()

          ) {

            idCorreoMatch =

              idCorreo;

          }

        }



        proveedor = {

          id:

            idProveedor,



          nombre,



          nit,



          id_area:

            nuevo.idArea,



          area:

            areaProveedor.nombre,



          id_correo_match:

            idCorreoMatch,



          correo_principal:

            correoPrincipal,

        };



        creado =

          true;

      }



      const facturasActualizadas =

        await reclasificarFacturasRecepcionProveedor(

          client,

          idFactura,

          idAreaActor,

          actor,

          proveedor,

          creado,

          ip,

          userAgent,

        );



      await client.query(

        "COMMIT",

      );



      return {

        idProveedor:

          Number(

            proveedor.id,

          ),



        proveedor:

          proveedor

            .nombre,



        nit:

          proveedor.nit,



        idArea:

          Number(

            proveedor

              .id_area,

          ),



        area:

          proveedor

            .area,



        creado,



        facturasActualizadas,

      };

    } catch (

      error

    ) {

      await client.query(

        "ROLLBACK",

      );



      if (

        error instanceof

        FacturasError

      ) {

        throw error;

      }



      const pgError =

        error as {

          code?:

            string;



          constraint?:

            string;

        };



      if (

        pgError.code ===

        "23505"

      ) {

        throw new FacturasError(

          "Ya existe un proveedor con ese NIT, nombre o correo. Usa la opción de asociar proveedor existente.",

          409,

        );

      }



      throw error;

    } finally {

      client.release();

    }

  };



/* =========================================================

   REACTIVAR FACTURA RECHAZADA

   Exclusivo de SISTEMAS por ruta y nuevamente validado
   dentro de PostgreSQL.

========================================================= */

export const reactivarFactura =
  async (
    idFactura:
      number,

    idArea:
      number,

    observacion:
      string | null,

    ip:
      string | null,

    userAgent:
      string | null,
  ) => {
    await query(
      `
        SELECT
          public.fn_reactivar_factura
          (
            $1::bigint,
            $2::bigint,
            $3::text,
            $4::inet,
            $5::text
          )
      `,
      [
        idFactura,
        idArea,
        observacion,
        ip,
        userAgent,
      ],
    );
  };


/* =========================================================

   PROCESAR

========================================================= */



export const procesarFactura =

  async (

    idFactura:

      number,



    idArea:

      number,



    observacion:

      string | null,



    ip:

      string | null,



    userAgent:

      string | null,

  ) => {

    await query(

      `

        SELECT

          public.fn_procesar_factura

          (

            $1,

            $2,

            $3,

            $4::inet,

            $5

          )

      `,

      [

        idFactura,

        idArea,

        observacion,

        ip,

        userAgent,

      ],

    );

  };



/* =========================================================

   HISTORIAL COMPLETO



   Primero validamos acceso a la factura.

========================================================= */



export const getHistorialFactura =

  async (

    idFactura:

      number,



    idArea:

      number,

  ) => {

    await getFacturaDetalle(

      idFactura,

      idArea,

    );



    const result =

      await query(

        `

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

        `,

        [

          idFactura,

        ],

      );



    return result.rows;

  };
