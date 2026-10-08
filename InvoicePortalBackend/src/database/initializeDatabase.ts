import {
  Client,
  type QueryResultRow,
} from "pg";

import bcrypt from "bcryptjs";

import pool from "../config/database";
import { env } from "../config/env";

import {
  normalizeAreaName,
} from "../utils/normalizeAreaName";

/* =========================================================
   ÁREAS INICIALES
========================================================= */

const INITIAL_AREAS = [
  "COMPRAS",
  "COMERCIAL",
  "MANTENIMIENTO",
  "GESTION HUMANA",
  "INSTALACION - PROYECTOS",
  "MONTACARGAS",
  "SISTEMAS",
  "TESORERIA",
  "TRANSPORTE",
  "CONTABILIDAD",
  "DESPACHOS",
] as const;

interface ExistingAreaRow
  extends QueryResultRow {
  id: number;
  nombre: string;
  nombre_normalizado: string | null;
}

/* =========================================================
   ESCAPAR NOMBRE DE BASE
========================================================= */

const quoteIdentifier = (
  value: string,
): string => {
  return `"${value.replace(/"/g, '""')}"`;
};

/* =========================================================
   CREAR BASE DE DATOS SI NO EXISTE
========================================================= */

export const ensureDatabaseExists =
  async (): Promise<void> => {
    const adminClient = new Client({
      host: env.postgres.host,
      port: env.postgres.port,
      database: "postgres",
      user: env.postgres.user,
      password: env.postgres.password,
    });

    try {
      await adminClient.connect();

      const result =
        await adminClient.query<{
          exists: boolean;
        }>(
          `
            SELECT EXISTS (
              SELECT 1
              FROM pg_database
              WHERE datname = $1
            ) AS exists
          `,
          [
            env.postgres.database,
          ],
        );

      const exists =
        result.rows[0]?.exists ??
        false;

      if (exists) {
        console.log(
          `Base de datos "${env.postgres.database}" encontrada.`,
        );

        return;
      }

      console.log(
        `Creando base de datos "${env.postgres.database}"...`,
      );

      const databaseName =
        quoteIdentifier(
          env.postgres.database,
        );

      await adminClient.query(
        `
          CREATE DATABASE ${databaseName}
          WITH
          OWNER = ${quoteIdentifier(
            env.postgres.user,
          )}
          ENCODING = 'UTF8'
        `,
      );

      console.log(
        `Base de datos "${env.postgres.database}" creada correctamente.`,
      );
    } finally {
      await adminClient.end();
    }
  };

/* =========================================================
   CREAR TABLA DE ÁREAS
========================================================= */

const createAreasTable =
  async (): Promise<void> => {
    await pool.query(
      `
        CREATE TABLE IF NOT EXISTS public.areas
        (
          id SERIAL PRIMARY KEY,

          nombre VARCHAR(100) NOT NULL,

          nombre_normalizado VARCHAR(120),

          clave_hash VARCHAR(255) NOT NULL,

          activo BOOLEAN NOT NULL DEFAULT TRUE,

          ultimo_acceso TIMESTAMPTZ,

          fecha_creacion TIMESTAMPTZ
            NOT NULL
            DEFAULT NOW(),

          fecha_actualizacion TIMESTAMPTZ
            NOT NULL
            DEFAULT NOW()
        )
      `,
    );

    /*
      Esto permite que el código también funcione
      si alcanzaste a crear la tabla con la versión
      anterior que no tenía nombre_normalizado.
    */

    await pool.query(
      `
        ALTER TABLE public.areas
        ADD COLUMN IF NOT EXISTS
          nombre_normalizado VARCHAR(120)
      `,
    );

    console.log(
      "Tabla public.areas verificada.",
    );
  };

/* =========================================================
   NORMALIZAR ÁREAS EXISTENTES
========================================================= */

