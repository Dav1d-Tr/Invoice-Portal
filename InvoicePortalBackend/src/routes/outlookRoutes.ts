import {
  Router,
} from "express";

import {
  sincronizarBuzonController,
  sincronizarProveedorController,
} from "../controllers/outlookController";

import {
  requireAuth,
} from "../middlewares/authMiddleware";

import {
  requireArea,
} from "../middlewares/areaAccessMiddleware";

const router =
  Router();

router.use(
  requireAuth,
);

/*
  La sincronización manual se mantiene para SISTEMAS.
  La sincronización automática se ejecuta desde Server.ts.
*/

router.post(
  "/sincronizar",
  requireArea(
    "SISTEMAS",
  ),
  sincronizarBuzonController,
);

router.post(
  "/proveedores/:idProveedor/sincronizar",
  requireArea(
    "SISTEMAS",
  ),
  sincronizarProveedorController,
);

/*
  Alias de compatibilidad.
*/

router.post(
  "/sincronizar/:idProveedor",
  requireArea(
    "SISTEMAS",
  ),
  sincronizarProveedorController,
);

export default router;
