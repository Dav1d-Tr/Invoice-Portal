import type {
  PoolClient,
  QueryResultRow,
} from "pg";

import pool, {
  query,
} from "../config/database";

import {
  env,
} from "../config/env";

import {
  extractInvoiceMetadata,
} from "./invoiceMetadataService";

import type {
  ExtractedInvoiceMetadata,
} from "./invoiceMetadataService";

import type {
  GraphAttachment,
  GraphAttachmentsResponse,
  GraphMessage,
  GraphMessagesResponse,
  OutlookAttachmentDetail,
  OutlookAttachmentDownload,
  OutlookDocumentLink,
  OutlookMessageDetail,
} from "../types/outlook.types";

/* =========================================================
   MICROSOFT TOKEN
========================================================= */

interface MicrosoftTokenResponse {
  access_token?:
    string;

  error?:
    string;

  error_description?:
    string;
}

interface GraphErrorResponse {
  error?: {
    code?:
      string;

    message?:
      string;
  };
}

/* =========================================================
   PROVEEDORES
========================================================= */

interface ProveedorConfigRow
  extends QueryResultRow {
  id_proveedor:
    number | string;

  proveedor:
    string;

  nit:
    string | null;

  id_area:
    number | string;

  area:
    string;

  id_correo:
    number | string | null;

  correo:
    string | null;
}

interface ProveedorCorreo {
  id:
    number;

  correo:
    string;
}

interface ProveedorConfig {
  idProveedor:
    number;

  proveedor:
    string;

  nit:
    string | null;

  idArea:
    number;

  area:
    string;

  correos:
    ProveedorCorreo[];
}

interface AreaRecepcionRow
  extends QueryResultRow {
  id:
    number | string;

  nombre:
    string;
}

interface IdRow
  extends QueryResultRow {
  id:
    number | string;
}

interface LatestInvoiceDateRow
  extends QueryResultRow {
  ultima_fecha:
    string |
    Date |
    null;
}

interface ExistingDocumentRow
  extends QueryResultRow {
  id:
    number | string;

  asunto:
    string | null;

  numero_factura:
    string | null;

  proveedor_snapshot:
    string | null;

  nit_snapshot:
    string | null;
}


interface FacturaRecepcionReclasificarRow
  extends QueryResultRow {
  id:
    number | string;

  id_estado:
    number | string;

  estado_codigo:
    string;

  correo_origen:
    string | null;
}

interface CountRow
  extends QueryResultRow {
  total:
    number | string;
}

/* =========================================================
   RESULTADOS
========================================================= */

export interface OutlookMailboxSyncResult {
  mensajesRevisados:
    number;

  candidatosFactura:
    number;

  facturasCreadas:
    number;

  reconocidas:
    number;

  enviadasRecepcion:
    number;

  duplicadas:
    number;

  errores:
    number;

  desde:
    string;
}

export interface OutlookSyncResult {
  proveedorId:
    number;

  proveedor:
    string;

  area:
    string;

  nit:
    string | null;

  correosConfigurados:
    number;

  mensajesRevisados:
    number;

  coincidencias:
    number;

  coincidenciasPorNombre:
    number;

  coincidenciasPorCorreo:
    number;

  facturasCreadas:
    number;

  duplicadas:
    number;

  enviadasRecepcion:
    number;

  facturasReclasificadas:
    number;
}

/* =========================================================
   CONFIG
========================================================= */

const validateConfig =
  (): void => {
    const missing:
      string[] = [];

    if (
      !env.outlook
        .tenantId
    ) {
      missing.push(
        "OUTLOOK_TENANT_ID",
      );
    }

    if (
      !env.outlook
        .clientId
    ) {
      missing.push(
        "OUTLOOK_CLIENT_ID",
      );
    }

    if (
      !env.outlook
        .clientSecret
    ) {
      missing.push(
        "OUTLOOK_CLIENT_SECRET",
      );
    }

    if (
      !env.outlook
        .mailbox
    ) {
      missing.push(
        "OUTLOOK_MAILBOX",
      );
    }

    if (
      missing.length >
      0
    ) {
      throw new Error(
        `Falta configurar Outlook: ${missing.join(", ")}`,
      );
    }
  };

/* =========================================================
   FECHA MINIMA CONFIGURADA
========================================================= */

const OUTLOOK_MIN_START_DATE =
  new Date(
    "2026-09-01T00:00:00-05:00",
  );

const getConfiguredStartDate =
  (): Date => {
    /*
      Regla de negocio SGAF:
      nunca consultar Outlook antes del
      1 de septiembre de 2026, 00:00 Colombia.
    */

    if (
      env.outlook
        .syncFromDate
    ) {
      const configuredDate =
        new Date(
          env.outlook
            .syncFromDate,
        );

      if (
        Number.isNaN(
          configuredDate.getTime(),
        )
      ) {
        throw new Error(
          "OUTLOOK_SYNC_FROM_DATE no es válida.",
        );
      }

      /*
        Si por error configuran una fecha anterior,
        conservamos el mínimo oficial.
      */

      return configuredDate >
        OUTLOOK_MIN_START_DATE
        ? configuredDate
        : OUTLOOK_MIN_START_DATE;
    }

    return OUTLOOK_MIN_START_DATE;
  };

/* =========================================================
   FECHA PARA SINCRONIZACION RECIENTE

   - FULL = fecha configurada.
   - BACKGROUND = últimos 7 días como mínimo.
   - Si ya hay facturas, vuelve 2 días desde la última fecha
     para tolerar retrasos, movimientos y cambios de carpeta.
========================================================= */

const getSyncStartDate =
  async (
    full:
      boolean,
  ): Promise<
    string
  > => {
    const configured =
      getConfiguredStartDate();

    if (full) {
      return configured
        .toISOString();
    }

    const now =
      new Date();

    const sevenDaysAgo =
      new Date(
        now.getTime() -
        7 *
        24 *
        60 *
        60 *
        1000,
      );

    let recentStart =
      sevenDaysAgo;

    const latest =
      await query<LatestInvoiceDateRow>(
        `
          SELECT
            MAX(
              fecha_recepcion
            )
              AS ultima_fecha

          FROM
            public.facturas

          WHERE
            origen =
              'OUTLOOK'
        `,
      );

    const latestValue =
      latest.rows[0]
        ?.ultima_fecha;

    if (
      latestValue
    ) {
      const latestDate =
        new Date(
          latestValue,
        );

      if (
        !Number.isNaN(
          latestDate.getTime(),
        )
      ) {
        const twoDaysBeforeLatest =
          new Date(
            latestDate
              .getTime() -
            2 *
            24 *
            60 *
            60 *
            1000,
          );

        if (
          twoDaysBeforeLatest >
          recentStart
        ) {
          recentStart =
            twoDaysBeforeLatest;
        }
      }
    }

    /*
      Nunca sincronizamos antes de la fecha configurada.
    */

    const start =
      recentStart >
      configured
        ? recentStart
        : configured;

    return start
      .toISOString();
  };

/* =========================================================
   TOKEN
========================================================= */

const getAccessToken =
  async (): Promise<
    string
  > => {
    validateConfig();

    const body =
      new URLSearchParams();

    body.set(
      "client_id",
      env.outlook
        .clientId,
    );

    body.set(
      "client_secret",
      env.outlook
        .clientSecret,
    );

    body.set(
      "scope",
      "https://graph.microsoft.com/.default",
    );

    body.set(
      "grant_type",
      "client_credentials",
    );

    const response =
      await fetch(
        `https://login.microsoftonline.com/${encodeURIComponent(
          env.outlook
            .tenantId,
        )}/oauth2/v2.0/token`,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",
          },

          body,
        },
      );

    const result =
      (
        await response
          .json()
      ) as
        MicrosoftTokenResponse;

    if (
      !response.ok ||
      !result
        .access_token
    ) {
      throw new Error(
        result
          .error_description ??
        "No fue posible autenticar SGAF contra Microsoft.",
      );
    }

    return result
      .access_token;
  };

/* =========================================================
   NORMALIZAR TEXTO
========================================================= */

