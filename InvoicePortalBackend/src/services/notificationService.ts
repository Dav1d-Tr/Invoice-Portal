import nodemailer from "nodemailer";

import type {
  Transporter,
} from "nodemailer";

import {
  query,
} from "../config/database";

/* =========================================================
   CONFIGURACION
========================================================= */

const readEnv = (
  name: string,
): string =>
  process.env[name]
    ?.trim() ??
  "";

const parseBoolean = (
  value: string,
  fallback: boolean,
): boolean => {
  if (!value) {
    return fallback;
  }

  return [
    "1",
    "true",
    "yes",
    "si",
    "sí",
    "on",
  ].includes(
    value.toLowerCase(),
  );
};

const EMAIL_FROM =
  readEnv(
    "NOTIFY_EMAIL_FROM",
  ) ||
  "digitaldemetalicos@gmail.com";

const EMAIL_FROM_NAME =
  readEnv(
    "NOTIFY_EMAIL_FROM_NAME",
  ) ||
  "SGAF Demetalicos";

const EMAIL_ENABLED =
  parseBoolean(
    readEnv(
      "NOTIFY_EMAIL_ENABLED",
    ),
    true,
  );

const EMAIL_SMTP_HOST =
  readEnv(
    "NOTIFY_EMAIL_SMTP_HOST",
  ) ||
  "smtp.gmail.com";

const EMAIL_SMTP_PORT =
  Number(
    readEnv(
      "NOTIFY_EMAIL_SMTP_PORT",
    ) ||
    "465",
  );

const EMAIL_SMTP_SECURE =
  parseBoolean(
    readEnv(
      "NOTIFY_EMAIL_SMTP_SECURE",
    ),
    true,
  );

const EMAIL_USER =
  readEnv(
    "NOTIFY_EMAIL_USER",
  ) ||
  EMAIL_FROM;

const EMAIL_APP_PASSWORD =
  readEnv(
    "NOTIFY_EMAIL_APP_PASSWORD",
  );

const WHATSAPP_ENABLED =
  parseBoolean(
    readEnv(
      "NOTIFY_WHATSAPP_ENABLED",
    ),
    true,
  );

const WHATSAPP_GRAPH_VERSION =
  readEnv(
    "WHATSAPP_GRAPH_VERSION",
  ) ||
  "v26.0";

const WHATSAPP_PHONE_NUMBER_ID =
  readEnv(
    "WHATSAPP_PHONE_NUMBER_ID",
  );

const WHATSAPP_ACCESS_TOKEN =
  readEnv(
    "WHATSAPP_ACCESS_TOKEN",
  );

const WHATSAPP_TEMPLATE_NAME =
  readEnv(
    "WHATSAPP_TEMPLATE_NAME",
  ) ||
  "sgaf_factura_notificacion";

const WHATSAPP_TEMPLATE_LANGUAGE =
  readEnv(
    "WHATSAPP_TEMPLATE_LANGUAGE",
  ) ||
  "es_CO";

const SGAF_PUBLIC_URL =
  (
    readEnv(
      "SGAF_PUBLIC_URL",
    ) ||
    "http://localhost:5173"
  ).replace(
    /\/+$/,
    "",
  );

/* =========================================================
   TIPOS
========================================================= */

export type NotificationType =
  | "NUEVA_FACTURA"
  | "FACTURA_ASIGNADA"
  | "FACTURA_REMITIDA";

export type NotificationChannel =
  | "EMAIL"
  | "WHATSAPP";

export interface NotificationData {
  idNotificacion: number;
  idFactura: number;
  tipo: NotificationType;
  numeroFactura: string | null;
  proveedor: string;
  nit: string | null;
  valorTotal: string | number | null;
  moneda: string | null;
  estado: string;
  areaDestino: string;
  areaOrigen: string | null;
  fechaEvento: string | Date;
}

interface ClaimedNotificationRow {
  id:
    number | string;
}

interface DeliveryRow {
  id:
    number | string;

  canal:
    NotificationChannel;

  destinatario:
    string;

  intentos:
    number | string;
}

interface NotificationDbRow {
  id_notificacion:
    number | string;

  id_factura:
    number | string;

  tipo:
    NotificationType;

  numero_factura:
    string | null;

  proveedor:
    string;

  nit:
    string | null;

  valor_total:
    string | number | null;

  moneda:
    string | null;

  estado:
    string;

  area_destino:
    string;

  area_origen:
    string | null;

  fecha_evento:
    string | Date;
}

