import type {
  PoolClient,
  QueryResultRow,
} from "pg";

import pool, {
  query,
} from "../config/database";

/* =========================================================
   TIPOS
========================================================= */

export interface CrearProveedorInput {
  nombre: string;

  nit?:
    string | null;

  idArea: number;

  correos?:
    string[];
}

export interface ActualizarProveedorInput {
  nombre: string;

  nit?:
    string | null;

  idArea: number;

  correos?:
    string[];
}

export interface ProveedorCreado {
  id: number;

  nombre: string;

  nit:
    string | null;

  idArea: number;
}

interface IdRow
  extends QueryResultRow {
  id:
    number | string;
}

interface CorreoExistenteRow
  extends QueryResultRow {
  id:
    number | string;

  id_proveedor:
    number | string;
}

export class ProveedorError
  extends Error {
  statusCode: number;

  constructor(
    message: string,
    statusCode = 400,
  ) {
    super(message);

    this.name =
      "ProveedorError";

    this.statusCode =
      statusCode;
  }
}

/* =========================================================
   HELPERS
========================================================= */

const normalizeEmail = (
  value: string,
): string => {
  return value
    .trim()
    .toLowerCase();
};

const normalizeNit = (
  value?:
    string | null,
): string | null => {
  const clean =
    value?.trim() ??
    "";

  return clean ||
    null;
};

const isValidEmail = (
  value: string,
): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value,
  );
};

const prepareEmails = (
  values:
    string[] = [],
): string[] => {
  const emails =
    Array.from(
      new Set(
        values
          .map(
            normalizeEmail,
          )
          .filter(
            Boolean,
          ),
      ),
    );

  const invalid =
    emails.find(
      (email) =>
        !isValidEmail(
          email,
        ),
    );

  if (invalid) {
    throw new ProveedorError(
      `El correo "${invalid}" no es válido.`,
    );
  }

  return emails;
};

/* =========================================================
   VALIDAR ÁREA
========================================================= */

const validateArea =
  async (
    client:
      PoolClient,

    idArea:
      number,
  ) => {
    const result =
      await client.query(
        `
          SELECT id

          FROM public.areas

          WHERE
            id = $1
            AND activo = TRUE

          LIMIT 1
        `,
        [
          idArea,
        ],
      );

    if (!result.rows[0]) {
      throw new ProveedorError(
        "El área no existe o está inactiva.",
      );
    }
  };

/* =========================================================
   SINCRONIZAR CORREOS EN DB

   ARRAY VACÍO = PROVEEDOR SIN CORREOS.
========================================================= */

const replaceProviderEmails =
  async (
    client:
      PoolClient,

    idProveedor:
      number,

    emails:
      string[],
  ) => {
    /*
      Desactivamos todos los actuales.
      Luego reactivamos / insertamos
      los enviados por el formulario.
    */

    await client.query(
      `
        UPDATE
          public.proveedor_correos

        SET
          activo = FALSE,
          es_principal = FALSE

        WHERE
          id_proveedor = $1
      `,
      [
        idProveedor,
      ],
    );

    for (
      let index = 0;
      index <
      emails.length;
      index += 1
    ) {
      const email =
        emails[index];

      const existing =
        await client.query<
          CorreoExistenteRow
        >(
          `
            SELECT
              id,
              id_proveedor

            FROM
              public.proveedor_correos

            WHERE
              LOWER(
                BTRIM(correo)
              ) = $1

            LIMIT 1
          `,
          [
            email,
          ],
        );

      const row =
        existing.rows[0];

      if (
        row &&
        Number(
          row.id_proveedor,
        ) !==
          idProveedor
      ) {
        throw new ProveedorError(
          `El correo ${email} ya pertenece a otro proveedor.`,
          409,
        );
      }

      if (row) {
        await client.query(
          `
            UPDATE
              public.proveedor_correos

            SET
              correo = $1,
              activo = TRUE,
              es_principal = $2

            WHERE
              id = $3
          `,
          [
            email,

            index === 0,

            Number(
              row.id,
            ),
          ],
        );
      } else {
        await client.query(
          `
            INSERT INTO
              public.proveedor_correos
            (
              id_proveedor,
              correo,
              es_principal,
              activo
            )

            VALUES
            (
              $1,
              $2,
              $3,
              TRUE
            )
          `,
          [
            idProveedor,

            email,

            index === 0,
          ],
        );
      }
    }
  };

/* =========================================================
   LISTAR ACTIVOS
========================================================= */

export const getProveedores =
  async () => {
    const result =
      await query(
        `
          SELECT

            p.id,

            p.nombre,

            p.nit,

            p.id_area
              AS "idArea",

            a.nombre
              AS area,

            p.activo,

            p.fecha_creacion
              AS "fechaCreacion",

            p.fecha_actualizacion
              AS "fechaActualizacion",

            COALESCE
            (
              JSONB_AGG
              (
                JSONB_BUILD_OBJECT
                (
                  'id',
                  pc.id,

                  'correo',
                  pc.correo,

                  'esPrincipal',
                  pc.es_principal,

                  'activo',
                  pc.activo
                )

                ORDER BY
                  pc.es_principal DESC,
                  pc.correo ASC
              )

              FILTER
              (
                WHERE
                  pc.id IS NOT NULL
                  AND pc.activo = TRUE
              ),

              '[]'::JSONB
            )
              AS correos

          FROM
            public.proveedores p

          INNER JOIN
            public.areas a

            ON a.id =
               p.id_area

          LEFT JOIN
            public.proveedor_correos pc

            ON pc.id_proveedor =
               p.id

          WHERE
            p.activo = TRUE

          GROUP BY
            p.id,
            p.nombre,
            p.nit,
            p.id_area,
            a.nombre,
            p.activo,
            p.fecha_creacion,
            p.fecha_actualizacion

          ORDER BY
            p.nombre ASC
        `,
      );

    return result.rows;
  };