const normalizeText = (
  value:
    string,
): string => {
  return value
    .normalize(
      "NFD",
    )
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .replace(
      /[^A-Za-z0-9@._\-\s]/g,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim()
    .toUpperCase();
};

const normalizeProviderName = (
  value:
    string,
): string => {
  return normalizeText(
    value,
  )
    .replace(
      /\bS\s*A\s*S\b/g,
      " ",
    )
    .replace(
      /\bSAS\b/g,
      " ",
    )
    .replace(
      /\bS\s*A\b/g,
      " ",
    )
    .replace(
      /\bLTDA\b/g,
      " ",
    )
    .replace(
      /\bLIMITADA\b/g,
      " ",
    )
    .replace(
      /\bBIC\b/g,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
};

const decodeHtmlEntities = (
  value:
    string,
): string => {
  return value
    .replace(
      /&nbsp;/gi,
      " ",
    )
    .replace(
      /&amp;/gi,
      "&",
    )
    .replace(
      /&lt;/gi,
      "<",
    )
    .replace(
      /&gt;/gi,
      ">",
    )
    .replace(
      /&quot;/gi,
      '"',
    )
    .replace(
      /&#39;/gi,
      "'",
    );
};

const htmlToText = (
  html:
    string,
): string => {
  return decodeHtmlEntities(
    html
      .replace(
        /<style[\s\S]*?<\/style>/gi,
        " ",
      )
      .replace(
        /<script[\s\S]*?<\/script>/gi,
        " ",
      )
      .replace(
        /<br\s*\/?>/gi,
        "\n",
      )
      .replace(
        /<\/p>/gi,
        "\n",
      )
      .replace(
        /<\/div>/gi,
        "\n",
      )
      .replace(
        /<\/tr>/gi,
        "\n",
      )
      .replace(
        /<\/td>/gi,
        " ",
      )
      .replace(
        /<[^>]+>/g,
        " ",
      ),
  )
    .replace(
      /\r/g,
      "",
    )
    .replace(
      /[ \t]+/g,
      " ",
    )
    .replace(
      /\n\s+/g,
      "\n",
    )
    .replace(
      /\n{3,}/g,
      "\n\n",
    )
    .trim();
};

const escapeRegExp = (
  value:
    string,
): string => {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
};

const escapeODataString = (
  value:
    string,
): string => {
  return value.replace(
    /'/g,
    "''",
  );
};

/* =========================================================
   PROVEEDORES
========================================================= */

const getAllProveedorConfigs =
  async (): Promise<
    ProveedorConfig[]
  > => {
    const result =
      await query<ProveedorConfigRow>(
        `
          SELECT
            p.id
              AS id_proveedor,

            p.nombre
              AS proveedor,

            p.nit,

            p.id_area,

            a.nombre
              AS area,

            pc.id
              AS id_correo,

            CASE
              WHEN pc.id IS NULL
                THEN NULL

              ELSE LOWER(
                BTRIM(
                  pc.correo
                )
              )
            END
              AS correo

          FROM
            public.proveedores p

          INNER JOIN
            public.areas a
              ON a.id =
                 p.id_area

          LEFT JOIN
            public.proveedor_correos pc
              ON pc.id_proveedor =
                 p.id

              AND pc.activo =
                  TRUE

          WHERE
            p.activo =
              TRUE

            AND a.activo =
                TRUE

          ORDER BY
            p.id ASC,

            pc.es_principal DESC,

            pc.id ASC
        `,
      );

    const map =
      new Map<
        number,
        ProveedorConfig
      >();

    for (
      const row
      of result.rows
    ) {
      const id =
        Number(
          row
            .id_proveedor,
        );

      let proveedor =
        map.get(
          id,
        );

      if (!proveedor) {
        proveedor = {
          idProveedor:
            id,

          proveedor:
            row.proveedor,

          nit:
            row.nit,

          idArea:
            Number(
              row.id_area,
            ),

          area:
            row.area,

          correos:
            [],
        };

        map.set(
          id,
          proveedor,
        );
      }

      if (
        row.id_correo !==
          null &&
        row.correo
      ) {
        proveedor
          .correos
          .push({
            id:
              Number(
                row.id_correo,
              ),

            correo:
              row.correo,
          });
      }
    }

    return Array.from(
      map.values(),
    );
  };

const getProveedorConfig =
  async (
    idProveedor:
      number,
  ): Promise<
    ProveedorConfig
  > => {
    const proveedores =
      await getAllProveedorConfigs();

    const proveedor =
      proveedores.find(
        (
          item,
        ) =>
          item.idProveedor ===
          idProveedor,
      );

    if (!proveedor) {
      throw new Error(
        "Proveedor no encontrado o inactivo.",
      );
    }

    return proveedor;
  };

const getRecepcionArea =
  async (): Promise<{
    id:
      number;

    nombre:
      string;
  }> => {
    const result =
      await query<AreaRecepcionRow>(
        `
          SELECT
            id,
            nombre

          FROM
            public.areas

          WHERE
            activo =
              TRUE

            AND
            (
              nombre_normalizado =
                'RECEPCION'

              OR

              UPPER(
                BTRIM(nombre)
              )
                IN
                (
                  'RECEPCION',
                  'RECEPCIÓN'
                )
            )

          ORDER BY
            id ASC

          LIMIT 1
        `,
      );

    const area =
      result.rows[0];

    if (!area) {
      throw new Error(
        "No existe el área activa RECEPCIÓN. Créala desde Administración de usuarios para recibir facturas de proveedores no identificados.",
      );
    }

    return {
      id:
        Number(
          area.id,
        ),

      nombre:
        area.nombre,
    };
  };

/* =========================================================
   MENSAJE
========================================================= */

const mailboxPath =
  (): string => {
    return encodeURIComponent(
      env.outlook
        .mailbox,
    );
  };

const getSenderEmail = (
  message:
    GraphMessage,
): string => {
  return (
    message.from
      ?.emailAddress
      ?.address ??

    message.sender
      ?.emailAddress
      ?.address ??

    ""
  )
    .trim()
    .toLowerCase();
};

const getSenderName = (
  message:
    GraphMessage,
): string => {
  return (
    message.from
      ?.emailAddress
      ?.name ??

    message.sender
      ?.emailAddress
      ?.name ??

    ""
  )
    .trim();
};

const getSearchText = (
  message:
    GraphMessage,

  extraText =
    "",
): string => {
  return normalizeText(
    [
      getSenderName(
        message,
      ),

      getSenderEmail(
        message,
      ),

      message.subject ??
        "",

      message.bodyPreview ??
        "",

      extraText,
    ].join(
      " ",
    ),
  );
};

/* =========================================================
   CANDIDATO A FACTURA / NOTA CREDITO
========================================================= */

const isInvoiceMessage = (
  message:
    GraphMessage,

  attachmentNames:
    string[] = [],

  extraText =
    "",
): boolean => {
  /*
    Todos los correos con la estructura corporativa
    NIT;PROVEEDOR;DOCUMENTO;TIPO;PROVEEDOR;
    se inspeccionan como candidatos a factura.
  */

  if (
    parseStructuredInvoiceSubject(
      message.subject,
    )
  ) {
    return true;
  }

  const text =
    normalizeText(
      [
        message.subject ??
          "",

        message.bodyPreview ??
          "",

        extraText,

        attachmentNames.join(
          " ",
        ),
      ].join(
        " ",
      ),
    );

  const keywords = [
    "FACTURA",
    "FACTURACION",
    "FACTURA ELECTRONICA",
    "NOTA CREDITO",
    "NOTA DE CREDITO",
    "CREDIT NOTE",
    "INVOICE",
    "CUFE",
    "CUDE",
    "DOCUMENTO ELECTRONICO",
    "DIAN",
  ];

  if (
    keywords.some(
      (
        keyword,
      ) =>
        text.includes(
          keyword,
        ),
    )
  ) {
    return true;
  }

  if (
    !message
      .hasAttachments
  ) {
    return false;
  }

  /*
    En la primera pasada todavía no conocemos el nombre
    de los adjuntos. Si Graph dice que hay adjuntos,
    inspeccionamos el correo una sola vez.
  */

  if (
    attachmentNames.length ===
    0
  ) {
    return true;
  }

  return attachmentNames.some(
    (
      name,
    ) =>
      /\.(pdf|xml|zip)$/i.test(
        name,
      ),
  );
};

/* =========================================================
   ASUNTO ESTRUCTURADO DEL DOCUMENTO

   Formato esperado:

   NIT;PROVEEDOR;NUMERO_DOCUMENTO;TIPO;PROVEEDOR;

   Ejemplo:

   830044858;PC COM S.A.S;ME85561;01;PC COM S.A.S;

   REGLA PRINCIPAL:
   El proveedor para asignación automática es ÚNICAMENTE
   el texto que está entre el primer y el segundo ";".

   Es decir:
   parts[1] = nombre del proveedor.
========================================================= */

interface StructuredInvoiceSubject {
  nit:
    string;

  proveedor:
    string;

  numeroDocumento:
    string;

  codigoDocumento:
    string;

  proveedorRepetido:
    string;
}

const normalizeProviderNameExact = (
  value:
    string,
): string => {
  /*
    Comparación estricta:
    - ignora mayúsculas/minúsculas;
    - ignora espacios repetidos al inicio/interior/final;
    - NO elimina puntos;
    - NO elimina S.A.S, LTDA, S.A., etc.;
    - NO elimina tildes;
    - NO busca palabras parciales.

    Por tanto:

    "PC COM S.A.S" == "pc com s.a.s"
    "PC COM S.A.S" != "PC COM SAS"
  */

  return value
    .trim()
    .replace(
      /\s+/g,
      " ",
    )
    .toUpperCase();
};

const normalizeDocumentNumber = (
  value:
    string |
    null |
    undefined,
): string => {
  return (
    value ??
    ""
  )
    .trim()
    .replace(
      /\s+/g,
      "",
    )
    .toUpperCase();
};

const normalizeNitKey = (
  value:
    string |
    null |
    undefined,
): string => {
  return (
    value ??
    ""
  )
    .replace(
      /\D/g,
      "",
    )
    .trim();
};

const parseStructuredInvoiceSubject = (
  subject:
    string |
    null |
    undefined,
): StructuredInvoiceSubject | null => {
  const clean =
    subject
      ?.trim() ??
    "";

  if (!clean) {
    return null;
  }

  const parts =
    clean
      .split(
        ";",
      )
      .map(
        (
          item,
        ) =>
          item.trim(),
      );

  /*
    Necesitamos como mínimo:

    parts[0] = NIT
    parts[1] = PROVEEDOR
    parts[2] = NUMERO DOCUMENTO

    El cuarto y quinto campo se conservan,
    pero NO son necesarios para identificar proveedor.
  */

  const nit =
    parts[0] ??
    "";

  const proveedor =
    parts[1] ??
    "";

  const numeroDocumento =
    parts[2] ??
    "";

  const codigoDocumento =
    parts[3] ??
    "";

  const proveedorRepetido =
    parts[4] ??
    "";

  if (
    !proveedor ||
    !numeroDocumento
  ) {
    return null;
  }

  return {
    nit,
    proveedor,
    numeroDocumento,
    codigoDocumento,
    proveedorRepetido,
  };
};

const getDetectedProviderName = (
  message:
    GraphMessage,
): string | null => {
  /*
    NO usamos:
    - cuerpo del correo;
    - XML;
    - NIT para elegir proveedor;
    - correo remitente;
    - proveedorSugerido;
    - coincidencias parciales.

    Únicamente parts[1] del asunto.
  */

  return (
    parseStructuredInvoiceSubject(
      message.subject,
    )
      ?.proveedor ??
    null
  );
};

const findProviderMatch = (
  message:
    GraphMessage,

  proveedores:
    ProveedorConfig[],
): {
  proveedor:
    ProveedorConfig;

  idCorreo:
    number | null;

  tipo:
    "NOMBRE_ASUNTO_EXACTO";
} | null => {
  const detectedName =
    getDetectedProviderName(
      message,
    );

  if (!detectedName) {
    return null;
  }

  const normalizedDetected =
    normalizeProviderNameExact(
      detectedName,
    );

  if (!normalizedDetected) {
    return null;
  }

  /*
    La coincidencia debe ser TOTAL contra proveedores.nombre.
  */

  const exactMatches =
    proveedores.filter(
      (
        proveedor,
      ) =>
        normalizeProviderNameExact(
          proveedor.proveedor,
        ) ===
        normalizedDetected,
    );

  /*
    0 coincidencias -> RECEPCIÓN.
    Más de 1 coincidencia -> RECEPCIÓN por ambigüedad.
  */

  if (
    exactMatches.length !==
    1
  ) {
    return null;
  }

  const proveedor =
    exactMatches[0]!;

  /*
    El correo remitente NO identifica proveedor.
    Solo guardamos idCorreo si ya pertenece al proveedor
    que fue identificado por nombre exacto.
  */

  const sender =
    getSenderEmail(
      message,
    );

  const correo =
    proveedor.correos.find(
      (
        item,
      ) =>
        item.correo ===
        sender,
    );

  return {
    proveedor,

    idCorreo:
      correo?.id ??
      null,

    tipo:
      "NOMBRE_ASUNTO_EXACTO",
  };
};

/* =========================================================
   GRAPH MESSAGE
========================================================= */

const getMessageById =
  async (
    token:
      string,

    messageId:
      string,
  ): Promise<
    GraphMessage | null
  > => {
    const url =
      new URL(
        `https://graph.microsoft.com/v1.0/users/${mailboxPath()}/messages/${encodeURIComponent(
          messageId,
        )}`,
      );

    url.searchParams.set(
      "$select",
      [
        "id",
        "subject",
        "from",
        "sender",
        "toRecipients",
        "ccRecipients",
        "receivedDateTime",
        "sentDateTime",
        "hasAttachments",
        "body",
        "bodyPreview",
        "webLink",
        "internetMessageId",
      ].join(
        ",",
      ),
    );

    const response =
      await fetch(
        url.toString(),
        {
          method:
            "GET",

          headers: {
            Authorization:
              `Bearer ${token}`,

            Accept:
              "application/json",

            Prefer:
              'IdType="ImmutableId", outlook.body-content-type="html"',
          },
        },
      );

    if (
      response.status ===
      404
    ) {
      return null;
    }

    const result =
      (
        await response
          .json()
      ) as
        GraphMessage &
        GraphErrorResponse;

    if (
      !response.ok
    ) {
      throw new Error(
        result.error
          ?.message ??
        "No fue posible obtener el mensaje de Outlook.",
      );
    }

    return result;
  };

const findMessageIdByInternetMessageId =
  async (
    token:
      string,

    internetMessageId:
      string |
      null |
      undefined,
  ): Promise<
    string | null
  > => {
    const clean =
      internetMessageId
        ?.trim();

    if (!clean) {
      return null;
    }

    const url =
      new URL(
        `https://graph.microsoft.com/v1.0/users/${mailboxPath()}/messages`,
      );

    url.searchParams.set(
      "$select",
      "id,internetMessageId",
    );

    url.searchParams.set(
      "$filter",
      `internetMessageId eq '${escapeODataString(
        clean,
      )}'`,
    );

    url.searchParams.set(
      "$top",
      "1",
    );

    const response =
      await fetch(
        url.toString(),
        {
          method:
            "GET",

          headers: {
            Authorization:
              `Bearer ${token}`,

            Accept:
              "application/json",

            Prefer:
              'IdType="ImmutableId"',
          },
        },
      );

    const result =
      (
        await response
          .json()
      ) as
        GraphMessagesResponse;

    if (
      !response.ok
    ) {
      return null;
    }

    return result
      .value?.[0]
      ?.id ??
      null;
  };

const resolveMessage =
  async (
    token:
      string,

    messageId:
      string,

    internetMessageId?:
      string |
      null,
  ): Promise<
    GraphMessage
  > => {
    const direct =
      await getMessageById(
        token,
        messageId,
      );

    if (direct) {
      return direct;
    }

    const recoveredId =
      await findMessageIdByInternetMessageId(
        token,
        internetMessageId,
      );

    if (
      recoveredId
    ) {
      const recovered =
        await getMessageById(
          token,
          recoveredId,
        );

      if (
        recovered
      ) {
        return recovered;
      }
    }

    throw new Error(
      "El correo ya no está disponible en el buzón de Outlook.",
    );
  };

/* =========================================================
   ADJUNTOS
========================================================= */

const getMessageAttachments =
  async (
    token:
      string,

    messageId:
      string,
  ): Promise<
    GraphAttachment[]
  > => {
    const first =
      new URL(
        `https://graph.microsoft.com/v1.0/users/${mailboxPath()}/messages/${encodeURIComponent(
          messageId,
        )}/attachments`,
      );

    /*
      IMPORTANTE:

      contentId NO se solicita aquí porque este endpoint
      devuelve microsoft.graph.attachment como tipo base.

      contentId pertenece específicamente a fileAttachment
      y Microsoft Graph falla si intentamos seleccionarlo
      desde la colección general.
    */

    first.searchParams.set(
      "$select",
      [
        "id",
        "name",
        "contentType",
        "size",
        "isInline",
        "lastModifiedDateTime",
      ].join(
        ",",
      ),
    );

    first.searchParams.set(
      "$top",
      "100",
    );

    let nextUrl:
      string | undefined =
        first.toString();

    const attachments:
      GraphAttachment[] = [];

    while (
      nextUrl
    ) {
      const response =
        await fetch(
          nextUrl,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,

              Accept:
                "application/json",

              Prefer:
                'IdType="ImmutableId"',
            },
          },
        );

      const result =
        (
          await response.json()
        ) as
          GraphAttachmentsResponse;

      if (
        !response.ok
      ) {
        throw new Error(
          result.error
            ?.message ??
          "No fue posible consultar los adjuntos de Outlook.",
        );
      }

      attachments.push(
        ...(
          result.value ??
          []
        ),
      );

      nextUrl =
        result[
          "@odata.nextLink"
        ];
    }

    return attachments;
  };

