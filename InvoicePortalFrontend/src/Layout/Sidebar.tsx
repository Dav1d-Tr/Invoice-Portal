import {
  ClipboardCheck,
  Clock3,
  FileText,
  Inbox,
  LogOut,
  Settings,
  Users,
  X,
} from "lucide-react";

import type {
  LucideIcon,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  NavLink,
  useLocation,
  useNavigate,
} from "react-router-dom";

import logo from "../assets/Logo.png";

import {
  getStoredArea,
  logout,
} from "../services/authService";

import {
  getFacturasRemitidas,
} from "../services/facturasService";

import {
  getAreaInitials,
  isSystemsArea,
} from "../utils/areaPermissions";

interface MenuItem {
  name: string;
  path: string;
  icon: LucideIcon;
}

const Sidebar = () => {
  const navigate =
    useNavigate();

  const location =
    useLocation();

  const currentArea =
    getStoredArea();

  const [
    remitidosCount,
    setRemitidosCount,
  ] =
    useState(
      0,
    );

  const areaName =
    currentArea?.nombre ??
    "Sin área";

  const areaInitials =
    getAreaInitials(
      currentArea?.nombre,
    );

  const isSystems =
    isSystemsArea(
      currentArea?.nombre,
    );

  const normalizedAreaName =
    areaName
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        "",
      )
      .trim()
      .toUpperCase();

  const isAccounting =
    normalizedAreaName ===
    "CONTABILIDAD";

  /* =======================================================
     CONTADOR DE FACTURAS REMITIDAS
  ======================================================= */

  const loadRemitidosCount =
    useCallback(
      async () => {
        try {
          const remitidas =
            await getFacturasRemitidas();

          setRemitidosCount(
            remitidas.length,
          );
        } catch (
          error
        ) {
          console.warn(
            "No fue posible consultar el contador de remitidos:",
            error,
          );

          setRemitidosCount(
            0,
          );
        }
      },
      [],
    );

  useEffect(
    () => {
      void loadRemitidosCount();
    },
    [
      loadRemitidosCount,
      location.pathname,
    ],
  );

  useEffect(
    () => {
      const interval =
        window.setInterval(
          () => {
            if (
              document.visibilityState ===
              "visible"
            ) {
              void loadRemitidosCount();
            }
          },
          30_000,
        );

      const handleFocus =
        () => {
          void loadRemitidosCount();
        };

      window.addEventListener(
        "focus",
        handleFocus,
      );

      return () => {
        window.clearInterval(
          interval,
        );

        window.removeEventListener(
          "focus",
          handleFocus,
        );
      };
    },
    [
      loadRemitidosCount,
    ],
  );

  const menuItems:
    MenuItem[] = [
      {
        name:
          "Facturas",

        path:
          "/facturas",

        icon:
          FileText,
      },

      /*
        Remitidos ahora está disponible para TODAS las áreas.
      */

      {
        name:
          "Remitidos",

        path:
          "/remitidos",

        icon:
          Inbox,
      },

      {
        name:
          "Rechazadas",

        path:
          "/rechazadas",

        icon:
          X,
      },

      {
        name:
          "Historial",

        path:
          "/historial",

        icon:
          Clock3,
      },

      ...(
        isAccounting
          ? [
              {
                name:
                  "Procesadas",

                path:
                  "/historial-procesadas",

                icon:
                  ClipboardCheck,
              },
            ]
          : []
      ),
    ];

  const handleLogout =
    () => {
      logout();

      navigate(
        "/login",
        {
          replace:
            true,
        },
      );
    };

  const navLinkClass = ({
    isActive,
  }: {
    isActive:
      boolean;
  }) => `
    flex
    h-10
    items-center
    gap-3
    rounded-xl
    px-3
    text-[13px]
    transition-all

    focus-visible:outline-none
    focus-visible:ring-2
    focus-visible:ring-[#076C8F]
    focus-visible:ring-offset-2

    ${
      isActive
        ? `
          bg-[#DFF6FA]
          font-semibold
          text-[#00698C]
        `
        : `
          font-normal
          text-slate-500
          hover:bg-slate-50
          hover:text-slate-700
        `
    }
  `;

  return (
    <>
      <a
        href="#main-content"
        className="
          sr-only

          focus:not-sr-only
          focus:fixed
          focus:left-4
          focus:top-4
          focus:z-50
          focus:rounded-md
          focus:bg-white
          focus:px-4
          focus:py-2
          focus:text-[#076C8F]
          focus:shadow-lg
        "
      >
        Ir al contenido principal
      </a>

      <aside
        className="
          flex
          h-full
          w-54
          shrink-0
          flex-col
          overflow-y-auto
          border-r
          border-slate-200
          bg-white
          px-4
          py-5
        "
        aria-label="Menú lateral"
      >
        <div
          className="
            mb-7
            flex
            shrink-0
            items-center
            justify-center
            gap-1
          "
        >
          <div
            className="
              flex
              w-12
              items-center
              justify-center
              rounded-s-md
              rounded-br-md
              bg-linear-to-br
              from-[#03263D]
              via-[#055F8C]
              to-[#3CC7E8]
              p-0.5
            "
          >
            <img
              src={
                logo
              }
              alt="Demetálicos"
              className="
                h-auto
                w-full
                object-contain
              "
            />
          </div>

          <strong
            className="
              bg-linear-to-br
              from-[#03263D]
              via-[#055F8C]
              to-[#3CC7E8]
              bg-clip-text
              font-philosopher
              text-5xl
              font-extrabold
              text-transparent
            "
          >
            SGAF
          </strong>
        </div>

        <nav
          className="
            flex
            shrink-0
            flex-col
            gap-2
            font-philosopher
          "
          aria-label="Navegación principal"
        >
          {menuItems.map(
            (
              item,
            ) => {
              const Icon =
                item.icon;

              return (
                <NavLink
                  key={
                    item.name
                  }
                  to={
                    item.path
                  }
                  aria-label={`Ir a ${item.name}`}
                  className={
                    navLinkClass
                  }
                >
                  {({
                    isActive,
                  }) => (
                    <>
                      <Icon
                        size={
                          17
                        }
                        strokeWidth={
                          isActive
                            ? 2
                            : 1.7
                        }
                        aria-hidden="true"
                        className={
                          isActive
                            ? "text-[#00789D]"
                            : "text-slate-500"
                        }
                      />

                      <span>
                        {item.name}
                      </span>

                      {item.name ===
                        "Remitidos" &&
                        remitidosCount >
                          0 && (
                          <span
                            className="
                              ml-auto
                              inline-flex
                              min-w-5
                              items-center
                              justify-center
                              rounded-full
                              bg-[#13B8D4]
                              px-1.5
                              py-1.5
                              text-[9px]
                              font-bold
                              leading-none
                              text-white
                            "
                            title={`${remitidosCount} factura${remitidosCount === 1 ? "" : "s"} remitida${remitidosCount === 1 ? "" : "s"}`}
                            aria-label={`${remitidosCount} factura${remitidosCount === 1 ? "" : "s"} remitida${remitidosCount === 1 ? "" : "s"}`}
                          >
                            {remitidosCount >
                            99
                              ? "99+"
                              : remitidosCount}
                          </span>
                        )}
                    </>
                  )}
                </NavLink>
              );
            },
          )}
        </nav>

        {isSystems && (
          <>
            <div
              className="
                mx-2
                mt-6
                border-t
                border-slate-200
              "
              aria-hidden="true"
            />

            <div
              className="
                mt-6
                shrink-0
                font-philosopher
              "
            >
              <p
                className="
                  mb-4
                  px-2
                  text-[8px]
                  font-bold
                  uppercase
                  tracking-wide
                  text-slate-500
                "
              >
                Sistema
              </p>

              <NavLink
                to="/configuracion"
                aria-label="Ir a configuración del sistema"
                className={
                  navLinkClass
                }
              >
                <Settings
                  size={
                    17
                  }
                  strokeWidth={
                    1.7
                  }
                  aria-hidden="true"
                />

                <span>
                  Configuración
                </span>
              </NavLink>

              <NavLink
                to="/usuarios"
                aria-label="Ir a usuarios del sistema"
                className={
                  navLinkClass
                }
              >
                <Users
                  size={
                    17
                  }
                  strokeWidth={
                    1.7
                  }
                  aria-hidden="true"
                />

                <span>
                  Usuarios
                </span>
              </NavLink>
            </div>
          </>
        )}

        <div
          className="
            mt-auto
            shrink-0
            pt-6
            font-philosopher
          "
        >
          <div
            className="
              flex
              items-center
              gap-3
              rounded-xl
              border
              border-slate-100
              bg-[#F7FAFB]
              px-3
              py-2.5
            "
          >
            <div
              className="
                flex
                h-8
                w-8
                shrink-0
                items-center
                justify-center
                rounded-full
                bg-[#073F63]
                text-[9px]
                font-bold
                text-white
              "
              aria-hidden="true"
            >
              {areaInitials}
            </div>

            <div
              className="
                min-w-0
                flex-1
              "
            >
              <p
                className="
                  truncate
                  text-[11px]
                  font-semibold
                  text-slate-800
                "
                title={
                  areaName
                }
              >
                Área {areaName}
              </p>

              <button
                type="button"
                onClick={
                  handleLogout
                }
                className="
                  mt-0.5
                  flex
                  items-center
                  gap-1
                  rounded
                  text-[9px]
                  text-slate-400
                  transition

                  hover:text-slate-600

                  focus-visible:outline-none
                  focus-visible:ring-2
                  focus-visible:ring-[#076C8F]
                "
                aria-label={`Cerrar sesión del área ${areaName}`}
              >
                <LogOut
                  size={
                    10
                  }
                  aria-hidden="true"
                />

                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
