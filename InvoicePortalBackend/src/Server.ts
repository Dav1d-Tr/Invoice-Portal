import app from "./App";

import {
  env,
} from "./config/env";

import pool from "./config/database";

import {
  ensureDatabaseExists,
  initializeDatabase,
} from "./database/initializeDatabase";

import {
  sincronizarBuzonOutlook,
} from "./services/outlookService";


import {
  startNotificationWorker,
} from "./workers/notificationWorker";


/* =========================================================
   SERVER CONFIG
========================================================= */

const HOST =
  "0.0.0.0";

let syncTimer:
  NodeJS.Timeout |
  null =
  null;

/* =========================================================
   OUTLOOK CONFIGURADO
========================================================= */

const outlookConfigured =
  (): boolean => {
    return Boolean(
      env.outlook
        .tenantId &&

      env.outlook
        .clientId &&

      env.outlook
        .clientSecret &&

      env.outlook
        .mailbox,
    );
  };

/* =========================================================
   EJECUTAR UNA SINCRONIZACION
========================================================= */

const runOutlookSync =
  async (
    full:
      boolean,
  ): Promise<void> => {
    const mode =
      full
        ? "COMPLETA"
        : "INCREMENTAL";

    try {
      console.log(
        "============================================",
      );

      console.log(
        `Iniciando sincronización Outlook ${mode}...`,
      );

      console.log(
        "Buzón:",
        env.outlook.mailbox,
      );

      if (
        full
      ) {
        console.log(
          "Fecha mínima configurada:",
          env.outlook
            .syncFromDate ||
          "No configurada",
        );
      }

      console.log(
        "============================================",
      );

      const result =
        await sincronizarBuzonOutlook(
          full,
        );

      console.log(
        `Sincronización Outlook ${mode} finalizada:`,
        result,
      );
    } catch (
    error
    ) {
      console.error(
        `Error en sincronización Outlook ${mode}:`,
        error,
      );
    }
  };

/* =========================================================
   PROGRAMAR SIGUIENTE SINCRONIZACION

   Se usa setTimeout en vez de setInterval para evitar
   que una sincronización nueva comience mientras la
   anterior todavía está procesando Outlook.
========================================================= */

const scheduleNextSync =
  (): void => {
    const intervalMs =
      env.outlook
        .syncIntervalMinutes *
      60_000;

    syncTimer =
      setTimeout(
        async () => {
          await runOutlookSync(
            false,
          );

          /*
            Cuando termina, programamos la siguiente.
          */

          scheduleNextSync();
        },
        intervalMs,
      );
  };

/* =========================================================
   WORKER OUTLOOK
========================================================= */

const startOutlookWorker =
  (): void => {
    if (
      !outlookConfigured()
    ) {
      console.log(
        "Outlook no está completamente configurado. Sincronización automática deshabilitada.",
      );

      return;
    }

    console.log(
      `Sincronización automática de Outlook cada ${env.outlook.syncIntervalMinutes} minuto(s).`,
    );

    console.log(
      "Buzón Outlook:",
      env.outlook.mailbox,
    );

    console.log(
      "Fecha mínima:",
      env.outlook
        .syncFromDate ||
      "No configurada",
    );

    console.log(
      "Sincronización completa al iniciar:",
      env.outlook
        .fullSyncOnStart
        ? "SÍ"
        : "NO",
    );

    /*
      Primera ejecución unos segundos después del arranque.

      Si OUTLOOK_FULL_SYNC_ON_START=true:
          01/09/2026 -> HOY

      Si es false:
          sincronización incremental.
    */

    syncTimer =
      setTimeout(
        async () => {
          await runOutlookSync(
            env.outlook
              .fullSyncOnStart,
          );

          /*
            Después de completar la primera ejecución,
            todas las siguientes son incrementales.
          */

          scheduleNextSync();
        },
        5_000,
      );
  };

/* =========================================================
   SERVER
========================================================= */

const startServer =
  async () => {
    try {
      /* ===================================================
         BASE DE DATOS
      =================================================== */

      await ensureDatabaseExists();

      await pool.query(
        "SELECT 1",
      );

      console.log(
        "PostgreSQL conectado correctamente.",
      );

      await initializeDatabase();

      /* ===================================================
         INFORMACION OUTLOOK
      =================================================== */

      console.log(
        "====================================",
      );

      console.log(
        "MAILBOX OUTLOOK ACTUAL:",
        env.outlook.mailbox,
      );

      console.log(
        "OUTLOOK DESDE:",
        env.outlook
          .syncFromDate ||
        "No configurado",
      );

      console.log(
        "FULL SYNC AL INICIAR:",
        env.outlook
          .fullSyncOnStart
          ? "SÍ"
          : "NO",
      );

      console.log(
        "====================================",
      );

      /* ===================================================
         EXPRESS
      =================================================== */

      app.listen(
        env.port,
        HOST,
        () => {
          console.log(
            `Invoice Portal ejecutándose en http://localhost:${env.port}`,
          );

          console.log(
            `Health: http://localhost:${env.port}/api/health`,
          );

          console.log(
            `Login: POST http://localhost:${env.port}/api/auth/login`,
          );

          /*
            =====================================================
            WORKER DE NOTIFICACIONES
            =====================================================
      
            Se inicia después de que PostgreSQL ya fue
            inicializado correctamente.
      
            Este worker consulta la cola de notificaciones
            y envía correo / WhatsApp.
          */

          startNotificationWorker();

          /*
            =====================================================
            WORKER DE OUTLOOK
            =====================================================
          */

          startOutlookWorker();
        },
      );
    } catch (
    error
    ) {
      console.error(
        "No se pudo iniciar el servidor:",
        error,
      );

      if (
        syncTimer
      ) {
        clearTimeout(
          syncTimer,
        );
      }

      await pool.end();

      process.exit(
        1,
      );
    }
  };

void startServer();