const getAttachmentBuffer =
  async (
    token:
      string,

    messageId:
      string,

    attachmentId:
      string,
  ): Promise<
    Buffer
  > => {
    const url =
      `https://graph.microsoft.com/v1.0/users/${mailboxPath()}` +
      `/messages/${encodeURIComponent(
        messageId,
      )}` +
      `/attachments/${encodeURIComponent(
        attachmentId,
      )}/$value`;

    const response =
      await fetch(
        url,
        {
          headers: {
            Authorization:
              `Bearer ${token}`,

            Prefer:
              'IdType="ImmutableId"',
          },
        },
      );

    if (
      !response.ok
    ) {
      let message =
        "No fue posible descargar el adjunto de Outlook.";

      try {
        const result =
          (
            await response
              .json()
          ) as
            GraphErrorResponse;

        message =
          result.error
            ?.message ??
          message;
      } catch {
        // $value puede devolver binario o vacío.
      }

      throw new Error(
        message,
      );
    }

    const arrayBuffer =
      await response
        .arrayBuffer();

    return Buffer.from(
      arrayBuffer,
    );
  };

const resolveInlineImages =
  async (
    token:
      string,

    messageId:
      string,

    bodyHtml:
      string,

    attachments:
      GraphAttachment[],
  ): Promise<
    string
  > => {
    let html =
      bodyHtml;

    const inlineImages =
      attachments.filter(
        (
          attachment,
        ) =>
          Boolean(
            attachment
              .isInline,
          ) &&
          Boolean(
            attachment
              .contentId,
          ) &&
          (
            attachment
              ["@odata.type"] ??
            ""
          ).includes(
            "fileAttachment",
          ),
      );

    for (
      const attachment
      of inlineImages
    ) {
      try {
        const buffer =
          await getAttachmentBuffer(
            token,
            messageId,
            attachment.id,
          );

        const mime =
          attachment
            .contentType ??
          "application/octet-stream";

        const dataUrl =
          `data:${mime};base64,${buffer.toString(
            "base64",
          )}`;

        const contentId =
          attachment
            .contentId!
            .replace(
              /^<|>$/g,
              "",
            );

        html =
          html.replace(
            new RegExp(
              `cid:${escapeRegExp(
                contentId,
              )}`,
              "gi",
            ),
            dataUrl,
          );
      } catch (
        error
      ) {
        console.warn(
          "No fue posible resolver una imagen inline:",
          attachment.name,
          error,
        );
      }
    }

    return html;
  };

