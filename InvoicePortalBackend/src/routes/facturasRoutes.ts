import {
  Router,
} from "express";

import {
  aprobarController,
  areasFacturasController,
  asignarProveedorController,
  descargarAdjuntoFacturaController,
  detalleFacturaController,
  detalleOutlookFacturaController,
  historialController,
  listarFacturasController,
  procesarController,
  proveedoresFacturasController,
  reactivarController,
  rechazadasController,
  rechazarController,
  remitirContabilidadController,
  remitirController,
  remitidasController,
} from "../controllers/facturasController";

import {
  requireAuth,
} from "../middlewares/authMiddleware";

import {
  requireArea,
} from "../middlewares/areaAccessMiddleware";

const router =
  Router();

/* =========================================================
   TODAS REQUIEREN JWT
========================================================= */

router.use(
  requireAuth,
);

/* =========================================================
   RUTAS FIJAS
   Siempre antes de /:id
========================================================= */

/* =========================================================
   REMITIDAS

   Disponible para TODAS las areas.
   Solo contiene trabajo activo remitido realmente al area.
========================================================= */

router.get(
  "/panel/remitidas",
  remitidasController,
);

/* =========================================================
   RECHAZADAS

   - Cada area ve sus rechazos actuales.
   - SISTEMAS ve todas las rechazadas.
========================================================= */

router.get(
  "/panel/rechazadas",
  rechazadasController,
);

/* =========================================================
   CATALOGO AREAS
========================================================= */

router.get(
  "/catalogos/areas",
  areasFacturasController,
);

/* =========================================================
   CATALOGO PROVEEDORES
========================================================= */

router.get(
  "/catalogos/proveedores",
  proveedoresFacturasController,
);

/* =========================================================
   FACTURAS DEL AREA
========================================================= */

router.get(
  "/",
  listarFacturasController,
);

/* =========================================================
   CORREO COMPLETO DESDE OUTLOOK
========================================================= */

router.get(
  "/:id/correo-outlook",
  detalleOutlookFacturaController,
);

/* =========================================================
   DESCARGAR / VER ADJUNTO
========================================================= */

router.get(
  "/:id/adjuntos/:attachmentId/download",
  descargarAdjuntoFacturaController,
);

/* =========================================================
   HISTORIAL
========================================================= */

router.get(
  "/:id/historial",
  historialController,
);

/* =========================================================
   ASIGNAR / REGISTRAR PROVEEDOR

   RECEPCION clasifica hacia el area responsable.
   Esa clasificacion NO crea una remision.
========================================================= */

router.post(
  "/:id/asignar-proveedor",
  asignarProveedorController,
);

/* =========================================================
   APROBAR
========================================================= */

router.post(
  "/:id/aprobar",
  aprobarController,
);

/* =========================================================
   RECHAZAR
========================================================= */

router.post(
  "/:id/rechazar",
  rechazarController,
);

/* =========================================================
   REACTIVAR

   Solo SISTEMAS.
   RECHAZADA -> PENDIENTE.
========================================================= */

router.post(
  "/:id/reactivar",
  requireArea(
    "SISTEMAS",
  ),
  reactivarController,
);

/* =========================================================
   REMITIR A OTRA AREA

   NO se usa para Contabilidad.
========================================================= */

router.post(
  "/:id/remitir",
  remitirController,
);

/* =========================================================
   REMITIR A CONTABILIDAD

   Usado por otras areas cuando la factura ya esta APROBADA.
========================================================= */

router.post(
  "/:id/remitir-contabilidad",
  remitirContabilidadController,
);

/* =========================================================
   PROCESAR

   Solo CONTABILIDAD.
   La funcion PostgreSQL valida que la factura:
   - este actualmente en CONTABILIDAD;
   - tenga estado APROBADA.

   NO exige una remision previa.
========================================================= */

router.post(
  "/:id/procesar",
  requireArea(
    "CONTABILIDAD",
  ),
  procesarController,
);

/* =========================================================
   DETALLE

   Siempre al final.
========================================================= */

router.get(
  "/:id",
  detalleFacturaController,
);

export default router;
