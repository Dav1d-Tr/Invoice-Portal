import type {
  Request,
  Response,
} from "express";

import {
  sincronizarBuzonOutlook,
  sincronizarProveedorOutlook,
} from "../services/outlookService";

const getPositiveId = (
  value:
    string |
    string[] |
    undefined,
): number | null => {
  const raw =
    typeof value ===
    "string"
      ? value
      : Array.isArray(
          value,
        )
        ? value[0]
        : undefined;

  const id =
    Number(
      raw,
    );

  return Number.isInteger(
    id,
  ) &&
    id > 0
    ? id
    : null;
};

/* =========================================================
   SINCRONIZAR BUZON COMPLETO
========================================================= */

export const sincronizarBuzonController =
  async (
    req:
      Request,

    res:
      Response,
  ): Promise<void> => {
    try {
      const full =
        req.body
          ?.full ===
        true;

      const data =
        await sincronizarBuzonOutlook(
          full,
        );

      res.status(
        200,
      ).json({
        success:
          true,

        message:
          `Sincronización completada. ${data.facturasCreadas} factura(s) nueva(s), ${data.enviadasRecepcion} enviada(s) a RECEPCIÓN.`,

        data,
      });
    } catch (
      error
    ) {
      console.error(
        "Error sincronizando Outlook:",
        error,
      );

      res.status(
        500,
      ).json({
        success:
          false,

        message:
          error instanceof
          Error
            ? error.message
            : "No fue posible sincronizar Outlook.",
      });
    }
  };

/* =========================================================
   COMPATIBILIDAD POR PROVEEDOR
========================================================= */

export const sincronizarProveedorController =
  async (
    req:
      Request,

    res:
      Response,
  ): Promise<void> => {
    const idProveedor =
      getPositiveId(
        req.params
          .idProveedor,
      );

    if (!idProveedor) {
      res.status(
        400,
      ).json({
        success:
          false,

        message:
          "Proveedor inválido.",
      });

      return;
    }

    try {
      const data =
        await sincronizarProveedorOutlook(
          idProveedor,
        );

      res.status(
        200,
      ).json({
        success:
          true,

        message:
          "Proveedor sincronizado con Outlook.",

        data,
      });
    } catch (
      error
    ) {
      console.error(
        "Error sincronizando proveedor:",
        error,
      );

      res.status(
        500,
      ).json({
        success:
          false,

        message:
          error instanceof
          Error
            ? error.message
            : "No fue posible sincronizar Outlook.",
      });
    }
  };