/* =========================================================
   LINKS DEL DOCUMENTO EN EL HTML

   Esto permite mostrar "Ver factura" cuando el proveedor no
   adjunta PDF y solo envía un enlace (por ejemplo SIIGO).
========================================================= */

const extractDocumentLinks = (
  html:
    string,
): OutlookDocumentLink[] => {
  const result:
    OutlookDocumentLink[] =
      [];

  const seen =
    new Set<string>();

  const expression =
    /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match:
    RegExpExecArray |
    null;

  while (
    (
      match =
        expression.exec(
          html,
        )
    ) !==
    null
  ) {
    const href =
      decodeHtmlEntities(
        match[1] ??
        "",
      )
        .trim();

    if (
      !/^https?:\/\//i.test(
        href,
      )
    ) {
      continue;
    }

    let valid =
      false;

    try {
      const parsed =
        new URL(
          href,
        );

      valid =
        parsed.protocol ===
          "https:" ||
        parsed.protocol ===
          "http:";
    } catch {
      valid =
        false;
    }

    if (!valid) {
      continue;
    }

    const label =
      htmlToText(
        match[2] ??
        "",
      )
        .trim();

    const searchable =
      normalizeText(
        `${label} ${href}`,
      );

    const looksDocumentRelated =
      [
        "FACTURA",
        "DOCUMENTO",
        "DESCARG",
        "VER FACTURA",
        "INVOICE",
        "PDF",
        "SIIGO",
      ].some(
        (
          keyword,
        ) =>
          searchable.includes(
            keyword,
          ),
      );

    if (
      !looksDocumentRelated ||
      seen.has(
        href,
      )
    ) {
      continue;
    }

    seen.add(
      href,
    );

    result.push({
      url:
        href,

      label:
        label ||
        "Abrir documento",
    });

    if (
      result.length >=
      10
    ) {
      break;
    }
  }

  return result;
};

/* =========================================================
   DETALLE INTERNO
========================================================= */

const getMessageDetailWithToken =
  async (
    token:
      string,

    messageId:
      string,

    internetMessageId?:
      string |
      null,
  ): Promise<
    OutlookMessageDetail
  > => {
    const message =
      await resolveMessage(
        token,
        messageId,
        internetMessageId,
      );

    let attachments:
      GraphAttachment[] =
        [];

    try {
      attachments =
        await getMessageAttachments(
          token,
          message.id,
        );
    } catch (
      error
    ) {
      console.warn(
        "No fue posible consultar los adjuntos:",
        error,
      );
    }

    const contentType =
      message.body
        ?.contentType
        ?.toLowerCase();

    const originalContent =
      message.body
        ?.content ??
      "";

    const originalHtml =
      contentType ===
        "html"
        ? originalContent
        : "";

    const bodyHtml =
      originalHtml
        ? await resolveInlineImages(
            token,
            message.id,
            originalHtml,
            attachments,
          )
        : "";

    const bodyText =
      originalHtml
        ? htmlToText(
            originalHtml,
          )
        : originalContent ||
          message.bodyPreview ||
          "";

    const visibleAttachments:
      OutlookAttachmentDetail[] =
        attachments
          .filter(
            (
              attachment,
            ) =>
              !attachment
                .isInline,
          )
          .map(
            (
              attachment,
            ) => ({
              id:
                attachment.id,

              name:
                attachment.name ??
                "Adjunto",

              contentType:
                attachment
                  .contentType ??
                "application/octet-stream",

              size:
                Number(
                  attachment
                    .size ??
                  0,
                ),

              isInline:
                Boolean(
                  attachment
                    .isInline,
                ),

              contentId:
                attachment
                  .contentId ??
                null,

              type:
                attachment[
                  "@odata.type"
                ] ??
                "",
            }),
          );

    const mapRecipient =
      (
        value:
          GraphMessage[
            "toRecipients"
          ],
      ): string[] => {
        return (
          value ??
          []
        )
          .map(
            (
              recipient,
            ) =>
              recipient
                .emailAddress
                ?.address ??
              "",
          )
          .filter(
            Boolean,
          );
      };

    return {
      id:
        message.id,

      subject:
        message.subject ??
        "",

      fromName:
        message.from
          ?.emailAddress
          ?.name ??
        message.sender
          ?.emailAddress
          ?.name ??
        "",

      fromEmail:
        getSenderEmail(
          message,
        ),

      to:
        mapRecipient(
          message.toRecipients,
        ),

      cc:
        mapRecipient(
          message.ccRecipients,
        ),

      receivedDateTime:
        message
          .receivedDateTime ??
        null,

      sentDateTime:
        message
          .sentDateTime ??
        null,

      bodyHtml,

      bodyText,

      bodyPreview:
        message
          .bodyPreview ??
        "",

      hasAttachments:
        visibleAttachments
          .length >
          0 ||
        Boolean(
          message
            .hasAttachments,
        ),

      attachments:
        visibleAttachments,

      documentLinks:
        extractDocumentLinks(
          originalHtml,
        ),

      webLink:
        message
          .webLink ??
        null,

      internetMessageId:
        message
          .internetMessageId ??
        null,
    };
  };

