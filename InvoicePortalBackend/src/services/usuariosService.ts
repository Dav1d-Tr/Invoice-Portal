import bcrypt from "bcryptjs";

import type {
  QueryResultRow,
} from "pg";

import {
  query,
} from "../config/database";

import {
  normalizeAreaName,
} from "../utils/normalizeAreaName";

/* =========================================================
   TIPOS CONTACTOS
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
  esPrincipal?: boolean;
}

export interface AreaCelularInput {
  celular: string;
  esPrincipal?: boolean;
}

/* =========================================================
   USUARIO / AREA
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
    string | null;

  activo: boolean;

  correos:
    AreaCorreoInput[];

  celulares:
    AreaCelularInput[];
}

/* =========================================================
   DB ROWS
========================================================= */

interface UsuarioDbRow
  extends QueryResultRow {
  id:
    number | string;

  nombre:
    string;

  activo:
    boolean;

  ultimo_acceso:
    string |
    Date |
    null;

  fecha_creacion:
    string |
    Date;

  fecha_actualizacion:
    string |
    Date;

  correos:
    unknown;

  celulares:
    unknown;
}

interface IdRow
  extends QueryResultRow {
  id:
    number | string;
}

interface CorreoJson {
  id:
    number | string;

  correo:
    string;

  esPrincipal:
    boolean;
}

interface CelularJson {
  id:
    number | string;

  celular:
    string;

  esPrincipal:
    boolean;
}

/* =========================================================
   ERROR
========================================================= */

export class UsuarioAdminError
  extends Error {
  statusCode:
    number;

  constructor(
    message:
      string,

    statusCode =
      400,
  ) {
    super(
      message,
    );

    this.name =
      "UsuarioAdminError";

    this.statusCode =
      statusCode;
  }
}

/* =========================================================
   SELECT BASE
========================================================= */

const usuarioSelect = `
  SELECT
    a.id,

    a.nombre,

    a.activo,

    a.ultimo_acceso,

    a.fecha_creacion,

    a.fecha_actualizacion,

    COALESCE(
      (
        SELECT
          jsonb_agg(
            jsonb_build_object(
              'id',
              c.id,

              'correo',
              c.correo,

              'esPrincipal',
              c.es_principal
            )

            ORDER BY
              c.es_principal DESC,
              c.id ASC
          )

        FROM
          public.area_correos c

        WHERE
          c.id_area = a.id

          AND c.activo = TRUE
      ),

      '[]'::jsonb
    ) AS correos,

    COALESCE(
      (
        SELECT
          jsonb_agg(
            jsonb_build_object(
              'id',
              t.id,

              'celular',
              t.celular,

              'esPrincipal',
              t.es_principal
            )

            ORDER BY
              t.es_principal DESC,
              t.id ASC
          )

        FROM
          public.area_celulares t

        WHERE
          t.id_area = a.id

          AND t.activo = TRUE
      ),

      '[]'::jsonb
    ) AS celulares

  FROM
    public.areas a
`;

/* =========================================================
   FECHA
========================================================= */

const dateToString = (
  value:
    string |
    Date |
    null,
): string | null => {
  if (
    value ===
    null
  ) {
    return null;
  }

  if (
    value instanceof
    Date
  ) {
    return value.toISOString();
  }

  return String(
    value,
  );
};

/* =========================================================
   JSON ARRAY
========================================================= */

const parseArray = <T>(
  value:
    unknown,
): T[] => {
  if (
    Array.isArray(
      value,
    )
  ) {
    return value as T[];
  }

  if (
    typeof value ===
    "string"
  ) {
    try {
      const parsed =
        JSON.parse(
          value,
        );

      if (
        Array.isArray(
          parsed,
        )
      ) {
        return parsed as T[];
      }
    } catch {
      return [];
    }
  }

  return [];
};

/* =========================================================
   MAP USUARIO
========================================================= */

const mapUsuario = (
  row:
    UsuarioDbRow,
): UsuarioPortal => {
  const correos =
    parseArray<CorreoJson>(
      row.correos,
    ).map(
      (
        item,
      ) => ({
        id:
          Number(
            item.id,
          ),

        correo:
          item.correo,

        esPrincipal:
          Boolean(
            item.esPrincipal,
          ),
      }),
    );

  const celulares =
    parseArray<CelularJson>(
      row.celulares,
    ).map(
      (
        item,
      ) => ({
        id:
          Number(
            item.id,
          ),

        celular:
          item.celular,

        esPrincipal:
          Boolean(
            item.esPrincipal,
          ),
      }),
    );

  return {
    id:
      Number(
        row.id,
      ),

    nombre:
      row.nombre,

    activo:
      Boolean(
        row.activo,
      ),

    ultimoAcceso:
      dateToString(
        row.ultimo_acceso,
      ),

    fechaCreacion:
      dateToString(
        row.fecha_creacion,
      ) ?? "",

    fechaActualizacion:
      dateToString(
        row.fecha_actualizacion,
      ) ?? "",

    correos,

    celulares,
  };
};

