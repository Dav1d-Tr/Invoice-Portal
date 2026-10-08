import {
  API_BASE,
} from "../config/api";

import {
  authFetch,
} from "./authService";

/* =========================================================
   CONTACTOS
========================================================= */

export interface AreaCorreo {
  id: number;

  correo: string;

  esPrincipal: boolean;
}

export interface AreaCelular {
  id: number;

  celular: string;

  esPrincipal: boolean;
}

export interface AreaCorreoInput {
  correo: string;

  esPrincipal: boolean;
}

export interface AreaCelularInput {
  celular: string;

  esPrincipal: boolean;
}

/* =========================================================
   USUARIO
========================================================= */

export interface UsuarioPortal {
  id: number;

  nombre: string;

  activo: boolean;

  ultimoAcceso:
    string | null;

  fechaCreacion:
    string;

  fechaActualizacion:
    string;

  correos:
    AreaCorreo[];

  celulares:
    AreaCelular[];
}

/* =========================================================
   INPUT
========================================================= */

export interface CrearUsuarioInput {
  nombre: string;

  clave: string;

  correos:
    AreaCorreoInput[];

  celulares:
    AreaCelularInput[];
}

export interface ActualizarUsuarioInput {
  nombre: string;

  clave?:
    string;

  activo: boolean;

  correos:
    AreaCorreoInput[];

  celulares:
    AreaCelularInput[];
}

/* =========================================================
   RESPUESTA
========================================================= */

interface ApiResponse<T> {
  success: boolean;

  message?:
    string;

  data?:
    T;
}

/* =========================================================
   LEER JSON
========================================================= */

const readJson =
  async <T>(
    response:
      Response,
  ): Promise<ApiResponse<T>> => {
    try {
      return (
        await response.json()
      ) as ApiResponse<T>;
    } catch {
      throw new Error(
        "El servidor devolvió una respuesta inválida.",
      );
    }
  };

/* =========================================================
   RESPONSE CON DATA
========================================================= */

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

/* =========================================================
   LISTAR
========================================================= */

export const getUsuarios =
  async (): Promise<
    UsuarioPortal[]
  > => {
    const response =
      await authFetch(
        `${API_BASE}/usuarios`,
        {
          method:
            "GET",

          cache:
            "no-store",
        },
      );

    return readResponse<
      UsuarioPortal[]
    >(
      response,
    );
  };

/* =========================================================
   CREAR
========================================================= */

export const crearUsuario =
  async (
    input:
      CrearUsuarioInput,
  ): Promise<UsuarioPortal> => {
    const response =
      await authFetch(
        `${API_BASE}/usuarios`,
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

    return readResponse<
      UsuarioPortal
    >(
      response,
    );
  };

/* =========================================================
   ACTUALIZAR
========================================================= */

export const actualizarUsuario =
  async (
    id:
      number,

    input:
      ActualizarUsuarioInput,
  ): Promise<UsuarioPortal> => {
    const response =
      await authFetch(
        `${API_BASE}/usuarios/${id}`,
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

    return readResponse<
      UsuarioPortal
    >(
      response,
    );
  };

/* =========================================================
   DESACTIVAR
========================================================= */

export const eliminarUsuario =
  async (
    id:
      number,
  ): Promise<void> => {
    const response =
      await authFetch(
        `${API_BASE}/usuarios/${id}`,
        {
          method:
            "DELETE",
        },
      );

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
          "No fue posible desactivar el usuario.",
      );
    }
  };

/* =========================================================
   REACTIVAR
========================================================= */

export const reactivarUsuario =
  async (
    id:
      number,
  ): Promise<void> => {
    const response =
      await authFetch(
        `${API_BASE}/usuarios/${id}/reactivar`,
        {
          method:
            "PATCH",
        },
      );

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
          "No fue posible reactivar el usuario.",
      );
    }
  };