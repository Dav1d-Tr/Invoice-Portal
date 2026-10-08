import type {
  Request,
  Response,
} from "express";

import {
  actualizarProveedor,
  agregarCorreoProveedor,
  crearProveedor,
  eliminarProveedor,
  getProveedores,
  ProveedorError,
} from "../services/proveedoresService";

import {
  sincronizarProveedorOutlook,
} from "../services/outlookService";

const handleError = (
  error: unknown,
  res: Response,
): void => {
  if (
    error instanceof
    ProveedorError
  ) {
    res.status(
      error.statusCode,
    ).json({
      success: false,

      message:
        error.message,
    });

    return;
  }

  console.error(
    "Error proveedores:",
    error,
  );

  res.status(500).json({
    success: false,

    message:
      "Ha ocurrido un error interno.",
  });
};

/* =========================================================
   LISTAR
========================================================= */

export const listarProveedoresController =
  async (
    _req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      res.json({
        success: true,

        data:
          await getProveedores(),
      });
    } catch (error) {
      handleError(
        error,
        res,
      );
    }
  };

/* =========================================================
   CREAR + SINCRONIZAR OUTLOOK
========================================================= */

export const crearProveedorController =
  async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const {
        nombre,
        nit,
        idArea,
        correos,
      } =
        req.body ?? {};

      if (
        typeof nombre !==
          "string" ||
        !nombre.trim()
      ) {
        res.status(400).json({
          success: false,

          message:
            "El nombre es obligatorio.",
        });

        return;
      }

      const proveedor =
        await crearProveedor({
          nombre,

          nit:
            typeof nit ===
            "string"
              ? nit
              : null,

          idArea:
            Number(
              idArea,
            ),

          /*
            CORREOS OPCIONALES
          */
          correos:
            Array.isArray(
              correos,
            )
              ? correos.filter(
                  (
                    value,
                  ): value is string =>
                    typeof value ===
                    "string",
                )
              : [],
        });

      try {
        const sincronizacion =
          await sincronizarProveedorOutlook(
            proveedor.id,
          );

        res.status(201).json({
          success: true,

          message:
            "Proveedor registrado y sincronizado.",

          data: {
            ...proveedor,

            sincronizacion,
          },
        });
      } catch (
        syncError
      ) {
        res.status(201).json({
          success: true,

          message:
            "Proveedor registrado.",

          warning:
            syncError instanceof
            Error
              ? syncError.message
              : "No fue posible sincronizar Outlook.",

          data: {
            ...proveedor,

            sincronizacion:
              null,
          },
        });
      }
    } catch (error) {
      handleError(
        error,
        res,
      );
    }
  };

/* =========================================================
   ACTUALIZAR + RESINCRONIZAR
========================================================= */

export const actualizarProveedorController =
  async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const id =
        Number(
          req.params.id,
        );

      const {
        nombre,
        nit,
        idArea,
        correos,
      } =
        req.body ?? {};

      if (
        !Number.isInteger(id) ||
        id <= 0 ||
        typeof nombre !==
          "string"
      ) {
        res.status(400).json({
          success: false,

          message:
            "Datos inválidos.",
        });

        return;
      }

      const proveedor =
        await actualizarProveedor(
          id,
          {
            nombre,

            nit:
              typeof nit ===
              "string"
                ? nit
                : null,

            idArea:
              Number(
                idArea,
              ),

            correos:
              Array.isArray(
                correos,
              )
                ? correos.filter(
                    (
                      value,
                    ): value is string =>
                      typeof value ===
                      "string",
                  )
                : [],
          },
        );

      try {
        const sincronizacion =
          await sincronizarProveedorOutlook(
            id,
          );

        res.json({
          success: true,

          message:
            "Proveedor actualizado.",

          data: {
            ...proveedor,

            sincronizacion,
          },
        });
      } catch (
        syncError
      ) {
        res.json({
          success: true,

          message:
            "Proveedor actualizado.",

          warning:
            syncError instanceof
            Error
              ? syncError.message
              : "No fue posible sincronizar Outlook.",

          data: {
            ...proveedor,

            sincronizacion:
              null,
          },
        });
      }
    } catch (error) {
      handleError(
        error,
        res,
      );
    }
  };

/* =========================================================
   ELIMINAR / DESACTIVAR
========================================================= */

export const eliminarProveedorController =
  async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const id =
        Number(
          req.params.id,
        );

      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        res.status(400).json({
          success: false,

          message:
            "Proveedor inválido.",
        });

        return;
      }

      await eliminarProveedor(
        id,
      );

      res.json({
        success: true,

        message:
          "Proveedor eliminado correctamente.",
      });
    } catch (error) {
      handleError(
        error,
        res,
      );
    }
  };

/* =========================================================
   AGREGAR CORREO
========================================================= */

export const agregarCorreoController =
  async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const id =
        Number(
          req.params.id,
        );

      const correo =
        req.body?.correo;

      if (
        !Number.isInteger(id) ||
        typeof correo !==
          "string"
      ) {
        res.status(400).json({
          success: false,

          message:
            "Datos inválidos.",
        });

        return;
      }

      const data =
        await agregarCorreoProveedor(
          id,
          correo,
        );

      let sincronizacion =
        null;

      try {
        sincronizacion =
          await sincronizarProveedorOutlook(
            id,
          );
      } catch (
        syncError
      ) {
        console.error(
          syncError,
        );
      }

      res.status(201).json({
        success: true,

        data: {
          ...data,

          sincronizacion,
        },
      });
    } catch (error) {
      handleError(
        error,
        res,
      );
    }
  };