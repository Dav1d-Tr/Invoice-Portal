import type {
  Request,
  Response,
} from "express";

import {
  actualizarUsuario,
  crearUsuario,
  eliminarUsuario,
  getUsuarios,
  reactivarUsuario,
  UsuarioAdminError,
} from "../services/usuariosService";

import type {
  AreaCelularInput,
  AreaCorreoInput,
} from "../services/usuariosService";

/* =========================================================
   PARAM ID
========================================================= */

const getId = (
  value:
    string |
    string[] |
    undefined,
): number | null => {
  const raw =
    Array.isArray(
      value,
    )
      ? value[0]
      : value;

  if (!raw) {
    return null;
  }

  const id =
    Number(
      raw,
    );

  if (
    !Number.isInteger(
      id,
    ) ||
    id <=
      0
  ) {
    return null;
  }

  return id;
};

/* =========================================================
   CORREOS
========================================================= */

const getCorreos = (
  value:
    unknown,
): AreaCorreoInput[] | null => {
  if (
    value ===
      undefined ||
    value ===
      null
  ) {
    return [];
  }

  if (
    !Array.isArray(
      value,
    )
  ) {
    return null;
  }

  const result:
    AreaCorreoInput[] =
      [];

  for (
    const item
    of value
  ) {
    if (
      !item ||
      typeof item !==
        "object"
    ) {
      return null;
    }

    const record =
      item as
        Record<
          string,
          unknown
        >;

    if (
      typeof record.correo !==
      "string"
    ) {
      return null;
    }

    if (
      record.esPrincipal !==
        undefined &&
      typeof record.esPrincipal !==
        "boolean"
    ) {
      return null;
    }

    result.push({
      correo:
        record.correo,

      esPrincipal:
        Boolean(
          record.esPrincipal,
        ),
    });
  }

  return result;
};

/* =========================================================
   CELULARES
========================================================= */

const getCelulares = (
  value:
    unknown,
): AreaCelularInput[] | null => {
  if (
    value ===
      undefined ||
    value ===
      null
  ) {
    return [];
  }

  if (
    !Array.isArray(
      value,
    )
  ) {
    return null;
  }

  const result:
    AreaCelularInput[] =
      [];

  for (
    const item
    of value
  ) {
    if (
      !item ||
      typeof item !==
        "object"
    ) {
      return null;
    }

    const record =
      item as
        Record<
          string,
          unknown
        >;

    if (
      typeof record.celular !==
      "string"
    ) {
      return null;
    }

    if (
      record.esPrincipal !==
        undefined &&
      typeof record.esPrincipal !==
        "boolean"
    ) {
      return null;
    }

    result.push({
      celular:
        record.celular,

      esPrincipal:
        Boolean(
          record.esPrincipal,
        ),
    });
  }

  return result;
};

/* =========================================================
   ERROR
========================================================= */

const handleError = (
  error:
    unknown,

  res:
    Response,
): void => {
  if (
    error instanceof
    UsuarioAdminError
  ) {
    res.status(
      error.statusCode,
    ).json({
      success:
        false,

      message:
        error.message,
    });

    return;
  }

  console.error(
    "==========================================",
  );

  console.error(
    "ERROR ADMINISTRANDO USUARIOS",
  );

  console.error(
    error,
  );

  console.error(
    "==========================================",
  );

  res.status(
    500,
  ).json({
    success:
      false,

    message:
      error instanceof
      Error
        ? error.message
        : "Ha ocurrido un error interno.",
  });
};

/* =========================================================
   LISTAR
========================================================= */

export const listarUsuariosController =
  async (
    _req:
      Request,

    res:
      Response,
  ): Promise<void> => {
    try {
      const data =
        await getUsuarios();

      res.status(
        200,
      ).json({
        success:
          true,

        data,
      });
    } catch (
      error
    ) {
      handleError(
        error,
        res,
      );
    }
  };

/* =========================================================
   CREAR
========================================================= */

