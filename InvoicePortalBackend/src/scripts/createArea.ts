import bcrypt from "bcryptjs";
import type { QueryResultRow } from "pg";

import pool from "../config/database";

interface AreaIdRow extends QueryResultRow {
  id: number;
  nombre: string;
}

const createArea = async () => {
  const nombre = process.argv[2]?.trim();
  const clave = process.argv[3];

  /* =========================================================
     VALIDACIONES
  ========================================================= */

  if (!nombre || !clave) {
    console.error(
      'Uso correcto: npm run area:create -- "Compras" "ClaveSegura"',
    );

    process.exit(1);
  }

  if (nombre.length > 100) {
    console.error(
      "El nombre del área no puede superar 100 caracteres.",
    );

    process.exit(1);
  }

  if (clave.length < 8) {
    console.error(
      "La contraseña debe tener mínimo 8 caracteres.",
    );

    process.exit(1);
  }

  try {
    /* =======================================================
       VERIFICAR SI EL ÁREA YA EXISTE
    ======================================================= */

    const existing =
      await pool.query<AreaIdRow>(
        `
          SELECT
            id,
            nombre
          FROM public.areas
          WHERE
            LOWER(BTRIM(nombre))
            =
            LOWER(BTRIM($1))
          LIMIT 1
        `,
        [nombre],
      );

    /* =======================================================
       GENERAR HASH DE LA CONTRASEÑA
    ======================================================= */

    const claveHash = await bcrypt.hash(
      clave,
      12,
    );

    const areaExistente =
      existing.rows[0];

    /* =======================================================
       SI EXISTE: ACTUALIZAR CONTRASEÑA
    ======================================================= */

    if (areaExistente) {
      await pool.query(
        `
          UPDATE public.areas
          SET
            clave_hash = $1,
            activo = TRUE
          WHERE id = $2
        `,
        [
          claveHash,
          areaExistente.id,
        ],
      );

      console.log("");
      console.log(
        "==========================================",
      );

      console.log(
        `Clave actualizada para: ${areaExistente.nombre}`,
      );

      console.log(
        "==========================================",
      );

      return;
    }

    /* =======================================================
       SI NO EXISTE: CREAR ÁREA
    ======================================================= */

    const result =
      await pool.query<AreaIdRow>(
        `
          INSERT INTO public.areas
          (
            nombre,
            clave_hash,
            activo
          )
          VALUES
          (
            $1,
            $2,
            TRUE
          )
          RETURNING
            id,
            nombre
        `,
        [
          nombre,
          claveHash,
        ],
      );

    const nuevaArea =
      result.rows[0];

    console.log("");
    console.log(
      "==========================================",
    );

    console.log(
      "Área creada correctamente",
    );

    console.log(
      `ID: ${nuevaArea?.id}`,
    );

    console.log(
      `Área: ${nuevaArea?.nombre}`,
    );

    console.log(
      "==========================================",
    );
  } catch (error) {
    console.error(
      "Error creando el área:",
      error,
    );

    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

void createArea();