import type {
  NextFunction,
  Request,
  Response,
} from "express";

import jwt from "jsonwebtoken";

import type {
  QueryResultRow,
} from "pg";

import {
  env,
} from "../config/env";

import {
  query,
} from "../config/database";

import type {
  AuthenticatedRequest,
  AuthPayload,
} from "../types/auth.types";

/* =========================================================
   TIPOS
========================================================= */

interface ActiveAreaRow
  extends QueryResultRow {
  id: number | string;
  nombre: string;
  activo: boolean;
}

/* =========================================================
   REQUIRE AUTH
========================================================= */

export const requireAuth =
  async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const authorization =
      req.headers.authorization;

    /* =====================================================
       VERIFICAR HEADER
    ===================================================== */

    if (
      !authorization ||
      !authorization.startsWith(
        "Bearer ",
      )
    ) {
      res.status(401).json({
        success: false,

        message:
          "Debes iniciar sesión.",
      });

      return;
    }

    const token =
      authorization
        .substring(7)
        .trim();

    if (!token) {
      res.status(401).json({
        success: false,

        message:
          "Debes iniciar sesión.",
      });

      return;
    }

    try {
      /* ===================================================
         DECODIFICAR JWT
      =================================================== */

      const decoded =
        jwt.verify(
          token,
          env.jwt.secret,
        );

      if (
        typeof decoded ===
        "string"
      ) {
        res.status(401).json({
          success: false,

          message:
            "Sesión no válida.",
        });

        return;
      }

      /* ===================================================
         CONVERTIR areaId

         Puede venir:
         2
         o
         "2"
      =================================================== */

      const areaId =
        Number(
          decoded.areaId,
        );

      if (
        !Number.isInteger(
          areaId,
        ) ||
        areaId <= 0
      ) {
        console.error(
          "JWT con areaId inválido:",
          decoded.areaId,
        );

        res.status(401).json({
          success: false,

          message:
            "Sesión no válida.",
        });

        return;
      }

      /* ===================================================
         VERIFICAR ÁREA EN POSTGRESQL
      =================================================== */

      const result =
        await query<ActiveAreaRow>(
          `
            SELECT
              id,
              nombre,
              activo

            FROM public.areas

            WHERE id = $1

            LIMIT 1
          `,
          [
            areaId,
          ],
        );

      const area =
        result.rows[0];

      if (
        !area ||
        !area.activo
      ) {
        res.status(401).json({
          success: false,

          message:
            "El área ya no tiene acceso al portal.",
        });

        return;
      }

      /* ===================================================
         CREAR SESIÓN INTERNA
      =================================================== */

      const auth:
        AuthPayload = {
        areaId:
          Number(area.id),

        area:
          area.nombre,
      };

      (
        req as
          AuthenticatedRequest
      ).auth = auth;

      next();
    } catch (error) {
      /* ===================================================
         TOKEN EXPIRADO
      =================================================== */

      if (
        error instanceof
        jwt.TokenExpiredError
      ) {
        console.log(
          "JWT expirado:",
          error.expiredAt,
        );

        res.status(401).json({
          success: false,

          message:
            "Tu sesión expiró. Inicia sesión nuevamente.",
        });

        return;
      }

      /* ===================================================
         TOKEN INVÁLIDO
      =================================================== */

      if (
        error instanceof
        jwt.JsonWebTokenError
      ) {
        console.log(
          "JWT inválido:",
          error.message,
        );

        res.status(401).json({
          success: false,

          message:
            "Sesión no válida. Inicia sesión nuevamente.",
        });

        return;
      }

      console.error(
        "Error validando sesión:",
        error,
      );

      res.status(500).json({
        success: false,

        message:
          "No fue posible validar la sesión.",
      });
    }
  };