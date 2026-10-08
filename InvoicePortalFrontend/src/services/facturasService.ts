import {
  API_BASE,
} from "../config/api";

import {
  authFetch,
} from "./authService";

/* =========================================================
   ESTADOS
========================================================= */

export type InvoiceStatusCode =
  | "PENDIENTE"
  | "APROBADA"
  | "RECHAZADA"
  | "REMITIDA"
  | "PROCESADA";

/* =========================================================
   FACTURA
========================================================= */

export interface Invoice {
  id:
    number;

  idProveedor:
    number | null;

  idAreaOrigen:
    number;

  idAreaActual:
    number;

  idAreaProveedor?:
    number | null;

  estadoCodigo:
    InvoiceStatusCode;

  estado:
    string;

  tipoDocumento:
    "FACTURA" |
    "NOTA_CREDITO" |
    null;

  numeroFactura:
    string | null;

  cufe?:
    string | null;

  asunto:
    string | null;

  proveedor:
    string;

  nit:
    string | null;

  correo:
    string | null;

  fechaRecepcion:
    string | null;

  fechaEmision?:
    string | null;

  fechaVencimiento?:
    string | null;

  tieneAdjuntos:
    boolean;

  webLink:
    string | null;

  bodyPreview?:
    string | null;

  outlookMessageId?:
    string | null;

  internetMessageId?:
    string | null;

  areaOrigen:
    string;

  areaActual:
    string;

  areaProveedor?:
    string | null;

  remitidaDesde?:
    string | null;

  fechaRemision?:
    string | null;

  rechazadaPor?:
    string | null;

  observacionRechazo?:
    string | null;

  fechaRechazo?:
    string | null;

  subtotal?:
    string |
    number |
    null;

  impuestos?:
    string |
    number |
    null;

  valorTotal:
    string |
    number |
    null;

  moneda:
    string | null;

  origen?:
    string;
}

/* =========================================================
   CATALOGOS
========================================================= */

export interface AreaFactura {
  id:
    number;

  nombre:
    string;
}

export interface ProveedorFactura {
  id:
    number;

  nombre:
    string;

  nit:
    string | null;

  idArea:
    number;

  area:
    string;

  correos:
    string[];
}

/* =========================================================
   OUTLOOK
========================================================= */

export interface OutlookAttachment {
  id:
    string;

  name:
    string;

  contentType:
    string;

  size:
    number;

  isInline:
    boolean;

  contentId:
    string | null;

  type:
    string;
}

export interface OutlookDocumentLink {
  url:
    string;

  label:
    string;
}

export interface OutlookMessageDetail {
  id:
    string;

  subject:
    string;

  fromName:
    string;

  fromEmail:
    string;

  to:
    string[];

  cc:
    string[];

  receivedDateTime:
    string | null;

  sentDateTime:
    string | null;

  bodyHtml:
    string;

  bodyText:
    string;

  bodyPreview:
    string;

  hasAttachments:
    boolean;

  attachments:
    OutlookAttachment[];

  documentLinks:
    OutlookDocumentLink[];

  webLink:
    string | null;

  internetMessageId:
    string | null;
}

/* =========================================================
   PROVEEDOR DESDE RECEPCION
========================================================= */

export interface NuevoProveedorFacturaInput {
  nombre:
    string;

  nit:
    string | null;

  idArea:
    number;

  correos:
    string[];
}

export interface AsignarProveedorResult {
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

  creado:
    boolean;
}

/* =========================================================
   HISTORIAL
========================================================= */

export interface FacturaEvento {
  id:
    number;

  accion:
    string;

  areaActor:
    string | null;

  areaOrigen:
    string | null;

  areaDestino:
    string | null;

  estadoAnteriorCodigo:
    string | null;

  estadoAnterior:
    string | null;

  estadoNuevoCodigo:
    string | null;

  estadoNuevo:
    string | null;

  observacion:
    string | null;

  datos:
    Record<
      string,
      unknown
    >;

  fechaEvento:
    string;
}

/* =========================================================
   RESPUESTA API
========================================================= */

interface ApiResponse<T> {
  success:
    boolean;

  message?:
    string;

