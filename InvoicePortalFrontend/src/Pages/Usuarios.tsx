import {
  CheckCircle2,
  KeyRound,
  LoaderCircle,
  Mail,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  UserCog,
  Users,
  X,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  FormEvent,
  ReactNode,
} from "react";

import {
  actualizarUsuario,
  crearUsuario,
  eliminarUsuario,
  getUsuarios,
  reactivarUsuario,
} from "../services/usuariosService";

import type {
  AreaCelularInput,
  AreaCorreoInput,
  UsuarioPortal,
} from "../services/usuariosService";

/* =========================================================
   COMPONENTE
========================================================= */

const Usuarios = () => {
  const [
    usuarios,
    setUsuarios,
  ] =
    useState<
      UsuarioPortal[]
    >([]);

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    saving,
    setSaving,
  ] =
    useState(
      false,
    );

  const [
    actionId,
    setActionId,
  ] =
    useState<
      number | null
    >(
      null,
    );

  /* =======================================================
     FILTROS
  ======================================================= */

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    status,
    setStatus,
  ] =
    useState<
      "TODOS" |
      "ACTIVOS" |
      "INACTIVOS"
    >(
      "TODOS",
    );

  /* =======================================================
     MODAL
  ======================================================= */

  const [
    modalOpen,
    setModalOpen,
  ] =
    useState(
      false,
    );

  const [
    editing,
    setEditing,
  ] =
    useState<
      UsuarioPortal | null
    >(
      null,
    );

  const [
    nombre,
    setNombre,
  ] =
    useState("");

  const [
    clave,
    setClave,
  ] =
    useState("");

  const [
    activo,
    setActivo,
  ] =
    useState(
      true,
    );

  /* =======================================================
     CONTACTOS
  ======================================================= */

  const [
    correos,
    setCorreos,
  ] =
    useState<
      AreaCorreoInput[]
    >([]);

  const [
    celulares,
    setCelulares,
  ] =
    useState<
      AreaCelularInput[]
    >([]);

  /* =======================================================
     MENSAJES
  ======================================================= */

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    message,
    setMessage,
  ] =
    useState<
      string | null
    >(
      null,
    );

  /* =======================================================
     CARGAR
  ======================================================= */

  const load =
    async () => {
      try {
        setLoading(
          true,
        );

        setError(
          null,
        );

        const data =
          await getUsuarios();

        setUsuarios(
          data,
        );
      } catch (
        error
      ) {
        setError(
          error instanceof
          Error
            ? error.message
            : "No fue posible cargar los usuarios.",
        );
      } finally {
        setLoading(
          false,
        );
      }
    };

  useEffect(
    () => {
      void load();
    },
    [],
  );

  /* =======================================================
     RESET
  ======================================================= */

  const resetForm =
    () => {
      setEditing(
        null,
      );

      setNombre(
        "",
      );

      setClave(
        "",
      );

      setActivo(
        true,
      );

      setCorreos(
        [],
      );

      setCelulares(
        [],
      );
    };

  /* =======================================================
     CREAR
  ======================================================= */

  const openCreate =
    () => {
      resetForm();

      setError(
        null,
      );

      setMessage(
        null,
      );

      setModalOpen(
        true,
      );
    };

  /* =======================================================
     EDITAR
  ======================================================= */

  const openEdit = (
    usuario:
      UsuarioPortal,
  ) => {
    setEditing(
      usuario,
    );

    setNombre(
      usuario.nombre,
    );

    setClave(
      "",
    );

    setActivo(
      usuario.activo,
    );

    setCorreos(
      usuario.correos.map(
        (
          item,
        ) => ({
          correo:
            item.correo,

          esPrincipal:
            item.esPrincipal,
        }),
      ),
    );

    setCelulares(
      usuario.celulares.map(
        (
          item,
        ) => ({
          celular:
            item.celular,

          esPrincipal:
            item.esPrincipal,
        }),
      ),
    );

    setError(
      null,
    );

    setMessage(
      null,
    );

    setModalOpen(
      true,
    );
  };

  /* =======================================================
     CERRAR
  ======================================================= */

  const closeModal =
    () => {
      if (
        saving
      ) {
        return;
      }

      setModalOpen(
        false,
      );

      setError(
        null,
      );

      resetForm();
    };

  /* =======================================================
     CORREOS
  ======================================================= */

  const addCorreo =
    () => {
      setCorreos(
        (
          current,
        ) => [
          ...current,

          {
            correo:
              "",

            esPrincipal:
              current.length ===
              0,
          },
        ],
      );
    };

  const updateCorreo =
    (
      index:
        number,

      value:
        string,
    ) => {
      setCorreos(
        (
          current,
        ) =>
          current.map(
            (
              item,
              currentIndex,
            ) =>
              currentIndex ===
              index
                ? {
                    ...item,

                    correo:
                      value,
                  }
                : item,
          ),
      );
    };

  const setCorreoPrincipal =
    (
      index:
        number,
    ) => {
      setCorreos(
        (
          current,
        ) =>
          current.map(
            (
              item,
              currentIndex,
            ) => ({
              ...item,

              esPrincipal:
                currentIndex ===
                index,
            }),
          ),
      );
    };

  const removeCorreo =
    (
      index:
        number,
    ) => {
      setCorreos(
        (
          current,
        ) => {
          const next =
            current.filter(
              (
                _item,
                currentIndex,
              ) =>
                currentIndex !==
                index,
            );

          if (
            next.length >
              0 &&
            !next.some(
              (
                item,
              ) =>
                item.esPrincipal,
            )
          ) {
            next[0] = {
              ...next[0],

              esPrincipal:
                true,
            };
          }

          return next;
        },
      );
    };

  /* =======================================================
     CELULARES
  ======================================================= */

  const addCelular =
    () => {
      setCelulares(
        (
          current,
        ) => [
          ...current,

          {
            celular:
              "",

            esPrincipal:
              current.length ===
              0,
          },
        ],
      );
    };

  const updateCelular =
    (
      index:
        number,

      value:
        string,
    ) => {
      setCelulares(
        (
          current,
        ) =>
          current.map(
            (
              item,
              currentIndex,
            ) =>
              currentIndex ===
              index
                ? {
                    ...item,

                    celular:
                      value,
                  }
                : item,
          ),
      );
    };

  const setCelularPrincipal =
    (
      index:
        number,
    ) => {
      setCelulares(
        (
          current,
        ) =>
          current.map(
            (
              item,
              currentIndex,
            ) => ({
              ...item,

              esPrincipal:
                currentIndex ===
                index,
            }),
          ),
      );
    };

  const removeCelular =
    (
      index:
        number,
    ) => {
      setCelulares(
        (
          current,
        ) => {
          const next =
            current.filter(
              (
                _item,
                currentIndex,
              ) =>
                currentIndex !==
                index,
            );

          if (
            next.length >
              0 &&
            !next.some(
              (
                item,
              ) =>
                item.esPrincipal,
            )
          ) {
            next[0] = {
              ...next[0],

              esPrincipal:
                true,
            };
          }

          return next;
        },
      );
    };

  /* =======================================================
     VALIDAR CORREOS
  ======================================================= */

  const cleanCorreos =
    (): AreaCorreoInput[] => {
      const values =
        correos
          .map(
            (
              item,
            ) => ({
              correo:
                item.correo
                  .trim()
                  .toLowerCase(),

              esPrincipal:
                Boolean(
                  item.esPrincipal,
                ),
            }),
          )
          .filter(
            (
              item,
            ) =>
              Boolean(
                item.correo,
              ),
          );

      for (
        const item
        of values
      ) {
        if (
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
            item.correo,
          )
        ) {
          throw new Error(
            `El correo "${item.correo}" no es válido.`,
          );
        }
      }

      if (
        values.length >
          0 &&
        !values.some(
          (
            item,
          ) =>
            item.esPrincipal,
        )
      ) {
        values[0].esPrincipal =
          true;
      }

      return values;
    };

  /* =======================================================
     VALIDAR CELULARES
  ======================================================= */

  const cleanCelulares =
    (): AreaCelularInput[] => {
      const values =
        celulares
          .map(
            (
              item,
            ) => ({
              celular:
                item.celular
                  .trim()
                  .replace(
                    /[\s().-]/g,
                    "",
                  ),

              esPrincipal:
                Boolean(
                  item.esPrincipal,
                ),
            }),
          )
          .filter(
            (
              item,
            ) =>
              Boolean(
                item.celular,
              ),
          );

      for (
        const item
        of values
      ) {
        if (
          !/^\+?[0-9]{7,15}$/.test(
            item.celular,
          )
        ) {
          throw new Error(
            `El celular "${item.celular}" no es válido.`,
          );
        }
      }

      if (
        values.length >
          0 &&
        !values.some(
          (
            item,
          ) =>
            item.esPrincipal,
        )
      ) {
        values[0].esPrincipal =
          true;
      }

      return values;
    };

  /* =======================================================
     GUARDAR
  ======================================================= */

  const save =
    async (
      event:
        FormEvent,
    ) => {
      event.preventDefault();

      setError(
        null,
      );

      setMessage(
        null,
      );

      const cleanName =
        nombre.trim();

      if (!cleanName) {
        setError(
          "El nombre del área es obligatorio.",
        );

        return;
      }

      if (
        !editing &&
        clave.length <
          8
      ) {
        setError(
          "La contraseña debe tener mínimo 8 caracteres.",
        );

        return;
      }

      if (
        editing &&
        clave &&
        clave.length <
          8
      ) {
        setError(
          "La nueva contraseña debe tener mínimo 8 caracteres.",
        );

        return;
      }

      try {
        const correosFinal =
          cleanCorreos();

        const celularesFinal =
          cleanCelulares();

        setSaving(
          true,
        );

        if (
          editing
        ) {
          await actualizarUsuario(
            editing.id,

            {
              nombre:
                cleanName,

              clave:
                clave ||
                undefined,

              activo,

              correos:
                correosFinal,

              celulares:
                celularesFinal,
            },
          );

          setMessage(
            "Usuario actualizado correctamente.",
          );
        } else {
          await crearUsuario({
            nombre:
              cleanName,

            clave,

            correos:
              correosFinal,

            celulares:
              celularesFinal,
          });

          setMessage(
            "Usuario creado correctamente.",
          );
        }

        setModalOpen(
          false,
        );

        resetForm();

        await load();
      } catch (
        error
      ) {
        setError(
          error instanceof
          Error
            ? error.message
            : "No fue posible guardar el usuario.",
        );
      } finally {
        setSaving(
          false,
        );
      }
    };

  /* =======================================================
     DESACTIVAR
  ======================================================= */

  const remove =
    async (
      usuario:
        UsuarioPortal,
    ) => {
      const confirmed =
        window.confirm(
          `¿Deseas desactivar "${usuario.nombre}"?\n\nLa información histórica se conservará.`,
        );

      if (
        !confirmed
      ) {
        return;
      }

      try {
        setActionId(
          usuario.id,
        );

        setError(
          null,
        );

        setMessage(
          null,
        );

        await eliminarUsuario(
          usuario.id,
        );

        setMessage(
          `${usuario.nombre} fue desactivado correctamente.`,
        );

        await load();
      } catch (
        error
      ) {
        setError(
          error instanceof
          Error
            ? error.message
            : "No fue posible desactivar el usuario.",
        );
      } finally {
        setActionId(
          null,
        );
      }
    };

  /* =======================================================
     REACTIVAR
  ======================================================= */

  const reactivate =
    async (
      usuario:
        UsuarioPortal,
    ) => {
      try {
        setActionId(
          usuario.id,
        );

        setError(
          null,
        );

        setMessage(
          null,
        );

        await reactivarUsuario(
          usuario.id,
        );

        setMessage(
          `${usuario.nombre} fue reactivado correctamente.`,
        );

        await load();
      } catch (
        error
      ) {
        setError(
          error instanceof
          Error
            ? error.message
            : "No fue posible reactivar el usuario.",
        );
      } finally {
        setActionId(
          null,
        );
      }
    };

  /* =======================================================
     FILTRO
  ======================================================= */

  const filtered =
    useMemo(
      () => {
        const needle =
          search
            .trim()
            .toLowerCase();

        return usuarios.filter(
          (
            usuario,
          ) => {
            if (
              status ===
                "ACTIVOS" &&
              !usuario.activo
            ) {
              return false;
            }

            if (
              status ===
                "INACTIVOS" &&
              usuario.activo
            ) {
              return false;
            }

            if (!needle) {
              return true;
            }

            const text =
              [
                usuario.nombre,

                ...usuario.correos.map(
                  (
                    item,
                  ) =>
                    item.correo,
                ),

                ...usuario.celulares.map(
                  (
                    item,
                  ) =>
                    item.celular,
                ),
              ]
                .join(
                  " ",
                )
                .toLowerCase();

            return text.includes(
              needle,
            );
          },
        );
      },
      [
        usuarios,
        search,
        status,
      ],
    );

  /* =======================================================
     KPIS
  ======================================================= */

  const activos =
    usuarios.filter(
      (
        item,
      ) =>
        item.activo,
    ).length;

  const inactivos =
    usuarios.length -
    activos;

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <>
      {/* HEADER */}

      <header
        className="
          mb-8
          flex
          flex-col
          gap-4

          md:flex-row
          md:items-center
          md:justify-between
        "
      >
        <div
          className="
            flex
            items-center
            gap-3
          "
        >
          <div
            className="
              flex
              h-11
              w-11
              items-center
              justify-center
              rounded-xl
              bg-[#13B8D4]/15
              text-[#00739B]
            "
          >
            <UserCog
              size={22}
            />
          </div>

          <div>
            <h1
              className="
                text-2xl
                font-bold
                text-slate-800
              "
            >
              Administración de usuarios
            </h1>

            <p
              className="
                mt-1
                text-sm
                text-slate-500
              "
            >
              Administra áreas, contraseñas,
              correos y celulares del portal.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={
            openCreate
          }
          className="
            inline-flex
            h-11
            items-center
            justify-center
            gap-2
            rounded-xl
            bg-[#00739B]
            px-5
            text-xs
            font-bold
            text-white

            hover:bg-[#05627F]
          "
        >
          <Plus
            size={16}
          />

          Nuevo usuario
        </button>
      </header>

      {/* ALERTAS */}

      {message && (
        <div
          className="
            mb-5
            flex
            items-center
            gap-2
            rounded-xl
            border
            border-emerald-200
            bg-emerald-50
            px-4
            py-3
            text-xs
            text-emerald-700
          "
        >
          <CheckCircle2
            size={15}
          />

          {message}
        </div>
      )}

      {error &&
        !modalOpen && (
          <div
            className="
              mb-5
              rounded-xl
              border
              border-red-200
              bg-red-50
              px-4
              py-3
              text-xs
              text-red-700
            "
          >
            {error}
          </div>
        )}

      {/* KPIS */}

      <div
        className="
          grid
          grid-cols-1
          gap-4

          md:grid-cols-3
        "
      >
        <Summary
          title="Total usuarios"
          value={
            usuarios.length
          }
        />

        <Summary
          title="Activos"
          value={
            activos
          }
        />

        <Summary
          title="Inactivos"
          value={
            inactivos
          }
        />
      </div>

      {/* FILTROS */}

      <section
        className="
          mt-6
          rounded-2xl
          border
          border-slate-200
          bg-white
          p-4
          shadow-sm
        "
      >
        <div
          className="
            grid
            grid-cols-1
            gap-3

            md:grid-cols-[1fr_180px]
          "
        >
          <div
            className="relative"
          >
            <Search
              size={16}
              className="
                absolute
                left-3
                top-1/2
                -translate-y-1/2
                text-slate-400
              "
            />

            <input
              value={
                search
              }
              onChange={(
                event,
              ) =>
                setSearch(
                  event.target
                    .value,
                )
              }
              placeholder="Buscar área, correo o celular..."
              className="
                h-10
                w-full
                rounded-xl
                border
                border-slate-200
                bg-[#F8FBFC]
                pl-9
                pr-3
                text-xs
                outline-none
              "
            />
          </div>

          <select
            value={
              status
            }
            onChange={(
              event,
            ) =>
              setStatus(
                event.target
                  .value as
                  | "TODOS"
                  | "ACTIVOS"
                  | "INACTIVOS",
              )
            }
            className="
              h-10
              rounded-xl
              border
              border-slate-200
              bg-white
              px-3
              text-xs
            "
          >
            <option value="TODOS">
              Todos
            </option>

            <option value="ACTIVOS">
              Activos
            </option>

            <option value="INACTIVOS">
              Inactivos
            </option>
          </select>
        </div>
      </section>

      {/* TABLA */}

      <section
        className="
          mt-6
          overflow-hidden
          rounded-2xl
          border
          border-slate-200
          bg-white
          shadow-sm
        "
      >
        {loading ? (
          <div
            className="
              flex
              min-h-64
              items-center
              justify-center
              gap-2
              text-sm
              text-slate-500
            "
          >
            <LoaderCircle
              size={18}
              className="animate-spin"
            />

            Cargando usuarios...
          </div>
        ) : (
          <div
            className="overflow-x-auto"
          >
            <table
              className="
                w-full
                min-w-262.5
              "
            >
              <thead>
                <tr
                  className="bg-[#F7F9FB]"
                >
                  <TableHeader>
                    Usuario / Área
                  </TableHeader>

                  <TableHeader>
                    Correos
                  </TableHeader>

                  <TableHeader>
                    Celulares
                  </TableHeader>

                  <TableHeader>
                    Estado
                  </TableHeader>

                  <TableHeader>
                    Último acceso
                  </TableHeader>

                  <TableHeader
                    right
                  >
                    Acciones
                  </TableHeader>
                </tr>
              </thead>

              <tbody>
                {filtered.map(
                  (
                    usuario,
                  ) => {
                    const sistemas =
                      usuario.nombre
                        .trim()
                        .toUpperCase() ===
                      "SISTEMAS";

                    const correoPrincipal =
                      usuario.correos.find(
                        (
                          item,
                        ) =>
                          item.esPrincipal,
                      ) ??
                      usuario.correos[0];

                    const celularPrincipal =
                      usuario.celulares.find(
                        (
                          item,
                        ) =>
                          item.esPrincipal,
                      ) ??
                      usuario.celulares[0];

                    const busy =
                      actionId ===
                      usuario.id;

                    return (
                      <tr
                        key={
                          usuario.id
                        }
                        className="
                          border-t
                          border-slate-100

                          hover:bg-slate-50
                        "
                      >
                        <td
                          className="
                            px-5
                            py-4
                          "
                        >
                          <div
                            className="
                              flex
                              items-center
                              gap-3
                            "
                          >
                            <div
                              className="
                                flex
                                h-9
                                w-9
                                items-center
                                justify-center
                                rounded-xl
                                bg-[#DFF6FA]
                                text-[#00739B]
                              "
                            >
                              {sistemas ? (
                                <ShieldCheck
                                  size={16}
                                />
                              ) : (
                                <Users
                                  size={16}
                                />
                              )}
                            </div>

                            <div>
                              <p
                                className="
                                  text-xs
                                  font-bold
                                  text-slate-800
                                "
                              >
                                {usuario.nombre}
                              </p>

                              <p
                                className="
                                  mt-0.5
                                  text-[9px]
                                  text-slate-400
                                "
                              >
                                ID {usuario.id}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* CORREOS */}

                        <td
                          className="
                            px-5
                            py-4
                          "
                        >
                          {correoPrincipal ? (
                            <div>
                              <div
                                className="
                                  flex
                                  items-center
                                  gap-1.5
                                "
                              >
                                <Mail
                                  size={12}
                                  className="text-[#00739B]"
                                />

                                <span
                                  className="
                                    max-w-55
                                    truncate
                                    text-[10px]
                                    font-semibold
                                    text-slate-600
                                  "
                                >
                                  {
                                    correoPrincipal.correo
                                  }
                                </span>
                              </div>

                              {usuario.correos
                                .length >
                                1 && (
                                <p
                                  className="
                                    mt-1
                                    text-[9px]
                                    text-slate-400
                                  "
                                >
                                  +
                                  {usuario.correos
                                    .length -
                                    1}{" "}
                                  adicional
                                  {usuario.correos
                                    .length -
                                    1 ===
                                  1
                                    ? ""
                                    : "es"}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span
                              className="
                                text-[10px]
                                text-slate-400
                              "
                            >
                              Sin correos
                            </span>
                          )}
                        </td>

                        {/* CELULAR */}

                        <td
                          className="
                            px-5
                            py-4
                          "
                        >
                          {celularPrincipal ? (
                            <div>
                              <div
                                className="
                                  flex
                                  items-center
                                  gap-1.5
                                "
                              >
                                <Phone
                                  size={12}
                                  className="text-[#00739B]"
                                />

                                <span
                                  className="
                                    text-[10px]
                                    font-semibold
                                    text-slate-600
                                  "
                                >
                                  {
                                    celularPrincipal.celular
                                  }
                                </span>
                              </div>

                              {usuario.celulares
                                .length >
                                1 && (
                                <p
                                  className="
                                    mt-1
                                    text-[9px]
                                    text-slate-400
                                  "
                                >
                                  +
                                  {usuario.celulares
                                    .length -
                                    1}{" "}
                                  adicional
                                  {usuario.celulares
                                    .length -
                                    1 ===
                                  1
                                    ? ""
                                    : "es"}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span
                              className="
                                text-[10px]
                                text-slate-400
                              "
                            >
                              Sin celulares
                            </span>
                          )}
                        </td>

                        {/* ESTADO */}

                        <td
                          className="
                            px-5
                            py-4
                          "
                        >
                          <span
                            className={
                              usuario.activo
                                ? "rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700"
                                : "rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold text-red-600"
                            }
                          >
                            {usuario.activo
                              ? "Activo"
                              : "Inactivo"}
                          </span>
                        </td>

                        {/* ULTIMO ACCESO */}

                        <td
                          className="
                            px-5
                            py-4
                            text-[10px]
                            text-slate-500
                          "
                        >
                          {usuario.ultimoAcceso
                            ? new Date(
                                usuario.ultimoAcceso,
                              ).toLocaleString(
                                "es-CO",
                              )
                            : "Nunca"}
                        </td>

                        {/* ACCIONES */}

                        <td
                          className="
                            px-5
                            py-4
                          "
                        >
                          <div
                            className="
                              flex
                              justify-end
                              gap-2
                            "
                          >
                            <button
                              type="button"
                              disabled={
                                busy
                              }
                              onClick={() =>
                                openEdit(
                                  usuario,
                                )
                              }
                              title="Editar"
                              className="
                                flex
                                h-8
                                w-8
                                items-center
                                justify-center
                                rounded-lg
                                border
                                border-slate-200
                                text-slate-500

                                hover:border-[#13A7C7]
                                hover:text-[#00739B]

                                disabled:opacity-40
                              "
                            >
                              <Pencil
                                size={13}
                              />
                            </button>

                            {!sistemas &&
                              usuario.activo && (
                                <button
                                  type="button"
                                  disabled={
                                    busy
                                  }
                                  onClick={() =>
                                    void remove(
                                      usuario,
                                    )
                                  }
                                  title="Desactivar"
                                  className="
                                    flex
                                    h-8
                                    w-8
                                    items-center
                                    justify-center
                                    rounded-lg
                                    border
                                    border-red-200
                                    text-red-500

                                    hover:bg-red-50

                                    disabled:opacity-40
                                  "
                                >
                                  {busy ? (
                                    <LoaderCircle
                                      size={13}
                                      className="animate-spin"
                                    />
                                  ) : (
                                    <Trash2
                                      size={13}
                                    />
                                  )}
                                </button>
                              )}

                            {!usuario.activo && (
                              <button
                                type="button"
                                disabled={
                                  busy
                                }
                                onClick={() =>
                                  void reactivate(
                                    usuario,
                                  )
                                }
                                title="Reactivar"
                                className="
                                  flex
                                  h-8
                                  w-8
                                  items-center
                                  justify-center
                                  rounded-lg
                                  border
                                  border-emerald-200
                                  text-emerald-600

                                  hover:bg-emerald-50

                                  disabled:opacity-40
                                "
                              >
                                {busy ? (
                                  <LoaderCircle
                                    size={13}
                                    className="animate-spin"
                                  />
                                ) : (
                                  <RefreshCw
                                    size={13}
                                  />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>

            {!loading &&
              filtered.length ===
                0 && (
                <div
                  className="
                    flex
                    min-h-52
                    items-center
                    justify-center
                    text-sm
                    text-slate-400
                  "
                >
                  No se encontraron usuarios.
                </div>
              )}
          </div>
        )}
      </section>

      {/* MODAL */}

      {modalOpen && (
        <div
          className="
            fixed
            inset-0
            z-50
            flex
            items-center
            justify-center
            bg-slate-900/35
            p-4
            backdrop-blur-[1px]
          "
        >
          <div
            className="
              max-h-[92vh]
              w-full
              max-w-2xl
              overflow-y-auto
              rounded-3xl
              bg-white
              shadow-2xl
            "
          >
            {/* HEADER */}

            <div
              className="
                sticky
                top-0
                z-10
                flex
                items-center
                justify-between
                border-b
                border-slate-100
                bg-white
                px-6
                py-5
              "
            >
              <div>
                <h2
                  className="
                    text-lg
                    font-bold
                    text-slate-800
                  "
                >
                  {editing
                    ? "Editar usuario"
                    : "Nuevo usuario"}
                </h2>

                <p
                  className="
                    mt-1
                    text-xs
                    text-slate-500
                  "
                >
                  Administra acceso y contactos
                  asociados al área.
                </p>
              </div>

              <button
                type="button"
                disabled={
                  saving
                }
                onClick={
                  closeModal
                }
                className="
                  flex
                  h-8
                  w-8
                  items-center
                  justify-center
                  rounded-lg
                  text-slate-400

                  hover:bg-slate-100
                "
              >
                <X
                  size={16}
                />
              </button>
            </div>

            <form
              onSubmit={
                save
              }
              className="
                space-y-6
                p-6
              "
            >
              {/* ERROR */}

              {error && (
                <div
                  className="
                    rounded-xl
                    border
                    border-red-200
                    bg-red-50
                    px-4
                    py-3
                    text-xs
                    text-red-700
                  "
                >
                  {error}
                </div>
              )}

              {/* ACCESO */}

              <section>
                <h3
                  className="
                    text-xs
                    font-bold
                    uppercase
                    tracking-wide
                    text-slate-500
                  "
                >
                  Información de acceso
                </h3>

                <div
                  className="
                    mt-4
                    grid
                    grid-cols-1
                    gap-4

                    md:grid-cols-2
                  "
                >
                  <div>
                    <label
                      className="
                        mb-2
                        block
                        text-xs
                        font-bold
                        text-slate-700
                      "
                    >
                      Área / Usuario
                    </label>

                    <input
                      type="text"
                      required
                      disabled={
                        editing
                          ?.nombre
                          .trim()
                          .toUpperCase() ===
                        "SISTEMAS"
                      }
                      value={
                        nombre
                      }
                      onChange={(
                        event,
                      ) =>
                        setNombre(
                          event.target
                            .value,
                        )
                      }
                      placeholder="Ej. SST"
                      className="
                        h-10
                        w-full
                        rounded-xl
                        border
                        border-slate-200
                        px-3
                        text-xs
                        outline-none

                        focus:border-[#13A7C7]

                        disabled:bg-slate-100
                      "
                    />
                  </div>

                  <div>
                    <label
                      className="
                        mb-2
                        block
                        text-xs
                        font-bold
                        text-slate-700
                      "
                    >
                      <span
                        className="
                          inline-flex
                          items-center
                          gap-2
                        "
                      >
                        <KeyRound
                          size={13}
                        />

                        {editing
                          ? "Nueva contraseña"
                          : "Contraseña"}
                      </span>
                    </label>

                    <input
                      type="password"
                      required={
                        !editing
                      }
                      value={
                        clave
                      }
                      onChange={(
                        event,
                      ) =>
                        setClave(
                          event.target
                            .value,
                        )
                      }
                      placeholder={
                        editing
                          ? "Vacía = conservar actual"
                          : "Mínimo 8 caracteres"
                      }
                      className="
                        h-10
                        w-full
                        rounded-xl
                        border
                        border-slate-200
                        px-3
                        text-xs
                        outline-none

                        focus:border-[#13A7C7]
                      "
                    />
                  </div>
                </div>

                {editing &&
                  editing.nombre
                    .trim()
                    .toUpperCase() !==
                    "SISTEMAS" && (
                    <label
                      className="
                        mt-4
                        flex
                        items-center
                        gap-3
                        rounded-xl
                        border
                        border-slate-200
                        bg-slate-50
                        p-4
                      "
                    >
                      <input
                        type="checkbox"
                        checked={
                          activo
                        }
                        onChange={(
                          event,
                        ) =>
                          setActivo(
                            event.target
                              .checked,
                          )
                        }
                      />

                      <div>
                        <p
                          className="
                            text-xs
                            font-bold
                            text-slate-700
                          "
                        >
                          Usuario activo
                        </p>

                        <p
                          className="
                            mt-0.5
                            text-[9px]
                            text-slate-400
                          "
                        >
                          Si está inactivo no
                          podrá iniciar sesión.
                        </p>
                      </div>
                    </label>
                  )}
              </section>

              {/* CORREOS */}

              <section
                className="
                  border-t
                  border-slate-100
                  pt-6
                "
              >
                <div
                  className="
                    flex
                    items-center
                    justify-between
                    gap-3
                  "
                >
                  <div>
                    <h3
                      className="
                        flex
                        items-center
                        gap-2
                        text-xs
                        font-bold
                        text-slate-700
                      "
                    >
                      <Mail
                        size={15}
                        className="text-[#00739B]"
                      />

                      Correos electrónicos
                    </h3>

                    <p
                      className="
                        mt-1
                        text-[10px]
                        text-slate-400
                      "
                    >
                      Puedes registrar varios
                      correos por área.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={
                      addCorreo
                    }
                    className="
                      inline-flex
                      h-9
                      items-center
                      gap-1.5
                      rounded-xl
                      border
                      border-[#13A7C7]
                      px-3
                      text-[10px]
                      font-bold
                      text-[#00739B]
                    "
                  >
                    <Plus
                      size={13}
                    />

                    Agregar
                  </button>
                </div>

                <div
                  className="
                    mt-4
                    space-y-2
                  "
                >
                  {correos.map(
                    (
                      item,
                      index,
                    ) => (
                      <div
                        key={
                          index
                        }
                        className="
                          grid
                          grid-cols-[1fr_auto_auto]
                          items-center
                          gap-2
                          rounded-xl
                          border
                          border-slate-200
                          bg-slate-50
                          p-2
                        "
                      >
                        <input
                          type="email"
                          value={
                            item.correo
                          }
                          onChange={(
                            event,
                          ) =>
                            updateCorreo(
                              index,
                              event.target
                                .value,
                            )
                          }
                          placeholder="correo@demetalicos.com"
                          className="
                            h-9
                            min-w-0
                            rounded-lg
                            border
                            border-slate-200
                            bg-white
                            px-3
                            text-xs
                            outline-none
                          "
                        />

                        <label
                          className="
                            flex
                            cursor-pointer
                            items-center
                            gap-1.5
                            px-2
                            text-[9px]
                            font-semibold
                            text-slate-500
                          "
                        >
                          <input
                            type="radio"
                            name="correo-principal"
                            checked={
                              item.esPrincipal
                            }
                            onChange={() =>
                              setCorreoPrincipal(
                                index,
                              )
                            }
                          />

                          <Star
                            size={11}
                          />

                          Principal
                        </label>

                        <button
                          type="button"
                          onClick={() =>
                            removeCorreo(
                              index,
                            )
                          }
                          className="
                            flex
                            h-8
                            w-8
                            items-center
                            justify-center
                            rounded-lg
                            text-red-400

                            hover:bg-red-50
                          "
                        >
                          <Trash2
                            size={13}
                          />
                        </button>
                      </div>
                    ),
                  )}

                  {correos.length ===
                    0 && (
                    <div
                      className="
                        rounded-xl
                        border
                        border-dashed
                        border-slate-200
                        bg-slate-50
                        px-4
                        py-5
                        text-center
                        text-[10px]
                        text-slate-400
                      "
                    >
                      Sin correos asociados.
                    </div>
                  )}
                </div>
              </section>

              {/* CELULARES */}

              <section
                className="
                  border-t
                  border-slate-100
                  pt-6
                "
              >
                <div
                  className="
                    flex
                    items-center
                    justify-between
                    gap-3
                  "
                >
                  <div>
                    <h3
                      className="
                        flex
                        items-center
                        gap-2
                        text-xs
                        font-bold
                        text-slate-700
                      "
                    >
                      <Phone
                        size={15}
                        className="text-[#00739B]"
                      />

                      Números de celular
                    </h3>

                    <p
                      className="
                        mt-1
                        text-[10px]
                        text-slate-400
                      "
                    >
                      Puedes registrar varios
                      números por área.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={
                      addCelular
                    }
                    className="
                      inline-flex
                      h-9
                      items-center
                      gap-1.5
                      rounded-xl
                      border
                      border-[#13A7C7]
                      px-3
                      text-[10px]
                      font-bold
                      text-[#00739B]
                    "
                  >
                    <Plus
                      size={13}
                    />

                    Agregar
                  </button>
                </div>

                <div
                  className="
                    mt-4
                    space-y-2
                  "
                >
                  {celulares.map(
                    (
                      item,
                      index,
                    ) => (
                      <div
                        key={
                          index
                        }
                        className="
                          grid
                          grid-cols-[1fr_auto_auto]
                          items-center
                          gap-2
                          rounded-xl
                          border
                          border-slate-200
                          bg-slate-50
                          p-2
                        "
                      >
                        <input
                          type="tel"
                          value={
                            item.celular
                          }
                          onChange={(
                            event,
                          ) =>
                            updateCelular(
                              index,
                              event.target
                                .value,
                            )
                          }
                          placeholder="+57 300 123 4567"
                          className="
                            h-9
                            min-w-0
                            rounded-lg
                            border
                            border-slate-200
                            bg-white
                            px-3
                            text-xs
                            outline-none
                          "
                        />

                        <label
                          className="
                            flex
                            cursor-pointer
                            items-center
                            gap-1.5
                            px-2
                            text-[9px]
                            font-semibold
                            text-slate-500
                          "
                        >
                          <input
                            type="radio"
                            name="celular-principal"
                            checked={
                              item.esPrincipal
                            }
                            onChange={() =>
                              setCelularPrincipal(
                                index,
                              )
                            }
                          />

                          <Star
                            size={11}
                          />

                          Principal
                        </label>

                        <button
                          type="button"
                          onClick={() =>
                            removeCelular(
                              index,
                            )
                          }
                          className="
                            flex
                            h-8
                            w-8
                            items-center
                            justify-center
                            rounded-lg
                            text-red-400

                            hover:bg-red-50
                          "
                        >
                          <Trash2
                            size={13}
                          />
                        </button>
                      </div>
                    ),
                  )}

                  {celulares.length ===
                    0 && (
                    <div
                      className="
                        rounded-xl
                        border
                        border-dashed
                        border-slate-200
                        bg-slate-50
                        px-4
                        py-5
                        text-center
                        text-[10px]
                        text-slate-400
                      "
                    >
                      Sin celulares asociados.
                    </div>
                  )}
                </div>
              </section>

              {/* BOTONES */}

              <div
                className="
                  flex
                  justify-end
                  gap-3
                  border-t
                  border-slate-100
                  pt-5
                "
              >
                <button
                  type="button"
                  disabled={
                    saving
                  }
                  onClick={
                    closeModal
                  }
                  className="
                    h-10
                    rounded-xl
                    border
                    border-slate-200
                    px-5
                    text-xs
                    font-semibold
                    text-slate-600

                    disabled:opacity-50
                  "
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={
                    saving
                  }
                  className="
                    inline-flex
                    h-10
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    bg-[#00739B]
                    px-5
                    text-xs
                    font-bold
                    text-white

                    disabled:opacity-60
                  "
                >
                  {saving ? (
                    <LoaderCircle
                      size={14}
                      className="animate-spin"
                    />
                  ) : editing ? (
                    <Pencil
                      size={14}
                    />
                  ) : (
                    <Plus
                      size={14}
                    />
                  )}

                  {editing
                    ? "Guardar cambios"
                    : "Crear usuario"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

/* =========================================================
   SUMMARY
========================================================= */

const Summary = ({
  title,
  value,
}: {
  title:
    string;

  value:
    number;
}) => {
  return (
    <div
      className="
        rounded-2xl
        border
        border-slate-200
        bg-white
        p-5
        shadow-sm
      "
    >
      <p
        className="
          text-xs
          text-slate-500
        "
      >
        {title}
      </p>

      <p
        className="
          mt-1
          text-2xl
          font-bold
          text-slate-800
        "
      >
        {value}
      </p>
    </div>
  );
};

/* =========================================================
   TABLE HEADER
========================================================= */

const TableHeader = ({
  children,
  right = false,
}: {
  children:
    ReactNode;

  right?:
    boolean;
}) => {
  return (
    <th
      className={`
        px-5
        py-3
        text-[10px]
        font-bold
        uppercase
        text-slate-500

        ${
          right
            ? "text-right"
            : "text-left"
        }
      `}
    >
      {children}
    </th>
  );
};

export default Usuarios;