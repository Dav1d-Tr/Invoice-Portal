import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import type {
  QueryResultRow,
} from "pg";

import {
  query,
} from "../config/database";

import {
  env,
} from "../config/env";

import {
  normalizeAreaName,
} from "../utils/normalizeAreaName";

/* =========================================================
   TIPOS
========================================================= */

interface AreaRow
  extends QueryResultRow {
  id: number | string;
  nombre: string;
  nombre_normalizado: string;
  clave_hash: string;
  activo: boolean;
}

interface AreaOptionRow
  extends QueryResultRow {
  id: number | string;
  nombre: string;
}

interface LoginInput {
  area: string;
  clave: string;
}

/* =========================================================
   ERROR DE CREDENCIALES
========================================================= */

export class InvalidCredentialsError
  extends Error {
  constructor() {
    super(
      "Área o clave incorrectos.",
    );

    this.name =
      "InvalidCredentialsError";
  }
}

/* =========================================================
   LISTAR ÁREAS ACTIVAS
========================================================= */

export const getActiveAreas =
  async () => {
    const result =
      await query<AreaOptionRow>(
        `
          SELECT
            id,
            nombre
          FROM public.areas
          WHERE activo = TRUE
          ORDER BY nombre ASC
        `,
      );

    /*
      PostgreSQL puede devolver BIGINT como string.
      Lo convertimos siempre a number.
    */

    return result.rows.map(
      (area) => ({
        id: Number(area.id),
        nombre: area.nombre,
      }),
    );
  };

/* =========================================================
   LOGIN
========================================================= */

export const loginArea =
  async ({
    area,
    clave,
  }: LoginInput) => {
    const normalizedArea =
      normalizeAreaName(
        area,
      );

    if (
      !normalizedArea ||
      !clave
    ) {
      throw new InvalidCredentialsError();
    }

    /* =====================================================
       BUSCAR ÁREA
    ===================================================== */

    const result =
      await query<AreaRow>(
        `
          SELECT
            id,
            nombre,
            nombre_normalizado,
            clave_hash,
            activo
          FROM public.areas
          WHERE nombre_normalizado = $1
          LIMIT 1
        `,
        [
          normalizedArea,
        ],
      );

    const areaEncontrada =
      result.rows[0];

    /* =====================================================
       VALIDAR ÁREA
    ===================================================== */

    if (
      !areaEncontrada ||
      !areaEncontrada.activo
    ) {
      throw new InvalidCredentialsError();
    }

    /* =====================================================
       CONVERTIR ID
    ===================================================== */

    const areaId =
      Number(
        areaEncontrada.id,
      );

    if (
      !Number.isInteger(areaId) ||
      areaId <= 0
    ) {
      console.error(
        "ID de área inválido:",
        areaEncontrada.id,
      );

      throw new Error(
        "El identificador del área no es válido.",
      );
    }

    /* =====================================================
       CONTRASEÑA
    ===================================================== */

    const claveCorrecta =
      await bcrypt.compare(
        clave,
        areaEncontrada.clave_hash,
      );

    if (!claveCorrecta) {
      throw new InvalidCredentialsError();
    }

    /* =====================================================
       ÚLTIMO ACCESO
    ===================================================== */

    await query(
      `
        UPDATE public.areas
        SET
          ultimo_acceso = NOW()
        WHERE id = $1
      `,
      [
        areaId,
      ],
    );

    /* =====================================================
       JWT

       areaId queda SIEMPRE como number.
    ===================================================== */

    const token =
      jwt.sign(
        {
          areaId,
          area:
            areaEncontrada.nombre,
        },
        env.jwt.secret,
        {
          expiresIn:
            env.jwt
              .expiresInSeconds,
        },
      );

    return {
      token,

      area: {
        id: areaId,

        nombre:
          areaEncontrada.nombre,
      },

      expiresIn:
        env.jwt
          .expiresInSeconds,
    };
  };