/* =========================================================
   XML PARA METADATOS
========================================================= */

const getXmlContentsForMetadata =
  async (
    token:
      string,

    messageId:
      string,

    attachments:
      OutlookAttachmentDetail[],
  ): Promise<
    string[]
  > => {
    const xmls:
      string[] = [];

    const candidates =
      attachments.filter(
        (
          attachment,
        ) =>
          (
            /\.xml$/i.test(
              attachment.name,
            ) ||
            attachment
              .contentType
              .toLowerCase()
              .includes(
                "xml",
              )
          ) &&
          attachment.size <=
            3_000_000,
      );

    for (
      const attachment
      of candidates
    ) {
      try {
        const buffer =
          await getAttachmentBuffer(
            token,
            messageId,
            attachment.id,
          );

        xmls.push(
          buffer.toString(
            "utf8",
          ),
        );
      } catch (
        error
      ) {
        console.warn(
          "No fue posible leer un XML para extracción de metadatos:",
          attachment.name,
          error,
        );
      }
    }

    return xmls;
  };

const extractMetadataForDetail =
  async (
    token:
      string,

    detail:
      OutlookMessageDetail,
  ): Promise<
    ExtractedInvoiceMetadata
  > => {
    const xmlContents =
      await getXmlContentsForMetadata(
        token,
        detail.id,
        detail.attachments,
      );

    return extractInvoiceMetadata({
      subject:
        detail.subject,

      bodyText:
        detail.bodyText,

      bodyHtml:
        detail.bodyHtml,

      xmlContents,

      attachmentNames:
        detail.attachments
          .map(
            (
              attachment,
            ) =>
              attachment.name,
          ),
    });
  };

/* =========================================================
   DUPLICADO
========================================================= */

const messageAlreadyRegistered =
  async (
    message:
      GraphMessage,
  ): Promise<
    boolean
  > => {
    const result =
      await query<IdRow>(
        `
          SELECT
            id

          FROM
            public.facturas

          WHERE
            outlook_message_id =
              $1

            OR
            (
              $2::text
                IS NOT NULL

              AND internet_message_id =
                  $2
            )

          LIMIT 1
        `,
        [
          message.id,

          message
            .internetMessageId ??
          null,
        ],
      );

    return Boolean(
      result.rows[0],
    );
  };


/* =========================================================
   DUPLICADO LOGICO DE FACTURA / NOTA CREDITO

   Los IDs de Outlook evitan insertar dos veces el MISMO correo.

   Este control adicional evita insertar el MISMO documento
   cuando llega en dos correos diferentes.

   Para asuntos estructurados la clave lógica es:

   NIT + PROVEEDOR DEL SEGUNDO CAMPO + NUMERO DOCUMENTO

   Ejemplo:

   830044858;PC COM S.A.S;ME85561;01;PC COM S.A.S;

   Si vuelve a llegar ese mismo documento con otro MessageId,
   NO se crea una nueva factura.
========================================================= */

const documentAlreadyRegistered =
  async (
    message:
      GraphMessage,

    metadata:
      ExtractedInvoiceMetadata,

    client?:
      PoolClient,
  ): Promise<
    boolean
  > => {
    const parsed =
      parseStructuredInvoiceSubject(
        message.subject,
      );

    const documentNumber =
      normalizeDocumentNumber(
        parsed
          ?.numeroDocumento ??
        metadata
          .numeroDocumento,
      );

    if (!documentNumber) {
      return false;
    }

    /*
      Traemos candidatos por número de documento:
      - numero_factura guardado;
      - o tercer campo del asunto original.

      Esto permite detectar duplicados incluso si una factura
      histórica quedó asociada al proveedor equivocado.
    */

    const sql =
      `
        SELECT
          id,
          asunto,
          numero_factura,
          proveedor_snapshot,
          nit_snapshot

        FROM
          public.facturas

        WHERE
          activo =
            TRUE

          AND origen =
            'OUTLOOK'

          AND
          (
            UPPER(
              REGEXP_REPLACE(
                BTRIM(
                  COALESCE(
                    numero_factura,
                    ''
                  )
                ),
                '\\s+',
                '',
                'g'
              )
            ) =
              $1

            OR

            UPPER(
              REGEXP_REPLACE(
                BTRIM(
                  SPLIT_PART(
                    COALESCE(
                      asunto,
                      ''
                    ),
                    ';',
                    3
                  )
                ),
                '\\s+',
                '',
                'g'
              )
            ) =
              $1
          )

        ORDER BY
          id ASC

        LIMIT
          100
      `;

    const params =
      [
        documentNumber,
      ];

    const result =
      client
        ? await client.query<
            ExistingDocumentRow
          >(
            sql,
            params,
          )
        : await query<
            ExistingDocumentRow
          >(
            sql,
            params,
          );

    if (
      result.rows.length ===
      0
    ) {
      return false;
    }

    /*
      Si el asunto actual tiene estructura conocida,
      esa misma estructura es la fuente principal.
    */

    if (parsed) {
      const currentNit =
        normalizeNitKey(
          parsed.nit,
        );

      const currentProvider =
        normalizeProviderNameExact(
          parsed.proveedor,
        );

      const currentDocument =
        normalizeDocumentNumber(
          parsed.numeroDocumento,
        );

      return result.rows.some(
        (
          row,
        ) => {
          const existingSubject =
            parseStructuredInvoiceSubject(
              row.asunto,
            );

          /*
            Caso ideal:
            ambos registros tienen asunto estructurado.
          */

          if (
            existingSubject
          ) {
            const sameDocument =
              normalizeDocumentNumber(
                existingSubject
                  .numeroDocumento,
              ) ===
              currentDocument;

            const sameProvider =
              normalizeProviderNameExact(
                existingSubject
                  .proveedor,
              ) ===
              currentProvider;

            const existingNit =
              normalizeNitKey(
                existingSubject.nit,
              );

            const sameNit =
              !currentNit ||
              !existingNit ||
              existingNit ===
                currentNit;

            return (
              sameDocument &&
              sameProvider &&
              sameNit
            );
          }

          /*
            Compatibilidad con registros antiguos sin asunto
            estructurado. Se exige el mismo número y el mismo
            proveedor_snapshot completo.
          */

          const sameDocument =
            normalizeDocumentNumber(
              row.numero_factura,
            ) ===
            currentDocument;

          const sameProvider =
            normalizeProviderNameExact(
              row.proveedor_snapshot ??
              "",
            ) ===
            currentProvider;

          const existingNit =
            normalizeNitKey(
              row.nit_snapshot,
            );

          const sameNit =
            !currentNit ||
            !existingNit ||
            existingNit ===
              currentNit;

          return (
            sameDocument &&
            sameProvider &&
            sameNit
          );
        },
      );
    }

    /*
      Si por excepción el asunto no es estructurado,
      hacemos un control conservador con los metadatos.
      Esto NO se usa para asignar proveedor.
    */

    const metadataProvider =
      normalizeProviderNameExact(
        metadata
          .proveedorSugerido ??
        "",
      );

    const metadataNit =
      normalizeNitKey(
        metadata.nit,
      );

    if (!metadataProvider) {
      return false;
    }

    return result.rows.some(
      (
        row,
      ) => {
        const sameDocument =
          normalizeDocumentNumber(
            row.numero_factura,
          ) ===
          documentNumber;

        const sameProvider =
          normalizeProviderNameExact(
            row.proveedor_snapshot ??
            "",
          ) ===
          metadataProvider;

        const existingNit =
          normalizeNitKey(
            row.nit_snapshot,
          );

        const sameNit =
          !metadataNit ||
          !existingNit ||
          existingNit ===
            metadataNit;

        return (
          sameDocument &&
          sameProvider &&
          sameNit
        );
      },
    );
  };