  data?:
    T;
}

const readJson =
  async <T>(
    response:
      Response,
  ): Promise<
    ApiResponse<T>
  > => {
    try {
      return (
        await response.json()
      ) as
        ApiResponse<T>;
    } catch {
      throw new Error(
        "El servidor devolvió una respuesta inválida.",
      );
    }
  };

const readResponse =
  async <T>(
    response:
      Response,
  ): Promise<T> => {
    const result =
      await readJson<T>(
        response,
      );

    if (
      !response.ok ||
      !result.success ||
      result.data ===
        undefined
    ) {
      throw new Error(
        result.message ??
          "No fue posible completar la operación.",
      );
    }

    return result.data;
  };

const ensureSuccess =
  async (
    response:
      Response,
  ): Promise<void> => {
    const result =
      await readJson<unknown>(
        response,
      );

    if (
      !response.ok ||
      !result.success
    ) {
      throw new Error(
        result.message ??
          "No fue posible completar la operación.",
      );
    }
  };

/* =========================================================
   NORMALIZAR
========================================================= */

const normalizeInvoice = (
  invoice:
    Invoice,
): Invoice => {
  return {
    ...invoice,

    id:
      Number(
        invoice.id,
      ),

    idProveedor:
      invoice.idProveedor ===
        null ||
      invoice.idProveedor ===
        undefined
        ? null
        : Number(
            invoice
              .idProveedor,
          ),

    idAreaOrigen:
      Number(
        invoice
          .idAreaOrigen,
      ),

    idAreaActual:
      Number(
        invoice
          .idAreaActual,
      ),

    idAreaProveedor:
      invoice.idAreaProveedor ===
        null ||
      invoice.idAreaProveedor ===
        undefined
        ? null
        : Number(
            invoice
              .idAreaProveedor,
          ),

    tieneAdjuntos:
      Boolean(
        invoice
          .tieneAdjuntos,
      ),
  };
};

/* =========================================================
   LISTADOS
========================================================= */

export const getFacturas =
  async (): Promise<
    Invoice[]
  > => {
    const response =
      await authFetch(
        `${API_BASE}/facturas`,
        {
          method:
            "GET",

          cache:
            "no-store",
        },
      );

    const data =
      await readResponse<
        Invoice[]
      >(
        response,
      );

    return data.map(
      normalizeInvoice,
    );
  };

export const getFacturasRemitidas =
  async (): Promise<
    Invoice[]
  > => {
    const response =
      await authFetch(
        `${API_BASE}/facturas/panel/remitidas`,
        {
          method:
            "GET",

          cache:
            "no-store",
        },
      );

    const data =
      await readResponse<
        Invoice[]
      >(
        response,
      );

    return data.map(
      normalizeInvoice,
    );
  };

export const getFacturasRechazadas =
  async (): Promise<
    Invoice[]
  > => {
    const response =
      await authFetch(
        `${API_BASE}/facturas/panel/rechazadas`,
        {
          method:
            "GET",

          cache:
            "no-store",
        },
      );

    const data =
      await readResponse<
        Invoice[]
      >(
        response,
      );

    return data.map(
      normalizeInvoice,
    );
  };


/* =========================================================
   DETALLE
========================================================= */

export const getFacturaDetalle =
  async (
    id:
      number,
  ): Promise<
    Invoice
  > => {
    const response =
      await authFetch(
        `${API_BASE}/facturas/${id}`,
        {
          method:
            "GET",

          cache:
            "no-store",
        },
      );

    return normalizeInvoice(
      await readResponse<
        Invoice
      >(
        response,
      ),
    );
  };

export const getFacturaCorreoOutlook =
  async (
    id:
      number,
  ): Promise<
    OutlookMessageDetail
  > => {
    const response =
      await authFetch(
        `${API_BASE}/facturas/${id}/correo-outlook`,
        {
          method:
            "GET",

          cache:
            "no-store",
        },
      );

    return readResponse<
      OutlookMessageDetail
    >(
      response,
    );
  };

/* =========================================================
   CATALOGOS
========================================================= */

