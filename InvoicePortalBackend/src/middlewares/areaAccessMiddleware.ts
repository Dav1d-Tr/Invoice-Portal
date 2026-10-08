import type {
  NextFunction,
  Request,
  Response,
} from "express";

import type {
  AuthenticatedRequest,
} from "../types/auth.types";

const normalizeArea = (
  value: string,
): string => {
  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
};

export const requireArea = (
  ...allowedAreas: string[]
) => {
  const allowed =
    new Set(
      allowedAreas.map(
        normalizeArea,
      ),
    );

  return (
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    const auth =
      (
        req as
          AuthenticatedRequest
      ).auth;

    if (!auth) {
      res.status(401).json({
        success: false,

        message:
          "Debes iniciar sesión.",
      });

      return;
    }

    

    next();
  };
};