/* =========================================================
   NOMBRE VISIBLE
========================================================= */

const cleanAreaName = (
  value:
    string,
): string => {
  return value
    .trim()
    .replace(
      /\s+/g,
      " ",
    )
    .toUpperCase();
};

/* =========================================================
   CORREOS
========================================================= */

const normalizeEmail = (
  value:
    string,
): string => {
  return value
    .trim()
    .toLowerCase();
};

const prepareCorreos = (
  values:
    AreaCorreoInput[],
): AreaCorreoInput[] => {
  if (
    !Array.isArray(
      values,
    )
  ) {
    throw new UsuarioAdminError(
      "La lista de correos no es válida.",
    );
  }

  if (
    values.length >
    20
  ) {
    throw new UsuarioAdminError(
      "Un área puede tener máximo 20 correos.",
    );
  }

  const result =
    new Map<
      string,
      AreaCorreoInput
    >();

  for (
    const item
    of values
  ) {
    if (
      !item ||
      typeof item.correo !==
        "string"
    ) {
      throw new UsuarioAdminError(
        "Existe un correo inválido.",
      );
    }

    const correo =
      normalizeEmail(
        item.correo,
      );

    if (!correo) {
      continue;
    }

    if (
      correo.length >
      320
    ) {
      throw new UsuarioAdminError(
        `El correo "${correo}" es demasiado largo.`,
      );
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        correo,
      )
    ) {
      throw new UsuarioAdminError(
        `El correo "${correo}" no es válido.`,
      );
    }

    const previous =
      result.get(
        correo,
      );

    result.set(
      correo,
      {
        correo,

        esPrincipal:
          Boolean(
            previous
              ?.esPrincipal ||
            item.esPrincipal,
          ),
      },
    );
  }

  const correos =
    Array.from(
      result.values(),
    );

  const principales =
    correos.filter(
      (
        item,
      ) =>
        item.esPrincipal,
    );

  if (
    principales.length >
    1
  ) {
    throw new UsuarioAdminError(
      "Solo puede existir un correo principal.",
    );
  }

  if (
    correos.length >
      0 &&
    principales.length ===
      0
  ) {
    correos[0] = {
      ...correos[0],

      esPrincipal:
        true,
    };
  }

  return correos;
};

/* =========================================================
   CELULARES
========================================================= */

const normalizePhone = (
  value:
    string,
): string => {
  return value
    .trim()
    .replace(
      /[\s().-]/g,
      "",
    );
};

const prepareCelulares = (
  values:
    AreaCelularInput[],
): AreaCelularInput[] => {
  if (
    !Array.isArray(
      values,
    )
  ) {
    throw new UsuarioAdminError(
      "La lista de celulares no es válida.",
    );
  }

  if (
    values.length >
    20
  ) {
    throw new UsuarioAdminError(
      "Un área puede tener máximo 20 celulares.",
    );
  }

  const result =
    new Map<
      string,
      AreaCelularInput
    >();

  for (
    const item
    of values
  ) {
    if (
      !item ||
      typeof item.celular !==
        "string"
    ) {
      throw new UsuarioAdminError(
        "Existe un celular inválido.",
      );
    }

    const celular =
      normalizePhone(
        item.celular,
      );

    if (!celular) {
      continue;
    }

    if (
      !/^\+?[0-9]{7,15}$/.test(
        celular,
      )
    ) {
      throw new UsuarioAdminError(
        `El celular "${celular}" no es válido.`,
      );
    }

    const previous =
      result.get(
        celular,
      );

    result.set(
      celular,
      {
        celular,

        esPrincipal:
          Boolean(
            previous
              ?.esPrincipal ||
            item.esPrincipal,
          ),
      },
    );
  }

  const celulares =
    Array.from(
      result.values(),
    );

  const principales =
    celulares.filter(
      (
        item,
      ) =>
        item.esPrincipal,
    );

  if (
    principales.length >
    1
  ) {
    throw new UsuarioAdminError(
      "Solo puede existir un celular principal.",
    );
  }

  if (
    celulares.length >
      0 &&
    principales.length ===
      0
  ) {
    celulares[0] = {
      ...celulares[0],

      esPrincipal:
        true,
    };
  }

  return celulares;
};

