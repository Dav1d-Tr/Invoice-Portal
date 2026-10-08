import type {
  ErrorRequestHandler,
} from "express";

export const errorHandler:
  ErrorRequestHandler = (
    error,
    _req,
    res,
    _next,
  ) => {
    console.error(
      "Error no controlado:",
      error,
    );

    res.status(500).json({
      success: false,

      message:
        "Ha ocurrido un error interno en el servidor.",
    });
  };