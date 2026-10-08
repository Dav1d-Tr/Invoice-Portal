import {
  useEffect,
  useState,
} from "react";

import type {
  FormEvent,
} from "react";

import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  X,
} from "lucide-react";

import {
  useNavigate,
} from "react-router-dom";

import logo from "../assets/Logo.png";

import {
  getAreas,
  login,
  type Area,
} from "../services/authService";

/* =========================================================
   TIPOS DE ALERTA
========================================================= */

type AlertType =
  | "success"
  | "error"
  | "warning";

interface AlertState {
  type: AlertType;
  title: string;
  message: string;
}

/* =========================================================
   LOGIN
========================================================= */

const Login = () => {
  const navigate =
    useNavigate();

  /* =======================================================
     FORMULARIO
  ======================================================= */

  const [
    area,
    setArea,
  ] = useState("");

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  /* =======================================================
     ÁREAS
  ======================================================= */

  const [
    areas,
    setAreas,
  ] = useState<Area[]>([]);

  const [
    loadingAreas,
    setLoadingAreas,
  ] = useState(true);

  /* =======================================================
     LOGIN
  ======================================================= */

  const [
    loading,
    setLoading,
  ] = useState(false);

  /* =======================================================
     ALERTAS
  ======================================================= */

  const [
    alert,
    setAlert,
  ] =
    useState<AlertState | null>(
      null,
    );

  /* =======================================================
     CARGAR ÁREAS DESDE POSTGRESQL
  ======================================================= */

  useEffect(() => {
    let active = true;

    const loadAreas =
      async () => {
        try {
          setLoadingAreas(
            true,
          );

          const data =
            await getAreas();

          if (!active) {
            return;
          }

          setAreas(data);

          if (
            data.length === 0
          ) {
            setAlert({
              type: "warning",

              title:
                "Sin áreas disponibles",

              message:
                "No existen áreas activas configuradas para ingresar al portal.",
            });
          }
        } catch (error) {
          if (!active) {
            return;
          }

          console.error(
            "Error cargando áreas:",
            error,
          );

          setAlert({
            type: "error",

            title:
              "No fue posible conectar",

            message:
              error instanceof Error
                ? error.message
                : "No fue posible consultar las áreas.",
          });
        } finally {
          if (active) {
            setLoadingAreas(
              false,
            );
          }
        }
      };

    void loadAreas();

    return () => {
      active = false;
    };
  }, []);

  /* =======================================================
     OCULTAR ALERTA AUTOMÁTICAMENTE
  ======================================================= */

  useEffect(() => {
    if (!alert) {
      return;
    }

    if (
      alert.type === "error" ||
      alert.type === "warning"
    ) {
      return;
    }

    const timer =
      window.setTimeout(
        () => {
          setAlert(null);
        },
        4000,
      );

    return () => {
      window.clearTimeout(
        timer,
      );
    };
  }, [alert]);

  /* =======================================================
     SUBMIT
  ======================================================= */

  const handleSubmit = async (
    event:
      FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setAlert(null);

    /* VALIDACIÓN ÁREA */

    if (!area) {
      setAlert({
        type: "warning",

        title:
          "Área requerida",

        message:
          "Selecciona el área con la que deseas ingresar.",
      });

      return;
    }

    /* VALIDACIÓN CONTRASEÑA */

    if (!password) {
      setAlert({
        type: "warning",

        title:
          "Contraseña requerida",

        message:
          "Ingresa la contraseña asignada al área.",
      });

      return;
    }

    try {
      setLoading(true);

      const loggedArea =
        await login(
          area,
          password,
        );

      setAlert({
        type: "success",

        title:
          "Acceso autorizado",

        message:
          `Bienvenido al área ${loggedArea.nombre}.`,
      });

      /*
        Pequeña espera para que el usuario
        alcance a ver la confirmación.
      */

      window.setTimeout(
        () => {
          navigate(
            "/facturas",
            {
              replace: true,
            },
          );
        },
        700,
      );
    } catch (error) {
      setAlert({
        type: "error",

        title:
          "No fue posible ingresar",

        message:
          error instanceof Error
            ? error.message
            : "Área o contraseña incorrectos.",
      });
    } finally {
      setLoading(false);
    }
  };

  /* =======================================================
     ALERTA
  ======================================================= */

  const alertStyles = {
    success: {
      container:
        "border-emerald-200 bg-emerald-50 text-emerald-800",

      icon:
        "text-emerald-600",
    },

    error: {
      container:
        "border-red-200 bg-red-50 text-red-800",

      icon:
        "text-red-500",
    },

    warning: {
      container:
        "border-amber-200 bg-amber-50 text-amber-800",

      icon:
        "text-amber-500",
    },
  };

  return (
    <main
      className="
        relative
        flex
        min-h-screen
        items-center
        justify-center
        overflow-hidden
        bg-linear-to-br
        from-[#03263D]
        via-[#055F8C]
        to-[#3CC7E8]
        px-4
        py-8
      "
    >
      {/* ===================================================
          DECORACIÓN DE FONDO
      ==================================================== */}

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          -left-40
          -top-40
          h-96
          w-96
          rounded-full
          bg-white/5
          blur-2xl
        "
      />

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          -bottom-48
          -right-40
          h-125
          w-125
          rounded-full
          bg-[#3CC7E8]/20
          blur-3xl
        "
      />

      {/* ===================================================
          ALERTA FLOTANTE
      ==================================================== */}

      {alert && (
        <div
          role="alert"
          aria-live="polite"
          className={`
            fixed
            right-5
            top-5
            z-50
            flex
            w-[calc(100%-40px)]
            max-w-sm
            items-start
            gap-3
            rounded-xl
            border
            p-4
            shadow-xl
            backdrop-blur-sm
            ${alertStyles[alert.type].container}
          `}
        >
          <div
            className="
              mt-0.5
              shrink-0
            "
          >
            {alert.type ===
              "success" && (
              <CheckCircle2
                size={21}
                className={
                  alertStyles
                    .success
                    .icon
                }
              />
            )}

            {alert.type ===
              "error" && (
              <AlertCircle
                size={21}
                className={
                  alertStyles
                    .error
                    .icon
                }
              />
            )}

            {alert.type ===
              "warning" && (
              <AlertCircle
                size={21}
                className={
                  alertStyles
                    .warning
                    .icon
                }
              />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">
              {alert.title}
            </p>

            <p className="mt-0.5 text-xs leading-relaxed opacity-80">
              {alert.message}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setAlert(null)
            }
            aria-label="Cerrar alerta"
            className="
              shrink-0
              rounded-md
              p-1
              opacity-60
              transition
              hover:bg-black/5
              hover:opacity-100
              focus-visible:outline-none
              focus-visible:ring-2
              focus-visible:ring-current
            "
          >
            <X
              size={16}
              aria-hidden="true"
            />
          </button>
        </div>
      )}

      {/* ===================================================
          LOGIN CARD
      ==================================================== */}

      <div
        className="
          relative
          z-10
          w-full
          max-w-md
          rounded-2xl
          border
          border-white/20
          bg-[#F4F8FA]
          px-10
          py-10
          shadow-2xl
        "
      >
        {/* HEADER */}

        <header
          className="
            mb-8
            flex
            items-center
            gap-4
          "
        >
          <div
            className="
              flex
              w-24
              shrink-0
              items-center
              justify-center
              rounded-s-xl
              rounded-br-xl
              bg-linear-to-br
              from-[#03263D]
              via-[#055F8C]
              to-[#3CC7E8]
              p-1
            "
          >
            <img
              src={logo}
              alt="Demetálicos"
              className="
                h-auto
                w-full
                object-contain
              "
            />
          </div>

          <span
            className="
              font-philosopher
              text-xl
              font-extrabold
              leading-tight
              text-[#878d91]
            "
          >
            Sistema de Gestión y
            Aprobación de Facturas
          </span>
        </header>

        {/* =================================================
            BIENVENIDA
        ================================================== */}

        <section
          aria-labelledby="login-title"
        >
          <div
            className="
              mb-6
              font-philosopher
            "
          >
            <h1
              id="login-title"
              className="
                text-4xl
                font-bold
                text-gray-800
              "
            >
              Bienvenido
            </h1>

            <p
              className="
                mt-1
                text-sm
                text-gray-500
              "
            >
              Ingrese con los datos
              asignados a su área.
            </p>
          </div>

          {/* =================================================
              FORMULARIO
          ================================================== */}

          <form
            onSubmit={
              handleSubmit
            }
            className="
              space-y-5
              font-philosopher
            "
          >
            {/* ===============================================
                ÁREA
            ================================================ */}

            <div>
              <label
                htmlFor="area"
                className="
                  mb-2
                  block
                  text-sm
                  font-bold
                  text-gray-800
                "
              >
                Área
              </label>

              <div className="relative">
                <Building2
                  size={19}
                  aria-hidden="true"
                  className="
                    pointer-events-none
                    absolute
                    left-3
                    top-1/2
                    z-10
                    -translate-y-1/2
                    text-gray-500
                  "
                />

                <select
                  id="area"
                  name="area"
                  value={area}
                  onChange={(
                    event,
                  ) =>
                    setArea(
                      event.target
                        .value,
                    )
                  }
                  required
                  disabled={
                    loading ||
                    loadingAreas
                  }
                  className="
                    h-11
                    w-full
                    appearance-none
                    rounded-lg
                    border
                    border-gray-300
                    bg-white
                    py-2.5
                    pl-10
                    pr-10
                    text-sm
                    text-gray-700
                    transition

                    hover:border-gray-400

                    focus:border-[#076C8F]
                    focus:outline-none
                    focus:ring-2
                    focus:ring-[#076C8F]/20

                    disabled:cursor-not-allowed
                    disabled:bg-gray-100
                    disabled:text-gray-400
                  "
                >
                  <option value="">
                    {loadingAreas
                      ? "Cargando áreas..."
                      : "Seleccione su área"}
                  </option>

                  {areas.map(
                    (
                      areaOption,
                    ) => (
                      <option
                        key={
                          areaOption.id
                        }
                        value={
                          areaOption.nombre
                        }
                      >
                        {
                          areaOption.nombre
                        }
                      </option>
                    ),
                  )}
                </select>

                <ChevronDown
                  size={17}
                  aria-hidden="true"
                  className="
                    pointer-events-none
                    absolute
                    right-3
                    top-1/2
                    -translate-y-1/2
                    text-gray-400
                  "
                />
              </div>
            </div>

            {/* ===============================================
                CONTRASEÑA
            ================================================ */}

            <div>
              <label
                htmlFor="password"
                className="
                  mb-2
                  block
                  text-sm
                  font-bold
                  text-gray-800
                "
              >
                Contraseña
              </label>

              <div className="relative">
                <LockKeyhole
                  size={19}
                  aria-hidden="true"
                  className="
                    pointer-events-none
                    absolute
                    left-3
                    top-1/2
                    -translate-y-1/2
                    text-gray-500
                  "
                />

                <input
                  id="password"
                  name="password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={password}
                  onChange={(
                    event,
                  ) =>
                    setPassword(
                      event.target
                        .value,
                    )
                  }
                  autoComplete="current-password"
                  required
                  disabled={loading}
                  placeholder="Ingrese su contraseña"
                  className="
                    h-11
                    w-full
                    rounded-lg
                    border
                    border-gray-300
                    bg-white
                    py-2.5
                    pl-10
                    pr-11
                    text-sm
                    text-gray-700
                    transition

                    placeholder:text-gray-400

                    hover:border-gray-400

                    focus:border-[#076C8F]
                    focus:outline-none
                    focus:ring-2
                    focus:ring-[#076C8F]/20

                    disabled:cursor-not-allowed
                    disabled:bg-gray-100
                  "
                />

                {/* VER CONTRASEÑA */}

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(
                      (
                        current,
                      ) =>
                        !current,
                    )
                  }
                  disabled={loading}
                  aria-label={
                    showPassword
                      ? "Ocultar contraseña"
                      : "Mostrar contraseña"
                  }
                  aria-pressed={
                    showPassword
                  }
                  className="
                    absolute
                    right-2
                    top-1/2
                    flex
                    h-8
                    w-8
                    -translate-y-1/2
                    items-center
                    justify-center
                    rounded-lg
                    text-gray-400
                    transition

                    hover:bg-gray-100
                    hover:text-[#076C8F]

                    focus-visible:outline-none
                    focus-visible:ring-2
                    focus-visible:ring-[#076C8F]/40
                  "
                >
                  {showPassword ? (
                    <EyeOff
                      size={18}
                      aria-hidden="true"
                    />
                  ) : (
                    <Eye
                      size={18}
                      aria-hidden="true"
                    />
                  )}
                </button>
              </div>
            </div>

            {/* ===============================================
                INGRESAR
            ================================================ */}

            <button
              type="submit"
              disabled={
                loading ||
                loadingAreas ||
                areas.length === 0
              }
              className="
                flex
                h-11
                w-full
                items-center
                justify-center
                gap-2
                rounded-lg
                bg-[#076C8F]
                px-4
                font-bold
                text-white
                shadow-sm
                transition-all

                hover:bg-[#055c79]
                hover:shadow-md

                active:scale-[0.99]

                disabled:cursor-not-allowed
                disabled:opacity-60

                focus-visible:outline-none
                focus-visible:ring-2
                focus-visible:ring-[#076C8F]
                focus-visible:ring-offset-2
              "
            >
              {loading ? (
                <>
                  <LoaderCircle
                    size={18}
                    aria-hidden="true"
                    className="animate-spin"
                  />

                  Verificando...
                </>
              ) : (
                "Ingresar al Portal"
              )}
            </button>
          </form>

          {/* =================================================
              FOOTER
          ================================================== */}

          <footer
            className="
              mt-5
              flex
              flex-col
              items-center
              gap-2
              font-philosopher
            "
          >
            <div
              className="
                h-px
                w-full
                bg-gray-300
              "
              aria-hidden="true"
            />

            <small
              className="
                text-[10px]
                text-gray-500
              "
            >
              © Demetálicos
              S.A.S.
            </small>

            <small
              className="
                text-center
                text-[10px]
                text-gray-500
              "
            >
              Las facturas se
              asignan
              automáticamente por
              área
            </small>
          </footer>
        </section>
      </div>
    </main>
  );
};

export default Login;