/* =========================================================
   CREAR
========================================================= */

export const crearProveedor =
  async (
    input:
      CrearProveedorInput,
  ): Promise<
    ProveedorCreado
  > => {
    const nombre =
      input.nombre
        .trim();

    if (!nombre) {
      throw new ProveedorError(
        "El nombre es obligatorio.",
      );
    }

    if (
      !Number.isInteger(
        input.idArea,
      ) ||
      input.idArea <= 0
    ) {
      throw new ProveedorError(
        "Área inválida.",
      );
    }

    const emails =
      prepareEmails(
        input.correos ??
          [],
      );

    const client =
      await pool.connect();

    try {
      await client.query(
        "BEGIN",
      );

      await validateArea(
        client,
        input.idArea,
      );

      const result =
        await client.query<IdRow>(
          `
            INSERT INTO
              public.proveedores
            (
              nombre,
              nit,
              id_area,
              activo
            )

            VALUES
            (
              $1,
              $2,
              $3,
              TRUE
            )

            RETURNING id
          `,
          [
            nombre,

            normalizeNit(
              input.nit,
            ),

            input.idArea,
          ],
        );

      const id =
        Number(
          result.rows[0]
            ?.id,
        );

      if (
        !Number.isInteger(id)
      ) {
        throw new Error(
          "No se obtuvo el ID del proveedor.",
        );
      }

      await replaceProviderEmails(
        client,
        id,
        emails,
      );

      await client.query(
        "COMMIT",
      );

      return {
        id,

        nombre,

        nit:
          normalizeNit(
            input.nit,
          ),

        idArea:
          input.idArea,
      };
    } catch (error) {
      await client.query(
        "ROLLBACK",
      );

      if (
        error instanceof
        ProveedorError
      ) {
        throw error;
      }

      const pgError =
        error as {
          code?: string;
        };

      if (
        pgError.code ===
        "23505"
      ) {
        throw new ProveedorError(
          "Ya existe un proveedor con esos datos.",
          409,
        );
      }

      throw error;
    } finally {
      client.release();
    }
  };

/* =========================================================
   ACTUALIZAR
========================================================= */

export const actualizarProveedor =
  async (
    idProveedor:
      number,

    input:
      ActualizarProveedorInput,
  ): Promise<
    ProveedorCreado
  > => {
    const nombre =
      input.nombre.trim();

    const emails =
      prepareEmails(
        input.correos ??
          [],
      );

    const client =
      await pool.connect();

    try {
      await client.query(
        "BEGIN",
      );

      await validateArea(
        client,
        input.idArea,
      );

      const result =
        await client.query(
          `
            UPDATE
              public.proveedores

            SET
              nombre = $1,
              nit = $2,
              id_area = $3

            WHERE
              id = $4
              AND activo = TRUE

            RETURNING id
          `,
          [
            nombre,

            normalizeNit(
              input.nit,
            ),

            input.idArea,

            idProveedor,
          ],
        );

      if (!result.rows[0]) {
        throw new ProveedorError(
          "Proveedor no encontrado.",
          404,
        );
      }

      await replaceProviderEmails(
        client,
        idProveedor,
        emails,
      );

      await client.query(
        "COMMIT",
      );

      return {
        id:
          idProveedor,

        nombre,

        nit:
          normalizeNit(
            input.nit,
          ),

        idArea:
          input.idArea,
      };
    } catch (error) {
      await client.query(
        "ROLLBACK",
      );

      if (
        error instanceof
        ProveedorError
      ) {
        throw error;
      }

      throw error;
    } finally {
      client.release();
    }
  };

/* =========================================================
   ELIMINAR = DESACTIVAR

   NO BORRAMOS FÍSICAMENTE PORQUE EXISTE HISTORIAL.
========================================================= */

export const eliminarProveedor =
  async (
    idProveedor:
      number,
  ): Promise<void> => {
    const client =
      await pool.connect();

    try {
      await client.query(
        "BEGIN",
      );

      const result =
        await client.query(
          `
            UPDATE
              public.proveedores

            SET
              activo = FALSE

            WHERE
              id = $1
              AND activo = TRUE

            RETURNING id
          `,
          [
            idProveedor,
          ],
        );

      if (!result.rows[0]) {
        throw new ProveedorError(
          "Proveedor no encontrado.",
          404,
        );
      }

      await client.query(
        `
          UPDATE
            public.proveedor_correos

          SET
            activo = FALSE,
            es_principal = FALSE

          WHERE
            id_proveedor = $1
        `,
        [
          idProveedor,
        ],
      );

      await client.query(
        "COMMIT",
      );
    } catch (error) {
      await client.query(
        "ROLLBACK",
      );

      throw error;
    } finally {
      client.release();
    }
  };

/* =========================================================
   AGREGAR UN CORREO
========================================================= */

export const agregarCorreoProveedor =
  async (
    idProveedor:
      number,

    correo:
      string,
  ) => {
    const email =
      normalizeEmail(
        correo,
      );

    if (
      !isValidEmail(
        email,
      )
    ) {
      throw new ProveedorError(
        "Correo inválido.",
      );
    }

    const result =
      await query<IdRow>(
        `
          INSERT INTO
            public.proveedor_correos
          (
            id_proveedor,
            correo,
            es_principal,
            activo
          )

          VALUES
          (
            $1,
            $2,
            FALSE,
            TRUE
          )

          RETURNING id
        `,
        [
          idProveedor,
          email,
        ],
      );

    return {
      id:
        Number(
          result.rows[0]?.id,
        ),

      idProveedor,

      correo:
        email,
    };
  };