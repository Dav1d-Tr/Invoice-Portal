import {
  API_BASE,
} from "../config/api";

import {
  getToken,
} from "./authService";

export interface OutlookInvoiceEmail {
  id: string;

  provider: string;

  subject: string;

  fromName: string;

  fromEmail: string;

  receivedDateTime: string;

  hasAttachments: boolean;

  bodyPreview: string;

  webLink: string;

  internetMessageId: string;

  isRead: boolean;
}

interface OutlookResponse {
  success: boolean;

  message?: string;

  data?: OutlookInvoiceEmail[];

  meta?: {
    count: number;

    suppliers: string[];

    mailbox: string;
  };
}

export const getCommercialOutlookInvoices =
  async (): Promise<
    OutlookInvoiceEmail[]
  > => {
    const token =
      getToken();

    if (!token) {
      throw new Error(
        "Debes iniciar sesión nuevamente.",
      );
    }

    const response =
      await fetch(
        `${API_BASE}/outlook/commercial-invoices`,
        {
          method: "GET",

          headers: {
            Accept:
              "application/json",

            Authorization:
              `Bearer ${token}`,
          },

          cache: "no-store",
        },
      );

    const result =
      (await response.json()) as
        OutlookResponse;

    if (
      !response.ok ||
      !result.success
    ) {
      throw new Error(
        result.message ??
          "No fue posible consultar las facturas de Outlook.",
      );
    }

    return result.data ?? [];
  };