/* =========================================================
   REEMPLAZAR CORREOS

   No borra físicamente.

   - Desactiva anteriores.
   - Reactiva los que continúan.
   - Crea los nuevos.
========================================================= */

const replaceCorreos =
  async (
    idArea:
      number,

    correos:
      AreaCorreoInput[],
  ): Promise<void> => {
    /*
      Primero retiramos principal para evitar
      conflictos con el índice único parcial.
    */

    await query(
      `
        UPDATE
          public.area_correos

        SET
          activo = FALSE,

          es_principal = FALSE

        WHERE
          id_area = $1
      `,
      [
        idArea,
      ],
    );

    /*
      Reactivar / crear todos SIN principal.
    */

    for (
      const item
      of correos
    ) {
      await query(
        `
          INSERT INTO
            public.area_correos
          (
            id_area,

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

          ON CONFLICT
          (
            id_area,
            (
              LOWER(
                BTRIM(correo)
              )
            )
          )

          DO UPDATE

          SET
            correo =
              EXCLUDED.correo,

            activo =
              TRUE,

            es_principal =
              FALSE
        `,
        [
          idArea,

          item.correo,
        ],
      );
    }

    /*
      Finalmente marcamos principal.
    */

    const principal =
      correos.find(
        (
          item,
        ) =>
          item.esPrincipal,
      );

    if (
      principal
    ) {
      await query(
        `
          UPDATE
            public.area_correos

          SET
            es_principal =
              TRUE

          WHERE
            id_area =
              $1

            AND LOWER(
                  BTRIM(correo)
                ) =
                LOWER(
                  BTRIM($2)
                )

            AND activo =
                TRUE
        `,
        [
          idArea,

          principal.correo,
        ],
      );
    }
  };

/* =========================================================
   REEMPLAZAR CELULARES
========================================================= */

const replaceCelulares =
  async (
    idArea:
      number,

    celulares:
      AreaCelularInput[],
  ): Promise<void> => {
    await query(
      `
        UPDATE
          public.area_celulares

        SET
          activo = FALSE,

          es_principal = FALSE

        WHERE
          id_area = $1
      `,
      [
        idArea,
      ],
    );

    for (
      const item
      of celulares
    ) {
      await query(
        `
          INSERT INTO
            public.area_celulares
          (
            id_area,

            celular,

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

          ON CONFLICT
          (
            id_area,
            (
              BTRIM(celular)
            )
          )

          DO UPDATE

          SET
            celular =
              EXCLUDED.celular,

            activo =
              TRUE,

            es_principal =
              FALSE
        `,
        [
          idArea,

          item.celular,
        ],
      );
    }

    const principal =
      celulares.find(
        (
          item,
        ) =>
          item.esPrincipal,
      );

    if (
      principal
    ) {
      await query(
        `
          UPDATE
            public.area_celulares

          SET
            es_principal =
              TRUE

          WHERE
            id_area =
              $1

            AND BTRIM(celular) =
                BTRIM($2)

            AND activo =
                TRUE
        `,
        [
          idArea,

          principal.celular,
        ],
      );
    }
  };

/* =========================================================
   CONTACTOS
========================================================= */

const replaceContactos =
  async (
    idArea:
      number,

    correos:
      AreaCorreoInput[],

    celulares:
      AreaCelularInput[],
  ): Promise<void> => {
    await replaceCorreos(
      idArea,
      correos,
    );

    await replaceCelulares(
      idArea,
      celulares,
    );
  };

/* =========================================================
   ERROR POSTGRESQL
========================================================= */

