import {
  Router,
} from "express";

import rateLimit from "express-rate-limit";

import {
  areasController,
  loginController,
  logoutController,
  meController,
} from "../controllers/authController";

import {
  requireAuth,
} from "../middlewares/authMiddleware";

const router =
  Router();

const loginLimiter =
  rateLimit({
    windowMs:
      5 * 60 * 1000,

    limit: 50,

    skipSuccessfulRequests:
      true,

    standardHeaders:
      true,

    legacyHeaders:
      false,

    message: {
      success: false,

      message:
        "Demasiados intentos de inicio de sesión. Intenta nuevamente en unos minutos.",
    },
  });

router.get(
  "/areas",
  areasController,
);

router.post(
  "/login",
  loginLimiter,
  loginController,
);

router.get(
  "/me",
  requireAuth,
  meController,
);

router.post(
  "/logout",
  logoutController,
);

export default router;