/* =========================================================
   HELPERS
========================================================= */

let transporter:
  Transporter | null =
    null;

const getEmailTransporter =
  (): Transporter => {
    if (
      transporter
    ) {
      return transporter;
    }

    if (
      !EMAIL_USER ||
      !EMAIL_APP_PASSWORD
    ) {
      throw new Error(
        "Correo no configurado. Define NOTIFY_EMAIL_USER y NOTIFY_EMAIL_APP_PASSWORD.",
      );
    }

    transporter =
      nodemailer.createTransport({
        host:
          EMAIL_SMTP_HOST,

        port:
          EMAIL_SMTP_PORT,

        secure:
          EMAIL_SMTP_SECURE,

        auth: {
          user:
            EMAIL_USER,

          pass:
            EMAIL_APP_PASSWORD,
        },
      });

    return transporter;
  };

const escapeHtml = (
  value: string,
): string =>
  value
    .replace(
      /&/g,
      "&amp;",
    )
    .replace(
      /</g,
      "&lt;",
    )
    .replace(
      />/g,
      "&gt;",
    )
    .replace(
      /"/g,
      "&quot;",
    )
    .replace(
      /'/g,
      "&#39;",
    );

const normalizePhone = (
  value: string,
): string =>
  value.replace(
    /\D/g,
    "",
  );

const formatMoney = (
  value:
    string |
    number |
    null,

  currency:
    string | null,
): string => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "No disponible";
  }

  const parsed =
    Number(value);

  if (
    !Number.isFinite(
      parsed,
    )
  ) {
    return `${value} ${currency ?? ""}`.trim();
  }

  try {
    return new Intl.NumberFormat(
      "es-CO",
      {
        style:
          "currency",

        currency:
          currency ||
          "COP",

        maximumFractionDigits:
          currency ===
          "USD"
            ? 2
            : 0,
      },
    ).format(
      parsed,
    );
  } catch {
    return `${parsed.toLocaleString("es-CO")} ${currency ?? ""}`.trim();
  }
};

const typeLabel = (
  type:
    NotificationType,
): string => {
  switch (type) {
    case "NUEVA_FACTURA":
      return "Nueva factura recibida";

    case "FACTURA_ASIGNADA":
      return "Nueva factura asignada";

    case "FACTURA_REMITIDA":
      return "Factura remitida";
  }
};

const invoiceUrl = (
  idFactura: number,
): string =>
  `${SGAF_PUBLIC_URL}/facturas/${idFactura}`;

const mapNotification = (
  row:
    NotificationDbRow,
): NotificationData => ({
  idNotificacion:
    Number(
      row.id_notificacion,
    ),

  idFactura:
    Number(
      row.id_factura,
    ),

  tipo:
    row.tipo,

  numeroFactura:
    row.numero_factura,

  proveedor:
    row.proveedor,

  nit:
    row.nit,

  valorTotal:
    row.valor_total,

  moneda:
    row.moneda,

  estado:
    row.estado,

  areaDestino:
    row.area_destino,

  areaOrigen:
    row.area_origen,

  fechaEvento:
    row.fecha_evento,
});

/* =========================================================
   EMAIL
========================================================= */

