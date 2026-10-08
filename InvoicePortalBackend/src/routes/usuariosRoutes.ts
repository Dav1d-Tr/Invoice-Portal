import {
  Router,
} from "express";

import {
  actualizarUsuarioController,
  crearUsuarioController,
  eliminarUsuarioController,
  listarUsuariosController,
  reactivarUsuarioController,
} from "../controllers/usuariosController";

import {
  requireAuth,
} from "../middlewares/authMiddleware";

import {
  requireArea,
} from "../middlewares/areaAccessMiddleware";

const router =
  Router();

/* =========================================================
   SOLO SISTEMAS
========================================================= */

router.use(
  requireAuth,
);

router.use(
  requireArea(
    "SISTEMAS",
  ),
);

/* =========================================================
   ENDPOINTS
========================================================= */

router.get(
  "/",
  listarUsuariosController,
);

router.post(
  "/",
  crearUsuarioController,
);

router.put(
  "/:id",
  actualizarUsuarioController,
);

router.delete(
  "/:id",
  eliminarUsuarioController,
);

router.patch(
  "/:id/reactivar",
  reactivarUsuarioController,
);

export default router;