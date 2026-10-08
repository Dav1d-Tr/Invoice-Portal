import {
    Building2,
    Edit3,
    LoaderCircle,
    Mail,
    Plus,
    RefreshCw,
    Save,
    Search,
    Trash2,
    X,
} from "lucide-react";

import {
    useEffect,
    useMemo,
    useState,
} from "react";

import type {
    FormEvent,
} from "react";

import {
    getAreas,
} from "../services/authService";

import type {
    Area,
} from "../services/authService";

import {
    actualizarProveedor,
    crearProveedor,
    eliminarProveedor,
    getProveedores,
    sincronizarProveedor,
} from "../services/proveedoresService";

import type {
    Proveedor,
} from "../services/proveedoresService";

const Configuracion = () => {
    const [
        areas,
        setAreas,
    ] =
        useState<
            Area[]
        >([]);

    const [
        proveedores,
        setProveedores,
    ] =
        useState<
            Proveedor[]
        >([]);

    const [
        editingId,
        setEditingId,
    ] =
        useState<
            number | null
        >(null);

    const [
        nombre,
        setNombre,
    ] =
        useState("");

    const [
        nit,
        setNit,
    ] =
        useState("");

    const [
        idArea,
        setIdArea,
    ] =
        useState("");

    const [
        correos,
        setCorreos,
    ] =
        useState<
            string[]
        >([
            "",
        ]);

    const [
        search,
        setSearch,
    ] =
        useState("");

    const [
        loading,
        setLoading,
    ] =
        useState(true);

    const [
        saving,
        setSaving,
    ] =
        useState(false);

    const [
        syncing,
        setSyncing,
    ] =
        useState<
            number | null
        >(null);

    const [
        message,
        setMessage,
    ] =
        useState<
            string | null
        >(null);

    const [
        error,
        setError,
    ] =
        useState<
            string | null
        >(null);

    const load =
        async () => {
            try {
                setLoading(
                    true,
                );

                const [
                    areaData,
                    providerData,
                ] =
                    await Promise.all([
                        getAreas(),
                        getProveedores(),
                    ]);

                setAreas(
                    areaData,
                );

                setProveedores(
                    providerData,
                );
            } catch (error) {
                setError(
                    error instanceof
                        Error
                        ? error.message
                        : "No fue posible cargar la configuración.",
                );
            } finally {
                setLoading(
                    false,
                );
            }
        };

    useEffect(() => {
        void load();
    }, []);

    const reset =
        () => {
            setEditingId(
                null,
            );

            setNombre("");

            setNit("");

            setIdArea("");

            setCorreos([
                "",
            ]);
        };

    const startEdit = (
        proveedor:
            Proveedor,
    ) => {
        setEditingId(
            proveedor.id,
        );

        setNombre(
            proveedor.nombre,
        );

        setNit(
            proveedor.nit ??
            "",
        );

        setIdArea(
            String(
                proveedor.idArea,
            ),
        );

        setCorreos(
            proveedor.correos
                .length
                ? proveedor.correos.map(
                    (correo) =>
                        correo.correo,
                )
                : [""],
        );

        window.scrollTo({
            top: 0,
            behavior:
                "smooth",
        });
    };

    const addEmail =
        () => {
            setCorreos(
                (current) => [
                    ...current,
                    "",
                ],
            );
        };

    const removeEmail =
        (
            index:
                number,
        ) => {
            setCorreos(
                (current) => {
                    const result =
                        current.filter(
                            (
                                _,
                                currentIndex,
                            ) =>
                                currentIndex !==
                                index,
                        );

                    return result
                        .length
                        ? result
                        : [""];
                },
            );
        };

    const save =
        async (
            event:
                FormEvent,
        ) => {
            event.preventDefault();

            setError(null);
            setMessage(null);

            const emails =
                Array.from(
                    new Set(
                        correos
                            .map(
                                (correo) =>
                                    correo
                                        .trim()
                                        .toLowerCase(),
                            )
                            .filter(
                                Boolean,
                            ),
                    ),
                );

            try {
                setSaving(
                    true,
                );

                const input = {
                    nombre:
                        nombre.trim(),

                    nit:
                        nit.trim() ||
                        null,

                    idArea:
                        Number(
                            idArea,
                        ),

                    /* Correos opcionales */

                    correos:
                        emails,
                };

                /* =======================================================
                   CREAR O ACTUALIZAR
              
                   LOS DOS DEVUELVEN GuardarProveedorResult
                ======================================================= */

                const result =
                    editingId
                        ? await actualizarProveedor(
                            editingId,
                            input,
                        )
                        : await crearProveedor(
                            input,
                        );

                const sync =
                    result.sincronizacion;

                /* =======================================================
                   OUTLOOK SINCRONIZADO
                ======================================================= */

                if (sync) {
                    const facturasReclasificadas =
                        Number(
                            (
                                sync as typeof sync & {
                                    facturasReclasificadas?: number;
                                }
                            ).facturasReclasificadas ??
                            0,
                        );

                    setMessage(
                        `${editingId ? "Proveedor actualizado" : "Proveedor registrado"}. ` +
                        `${sync.coincidencias} factura${sync.coincidencias === 1 ? "" : "s"} identificada${sync.coincidencias === 1 ? "" : "s"} para ${sync.proveedor}. ` +
                        `${facturasReclasificadas} factura${facturasReclasificadas === 1 ? "" : "s"} ` +
                        `${facturasReclasificadas === 1 ? "fue movida" : "fueron movidas"} desde RECEPCIÓN hacia ${sync.area}. ` +
                        `${sync.facturasCreadas} factura${sync.facturasCreadas === 1 ? "" : "s"} nueva${sync.facturasCreadas === 1 ? "" : "s"} ` +
                        `${sync.duplicadas} ya estaba${sync.duplicadas === 1 ? "" : "n"} registrada${sync.duplicadas === 1 ? "" : "s"} para este proveedor.`,
                    );
                }

                /* =======================================================
                   PROVEEDOR GUARDADO PERO OUTLOOK PRESENTÓ PROBLEMA
                ======================================================= */

                else if (
                    result.warning
                ) {
                    setMessage(
                        `${editingId ? "Proveedor actualizado" : "Proveedor registrado"} correctamente. ` +
                        `Sin embargo, Outlook no pudo completar la sincronización: ${result.warning}`,
                    );
                }

                /* =======================================================
                   SIN INFORMACIÓN DE SINCRONIZACIÓN
                ======================================================= */

                else {
                    setMessage(
                        editingId
                            ? "Proveedor actualizado correctamente."
                            : "Proveedor registrado correctamente.",
                    );
                }

                reset();

                await load();
            } catch (error) {
                setError(
                    error instanceof
                        Error
                        ? error.message
                        : "No fue posible guardar el proveedor.",
                );
            } finally {
                setSaving(
                    false,
                );
            }
        };

    const removeProvider =
        async (
            proveedor:
                Proveedor,
        ) => {
            if (
                !window.confirm(
                    `¿Eliminar ${proveedor.nombre}? El historial de facturas no será borrado.`,
                )
            ) {
                return;
            }

            try {
                await eliminarProveedor(
                    proveedor.id,
                );

                setMessage(
                    "Proveedor eliminado correctamente.",
                );

                if (
                    editingId ===
                    proveedor.id
                ) {
                    reset();
                }

                await load();
            } catch (error) {
                setError(
                    error instanceof
                        Error
                        ? error.message
                        : "No fue posible eliminar.",
                );
            }
        };

    const syncProvider =
        async (
            proveedor:
                Proveedor,
        ) => {
            try {
                setSyncing(
                    proveedor.id,
                );

                const result =
                    await sincronizarProveedor(
                        proveedor.id,
                    );

                const facturasReclasificadas =
                    Number(
                        (
                            result as typeof result & {
                                facturasReclasificadas?: number;
                            }
                        ).facturasReclasificadas ??
                        0,
                    );

                setMessage(
                    `${proveedor.nombre}: ${result.coincidencias} factura${result.coincidencias === 1 ? "" : "s"} identificada${result.coincidencias === 1 ? "" : "s"}. ` +
                    `${facturasReclasificadas} factura${facturasReclasificadas === 1 ? "" : "s"} ` +
                    `${facturasReclasificadas === 1 ? "fue movida" : "fueron movidas"} desde RECEPCIÓN hacia ${result.area}. ` +
                    `${result.facturasCreadas} nueva${result.facturasCreadas === 1 ? "" : "s"} y ` +
                    `${result.duplicadas} ya registrada${result.duplicadas === 1 ? "" : "s"} para este proveedor.`,
                );

                await load();
            } catch (error) {
                setError(
                    error instanceof
                        Error
                        ? error.message
                        : "Error sincronizando Outlook.",
                );
            } finally {
                setSyncing(
                    null,
                );
            }
        };

    const filtered =
        useMemo(
            () => {
                const value =
                    search
                        .trim()
                        .toLowerCase();

                if (!value) {
                    return proveedores;
                }

                return proveedores.filter(
                    (
                        proveedor,
                    ) =>
                        [
                            proveedor.nombre,
                            proveedor.nit ??
                            "",
                            proveedor.area,

                            ...proveedor.correos.map(
                                (correo) =>
                                    correo.correo,
                            ),
                        ]
                            .join(" ")
                            .toLowerCase()
                            .includes(
                                value,
                            ),
                );
            },
            [
                search,
                proveedores,
            ],
        );

    return (
        <>
            <header className="mb-8">
                <h1 className="text-2xl font-bold text-slate-800">
                    Configuración
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                    Configuración de proveedores,
                    área responsable y correos
                    opcionales.
                </p>
            </header>

            {message && (
                <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-700">
                    {message}
                </div>
            )}

            {error && (
                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
                    {error}
                </div>
            )}

            <div
                className="
          grid
          grid-cols-1
          gap-6
          xl:grid-cols-[420px_minmax(0,1fr)]
        "
            >
                {/* FORM */}

                <section className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-6 flex items-start justify-between">
                        <div>
                            <h2 className="font-bold text-slate-800">
                                {editingId
                                    ? "Editar proveedor"
                                    : "Registrar proveedor"}
                            </h2>

                            <p className="mt-1 text-xs text-slate-500">
                                La búsqueda en Outlook se
                                hará principalmente por el
                                nombre del proveedor.
                            </p>
                        </div>

                        {editingId && (
                            <button
                                type="button"
                                onClick={
                                    reset
                                }
                                className="text-slate-400 hover:text-slate-700"
                            >
                                <X
                                    size={18}
                                />
                            </button>
                        )}
                    </div>

                    <form
                        onSubmit={
                            save
                        }
                        className="space-y-5"
                    >
                        <Field
                            label="Proveedor"
                            value={
                                nombre
                            }
                            onChange={
                                setNombre
                            }
                            placeholder="Nombre del proveedor"
                            icon={
                                <Building2
                                    size={16}
                                />
                            }
                            required
                        />

                        <Field
                            label="NIT"
                            value={
                                nit
                            }
                            onChange={
                                setNit
                            }
                            placeholder="Opcional"
                        />

                        <div>
                            <label className="mb-2 block text-xs font-bold text-slate-700">
                                Área responsable
                            </label>

                            <select
                                required
                                value={
                                    idArea
                                }
                                onChange={(
                                    event,
                                ) =>
                                    setIdArea(
                                        event.target
                                            .value,
                                    )
                                }
                                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs"
                            >
                                <option value="">
                                    Seleccione
                                </option>

                                {areas.map(
                                    (area) => (
                                        <option
                                            key={
                                                area.id
                                            }
                                            value={
                                                area.id
                                            }
                                        >
                                            {
                                                area.nombre
                                            }
                                        </option>
                                    ),
                                )}
                            </select>
                        </div>

                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <label className="text-xs font-bold text-slate-700">
                                    Correos
                                    <span className="ml-1 font-normal text-slate-400">
                                        Opcionales
                                    </span>
                                </label>

                                <button
                                    type="button"
                                    onClick={
                                        addEmail
                                    }
                                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#00739B]"
                                >
                                    <Plus
                                        size={13}
                                    />

                                    Agregar
                                </button>
                            </div>

                            <div className="space-y-2">
                                {correos.map(
                                    (
                                        correo,
                                        index,
                                    ) => (
                                        <div
                                            key={
                                                index
                                            }
                                            className="flex gap-2"
                                        >
                                            <div className="relative flex-1">
                                                <Mail
                                                    size={15}
                                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                                                />

                                                <input
                                                    type="email"
                                                    value={
                                                        correo
                                                    }
                                                    onChange={(
                                                        event,
                                                    ) =>
                                                        setCorreos(
                                                            (
                                                                current,
                                                            ) =>
                                                                current.map(
                                                                    (
                                                                        value,
                                                                        currentIndex,
                                                                    ) =>
                                                                        currentIndex ===
                                                                            index
                                                                            ? event
                                                                                .target
                                                                                .value
                                                                            : value,
                                                                ),
                                                        )
                                                    }
                                                    placeholder="Opcional"
                                                    className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-xs"
                                                />
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    removeEmail(
                                                        index,
                                                    )
                                                }
                                                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:text-red-500"
                                            >
                                                <Trash2
                                                    size={14}
                                                />
                                            </button>
                                        </div>
                                    ),
                                )}
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={
                                saving
                            }
                            className="
                flex
                h-11
                w-full
                items-center
                justify-center
                gap-2
                rounded-xl
                bg-[#076C8F]
                text-xs
                font-bold
                text-white
              "
                        >
                            {saving ? (
                                <LoaderCircle
                                    size={16}
                                    className="animate-spin"
                                />
                            ) : (
                                <Save
                                    size={16}
                                />
                            )}

                            {editingId
                                ? "Guardar cambios"
                                : "Registrar y buscar facturas"}
                        </button>
                    </form>
                </section>

                {/* TABLE */}

                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 p-5">
                        <div className="relative max-w-md">
                            <Search
                                size={16}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            />

                            <input
                                type="search"
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
                                placeholder="Buscar proveedor..."
                                className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-xs"
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex min-h-60 items-center justify-center">
                            <LoaderCircle
                                className="animate-spin"
                            />
                        </div>
                    ) : (
                        <div className="overflow-x-auto p-4">
                            <table className="w-full min-w-225">
                                <thead>
                                    <tr className="bg-[#F6F9FA]">
                                        {[
                                            "Proveedor",
                                            "Área",
                                            "Correos",
                                            "Acciones",
                                        ].map(
                                            (
                                                title,
                                            ) => (
                                                <th
                                                    key={
                                                        title
                                                    }
                                                    className="px-4 py-3 text-left text-[10px] font-bold uppercase text-slate-500"
                                                >
                                                    {title}
                                                </th>
                                            ),
                                        )}
                                    </tr>
                                </thead>

                                <tbody>
                                    {filtered.map(
                                        (
                                            proveedor,
                                        ) => (
                                            <tr
                                                key={
                                                    proveedor.id
                                                }
                                                className="border-b border-slate-100"
                                            >
                                                <td className="px-4 py-4">
                                                    <p className="text-xs font-bold text-slate-800">
                                                        {
                                                            proveedor.nombre
                                                        }
                                                    </p>

                                                    <p className="mt-1 text-[10px] text-slate-400">
                                                        {proveedor.nit
                                                            ? `NIT ${proveedor.nit}`
                                                            : "Sin NIT"}
                                                    </p>
                                                </td>

                                                <td className="px-4 py-4 text-xs">
                                                    {
                                                        proveedor.area
                                                    }
                                                </td>

                                                <td className="px-4 py-4">
                                                    {proveedor.correos
                                                        .length ? (
                                                        <div className="flex flex-wrap gap-1">
                                                            {proveedor.correos.map(
                                                                (
                                                                    correo,
                                                                ) => (
                                                                    <span
                                                                        key={
                                                                            correo.id
                                                                        }
                                                                        className="rounded-lg bg-slate-100 px-2 py-1 text-[9px] text-slate-500"
                                                                    >
                                                                        {
                                                                            correo.correo
                                                                        }
                                                                    </span>
                                                                ),
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] text-slate-400">
                                                            Sin correos
                                                        </span>
                                                    )}
                                                </td>

                                                <td className="px-4 py-4">
                                                    <div className="flex gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                startEdit(
                                                                    proveedor,
                                                                )
                                                            }
                                                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-[#00739B]"
                                                            title="Editar"
                                                        >
                                                            <Edit3
                                                                size={13}
                                                            />
                                                        </button>

                                                        <button
                                                            type="button"
                                                            disabled={
                                                                syncing ===
                                                                proveedor.id
                                                            }
                                                            onClick={() =>
                                                                void syncProvider(
                                                                    proveedor,
                                                                )
                                                            }
                                                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-[#00739B]"
                                                            title="Sincronizar Outlook"
                                                        >
                                                            <RefreshCw
                                                                size={13}
                                                                className={
                                                                    syncing ===
                                                                        proveedor.id
                                                                        ? "animate-spin"
                                                                        : ""
                                                                }
                                                            />
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                void removeProvider(
                                                                    proveedor,
                                                                )
                                                            }
                                                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-500"
                                                            title="Eliminar"
                                                        >
                                                            <Trash2
                                                                size={13}
                                                            />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ),
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>
        </>
    );
};

const Field = ({
    label,
    value,
    onChange,
    placeholder,
    icon,
    required,
}: {
    label: string;

    value: string;

    onChange: (
        value:
            string,
    ) => void;

    placeholder:
    string;

    icon?:
    React.ReactNode;

    required?:
    boolean;
}) => (
    <div>
        <label className="mb-2 block text-xs font-bold text-slate-700">
            {label}
        </label>

        <div className="relative">
            {icon && (
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {icon}
                </div>
            )}

            <input
                required={
                    required
                }
                value={
                    value
                }
                onChange={(
                    event,
                ) =>
                    onChange(
                        event.target
                            .value,
                    )
                }
                placeholder={
                    placeholder
                }
                className={`
          h-10
          w-full
          rounded-xl
          border
          border-slate-200
          pr-3
          text-xs

          ${icon
                        ? "pl-9"
                        : "pl-3"
                    }
        `}
            />
        </div>
    </div>
);

export default Configuracion;