const getLogicalDocumentLockKey = (
  message:
    GraphMessage,

  metadata:
    ExtractedInvoiceMetadata,
): string | null => {
  const parsed =
    parseStructuredInvoiceSubject(
      message.subject,
    );

  if (parsed) {
    return [
      normalizeNitKey(
        parsed.nit,
      ),

      normalizeProviderNameExact(
        parsed.proveedor,
      ),

      normalizeDocumentNumber(
        parsed.numeroDocumento,
      ),
    ].join(
      "|",
    );
  }

  const documentNumber =
    normalizeDocumentNumber(
      metadata
        .numeroDocumento,
    );

  const provider =
    normalizeProviderNameExact(
      metadata
        .proveedorSugerido ??
      "",
    );

  if (
    !documentNumber ||
    !provider
  ) {
    return null;
  }

  return [
    normalizeNitKey(
      metadata.nit,
    ),

    provider,

    documentNumber,
  ].join(
    "|",
  );
};

/* =========================================================
   REGISTRAR FACTURA NUEVA
========================================================= */

const registerInvoiceMessage =
  async (
    message:
      GraphMessage,

    detail:
      OutlookMessageDetail,

    match: ReturnType<
      typeof findProviderMatch
    >,

    recepcion: {
      id:
        number;

      nombre:
        string;
    },

    metadata:
      ExtractedInvoiceMetadata,
  ): Promise<{
    created:
      boolean;

    recepcion:
      boolean;
  }> => {
    const client =
      await pool.connect();

    try {
      await client.query(
        "BEGIN",
      );

      /*
        Bloqueo transaccional por documento lógico.

        Evita que dos sincronizaciones concurrentes intenten
        insertar la misma factura al mismo tiempo aunque hayan
        llegado en mensajes Outlook distintos.
      */

      const logicalLockKey =
        getLogicalDocumentLockKey(
          message,
          metadata,
        );

      if (
        logicalLockKey
      ) {
        await client.query(
          `
            SELECT
              pg_advisory_xact_lock(
                hashtext($1)
              )
          `,
          [
            logicalLockKey,
          ],
        );
      }

      const duplicate =
        await client.query<IdRow>(
          `
            SELECT
              id

            FROM
              public.facturas

            WHERE
              outlook_message_id =
                $1

              OR
              (
                $2::text
                  IS NOT NULL

                AND internet_message_id =
                    $2
              )

            LIMIT 1

            FOR UPDATE
          `,
          [
            message.id,

            message
              .internetMessageId ??
            null,
          ],
        );

      if (
        duplicate.rows[0]
      ) {
        await client.query(
          "ROLLBACK",
        );

        return {
          created:
            false,

          recepcion:
            !match,
        };
      }

      /*
        Segunda barrera anti-duplicado dentro de la misma
        transacción, protegida por advisory lock.
      */

      if (
        await documentAlreadyRegistered(
          message,
          metadata,
          client,
        )
      ) {
        await client.query(
          "ROLLBACK",
        );

        return {
          created:
            false,

          recepcion:
            !match,
        };
      }

      const state =
        await client.query<IdRow>(
          `
            SELECT
              id

            FROM
              public.estados_factura

            WHERE
              codigo =
                'PENDIENTE'

            LIMIT 1
          `,
        );

      const idEstado =
        Number(
          state.rows[0]
            ?.id,
        );

      if (
        !Number.isInteger(
          idEstado,
        )
      ) {
        throw new Error(
          "No existe el estado PENDIENTE.",
        );
      }

      const idProveedor =
        match
          ?.proveedor
          .idProveedor ??
        null;

      const idProveedorCorreo =
        match
          ?.idCorreo ??
        null;

      const idArea =
        match
          ?.proveedor
          .idArea ??
        recepcion.id;

      const area =
        match
          ?.proveedor
          .area ??
        recepcion.nombre;

      const senderEmail =
        detail.fromEmail ||
        getSenderEmail(
          message,
        );

      const senderName =
        detail.fromName ||
        getSenderName(
          message,
        );

      const structuredSubject =
        parseStructuredInvoiceSubject(
          detail.subject ||
          message.subject,
        );

      const subjectProvider =
        structuredSubject
          ?.proveedor ??
        null;

      const subjectNit =
        structuredSubject
          ?.nit ??
        null;

      const subjectDocumentNumber =
        structuredSubject
          ?.numeroDocumento ??
        null;

      const proveedorSnapshot =
        match
          ?.proveedor
          .proveedor ??
        subjectProvider ??
        metadata
          .proveedorSugerido ??
        (
          senderName ||
          senderEmail ||
          "PROVEEDOR PENDIENTE"
        );

      const nit =
        match
          ?.proveedor
          .nit ??
        subjectNit ??
        metadata.nit ??
        null;

      const numeroDocumento =
        subjectDocumentNumber ??
        metadata
          .numeroDocumento ??
        null;

      const insert =
        await client.query<IdRow>(
          `
            INSERT INTO
              public.facturas
            (
              id_proveedor,
              id_proveedor_correo,
              id_area_origen,
              id_area_actual,
              id_estado,
              proveedor_snapshot,
              nit_snapshot,
              correo_proveedor_snapshot,
              tipo_documento,
              numero_factura,
              valor_total,
              moneda,
              origen,
              outlook_message_id,
              internet_message_id,
              asunto,
              correo_origen,
              fecha_recepcion,
              tiene_adjuntos,
              web_link,
              body_preview
            )

            VALUES
            (
              $1,
              $2,
              $3,
              $3,
              $4,
              $5,
              $6,
              $7,
              $8,
              $9,
              $10,
              $11,
              'OUTLOOK',
              $12,
              $13,
              $14,
              $15,
              $16,
              $17,
              $18,
              $19
            )

            ON CONFLICT
              DO NOTHING

            RETURNING
              id
          `,
          [
            idProveedor,

            idProveedorCorreo,

            idArea,

            idEstado,

            proveedorSnapshot,

            nit,

            senderEmail ||
              null,

            metadata
              .tipoDocumento,

            numeroDocumento,

            metadata
              .valorTotal,

            metadata
              .moneda,

            message.id,

            message
              .internetMessageId ??
            detail
              .internetMessageId ??
            null,

            detail.subject ||
              message.subject ||
              null,

            senderEmail ||
              null,

            detail
              .receivedDateTime ??
            message
              .receivedDateTime ??
            null,

            detail
              .attachments
              .length >
              0 ||
            Boolean(
              message
                .hasAttachments,
            ),

            detail
              .webLink ??
            message
              .webLink ??
            null,

            detail
              .bodyPreview ||
            message
              .bodyPreview ||
            null,
          ],
        );

      const idFactura =
        Number(
          insert.rows[0]
            ?.id,
        );

      if (
        !Number.isInteger(
          idFactura,
        )
      ) {
        await client.query(
          "ROLLBACK",
        );

        return {
          created:
            false,

          recepcion:
            !match,
        };
      }

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
            datos
          )

          VALUES
          (
            $1,
            'RECIBIDA_OUTLOOK',
            NULL,
            'SISTEMA',
            NULL,
            NULL,
            $2,
            $3,
            NULL,
            $4,
            $5,
            $6::jsonb
          )
        `,
        [
          idFactura,

          idArea,

          area,

          idEstado,

          match
            ? "Factura identificada automáticamente desde Outlook."
            : "Factura sin proveedor identificado enviada automáticamente a RECEPCIÓN.",

          JSON.stringify({
            metodo_identificacion:
              match
                ?.tipo ??
              "RECEPCION",

            id_proveedor:
              idProveedor,

            correo_origen:
              senderEmail ||
              null,

            tipo_documento:
              metadata
                .tipoDocumento,

            numero_documento:
              numeroDocumento,

            proveedor_asunto:
              subjectProvider,

            nit_asunto:
              subjectNit,

            valor_total:
              metadata
                .valorTotal,

            moneda:
              metadata
                .moneda,

            outlook_message_id:
              message.id,

            internet_message_id:
              message
                .internetMessageId ??
              null,
          }),
        ],
      );

      await client.query(
        "COMMIT",
      );

      return {
        created:
          true,

        recepcion:
          !match,
      };
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
   SINCRONIZACION GLOBAL
========================================================= */

let currentSync:
  Promise<
    OutlookMailboxSyncResult
  > |
  null =
    null;

const runMailboxSync =
  async (
    full:
      boolean,
  ): Promise<
    OutlookMailboxSyncResult
  > => {
    validateConfig();

    const [
      token,
      proveedores,
      startDate,
    ] =
      await Promise.all([
        getAccessToken(),
        getAllProveedorConfigs(),
        getSyncStartDate(
          full,
        ),
      ]);

    let recepcionCache:
      {
        id:
          number;

        nombre:
          string;
      } |
      null =
        null;

    const graphUrl =
      new URL(
        `https://graph.microsoft.com/v1.0/users/${mailboxPath()}/messages`,
      );

    graphUrl
      .searchParams
      .set(
        "$select",
        [
          "id",
          "subject",
          "from",
          "sender",
          "receivedDateTime",
          "hasAttachments",
          "bodyPreview",
          "webLink",
          "internetMessageId",
        ].join(
          ",",
        ),
      );

    graphUrl
      .searchParams
      .set(
        "$filter",
        `receivedDateTime ge ${startDate}`,
      );

    graphUrl
      .searchParams
      .set(
        "$orderby",
        "receivedDateTime desc",
      );

    graphUrl
      .searchParams
      .set(
        "$top",
        "100",
      );

    let nextUrl:
      string |
      undefined =
        graphUrl.toString();

    let mensajesRevisados =
      0;

    let candidatosFactura =
      0;

    let facturasCreadas =
      0;

    let reconocidas =
      0;

    let enviadasRecepcion =
      0;

    let duplicadas =
      0;

    let errores =
      0;

    while (
      nextUrl
    ) {
      const response =
        await fetch(
          nextUrl,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,

              Accept:
                "application/json",

              Prefer:
                'IdType="ImmutableId"',
            },
          },
        );

      const result =
        (
          await response
            .json()
        ) as
          GraphMessagesResponse;

      if (
        !response.ok
      ) {
        throw new Error(
          result.error
            ?.message ??
          "No fue posible consultar Outlook.",
        );
      }

      const messages =
        result.value ??
        [];

      mensajesRevisados +=
        messages.length;

      for (
        const message
        of messages
      ) {
        try {
          if (
            await messageAlreadyRegistered(
              message,
            )
          ) {
            duplicadas +=
              1;

            continue;
          }

          if (
            !isInvoiceMessage(
              message,
            )
          ) {
            continue;
          }

          const detail =
            await getMessageDetailWithToken(
              token,
              message.id,
              message
                .internetMessageId ??
              null,
            );

          const attachmentNames =
            detail
              .attachments
              .map(
                (
                  attachment,
                ) =>
                  attachment.name,
              );

          if (
            !isInvoiceMessage(
              message,
              attachmentNames,
              detail
                .bodyText,
            )
          ) {
            continue;
          }

          candidatosFactura +=
            1;

          const metadata =
            await extractMetadataForDetail(
              token,
              detail,
            );

          /*
            Evitamos duplicar la misma factura/nota crédito
            aunque haya llegado en OTRO correo con IDs distintos.
          */

          if (
            await documentAlreadyRegistered(
              message,
              metadata,
            )
          ) {
            duplicadas +=
              1;

            continue;
          }

          const match =
            findProviderMatch(
              message,
              proveedores,
            );

          /*
            RECEPCIÓN solo se resuelve si realmente encontramos
            una factura sin proveedor. Así los proveedores ya
            configurados siguen sincronizando aunque el área
            RECEPCIÓN todavía no haya sido creada durante la
            instalación.
          */

          const recepcion: {
            id:
              number;

            nombre:
              string;
          } =
            match
              ? {
                  id:
                    match
                      .proveedor
                      .idArea,

                  nombre:
                    match
                      .proveedor
                      .area,
                }
              : (
                  recepcionCache ??
                  await getRecepcionArea()
                );

          if (!match) {
            recepcionCache =
              recepcion;
          }

          const registered =
            await registerInvoiceMessage(
              message,
              detail,
              match,
              recepcion,
              metadata,
            );

          if (
            !registered
              .created
          ) {
            duplicadas +=
              1;

            continue;
          }

          facturasCreadas +=
            1;

          if (
            registered
              .recepcion
          ) {
            enviadasRecepcion +=
              1;
          } else {
            reconocidas +=
              1;
          }
        } catch (
          error
        ) {
          errores +=
            1;

          console.error(
            "Error procesando mensaje Outlook:",
            message.id,
            error,
          );
        }
      }

      nextUrl =
        result[
          "@odata.nextLink"
        ];
    }

    const syncResult: OutlookMailboxSyncResult =
      {
        mensajesRevisados,

        candidatosFactura,

        facturasCreadas,

        reconocidas,

        enviadasRecepcion,

        duplicadas,

        errores,

        desde:
          startDate,
      };

    console.log(
      "Sincronización global Outlook:",
      syncResult,
    );

    return syncResult;
  };