const sendEmail =
  async (
    recipients: string[],
    data: NotificationData,
  ): Promise<string | null> => {
    const mailer =
      getEmailTransporter();

    const title =
      typeLabel(
        data.tipo,
      );

    const number =
      data.numeroFactura ||
      `#${data.idFactura}`;

    const amount =
      formatMoney(
        data.valorTotal,
        data.moneda,
      );

    const url =
      invoiceUrl(
        data.idFactura,
      );

    const origin =
      data.areaOrigen ||
      "Outlook";

    const result =
      await mailer.sendMail({
        from: {
          name:
            EMAIL_FROM_NAME,

          address:
            EMAIL_FROM,
        },

        to: recipients,

        subject:
          `[SGAF] ${title} - ${number}`,

        text:
          [
            title,
            "",
            `Factura: ${number}`,
            `Proveedor: ${data.proveedor}`,
            `NIT: ${data.nit ?? "No disponible"}`,
            `Valor: ${amount}`,
            `Area destino: ${data.areaDestino}`,
            `Origen: ${origin}`,
            `Estado: ${data.estado}`,
            "",
            `Abrir SGAF: ${url}`,
          ].join(
            "\n",
          ),

        html: `
          <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#263238">
            <div style="background:#8E1A32;color:#fff;padding:18px 22px;border-radius:14px 14px 0 0">
              <div style="font-size:12px;opacity:.85">SGAF - Demetalicos</div>
              <div style="font-size:22px;font-weight:700;margin-top:5px">${escapeHtml(title)}</div>
            </div>

            <div style="border:1px solid #e2e8f0;border-top:0;padding:22px;border-radius:0 0 14px 14px">
              <p style="margin:0 0 18px">Hay una factura disponible para <strong>${escapeHtml(data.areaDestino)}</strong>.</p>

              <table style="width:100%;border-collapse:collapse;font-size:14px">
                <tr><td style="padding:7px 0;color:#64748b">Factura</td><td style="padding:7px 0;font-weight:700">${escapeHtml(number)}</td></tr>
                <tr><td style="padding:7px 0;color:#64748b">Proveedor</td><td style="padding:7px 0;font-weight:700">${escapeHtml(data.proveedor)}</td></tr>
                <tr><td style="padding:7px 0;color:#64748b">NIT</td><td style="padding:7px 0">${escapeHtml(data.nit ?? "No disponible")}</td></tr>
                <tr><td style="padding:7px 0;color:#64748b">Valor</td><td style="padding:7px 0">${escapeHtml(amount)}</td></tr>
                <tr><td style="padding:7px 0;color:#64748b">Origen</td><td style="padding:7px 0">${escapeHtml(origin)}</td></tr>
                <tr><td style="padding:7px 0;color:#64748b">Estado</td><td style="padding:7px 0">${escapeHtml(data.estado)}</td></tr>
              </table>

              <div style="margin-top:22px">
                <a href="${escapeHtml(url)}" style="display:inline-block;background:#00739B;color:#fff;text-decoration:none;padding:11px 18px;border-radius:10px;font-weight:700">
                  Abrir factura en SGAF
                </a>
              </div>

              <p style="margin:22px 0 0;font-size:11px;color:#94a3b8">
                Notificacion automatica. No responda este mensaje.
              </p>
            </div>
          </div>
        `,
      });

    return result.messageId ??
      null;
  };

/* =========================================================
   WHATSAPP CLOUD API
========================================================= */

const sendWhatsApp =
  async (
    toRaw: string,
    data: NotificationData,
  ): Promise<string | null> => {
    if (
      !WHATSAPP_PHONE_NUMBER_ID ||
      !WHATSAPP_ACCESS_TOKEN
    ) {
      throw new Error(
        "WhatsApp no configurado. Define WHATSAPP_PHONE_NUMBER_ID y WHATSAPP_ACCESS_TOKEN.",
      );
    }

    const to =
      normalizePhone(
        toRaw,
      );

    if (
      !to
    ) {
      throw new Error(
        "Numero WhatsApp destinatario invalido.",
      );
    }

    const number =
      data.numeroFactura ||
      `#${data.idFactura}`;

    const amount =
      formatMoney(
        data.valorTotal,
        data.moneda,
      );

    const origin =
      data.areaOrigen ||
      "Outlook";

    const url =
      invoiceUrl(
        data.idFactura,
      );

    const endpoint =
      `https://graph.facebook.com/${encodeURIComponent(
        WHATSAPP_GRAPH_VERSION,
      )}/${encodeURIComponent(
        WHATSAPP_PHONE_NUMBER_ID,
      )}/messages`;

    const response =
      await fetch(
        endpoint,
        {
          method:
            "POST",

          headers: {
            Authorization:
              `Bearer ${WHATSAPP_ACCESS_TOKEN}`,

            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              messaging_product:
                "whatsapp",

              recipient_type:
                "individual",

              to,

              type:
                "template",

              template: {
                name:
                  WHATSAPP_TEMPLATE_NAME,

                language: {
                  code:
                    WHATSAPP_TEMPLATE_LANGUAGE,
                },

                components: [
                  {
                    type:
                      "body",

                    parameters: [
                      {
                        type:
                          "text",

                        text:
                          typeLabel(
                            data.tipo,
                          ),
                      },
                      {
                        type:
                          "text",

                        text:
                          number,
                      },
                      {
                        type:
                          "text",

                        text:
                          data.proveedor,
                      },
                      {
                        type:
                          "text",

                        text:
                          data.areaDestino,
                      },
                      {
                        type:
                          "text",

                        text:
                          origin,
                      },
                      {
                        type:
                          "text",

                        text:
                          amount,
                      },
                      {
                        type:
                          "text",

                        text:
                          url,
                      },
                    ],
                  },
                ],
              },
            }),
        },
      );

    const result =
      await response.json()
        .catch(
          () => ({}),
        ) as {
          messages?:
            Array<{
              id?: string;
            }>;

          error?: {
            message?: string;
          };
        };

    if (
      !response.ok
    ) {
      throw new Error(
        result.error
          ?.message ??
        `WhatsApp HTTP ${response.status}`,
      );
    }

    return result.messages
      ?.[0]
      ?.id ??
      null;
  };

