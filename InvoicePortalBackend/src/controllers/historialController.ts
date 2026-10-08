import type {
  Request,
  Response,
} from "express";

import type {
  AuthenticatedRequest,
} from "../types/auth.types";

import {
  getHistorialProcesadasArea,
  getHistorialRemisionesArea,
  getResumenArea,
} from "../services/historialService";

const getAuth = (
  req:
    Request,
) => {
  return (
    req as AuthenticatedRequest
  ).auth;
};

const handleError = (
  error:
    unknown,

  res:
    Response,

  fallback:
    string,
): void => {
  console.error(
    fallback,
    error,
  );

  res.status(
    500,
  ).json({
    success:
      false,

    message:
      error instanceof Error
        ? error.message
        : fallback,
  });
};

export const resumenAreaController =
  async (
    req:
      Request,

    res:
      Response,
  ): Promise<void> => {
    const auth =
      getAuth(
        req,
      );

    if (!auth) {
      res.status(401).json({
        success: false,
        message: "Sesión no válida.",
      });
      return;
    }

    try {
      const data =
        await getResumenArea(
          auth.areaId,
        );

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      handleError(
        error,
        res,
        "No fue posible consultar el resumen global del área.",
      );
    }
  };

export const historialRemisionesController =
  async (
    req:
      Request,

    res:
      Response,
  ): Promise<void> => {
    const auth =
      getAuth(
        req,
      );

    if (!auth) {
      res.status(401).json({
        success: false,
        message: "Sesión no válida.",
      });
      return;
    }

    try {
      const data =
        await getHistorialRemisionesArea(
          auth.areaId,
        );

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      handleError(
        error,
        res,
        "No fue posible consultar el historial de remisiones.",
      );
    }
  };

export const historialProcesadasController =
  async (
    req:
      Request,

    res:
      Response,
  ): Promise<void> => {
    const auth =
      getAuth(
        req,
      );

    if (!auth) {
      res.status(401).json({
        success: false,
        message: "Sesión no válida.",
      });
      return;
    }

    try {
      const data =
        await getHistorialProcesadasArea(
          auth.areaId,
        );

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      handleError(
        error,
        res,
        "No fue posible consultar el historial de facturas procesadas.",
      );
    }
  };
