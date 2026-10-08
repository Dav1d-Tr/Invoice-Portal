import {
  claimNextNotification,
  notificationConfigurationSummary,
  processNotification,
} from "../services/notificationService";

const readPositiveInt = (
  value:
    string |
    undefined,
  fallback:
    number,
): number => {
  const parsed =
    Number(value);

  return Number.isInteger(
    parsed,
  ) &&
    parsed > 0
    ? parsed
    : fallback;
};

const POLL_MS =
  readPositiveInt(
    process.env.NOTIFY_WORKER_INTERVAL_MS,
    15_000,
  );

const BATCH_SIZE =
  readPositiveInt(
    process.env.NOTIFY_WORKER_BATCH_SIZE,
    20,
  );

let started =
  false;

let running =
  false;

const runBatch =
  async (): Promise<void> => {
    if (running) {
      return;
    }

    running =
      true;

    try {
      for (
        let index = 0;
        index < BATCH_SIZE;
        index += 1
      ) {
        const id =
          await claimNextNotification();

        if (!id) {
          break;
        }

        try {
          await processNotification(
            id,
          );
        } catch (
          error
        ) {
          console.error(
            `[SGAF Notificaciones] Error procesando notificacion ${id}:`,
            error,
          );
        }
      }
    } catch (
      error
    ) {
      console.error(
        "[SGAF Notificaciones] Error en worker:",
        error,
      );
    } finally {
      running =
        false;
    }
  };

export const startNotificationWorker =
  (): void => {
    if (started) {
      return;
    }

    started =
      true;

    console.log(
      "[SGAF Notificaciones] Worker iniciado.",
    );

    console.log(
      "[SGAF Notificaciones] Configuracion:",
      notificationConfigurationSummary(),
    );

    void runBatch();

    const timer =
      setInterval(
        () => {
          void runBatch();
        },
        POLL_MS,
      );

  };