export const getAreasFactura =
  async (): Promise<
    AreaFactura[]
  > => {
    const response =
      await authFetch(
        `${API_BASE}/facturas/catalogos/areas`,
        {
          method:
            "GET",

          cache:
            "no-store",
        },
      );

    const data =
      await readResponse<
        AreaFactura[]
      >(
        response,
      );

    return data.map(
      (
        item,
      ) => ({
        ...item,

        id:
          Number(
            item.id,
          ),
      }),
    );
  };

export const getProveedoresFactura =
  async (): Promise<
    ProveedorFactura[]
  > => {
    const response =
      await authFetch(
        `${API_BASE}/facturas/catalogos/proveedores`,
        {
          method:
            "GET",

          cache:
            "no-store",
        },
      );

    const data =
      await readResponse<
        ProveedorFactura[]
      >(
        response,
      );

    return data.map(
      (
        item,
      ) => ({
        ...item,

        id:
          Number(
            item.id,
          ),

        idArea:
          Number(
            item.idArea,
          ),

        correos:
          Array.isArray(
            item.correos,
          )
            ? item.correos
            : [],
      }),
    );
  };

/* =========================================================
   ACCIONES SIMPLES
========================================================= */

const postSimpleAction =
  async (
    url:
      string,

    observacion?:
      string |
      null,
  ): Promise<void> => {
    const response =
      await authFetch(
        url,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              observacion:
                observacion
                  ?.trim() ||
                null,
            }),
        },
      );

    await ensureSuccess(
      response,
    );
  };

export const aprobarFactura =
  async (
    id:
      number,

    observacion?:
      string |
      null,
  ): Promise<void> => {
    return postSimpleAction(
      `${API_BASE}/facturas/${id}/aprobar`,
      observacion,
    );
  };

export const rechazarFactura =
  async (
    id:
      number,

    observacion?:
      string |
      null,
  ): Promise<void> => {
    return postSimpleAction(
      `${API_BASE}/facturas/${id}/rechazar`,
      observacion,
    );
  };

export const procesarFactura =
  async (
    id:
      number,

    observacion?:
      string |
      null,
  ): Promise<void> => {
    return postSimpleAction(
      `${API_BASE}/facturas/${id}/procesar`,
      observacion,
    );
  };

export const reactivarFactura =
  async (
    id:
      number,

    observacion?:
      string |
      null,
  ): Promise<void> => {
    return postSimpleAction(
      `${API_BASE}/facturas/${id}/reactivar`,
      observacion,
    );
  };


/* =========================================================
   REMITIR
========================================================= */

export const remitirFactura =
  async (
    id:
      number,

    idAreaDestino:
      number,

    observacion?:
      string |
      null,
  ): Promise<void> => {
    const response =
      await authFetch(
        `${API_BASE}/facturas/${id}/remitir`,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              idAreaDestino,

              observacion:
                observacion
                  ?.trim() ||
                null,
            }),
        },
      );

    await ensureSuccess(
      response,
    );
  };

/*
  Alias temporal para no romper componentes antiguos.
  La nueva UI utiliza remitirFactura().
*/

export const remitirFacturaContabilidad =
  async (
    id:
      number,

    observacion?:
      string |
      null,
  ): Promise<void> => {
    return postSimpleAction(
      `${API_BASE}/facturas/${id}/remitir-contabilidad`,
      observacion,
    );
  };

/* =========================================================
   PROVEEDOR DESDE RECEPCION
========================================================= */

export const asociarProveedorExistente =
  async (
    idFactura:
      number,

    idProveedor:
      number,
  ): Promise<
    AsignarProveedorResult
  > => {
    const response =
      await authFetch(
        `${API_BASE}/facturas/${idFactura}/asignar-proveedor`,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              idProveedor,
            }),
        },
      );

    return readResponse<
      AsignarProveedorResult
    >(
      response,
    );
  };

export const registrarProveedorDesdeFactura =
  async (
    idFactura:
      number,

    nuevoProveedor:
      NuevoProveedorFacturaInput,
  ): Promise<
    AsignarProveedorResult
  > => {
    const response =
      await authFetch(
        `${API_BASE}/facturas/${idFactura}/asignar-proveedor`,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              nuevoProveedor,
            }),
        },
      );

    return readResponse<
      AsignarProveedorResult
    >(
      response,
    );
  };

