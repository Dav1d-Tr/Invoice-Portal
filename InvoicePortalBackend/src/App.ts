import express from "express";
import cors from "cors";
import helmet from "helmet";

import {
  env,
} from "./config/env";

import authRoutes from "./routes/authRoutes";
import facturasRoutes from "./routes/facturasRoutes";
import outlookRoutes from "./routes/outlookRoutes";
import proveedoresRoutes from "./routes/proveedoresRoutes";
import usuariosRoutes from "./routes/usuariosRoutes";

import historialRoutes from "./routes/historialRoutes";

const app =
  express();

app.disable(
  "x-powered-by",
);

app.use(
  helmet(),
);

app.use(
  cors({
    origin:
      env.frontendOrigins,

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],

    exposedHeaders: [
      "Content-Disposition",
      "Content-Type",
    ],
  }),
);

app.use(
  express.json({
    limit:
      "1mb",
  }),
);

app.use(
  express.urlencoded({
    extended:
      true,

    limit:
      "1mb",
  }),
);

/* HEALTH */

app.get(
  "/api/health",
  (_req, res) => {
    res.json({
      success:
        true,

      message:
        "SGAF Backend funcionando correctamente.",
    });
  },
);

/* AUTH */

app.use(
  "/api/auth",
  authRoutes,
);

/* PROVEEDORES */

app.use(
  "/api/proveedores",
  proveedoresRoutes,
);

/* FACTURAS */

app.use(
  "/api/facturas",
  facturasRoutes,
);

/* OUTLOOK */

app.use(
  "/api/outlook",
  outlookRoutes,
);

/* USUARIOS */

app.use(
  "/api/usuarios",
  usuariosRoutes,
);

app.use(
  "/api/historial",
  historialRoutes,
);

/* 404 */

app.use(
  (_req, res) => {
    res.status(
      404,
    ).json({
      success:
        false,

      message:
        "Ruta no encontrada.",
    });
  },
);

export default app;