export const crearUsuarioController =
  async (
    req:
      Request,

    res:
      Response,
  ): Promise<void> => {
    try {
      const {
        nombre,
        clave,
      } =
        req.body ??
        {};

      const correos =
        getCorreos(
          req.body
            ?.correos,
        );

      const celulares =
        getCelulares(
          req.body
            ?.celulares,
        );

      if (
        typeof nombre !==
          "string" ||
        typeof clave !==
          "string"
      ) {
        res.status(
          400,
        ).json({
          success:
            false,

          message:
            "Nombre y contraseña son obligatorios.",
        });

        return;
      }

      if (
        correos ===
        null
      ) {
        res.status(
          400,
        ).json({
          success:
            false,

          message:
            "La lista de correos no es válida.",
        });

        return;
      }

      if (
        celulares ===
        null
      ) {
        res.status(
          400,
        ).json({
          success:
            false,

          message:
            "La lista de celulares no es válida.",
        });

        return;
      }

      const data =
        await crearUsuario({
          nombre,

          clave,

          correos,

          celulares,
        });

      res.status(
        201,
      ).json({
        success:
          true,

        message:
          "Usuario creado correctamente.",

        data,
      });
    } catch (
      error
    ) {
      handleError(
        error,
        res,
      );
    }
  };

/* =========================================================
   ACTUALIZAR
========================================================= */

export const actualizarUsuarioController =
  async (
    req:
      Request,

    res:
      Response,
  ): Promise<void> => {
    try {
      const id =
        getId(
          req.params.id,
        );

      if (!id) {
        res.status(
          400,
        ).json({
          success:
            false,

          message:
            "Usuario inválido.",
        });

        return;
      }

      const {
        nombre,
        clave,
        activo,
      } =
        req.body ??
        {};

      const correos =
        getCorreos(
          req.body
            ?.correos,
        );

      const celulares =
        getCelulares(
          req.body
            ?.celulares,
        );

      if (
        typeof nombre !==
        "string"
      ) {
        res.status(
          400,
        ).json({
          success:
            false,

          message:
            "El nombre es obligatorio.",
        });

        return;
      }

      if (
        typeof activo !==
        "boolean"
      ) {
        res.status(
          400,
        ).json({
          success:
            false,

          message:
            "El estado del usuario es obligatorio.",
        });

        return;
      }

      if (
        correos ===
          null ||
        celulares ===
          null
      ) {
        res.status(
          400,
        ).json({
          success:
            false,

          message:
            "Los contactos enviados no son válidos.",
        });

        return;
      }

      const data =
        await actualizarUsuario(
          id,

          {
            nombre,

            clave:
              typeof clave ===
                "string" &&
              clave.trim()
                ? clave
                : null,

            activo,

            correos,

            celulares,
          },
        );

      res.status(
        200,
      ).json({
        success:
          true,

        message:
          "Usuario actualizado correctamente.",

        data,
      });
    } catch (
      error
    ) {
      handleError(
        error,
        res,
      );
    }
  };

/* =========================================================
   DESACTIVAR
========================================================= */

export const eliminarUsuarioController =
  async (
    req:
      Request,

    res:
      Response,
  ): Promise<void> => {
    try {
      const id =
        getId(
          req.params.id,
        );

      if (!id) {
        res.status(
          400,
        ).json({
          success:
            false,

          message:
            "Usuario inválido.",
        });

        return;
      }

      await eliminarUsuario(
        id,
      );

      res.status(
        200,
      ).json({
        success:
          true,

        message:
          "Usuario desactivado correctamente.",
      });
    } catch (
      error
    ) {
      handleError(
        error,
        res,
      );
    }
  };

/* =========================================================
   REACTIVAR
========================================================= */

export const reactivarUsuarioController =
  async (
    req:
      Request,

    res:
      Response,
  ): Promise<void> => {
    try {
      const id =
        getId(
          req.params.id,
        );

      if (!id) {
        res.status(
          400,
        ).json({
          success:
            false,

          message:
            "Usuario inválido.",
        });

        return;
      }

      const data =
        await reactivarUsuario(
          id,
        );

      res.status(
        200,
      ).json({
        success:
          true,

        message:
          "Usuario reactivado correctamente.",

        data,
      });
    } catch (
      error
    ) {
      handleError(
        error,
        res,
      );
    }
  };