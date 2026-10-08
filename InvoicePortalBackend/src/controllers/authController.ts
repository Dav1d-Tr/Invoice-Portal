import type {
  Request,
  Response,
} from "express";

import {
  getActiveAreas,
  InvalidCredentialsError,
  loginArea,
} from "../services/authService";

import type {
  AuthenticatedRequest,
} from "../types/auth.types";

/* =========================================================
   GET /api/auth/areas
========================================================= */

export const areasController =
  async (
    _req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const areas =
        await getActiveAreas();

      res.status(200).json({
        success: true,
        data: areas,
      });
    } catch (error) {
      console.error(
        "Error consultando áreas:",
        error,
      );

      res.status(500).json({
        success: false,

        message:
          "No fue posible cargar las áreas.",
      });
    }
  };

/* =========================================================
   POST /api/auth/login
========================================================= */

export const loginController =
  async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const area =
        typeof req.body?.area ===
        "string"
          ? req.body.area
          : "";

      const clave =
        typeof req.body?.clave ===
        "string"
          ? req.body.clave
          : "";

      if (
        !area.trim() ||
        !clave
      ) {
        res.status(400).json({
          success: false,

          message:
            "Debes seleccionar el área e ingresar la contraseña.",
        });

        return;
      }

      const data =
        await loginArea({
          area,
          clave,
        });

      res.status(200).json({
        success: true,

        message:
          "Inicio de sesión exitoso.",

        data,
      });
    } catch (error) {
      if (
        error instanceof
        InvalidCredentialsError
      ) {
        res.status(401).json({
          success: false,

          message:
            "Área o contraseña incorrectos.",
        });

        return;
      }

      console.error(
        "Error iniciando sesión:",
        error,
      );

      res.status(500).json({
        success: false,

        message:
          "No fue posible iniciar sesión.",
      });
    }
  };

/* =========================================================
   GET /api/auth/me
========================================================= */

export const meController = (
  req: Request,
  res: Response,
): void => {
  const auth =
    (
      req as
        AuthenticatedRequest
    ).auth;

  if (!auth) {
    res.status(401).json({
      success: false,

      message:
        "Sesión no válida.",
    });

    return;
  }

  res.status(200).json({
    success: true,

    data: {
      id:
        auth.areaId,

      nombre:
        auth.area,
    },
  });
};

/* =========================================================
   POST /api/auth/logout
========================================================= */

export const logoutController = (
  _req: Request,
  res: Response,
): void => {
  res.status(200).json({
    success: true,

    message:
      "Sesión cerrada correctamente.",
  });
};