export const sincronizarBuzonOutlook =
  async (
    full =
      false,
  ): Promise<
    OutlookMailboxSyncResult
  > => {
    if (
      currentSync
    ) {
      return currentSync;
    }

    currentSync =
      runMailboxSync(
        full,
      );

    try {
      return await currentSync;
    } finally {
      currentSync =
        null;
    }
  };

/* =========================================================
   CONTAR FACTURAS EXISTENTES DEL PROVEEDOR

   La identificación usa EXCLUSIVAMENTE el segundo campo
   del asunto separado por ";".

   Ejemplo:
   830044858;PC COM S.A.S;ME85561;01;PC COM S.A.S;
             ^^^^^^^^^^^
========================================================= */

const countExistingProviderInvoices =
  async (
    proveedor:
      ProveedorConfig,
  ): Promise<number> => {
    const result =
      await query<CountRow>(
        `
          SELECT
            COUNT(*) AS total

          FROM
            public.facturas f

          WHERE
            f.activo =
              TRUE

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
                  BTRIM($1)
                )
        `,
        [
          proveedor.proveedor,
        ],
      );

    return Number(
      result.rows[0]
        ?.total ??
      0,
    );
  };

/* =========================================================
   RECLASIFICAR FACTURAS YA EXISTENTES EN RECEPCIÓN

   Cuando un proveedor se registra o se sincroniza desde
   Configuración, SGAF debe revisar primero las facturas que
   YA existen en PostgreSQL y que todavía están en RECEPCIÓN.

   Solo se reclasifican si:

   1. id_area_actual = RECEPCIÓN
   2. id_proveedor IS NULL
   3. El SEGUNDO campo del asunto coincide COMPLETAMENTE con
      proveedores.nombre.

   NO se crea una factura nueva.
   Se actualiza la fila existente y se conserva id_area_origen.
========================================================= */