/* =========================================================
   CLAIM
========================================================= */

export const claimNextNotification =
  async (): Promise<
    number | null
  > => {
    const result =
      await query<
        ClaimedNotificationRow
      >(
        `
          UPDATE public.notificaciones n
          SET
            estado = 'PROCESANDO',
            ultimo_error = NULL
          WHERE n.id =
          (
            SELECT id
            FROM public.notificaciones
            WHERE
              estado IN ('PENDIENTE', 'ERROR', 'PARCIAL')
              AND proximo_intento <= NOW()
            ORDER BY id ASC
            FOR UPDATE SKIP LOCKED
            LIMIT 1
          )
          RETURNING n.id
        `,
      );

    const id =
      Number(
        result.rows[0]
          ?.id,
      );

    return Number.isInteger(
      id,
    )
      ? id
      : null;
  };

/* =========================================================
   DETALLE DE NOTIFICACION
========================================================= */

const getNotificationData =
  async (
    idNotificacion: number,
  ): Promise<NotificationData> => {
    const result =
      await query<
        NotificationDbRow
      >(
        `
          SELECT
            n.id AS id_notificacion,
            f.id AS id_factura,
            n.tipo,
            f.numero_factura,
            COALESCE(f.proveedor_snapshot, 'PROVEEDOR PENDIENTE') AS proveedor,
            f.nit_snapshot AS nit,
            f.valor_total,
            f.moneda,
            ef.codigo AS estado,
            ad.nombre AS area_destino,
            ev.area_origen_snapshot AS area_origen,
            ev.fecha_evento
          FROM public.notificaciones n
          INNER JOIN public.facturas f
            ON f.id = n.id_factura
          INNER JOIN public.factura_eventos ev
            ON ev.id = n.id_evento
          INNER JOIN public.areas ad
            ON ad.id = n.id_area_destino
          INNER JOIN public.estados_factura ef
            ON ef.id = f.id_estado
          WHERE n.id = $1
          LIMIT 1
        `,
        [
          idNotificacion,
        ],
      );

    const row =
      result.rows[0];

    if (!row) {
      throw new Error(
        "Notificacion no encontrada.",
      );
    }

    return mapNotification(
      row,
    );
  };

/* =========================================================
   CREAR DESTINATARIOS
========================================================= */

const ensureDeliveries =
  async (
    idNotificacion: number,
  ): Promise<void> => {
    await query(
      `
        INSERT INTO public.notificacion_envios
        (
          id_notificacion,
          canal,
          destinatario,
          estado
        )
        SELECT
          n.id,
          'EMAIL',
          LOWER(BTRIM(ac.correo)),
          'PENDIENTE'
        FROM public.notificaciones n
        INNER JOIN public.area_correos ac
          ON ac.id_area = n.id_area_destino
        WHERE
          n.id = $1
          AND ac.activo = TRUE
          AND BTRIM(ac.correo) <> ''
        ON CONFLICT (id_notificacion, canal, destinatario)
        DO NOTHING
      `,
      [
        idNotificacion,
      ],
    );

    await query(
      `
        INSERT INTO public.notificacion_envios
        (
          id_notificacion,
          canal,
          destinatario,
          estado
        )
        SELECT
          n.id,
          'WHATSAPP',
          BTRIM(cel.celular),
          'PENDIENTE'
        FROM public.notificaciones n
        INNER JOIN public.area_celulares cel
          ON cel.id_area = n.id_area_destino
        WHERE
          n.id = $1
          AND cel.activo = TRUE
          AND BTRIM(cel.celular) <> ''
        ON CONFLICT (id_notificacion, canal, destinatario)
        DO NOTHING
      `,
      [
        idNotificacion,
      ],
    );
  };

const getPendingDeliveries =
  async (
    idNotificacion: number,
  ): Promise<DeliveryRow[]> => {
    const result =
      await query<
        DeliveryRow
      >(
        `
          SELECT
            id,
            canal,
            destinatario,
            intentos
          FROM public.notificacion_envios
          WHERE
            id_notificacion = $1
            AND estado IN ('PENDIENTE', 'ERROR')
            AND intentos < 5
          ORDER BY id ASC
        `,
        [
          idNotificacion,
        ],
      );

    return result.rows;
  };

