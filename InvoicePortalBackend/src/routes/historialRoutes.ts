import {
  Router,
} from "express";

import {
  historialProcesadasController,
  historialRemisionesController,
  resumenAreaController,
} from "../controllers/historialController";

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

router.get(
  "/resumen",
  resumenAreaController,
);

router.get(
  "/remisiones",
  historialRemisionesController,
);

router.get(
  "/procesadas",
  requireArea(
    "CONTABILIDAD",
  ),
  historialProcesadasController,
);

export default router;