const reclasificarFacturasRecepcionProveedor =
  async (
    proveedor:
      ProveedorConfig,
  ): Promise<number> => {
    const recepcion =
      await getRecepcionArea();

    const client =
      await pool.connect();

    try {
      await client.query(
        "BEGIN",
      );

      /*
        Bloqueamos las facturas candidatas para impedir que dos
        sincronizaciones concurrentes reclasifiquen la misma fila.
      */

      const candidatas =
        await client.query<FacturaRecepcionReclasificarRow>(
          `
            SELECT
              f.id,

              f.id_estado,

              ef.codigo
                AS estado_codigo,

              f.correo_origen

            FROM
              public.facturas f

            INNER JOIN
              public.estados_factura ef
                ON ef.id =
                   f.id_estado

            WHERE
              f.activo =
                TRUE

              AND f.id_area_actual =
                  $1

              AND f.id_proveedor
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
                    BTRIM($2)
                  )

            ORDER BY
              f.id ASC

            FOR UPDATE OF f
          `,
          [
            recepcion.id,
            proveedor.proveedor,
          ],
        );

      let actualizadas =
        0;

      for (
        const factura
        of candidatas.rows
      ) {
        const idFactura =
          Number(
            factura.id,
          );

        const correoOrigen =
          factura
            .correo_origen
            ?.trim()
            .toLowerCase() ??
          "";

        /*
          El correo NO decide qué proveedor es.
          Solo intentamos guardar id_proveedor_correo si el correo
          de la factura coincide con uno configurado para el proveedor.
        */

        const correoMatch =
          proveedor
            .correos
            .find(
              (
                correo,
              ) =>
                correo.correo
                  .trim()
                  .toLowerCase() ===
                correoOrigen,
            );

        const correoPrincipal =
          proveedor
            .correos[0]
            ?.correo ??
          null;

        const correoSnapshot =
          correoMatch
            ?.correo ??
          correoPrincipal ??
          factura
            .correo_origen ??
          null;

        /*
          IMPORTANTE:
          id_area_origen NO cambia.
          Si la factura entró originalmente por RECEPCIÓN,
          debe conservar ese origen en la trazabilidad.
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
            proveedor.idProveedor,

            correoMatch
              ?.id ??
            null,

            proveedor.proveedor,

            proveedor.nit,

            correoSnapshot,

            proveedor.idArea,

            idFactura,
          ],
        );

        /*
          Evento 1:
          dejamos constancia de que el proveedor fue reconocido.
        */

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
              datos
            )

            VALUES
            (
              $1,
              'PROVEEDOR_ASIGNADO',
              NULL,
              'SISTEMA',
              $2,
              $3,
              $4,
              $5,
              $6,
              $6,
              $7,
              $8::jsonb
            )
          `,
          [
            idFactura,

            recepcion.id,

            recepcion.nombre,

            proveedor.idArea,

            proveedor.area,

            Number(
              factura.id_estado,
            ),

            "Proveedor reconocido automáticamente al sincronizar su configuración.",

            JSON.stringify({
              automatico:
                true,

              motivo:
                "RECLASIFICACION_DESDE_RECEPCION",

              coincidencia:
                "NOMBRE_EXACTO_SEGUNDO_CAMPO_ASUNTO",

              id_proveedor:
                proveedor.idProveedor,

              proveedor:
                proveedor.proveedor,

              estado_conservado:
                factura.estado_codigo,
            }),
          ],
        );

        /*
          IMPORTANTE:

          La clasificación automática desde RECEPCIÓN hacia el
          área responsable NO es una remisión entre áreas.

          El evento PROVEEDOR_ASIGNADO anterior ya registra
          RECEPCIÓN -> área responsable para efectos de historial.

          No insertamos REMITIDA, de modo que esta factura llegará
          al panel FACTURAS del área destino.
        */

        actualizadas +=
          1;
      }

      await client.query(
        "COMMIT",
      );

      if (
        actualizadas >
        0
      ) {
        console.log(
          `Proveedor "${proveedor.proveedor}": ${actualizadas} factura(s) clasificada(s) desde RECEPCIÓN hacia ${proveedor.area}.`,
        );
      }

      return actualizadas;
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
   COMPATIBILIDAD POR PROVEEDOR

   Cuando se registra/edita un proveedor desde Configuración,
   hacemos una sincronización completa. Así el proveedor nuevo
   puede reclamar mensajes históricos que aún no estaban en SGAF.
========================================================= */

export const sincronizarProveedorOutlook =
  async (
    idProveedor:
      number,
  ): Promise<
    OutlookSyncResult
  > => {
    const proveedor =
      await getProveedorConfig(
        idProveedor,
      );

    /*
      Cantidad de facturas de este proveedor que YA existían
      antes de la sincronización.

      Esto evita mostrar en el frontend las 456 duplicadas
      de TODO el buzón como si pertenecieran al proveedor
      que acabamos de sincronizar.
    */

    const existentesAntes =
      await countExistingProviderInvoices(
        proveedor,
      );

    /*
      PRIMERO:
      reclamamos las facturas ya guardadas en RECEPCIÓN.

      Estas no deben volver a insertarse: se actualizan.
    */

    const facturasReclasificadas =
      await reclasificarFacturasRecepcionProveedor(
        proveedor,
      );

    /*
      DESPUÉS:
      recorremos Outlook desde la fecha configurada para capturar
      correos históricos que todavía no estén registrados.

      El flujo normal de Outlook ya evita duplicados por:
      - outlook_message_id;
      - internet_message_id;
      - documento lógico.
    */

    const result =
      await sincronizarBuzonOutlook(
        true,
      );

    /*
      Volvemos a contar SOLO las facturas cuyo segundo campo del
      asunto coincide exactamente con este proveedor.

      Así calculamos cuántas realmente fueron nuevas para él,
      sin mezclar los demás proveedores del buzón.
    */

    const existentesDespues =
      await countExistingProviderInvoices(
        proveedor,
      );

    const facturasNuevasProveedor =
      Math.max(
        0,
        existentesDespues -
        existentesAntes,
      );

    return {
      proveedorId:
        proveedor
          .idProveedor,

      proveedor:
        proveedor
          .proveedor,

      area:
        proveedor.area,

      nit:
        proveedor.nit,

      correosConfigurados:
        proveedor
          .correos
          .length,

      mensajesRevisados:
        result
          .mensajesRevisados,

      /*
        Estas cifras ahora pertenecen al proveedor seleccionado,
        no al buzón completo.
      */

      coincidencias:
        existentesDespues,

      coincidenciasPorNombre:
        existentesDespues,

      coincidenciasPorCorreo:
        0,

      facturasCreadas:
        facturasNuevasProveedor,

      /*
        Las que ya estaban en PostgreSQL antes de sincronizar
        son las "ya registradas" de ESTE proveedor.
      */

      duplicadas:
        existentesAntes,

      /*
        Para un proveedor ya conocido, una factura válida con su
        nombre exacto no debe terminar en RECEPCIÓN.
      */

      enviadasRecepcion:
        0,

      facturasReclasificadas,
    };
  };

/* =========================================================
   DETALLE OUTLOOK
========================================================= */

export const getOutlookMessageDetail =
  async (
    messageId:
      string,

    internetMessageId?:
      string |
      null,
  ): Promise<
    OutlookMessageDetail
  > => {
    validateConfig();

    if (
      !messageId ||
      !messageId
        .trim()
    ) {
      throw new Error(
        "La factura no tiene un identificador de Outlook.",
      );
    }

    const token =
      await getAccessToken();

    return getMessageDetailWithToken(
      token,
      messageId,
      internetMessageId,
    );
  };

/* =========================================================
   METADATOS DE UN MENSAJE YA CARGADO
========================================================= */

export const getOutlookInvoiceMetadata =
  async (
    detail:
      OutlookMessageDetail,
  ): Promise<
    ExtractedInvoiceMetadata
  > => {
    validateConfig();

    const token =
      await getAccessToken();

    return extractMetadataForDetail(
      token,
      detail,
    );
  };

/* =========================================================
   DESCARGAR ADJUNTO

   Firma compatible con el proyecto actual:
   (messageId, attachmentId, internetMessageId?)
========================================================= */

export const downloadOutlookAttachment =
  async (
    messageId:
      string,

    attachmentId:
      string,

    internetMessageId?:
      string |
      null,
  ): Promise<
    OutlookAttachmentDownload
  > => {
    validateConfig();

    if (
      !messageId
        .trim() ||
      !attachmentId
        .trim()
    ) {
      throw new Error(
        "Mensaje o adjunto inválido.",
      );
    }

    const token =
      await getAccessToken();

    const message =
      await resolveMessage(
        token,
        messageId,
        internetMessageId,
      );

    const attachments =
      await getMessageAttachments(
        token,
        message.id,
      );

    const attachment =
      attachments.find(
        (
          item,
        ) =>
          item.id ===
          attachmentId,
      );

    if (!attachment) {
      throw new Error(
        "El adjunto ya no está disponible en Outlook.",
      );
    }

    const type =
      attachment[
        "@odata.type"
      ] ??
      "";

    if (
      type &&
      !type.includes(
        "fileAttachment",
      )
    ) {
      throw new Error(
        "Este tipo de adjunto no puede descargarse directamente.",
      );
    }

    const buffer =
      await getAttachmentBuffer(
        token,
        message.id,
        attachment.id,
      );

    return {
      buffer,

      fileName:
        attachment.name ??
        "adjunto",

      contentType:
        attachment
          .contentType ??
        "application/octet-stream",
    };
  };