const markDeliveries =
  async (
    ids: number[],
    state:
      "ENVIADA" |
      "ERROR" |
      "OMITIDA",
    error:
      string | null,
    providerMessageId:
      string | null,
  ): Promise<void> => {
    if (
      ids.length ===
      0
    ) {
      return;
    }

    await query(
      `
        UPDATE public.notificacion_envios
        SET
          estado = $2::varchar(30),
          intentos = intentos + 1,
          ultimo_error = $3::text,
          proveedor_mensaje_id = COALESCE($4::text, proveedor_mensaje_id),
          fecha_envio = CASE
            WHEN $2::varchar(30) = 'ENVIADA' THEN NOW()
            ELSE fecha_envio
          END
        WHERE id = ANY($1::bigint[])
      `,
      [
        ids,
        state,
        error,
        providerMessageId,
      ],
    );
  };

const markDelivery =
  async (
    idDelivery: number,
    state:
      "ENVIADA" |
      "ERROR" |
      "OMITIDA",
    error:
      string | null,
    providerMessageId:
      string | null,
  ): Promise<void> => {
    await markDeliveries(
      [
        idDelivery,
      ],
      state,
      error,
      providerMessageId,
    );
  };

const finalizeNotification =
  async (
    idNotificacion: number,
  ): Promise<void> => {
    const result =
      await query<{
        total:
          number | string;

        sent:
          number | string;

        pending:
          number | string;

        error:
          number | string;

        omitted:
          number | string;
      }>(
        `
          SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE estado = 'ENVIADA') AS sent,
            COUNT(*) FILTER (WHERE estado IN ('PENDIENTE', 'ENVIANDO')) AS pending,
            COUNT(*) FILTER (WHERE estado = 'ERROR' AND intentos < 5) AS error,
            COUNT(*) FILTER (WHERE estado = 'OMITIDA' OR (estado = 'ERROR' AND intentos >= 5)) AS omitted
          FROM public.notificacion_envios
          WHERE id_notificacion = $1
        `,
        [
          idNotificacion,
        ],
      );

    const row =
      result.rows[0];

    const total =
      Number(
        row?.total ??
        0,
      );

    const sent =
      Number(
        row?.sent ??
        0,
      );

    const pending =
      Number(
        row?.pending ??
        0,
      );

    const error =
      Number(
        row?.error ??
        0,
      );

    if (
      total === 0 ||
      (
        sent === 0 &&
        pending === 0 &&
        error === 0
      )
    ) {
      await query(
        `
          UPDATE public.notificaciones
          SET
            estado = 'SIN_DESTINATARIOS',
            fecha_completada = NOW(),
            ultimo_error = CASE
              WHEN $2 = 0
                THEN 'El area no tiene correos ni celulares activos.'
              ELSE 'No hay canales habilitados/configurados para los destinatarios.'
            END
          WHERE id = $1
        `,
        [
          idNotificacion,
          total,
        ],
      );

      return;
    }

    if (
      pending > 0 ||
      error > 0
    ) {
      await query(
        `
          UPDATE public.notificaciones
          SET
            estado = CASE
              WHEN $2 > 0 THEN 'PARCIAL'
              ELSE 'ERROR'
            END,
            proximo_intento = NOW() + INTERVAL '2 minutes'
          WHERE id = $1
        `,
        [
          idNotificacion,
          sent,
        ],
      );

      return;
    }

    await query(
      `
        UPDATE public.notificaciones
        SET
          estado = 'ENVIADA',
          fecha_completada = NOW(),
          ultimo_error = NULL
        WHERE id = $1
      `,
      [
        idNotificacion,
      ],
    );
  };

/* =========================================================
   PROCESAR UNA NOTIFICACION
========================================================= */