/* =========================================================
   HISTORIAL
========================================================= */

export const getHistorialFactura =
  async (
    idFactura:
      number,
  ): Promise<
    FacturaEvento[]
  > => {
    const response =
      await authFetch(
        `${API_BASE}/facturas/${idFactura}/historial`,
        {
          method:
            "GET",

          cache:
            "no-store",
        },
      );

    const data =
      await readResponse<
        FacturaEvento[]
      >(
        response,
      );

    return data.map(
      (
        item,
      ) => ({
        ...item,

        id:
          Number(
            item.id,
          ),

        datos:
          item.datos ??
          {},
      }),
    );
  };

/* =========================================================
   ADJUNTOS
========================================================= */

const getFileNameFromDisposition = (
  header:
    string |
    null,

  fallback:
    string,
): string => {
  if (!header) {
    return fallback;
  }

  const utf8 =
    header.match(
      /filename\*=UTF-8''([^;]+)/i,
    );

  if (
    utf8?.[1]
  ) {
    try {
      return decodeURIComponent(
        utf8[1],
      );
    } catch {
      return utf8[1];
    }
  }

  const simple =
    header.match(
      /filename="?([^";]+)"?/i,
    );

  return simple?.[1]
    ?.trim() ||
    fallback;
};

export const obtenerAdjuntoFactura =
  async (
    idFactura:
      number,

    attachmentId:
      string,

    inline =
      false,
  ): Promise<{
    blob:
      Blob;

    fileName:
      string;

    contentType:
      string;
  }> => {
    const response =
      await authFetch(
        `${API_BASE}/facturas/${idFactura}/adjuntos/${encodeURIComponent(
          attachmentId,
        )}/download${inline ? "?inline=1" : ""}`,
        {
          method:
            "GET",

          cache:
            "no-store",
        },
      );

    if (
      !response.ok
    ) {
      let message =
        "No fue posible obtener el archivo.";

      try {
        const result =
          (
            await response
              .json()
          ) as
            ApiResponse<unknown>;

        message =
          result.message ??
          message;
      } catch {
        // Respuesta binaria/vacía.
      }

      throw new Error(
        message,
      );
    }

    const blob =
      await response.blob();

    return {
      blob,

      fileName:
        getFileNameFromDisposition(
          response.headers.get(
            "Content-Disposition",
          ),
          "adjunto",
        ),

      contentType:
        response.headers.get(
          "Content-Type",
        ) ??
        blob.type ??
        "application/octet-stream",
    };
  };

export const descargarAdjuntoFactura =
  async (
    idFactura:
      number,

    attachmentId:
      string,

    fallbackName:
      string,
  ): Promise<void> => {
    const file =
      await obtenerAdjuntoFactura(
        idFactura,
        attachmentId,
        false,
      );

    const url =
      URL.createObjectURL(
        file.blob,
      );

    try {
      const anchor =
        document.createElement(
          "a",
        );

      anchor.href =
        url;

      anchor.download =
        file.fileName ||
        fallbackName;

      document.body
        .appendChild(
          anchor,
        );

      anchor.click();

      anchor.remove();
    } finally {
      setTimeout(
        () => {
          URL.revokeObjectURL(
            url,
          );
        },
        1_000,
      );
    }
  };

export const abrirAdjuntoFactura =
  async (
    idFactura:
      number,

    attachmentId:
      string,
  ): Promise<void> => {
    const preview =
      window.open(
        "",
        "_blank",
        "noopener,noreferrer",
      );

    try {
      const file =
        await obtenerAdjuntoFactura(
          idFactura,
          attachmentId,
          true,
        );

      const url =
        URL.createObjectURL(
          file.blob,
        );

      if (
        preview
      ) {
        preview.location.href =
          url;
      } else {
        window.open(
          url,
          "_blank",
          "noopener,noreferrer",
        );
      }

      setTimeout(
        () => {
          URL.revokeObjectURL(
            url,
          );
        },
        60_000,
      );
    } catch (
      error
    ) {
      preview?.close();

      throw error;
    }
  };
