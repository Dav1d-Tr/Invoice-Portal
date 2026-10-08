import {
  Router,
} from "express";

import {
  actualizarProveedorController,
  agregarCorreoController,
  crearProveedorController,
  eliminarProveedorController,
  listarProveedoresController,
} from "../controllers/proveedoresController";

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

router.use(
  requireArea(
    "SISTEMAS",
  ),
);

router.get(
  "/",
  listarProveedoresController,
);

router.post(
  "/",
  crearProveedorController,
);

router.put(
  "/:id",
  actualizarProveedorController,
);

router.delete(
  "/:id",
  eliminarProveedorController,
);

router.post(
  "/:id/correos",
  agregarCorreoController,
);

export default router;