const handleDbError = (
  error:
    unknown,
): never => {
  if (
    error instanceof
    UsuarioAdminError
  ) {
    throw error;
  }

  const pgError =
    error as {
      code?:
        string;

      constraint?:
        string;

      message?:
        string;

      detail?:
        string;

      table?:
        string;

      column?:
        string;
    };

  if (
    pgError.code ===
    "23505"
  ) {
    const constraint =
      pgError.constraint
        ?.toLowerCase() ??
      "";

    if (
      constraint.includes(
        "correo",
      )
    ) {
      throw new UsuarioAdminError(
        "Existe un correo duplicado para esta área.",
        409,
      );
    }

    if (
      constraint.includes(
        "celular",
      )
    ) {
      throw new UsuarioAdminError(
        "Existe un celular duplicado para esta área.",
        409,
      );
    }

    throw new UsuarioAdminError(
      "Ya existe un área con ese nombre.",
      409,
    );
  }

  if (
    pgError.code ===
    "23502"
  ) {
    throw new UsuarioAdminError(
      pgError.column
        ? `El campo obligatorio "${pgError.column}" no puede estar vacío.`
        : "Falta un campo obligatorio.",
      400,
    );
  }

  if (
    pgError.code ===
    "23514"
  ) {
    throw new UsuarioAdminError(
      "Uno de los datos no cumple las validaciones de la base de datos.",
      400,
    );
  }

  if (
    pgError.code ===
    "42P01"
  ) {
    throw new UsuarioAdminError(
      `Falta una tabla requerida en PostgreSQL. ${pgError.message ?? ""}`,
      500,
    );
  }

  throw error;
};

/* =========================================================
   OBTENER UNO
========================================================= */

export const getUsuarioById =
  async (
    id:
      number,
  ): Promise<UsuarioPortal> => {
    const result =
      await query<UsuarioDbRow>(
        `
          ${usuarioSelect}

          WHERE
            a.id = $1

          LIMIT 1
        `,
        [
          id,
        ],
      );

    const row =
      result.rows[0];

    if (!row) {
      throw new UsuarioAdminError(
        "Usuario no encontrado.",
        404,
      );
    }

    return mapUsuario(
      row,
    );
  };

/* =========================================================
   LISTAR
========================================================= */

export const getUsuarios =
  async (): Promise<
    UsuarioPortal[]
  > => {
    const result =
      await query<UsuarioDbRow>(
        `
          ${usuarioSelect}

          ORDER BY
            a.activo DESC,
            a.nombre ASC
        `,
      );

    return result.rows.map(
      mapUsuario,
    );
  };

/* =========================================================
   CREAR

   YA NO USA:
   fn_admin_area_crear
========================================================= */

export const crearUsuario =
  async (
    input:
      CrearUsuarioInput,
  ): Promise<UsuarioPortal> => {
    const nombre =
      cleanAreaName(
        input.nombre,
      );

    if (!nombre) {
      throw new UsuarioAdminError(
        "El nombre del área es obligatorio.",
      );
    }

    if (
      nombre.length >
      100
    ) {
      throw new UsuarioAdminError(
        "El nombre del área no puede superar 100 caracteres.",
      );
    }

    const nombreNormalizado =
      normalizeAreaName(
        nombre,
      );

    if (
      typeof input.clave !==
        "string" ||
      input.clave.length <
        8
    ) {
      throw new UsuarioAdminError(
        "La contraseña debe tener mínimo 8 caracteres.",
      );
    }

    const correos =
      prepareCorreos(
        input.correos ??
          [],
      );

    const celulares =
      prepareCelulares(
        input.celulares ??
          [],
      );

    const claveHash =
      await bcrypt.hash(
        input.clave,
        12,
      );

    let idCreado:
      number | null =
        null;

    try {
      /*
        CORRECCION DEL ERROR:

        nombre_normalizado se escribe
        explícitamente.
      */

      const result =
        await query<IdRow>(
          `
            INSERT INTO
              public.areas
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

            RETURNING
              id
          `,
          [
            nombre,

            nombreNormalizado,

            claveHash,
          ],
        );

      const id =
        Number(
          result.rows[0]
            ?.id,
        );

      if (
        !Number.isInteger(
          id,
        ) ||
        id <= 0
      ) {
        throw new Error(
          "PostgreSQL no devolvió el ID del área creada.",
        );
      }

      idCreado =
        id;

      await replaceContactos(
        id,

        correos,

        celulares,
      );

      return await getUsuarioById(
        id,
      );
    } catch (
      error
    ) {
      /*
        Si el área se alcanzó a crear
        pero fallaron los contactos,
        intentamos limpiar ese registro
        recién creado.
      */

      if (
        idCreado
      ) {
        try {
          await query(
            `
              DELETE FROM
                public.area_correos

              WHERE
                id_area = $1
            `,
            [
              idCreado,
            ],
          );
        } catch {
          // Ignorar limpieza secundaria.
        }

        try {
          await query(
            `
              DELETE FROM
                public.area_celulares

              WHERE
                id_area = $1
            `,
            [
              idCreado,
            ],
          );
        } catch {
          // Ignorar limpieza secundaria.
        }

        try {
          await query(
            `
              DELETE FROM
                public.areas

              WHERE
                id = $1
            `,
            [
              idCreado,
            ],
          );
        } catch {
          // Ignorar limpieza secundaria.
        }
      }

      return handleDbError(
        error,
      );
    }
  };

