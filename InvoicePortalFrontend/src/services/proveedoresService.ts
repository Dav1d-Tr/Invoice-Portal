import {
  API_BASE,
} from "../config/api";

import {
  authFetch,
} from "./authService";

/* =========================================================
   TIPOS
========================================================= */

export interface ProveedorCorreo {
  id: number;

  correo: string;

  esPrincipal: boolean;

  activo: boolean;
}

export interface Proveedor {
  id: number;

  nombre: string;

  nit:
    string | null;

  idArea: number;

  area: string;

  activo: boolean;

  fechaCreacion: string;

  fechaActualizacion: string;

  correos:
    ProveedorCorreo[];
}

/* =========================================================
   OUTLOOK
========================================================= */

export interface OutlookSyncResult {
  proveedorId: number;

  proveedor: string;

  area: string;

  nit:
    string | null;

  correosConfigurados: number;

  mensajesRevisados: number;

  coincidencias: number;

  coincidenciasPorNombre: number;

  coincidenciasPorCorreo: number;

  facturasCreadas: number;

  duplicadas: number;
}

/* =========================================================
   INPUT CREAR / EDITAR
========================================================= */

export interface GuardarProveedorInput {
  nombre: string;

  nit:
    string | null;

  idArea: number;

  /*
    Puede estar vacío.

    La identificación principal
    actualmente se realiza por
    nombre del proveedor.
  */
  correos: string[];
}

/* =========================================================
   RESPUESTA UNIFICADA CREAR / EDITAR
========================================================= */

export interface GuardarProveedorResult {
  id: number;

  nombre: string;

  nit:
    string | null;

  idArea: number;

  sincronizacion:
    OutlookSyncResult | null;

  warning?:
    string;
}

/* =========================================================
   RESPUESTA API GENERAL
========================================================= */

interface ApiResponse<T> {
  success: boolean;

  message?: string;

  warning?: string;

  data?: T;
}

/* =========================================================
   NORMALIZAR PROVEEDOR
========================================================= */

const normalizeProveedor = (
  proveedor:
    Proveedor,
): Proveedor => {
  return {
    ...proveedor,

    id:
      Number(
        proveedor.id,
      ),

    idArea:
      Number(
        proveedor.idArea,
      ),

    correos:
      (
        proveedor.correos ??
        []
      ).map(
        (correo) => ({
          ...correo,

          id:
            Number(
              correo.id,
            ),

          esPrincipal:
            Boolean(
              correo.esPrincipal,
            ),

          activo:
            Boolean(
              correo.activo,
            ),
        }),
      ),
  };
};

/* =========================================================
   LISTAR
========================================================= */

export const getProveedores =
  async (): Promise<
    Proveedor[]
  > => {
    const response =
      await authFetch(
        `${API_BASE}/proveedores`,
        {
          method:
            "GET",
        },
      );

    const result =
      (await response.json()) as
        ApiResponse<
          Proveedor[]
        >;

    if (
      !response.ok ||
      !result.success
    ) {
      throw new Error(
        result.message ??
          "No fue posible consultar los proveedores.",
      );
    }

    return (
      result.data ??
      []
    ).map(
      normalizeProveedor,
    );
  };

/* =========================================================
   CREAR PROVEEDOR

   Devuelve SIEMPRE:
   GuardarProveedorResult
========================================================= */

export const crearProveedor =
  async (
    input:
      GuardarProveedorInput,
  ): Promise<
    GuardarProveedorResult
  > => {
    const response =
      await authFetch(
        `${API_BASE}/proveedores`,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify(
              input,
            ),
        },
      );

    const result =
      (await response.json()) as
        ApiResponse<{
          id:
            number | string;

          nombre: string;

          nit:
            string | null;

          idArea:
            number | string;

          sincronizacion:
            OutlookSyncResult | null;
        }>;

    if (
      !response.ok ||
      !result.success ||
      !result.data
    ) {
      throw new Error(
        result.message ??
          "No fue posible registrar el proveedor.",
      );
    }

    return {
      id:
        Number(
          result.data.id,
        ),

      nombre:
        result.data.nombre,

      nit:
        result.data.nit,

      idArea:
        Number(
          result.data.idArea,
        ),

      sincronizacion:
        result.data
          .sincronizacion ??
        null,

      warning:
        result.warning,
    };
  };

/* =========================================================
   ACTUALIZAR PROVEEDOR

   Devuelve EXACTAMENTE EL MISMO TIPO
   que crearProveedor().
========================================================= */

export const actualizarProveedor =
  async (
    id:
      number,

    input:
      GuardarProveedorInput,
  ): Promise<
    GuardarProveedorResult
  > => {
    const response =
      await authFetch(
        `${API_BASE}/proveedores/${id}`,
        {
          method:
            "PUT",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify(
              input,
            ),
        },
      );

    const result =
      (await response.json()) as
        ApiResponse<{
          id:
            number | string;

          nombre: string;

          nit:
            string | null;

          idArea:
            number | string;

          sincronizacion:
            OutlookSyncResult | null;
        }>;

    if (
      !response.ok ||
      !result.success ||
      !result.data
    ) {
      throw new Error(
        result.message ??
          "No fue posible actualizar el proveedor.",
      );
    }

    return {
      id:
        Number(
          result.data.id,
        ),

      nombre:
        result.data.nombre,

      nit:
        result.data.nit,

      idArea:
        Number(
          result.data.idArea,
        ),

      sincronizacion:
        result.data
          .sincronizacion ??
        null,

      warning:
        result.warning,
    };
  };

/* =========================================================
   ELIMINAR PROVEEDOR
========================================================= */

export const eliminarProveedor =
  async (
    id:
      number,
  ): Promise<void> => {
    const response =
      await authFetch(
        `${API_BASE}/proveedores/${id}`,
        {
          method:
            "DELETE",
        },
      );

    const result =
      (await response.json()) as
        ApiResponse<unknown>;

    if (
      !response.ok ||
      !result.success
    ) {
      throw new Error(
        result.message ??
          "No fue posible eliminar el proveedor.",
      );
    }
  };

/* =========================================================
   SINCRONIZAR OUTLOOK
========================================================= */

export const sincronizarProveedor =
  async (
    id:
      number,
  ): Promise<
    OutlookSyncResult
  > => {
    const response =
      await authFetch(
        `${API_BASE}/outlook/proveedores/${id}/sincronizar`,
        {
          method:
            "POST",
        },
      );

    const result =
      (await response.json()) as
        ApiResponse<
          OutlookSyncResult
        >;

    if (
      !response.ok ||
      !result.success ||
      !result.data
    ) {
      throw new Error(
        result.message ??
          "No fue posible sincronizar Outlook.",
      );
    }

    return {
      ...result.data,

      proveedorId:
        Number(
          result.data
            .proveedorId,
        ),

      correosConfigurados:
        Number(
          result.data
            .correosConfigurados,
        ),

      mensajesRevisados:
        Number(
          result.data
            .mensajesRevisados,
        ),

      coincidencias:
        Number(
          result.data
            .coincidencias,
        ),

      coincidenciasPorNombre:
        Number(
          result.data
            .coincidenciasPorNombre,
        ),

      coincidenciasPorCorreo:
        Number(
          result.data
            .coincidenciasPorCorreo,
        ),

      facturasCreadas:
        Number(
          result.data
            .facturasCreadas,
        ),

      duplicadas:
        Number(
          result.data
            .duplicadas,
        ),
    };
  };