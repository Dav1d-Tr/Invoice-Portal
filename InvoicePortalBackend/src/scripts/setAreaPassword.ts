import bcrypt from "bcryptjs";

import pool from "../config/database";

import {
  normalizeAreaName,
} from "../utils/normalizeAreaName";

const setAreaPassword =
  async () => {
    const area =
      process.argv[2]?.trim();

    const newPassword =
      process.argv[3];

    if (
      !area ||
      !newPassword
    ) {
      console.error(
        'Uso: npm run area:password -- "COMPRAS" "NuevaClaveSegura"',
      );

      process.exit(1);
    }

    if (
      newPassword.length <
      10
    ) {
      console.error(
        "La contraseña debe tener mínimo 10 caracteres.",
      );

      process.exit(1);
    }

    try {
      const normalized =
        normalizeAreaName(
          area,
        );

      const passwordHash =
        await bcrypt.hash(
          newPassword,
          12,
        );

      const result =
        await pool.query<{
          id: number;
          nombre: string;
        }>(
          `
            UPDATE public.areas

            SET
              clave_hash = $1,
              activo = TRUE

            WHERE
              nombre_normalizado = $2

            RETURNING
              id,
              nombre
          `,
          [
            passwordHash,
            normalized,
          ],
        );

      const updated =
        result.rows[0];

      if (!updated) {
        console.error(
          `No existe el área: ${area}`,
        );

        process.exitCode = 1;

        return;
      }

      console.log("");
      console.log(
        "========================================",
      );

      console.log(
        "Contraseña actualizada correctamente.",
      );

      console.log(
        `Área: ${updated.nombre}`,
      );

      console.log(
        "========================================",
      );
    } catch (error) {
      console.error(
        "Error actualizando contraseña:",
        error,
      );

      process.exitCode = 1;
    } finally {
      await pool.end();
    }
  };

void setAreaPassword();