/* =========================================================
   ACTUALIZAR

   YA NO USA:
   fn_admin_area_actualizar
========================================================= */

export const actualizarUsuario =
  async (
    id:
      number,

    input:
      ActualizarUsuarioInput,
  ): Promise<UsuarioPortal> => {
    const actual =
      await getUsuarioById(
        id,
      );

    const nombre =
      cleanAreaName(
        input.nombre,
      );

    if (!nombre) {
      throw new UsuarioAdminError(
        "El nombre del área es obligatorio.",
      );
    }

    const nombreNormalizado =
      normalizeAreaName(
        nombre,
      );

    /* =====================================================
       PROTEGER SISTEMAS
    ===================================================== */

    if (
      normalizeAreaName(
        actual.nombre,
      ) ===
        "SISTEMAS" &&
      nombreNormalizado !==
        "SISTEMAS"
    ) {
      throw new UsuarioAdminError(
        "La cuenta SISTEMAS no puede cambiar de nombre.",
      );
    }

    if (
      normalizeAreaName(
        actual.nombre,
      ) ===
        "SISTEMAS" &&
      !input.activo
    ) {
      throw new UsuarioAdminError(
        "La cuenta SISTEMAS no puede desactivarse.",
      );
    }

    /* =====================================================
       PASSWORD
    ===================================================== */

    let claveHash:
      string | null =
        null;

    if (
      input.clave
    ) {
      if (
        input.clave.length <
        8
      ) {
        throw new UsuarioAdminError(
          "La nueva contraseña debe tener mínimo 8 caracteres.",
        );
      }

      claveHash =
        await bcrypt.hash(
          input.clave,
          12,
        );
    }

    const correos =
      prepareCorreos(
        input.correos ??
          [],
      );

    const celulares =
      prepareCelulares(
        input.celulares ??
          [],
      );

    try {
      /*
        COALESCE permite mantener
        la contraseña actual cuando
        claveHash es NULL.
      */

      const result =
        await query(
          `
            UPDATE
              public.areas

            SET
              nombre =
                $1,

              nombre_normalizado =
                $2,

              activo =
                $3,

              clave_hash =
                COALESCE(
                  $4::text,
                  clave_hash
                )

            WHERE
              id = $5

            RETURNING
              id
          `,
          [
            nombre,

            nombreNormalizado,

            Boolean(
              input.activo,
            ),

            claveHash,

            id,
          ],
        );

      if (
        result.rowCount ===
        0
      ) {
        throw new UsuarioAdminError(
          "Usuario no encontrado.",
          404,
        );
      }

      await replaceContactos(
        id,

        correos,

        celulares,
      );

      return await getUsuarioById(
        id,
      );
    } catch (
      error
    ) {
      return handleDbError(
        error,
      );
    }
  };

/* =========================================================
   DESACTIVAR
========================================================= */

export const eliminarUsuario =
  async (
    id:
      number,
  ): Promise<void> => {
    const actual =
      await getUsuarioById(
        id,
      );

    if (
      normalizeAreaName(
        actual.nombre,
      ) ===
      "SISTEMAS"
    ) {
      throw new UsuarioAdminError(
        "La cuenta SISTEMAS no puede desactivarse.",
      );
    }

    const result =
      await query(
        `
          UPDATE
            public.areas

          SET
            activo =
              FALSE

          WHERE
            id = $1

          RETURNING
            id
        `,
        [
          id,
        ],
      );

    if (
      result.rowCount ===
      0
    ) {
      throw new UsuarioAdminError(
        "Usuario no encontrado.",
        404,
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
  ): Promise<UsuarioPortal> => {
    const result =
      await query(
        `
          UPDATE
            public.areas

          SET
            activo =
              TRUE

          WHERE
            id = $1

          RETURNING
            id
        `,
        [
          id,
        ],
      );

    if (
      result.rowCount ===
      0
    ) {
      throw new UsuarioAdminError(
        "Usuario no encontrado.",
        404,
      );
    }

    return await getUsuarioById(
      id,
    );
  };