const normalizeExistingAreas =
  async (): Promise<void> => {
    const result =
      await pool.query<ExistingAreaRow>(
        `
          SELECT
            id,
            nombre,
            nombre_normalizado
          FROM public.areas
          ORDER BY id
        `,
      );

    for (const area of result.rows) {
      const normalized =
        normalizeAreaName(
          area.nombre,
        );

      if (
        area.nombre_normalizado !==
        normalized
      ) {
        await pool.query(
          `
            UPDATE public.areas
            SET nombre_normalizado = $1
            WHERE id = $2
          `,
          [
            normalized,
            area.id,
          ],
        );
      }
    }

    await pool.query(
      `
        ALTER TABLE public.areas
        ALTER COLUMN nombre_normalizado
        SET NOT NULL
      `,
    );

    await pool.query(
      `
        CREATE UNIQUE INDEX
        IF NOT EXISTS
          ux_areas_nombre_normalizado
        ON public.areas (
          nombre_normalizado
        )
      `,
    );
  };

/* =========================================================
   TRIGGER FECHA ACTUALIZACIÓN
========================================================= */

const createUpdateTrigger =
  async (): Promise<void> => {
    await pool.query(
      `
        CREATE OR REPLACE FUNCTION
          public.actualizar_fecha_modificacion()
        RETURNS TRIGGER
        LANGUAGE plpgsql
        AS
        $$
        BEGIN
          NEW.fecha_actualizacion =
            NOW();

          RETURN NEW;
        END;
        $$
      `,
    );

    await pool.query(
      `
        DROP TRIGGER IF EXISTS
          trg_areas_fecha_actualizacion
        ON public.areas
      `,
    );

    await pool.query(
      `
        CREATE TRIGGER
          trg_areas_fecha_actualizacion
        BEFORE UPDATE
        ON public.areas
        FOR EACH ROW
        EXECUTE FUNCTION
          public.actualizar_fecha_modificacion()
      `,
    );
  };

/* =========================================================
   INSERTAR ÁREAS FALTANTES
========================================================= */

const seedAreas =
  async (): Promise<void> => {
    const existing =
      await pool.query<ExistingAreaRow>(
        `
          SELECT
            id,
            nombre,
            nombre_normalizado
          FROM public.areas
        `,
      );

    const existingNames =
      new Set(
        existing.rows.map(
          (area) =>
            area.nombre_normalizado,
        ),
      );

    const missingAreas =
      INITIAL_AREAS.filter(
        (area) =>
          !existingNames.has(
            normalizeAreaName(
              area,
            ),
          ),
      );

    if (
      missingAreas.length === 0
    ) {
      console.log(
        "Todas las áreas iniciales ya existen.",
      );

      return;
    }

    const initialPassword =
      env.initialAreaPassword;

    if (
      !initialPassword ||
      initialPassword.length < 10
    ) {
      throw new Error(
        "Existen áreas por crear, pero INITIAL_AREA_PASSWORD no está configurada o tiene menos de 10 caracteres.",
      );
    }

    console.log(
      `Registrando ${missingAreas.length} área(s) inicial(es)...`,
    );

    for (
      const areaName
      of missingAreas
    ) {
      const passwordHash =
        await bcrypt.hash(
          initialPassword,
          12,
        );

      const normalized =
        normalizeAreaName(
          areaName,
        );

      await pool.query(
        `
          INSERT INTO public.areas
          (
            nombre,
            nombre_normalizado,
            clave_hash,
            activo
          )
          VALUES
          (
            $1,
            $2,
            $3,
            TRUE
          )
          ON CONFLICT DO NOTHING
        `,
        [
          areaName,
          normalized,
          passwordHash,
        ],
      );

      console.log(
        `Área registrada: ${areaName}`,
      );
    }
  };

/* =========================================================
   INICIALIZACIÓN COMPLETA
========================================================= */

export const initializeDatabase =
  async (): Promise<void> => {
    console.log("");
    console.log(
      "============================================",
    );

    console.log(
      "Inicializando Invoice Portal...",
    );

    console.log(
      "============================================",
    );

    await createAreasTable();

    await normalizeExistingAreas();

    await createUpdateTrigger();

    await seedAreas();

    console.log(
      "Base de datos inicializada correctamente.",
    );

    console.log(
      "============================================",
    );

    console.log("");
  };