export const processNotification =
  async (
    idNotificacion: number,
  ): Promise<void> => {
    try {
      const data =
        await getNotificationData(
          idNotificacion,
        );

      await ensureDeliveries(
        idNotificacion,
      );

      const deliveries =
        await getPendingDeliveries(
          idNotificacion,
        );

      /*
        EMAIL se procesa EN GRUPO.

        Si un area tiene dos o mas correos activos, SGAF realiza
        una sola llamada SMTP con todos los destinatarios.
        De esta forma cada bandeja recibe una copia del mismo
        mensaje, pero la factura genera un unico envio de correo.
      */

      const emailDeliveries =
        deliveries.filter(
          (delivery) =>
            delivery.canal ===
            "EMAIL",
        );

      if (
        emailDeliveries.length >
        0
      ) {
        const emailIds =
          emailDeliveries.map(
            (delivery) =>
              Number(
                delivery.id,
              ),
          );

        const recipients =
          Array.from(
            new Set(
              emailDeliveries
                .map(
                  (delivery) =>
                    delivery
                      .destinatario
                      .trim()
                      .toLowerCase(),
                )
                .filter(Boolean),
            ),
          );

        if (
          !EMAIL_ENABLED
        ) {
          await markDeliveries(
            emailIds,
            "OMITIDA",
            "Canal EMAIL deshabilitado.",
            null,
          );
        } else if (
          !EMAIL_APP_PASSWORD
        ) {
          await markDeliveries(
            emailIds,
            "OMITIDA",
            "Falta NOTIFY_EMAIL_APP_PASSWORD.",
            null,
          );
        } else if (
          recipients.length ===
          0
        ) {
          await markDeliveries(
            emailIds,
            "OMITIDA",
            "No hay correos validos para enviar.",
            null,
          );
        } else {
          try {
            const messageId =
              await sendEmail(
                recipients,
                data,
              );

            await markDeliveries(
              emailIds,
              "ENVIADA",
              null,
              messageId,
            );

            console.log(
              `[SGAF Notificaciones] Email enviado una sola vez a ${recipients.length} destinatario(s): ${recipients.join(", ")}`,
            );
          } catch (
            error
          ) {
            await markDeliveries(
              emailIds,
              "ERROR",
              error instanceof
              Error
                ? error.message
                : String(error),
              null,
            );
          }
        }
      }

      /*
        WhatsApp sigue siendo individual porque Meta requiere
        un envio por numero destinatario.
      */

      const whatsappDeliveries =
        deliveries.filter(
          (delivery) =>
            delivery.canal ===
            "WHATSAPP",
        );

      for (
        const delivery
        of whatsappDeliveries
      ) {
        const idDelivery =
          Number(
            delivery.id,
          );

        try {
          if (
            !WHATSAPP_ENABLED
          ) {
            await markDelivery(
              idDelivery,
              "OMITIDA",
              "Canal WHATSAPP deshabilitado.",
              null,
            );

            continue;
          }

          if (
            !WHATSAPP_PHONE_NUMBER_ID ||
            !WHATSAPP_ACCESS_TOKEN
          ) {
            await markDelivery(
              idDelivery,
              "OMITIDA",
              "Falta configurar WHATSAPP_PHONE_NUMBER_ID/WHATSAPP_ACCESS_TOKEN.",
              null,
            );

            continue;
          }

          const messageId =
            await sendWhatsApp(
              delivery.destinatario,
              data,
            );

          await markDelivery(
            idDelivery,
            "ENVIADA",
            null,
            messageId,
          );
        } catch (
          error
        ) {
          await markDelivery(
            idDelivery,
            "ERROR",
            error instanceof
            Error
              ? error.message
              : String(error),
            null,
          );
        }
      }

      await finalizeNotification(
        idNotificacion,
      );
    } catch (
      error
    ) {
      await query(
        `
          UPDATE public.notificaciones
          SET
            estado = 'ERROR',
            ultimo_error = $2::text,
            proximo_intento = NOW() + INTERVAL '2 minutes'
          WHERE id = $1
        `,
        [
          idNotificacion,
          error instanceof
          Error
            ? error.message
            : String(error),
        ],
      );

      throw error;
    }
  };

/* =========================================================
   VALIDACION DE CONFIGURACION
========================================================= */

export const notificationConfigurationSummary =
  () => ({
    email: {
      enabled:
        EMAIL_ENABLED,

      from:
        EMAIL_FROM,

      smtpHost:
        EMAIL_SMTP_HOST,

      configured:
        Boolean(
          EMAIL_USER &&
          EMAIL_APP_PASSWORD,
        ),
    },

    whatsapp: {
      enabled:
        WHATSAPP_ENABLED,

      graphVersion:
        WHATSAPP_GRAPH_VERSION,

      template:
        WHATSAPP_TEMPLATE_NAME,

      configured:
        Boolean(
          WHATSAPP_PHONE_NUMBER_ID &&
          WHATSAPP_ACCESS_TOKEN,
        ),
    },

    sgafPublicUrl:
      SGAF_PUBLIC_URL,
  });
