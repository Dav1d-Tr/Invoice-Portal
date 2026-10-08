import dotenv from "dotenv";

dotenv.config();

/* =========================================================
   HELPERS
========================================================= */

const requiredEnv = (
  name: string,
  value: string | undefined,
): string => {
  if (!value?.trim()) {
    throw new Error(
      `Variable de entorno requerida: ${name}`,
    );
  }

  return value.trim();
};

const booleanEnv = (
  value: string | undefined,
  defaultValue = false,
): boolean => {
  if (!value?.trim()) {
    return defaultValue;
  }

  const normalized =
    value
      .trim()
      .toLowerCase();

  return [
    "true",
    "1",
    "yes",
    "si",
    "sí",
    "on",
  ].includes(
    normalized,
  );
};

/* =========================================================
   JWT
========================================================= */

const jwtSecret =
  requiredEnv(
    "JWT_SECRET",
    process.env.JWT_SECRET,
  );

/* =========================================================
   ENV
========================================================= */

export const env = {
  port:
    Number(
      process.env.PORT ??
      3000,
    ),

  /* =======================================================
     POSTGRESQL
  ======================================================= */

  postgres: {
    host:
      process.env.DB_HOST ??
      "localhost",

    port:
      Number(
        process.env.DB_PORT ??
        5432,
      ),

    database:
      process.env.DB_NAME ??
      "Facturas_SGAF",

    user:
      process.env.DB_USER ??
      "postgres",

    password:
      requiredEnv(
        "DB_PASSWORD",
        process.env.DB_PASSWORD,
      ),
  },

  /* =======================================================
     JWT
  ======================================================= */

  jwt: {
    secret:
      jwtSecret,

    expiresInSeconds:
      Number(
        process.env
          .JWT_EXPIRES_SECONDS ??
        28800,
      ),
  },

  /* =======================================================
     FRONTEND
  ======================================================= */

  frontendOrigins:
    (
      process.env
        .FRONTEND_ORIGINS ??
      "http://localhost:5173"
    )
      .split(",")
      .map(
        (
          origin,
        ) =>
          origin.trim(),
      )
      .filter(
        Boolean,
      ),

  /* =======================================================
     AREAS
  ======================================================= */

  initialAreaPassword:
    process.env
      .INITIAL_AREA_PASSWORD ??
    "",

  /* =======================================================
     OUTLOOK
  ======================================================= */

  outlook: {
    tenantId:
      process.env
        .OUTLOOK_TENANT_ID
        ?.trim() ??
      "",

    clientId:
      process.env
        .OUTLOOK_CLIENT_ID
        ?.trim() ??
      "",

    clientSecret:
      process.env
        .OUTLOOK_CLIENT_SECRET
        ?.trim() ??
      "",

    mailbox:
      process.env
        .OUTLOOK_MAILBOX
        ?.trim() ??
      "",

    /*
      Fecha mínima oficial desde la cual SGAF
      debe consultar correos.
    */

    syncFromDate:
      process.env
        .OUTLOOK_SYNC_FROM_DATE
        ?.trim() ??
      "",

    /*
      Cada cuántos minutos consultar novedades.
    */

    syncIntervalMinutes:
      Math.max(
        1,
        Number(
          process.env
            .OUTLOOK_SYNC_INTERVAL_MINUTES ??
          5,
        ) ||
          5,
      ),

    /*
      true:
      Al arrancar el servidor se hace una recuperación
      COMPLETA desde OUTLOOK_SYNC_FROM_DATE.

      false:
      El arranque usa solamente la sincronización reciente.
    */

    fullSyncOnStart:
      booleanEnv(
        process.env
          .OUTLOOK_FULL_SYNC_ON_START,
        false,
      ),
  },
};