import {
  Eye,
  LoaderCircle,
  RotateCcw,
  XCircle,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import HistoryFilters from "../Components/HistoryFilters";

import type {
  HistoryFiltersValue,
} from "../Components/HistoryFilters";

import {
  getFacturasRechazadas,
  reactivarFactura,
} from "../services/facturasService";

import type {
  Invoice,
} from "../services/facturasService";

import {
  getStoredArea,
} from "../services/authService";

import {
  isSystemsArea,
} from "../utils/areaPermissions";

import {
  matchesBogotaDate,
} from "../utils/dateFilters";

const formatDate = (
  value:
    string |
    null |
    undefined,
): string => {
  if (!value) {
    return "—";
  }

  const date =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "es-CO",
    {
      dateStyle:
        "medium",

      timeStyle:
        "short",

      timeZone:
        "America/Bogota",
    },
  ).format(
    date,
  );
};

const formatMoney = (
  value:
    string |
    number |
    null |
    undefined,

  currency:
    string |
    null |
    undefined,
): string => {
  const parsed =
    Number(
      value,
    );

  if (
    !Number.isFinite(
      parsed,
    )
  ) {
    return "—";
  }

  try {
    return new Intl.NumberFormat(
      "es-CO",
      {
        style:
          "currency",

        currency:
          currency ||
          "COP",

        maximumFractionDigits:
          currency === "USD"
            ? 2
            : 0,
      },
    ).format(
      parsed,
    );
  } catch {
    return `${parsed.toLocaleString("es-CO")} ${currency ?? ""}`.trim();
  }
};

const Rechazadas = () => {
  const navigate =
    useNavigate();

  const currentArea =
    getStoredArea();

  const systems =
    isSystemsArea(
      currentArea?.nombre,
    );

  const [
    items,
    setItems,
  ] =
    useState<Invoice[]>([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    actionId,
    setActionId,
  ] =
    useState<number | null>(null);

  const [
    error,
    setError,
  ] =
    useState<string | null>(null);

  const [
    success,
    setSuccess,
  ] =
    useState<string | null>(null);

  const [
    filters,
    setFilters,
  ] =
    useState<HistoryFiltersValue>({
      search: "",
      status: "",
      supplier: "",
      area: "",
      date: "",
    });

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
          await getFacturasRechazadas();

        setItems(
          data,
        );
      } catch (
        loadError
      ) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No fue posible consultar las facturas rechazadas.",
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

  const suppliers =
    useMemo(
      () =>
        Array.from(
          new Set(
            items.map(
              (
                item,
              ) =>
                item.proveedor,
            ),
          ),
        ).sort(),
      [items],
    );

  const areas =
    useMemo(
      () =>
        Array.from(
          new Set(
            items
              .map(
                (
                  item,
                ) =>
                  item.rechazadaPor,
              )
              .filter(
                (
                  value,
                ): value is string =>
                  Boolean(
                    value,
                  ),
              ),
          ),
        ).sort(),
      [items],
    );

  const filtered =
    useMemo(
      () => {
        const search =
          filters.search
            .trim()
            .toLowerCase();

        return items.filter(
          (
            item,
          ) => {
            if (
              filters.supplier &&
              item.proveedor !==
                filters.supplier
            ) {
              return false;
            }

            if (
              filters.area &&
              item.rechazadaPor !==
                filters.area
            ) {
              return false;
            }

            if (
              !matchesBogotaDate(
                item.fechaRechazo ??
                item.fechaRecepcion,
                filters.date,
              )
            ) {
              return false;
            }

            if (!search) {
              return true;
            }

            return [
              item.numeroFactura ?? "",
              item.proveedor,
              item.nit ?? "",
              item.correo ?? "",
              item.areaActual,
              item.rechazadaPor ?? "",
              item.observacionRechazo ?? "",
            ]
              .join(" ")
              .toLowerCase()
              .includes(
                search,
              );
          },
        );
      },
      [
        items,
        filters,
      ],
    );

  const handleReactivate =
    async (
      invoice:
        Invoice,
    ) => {
      if (!systems) {
        return;
      }

      const observation =
        window.prompt(
          "Observación de reactivación (opcional). Pulsa Cancelar para no continuar:",
          "",
        );

      if (
        observation ===
        null
      ) {
        return;
      }

      try {
        setActionId(
          invoice.id,
        );

        setError(
          null,
        );

        setSuccess(
          null,
        );

        await reactivarFactura(
          invoice.id,
          observation,
        );

        setItems(
          (
            current,
          ) =>
            current.filter(
              (
                item,
              ) =>
                item.id !==
                invoice.id,
            ),
        );

        setSuccess(
          `La factura ${invoice.numeroFactura ?? `#${invoice.id}`} volvió a estado PENDIENTE.`,
        );
      } catch (
        actionError
      ) {
        setError(
          actionError instanceof Error
            ? actionError.message
            : "No fue posible reactivar la factura.",
        );
      } finally {
        setActionId(
          null,
        );
      }
    };

  return (
    <>
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <XCircle
              size={21}
            />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Facturas rechazadas
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {systems
                ? "SISTEMAS puede consultar todas las facturas actualmente rechazadas y reactivarlas cuando sea necesario."
                : "Historial de facturas rechazadas por el área actual."}
            </p>
          </div>
        </div>
      </header>

      {success && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-700">
          {success}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
          {error}
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs text-slate-400">
            Total rechazadas actuales
          </p>

          <strong className="mt-2 block text-2xl text-slate-800">
            {items.length}
          </strong>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs text-slate-400">
            Resultados con filtros
          </p>

          <strong className="mt-2 block text-2xl text-slate-800">
            {filtered.length}
          </strong>
        </div>
      </section>

      <HistoryFilters
        value={filters}
        suppliers={suppliers}
        areas={areas}
        areaLabel="Rechazada por"
        showStatus={false}
        onChange={
          setFilters
        }
      />

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-slate-400">
            <LoaderCircle
              className="animate-spin"
              size={18}
            />

            Cargando rechazadas...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex min-h-56 items-center justify-center px-6 text-center text-sm text-slate-400">
            No hay facturas rechazadas para mostrar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-280 w-full text-left">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3">Factura</th>
                  <th className="px-4 py-3">Proveedor</th>
                  <th className="px-4 py-3">Área actual</th>
                  <th className="px-4 py-3">Rechazada por</th>
                  <th className="px-4 py-3">Fecha rechazo</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Observación</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filtered.map(
                  (
                    item,
                  ) => (
                    <tr
                      key={
                        item.id
                      }
                      className="text-xs text-slate-600 transition hover:bg-slate-50/70"
                    >
                      <td className="px-4 py-4">
                        <p className="font-bold text-slate-800">
                          {item.numeroFactura ?? `#${item.id}`}
                        </p>

                        <span className="mt-1 inline-flex rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[9px] font-bold text-red-700">
                          Rechazada
                        </span>
                      </td>

                      <td className="max-w-64 px-4 py-4">
                        <p
                          className="truncate font-semibold text-slate-700"
                          title={
                            item.proveedor
                          }
                        >
                          {item.proveedor}
                        </p>

                        <p className="mt-1 text-[9px] text-slate-400">
                          NIT {item.nit ?? "—"}
                        </p>
                      </td>

                      <td className="px-4 py-4 font-semibold text-slate-700">
                        {item.areaActual}
                      </td>

                      <td className="px-4 py-4 font-semibold text-slate-700">
                        {item.rechazadaPor ?? "—"}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4">
                        {formatDate(
                          item.fechaRechazo,
                        )}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 font-semibold text-slate-700">
                        {formatMoney(
                          item.valorTotal,
                          item.moneda,
                        )}
                      </td>

                      <td className="max-w-80 px-4 py-4">
                        <p
                          className="line-clamp-3"
                          title={
                            item.observacionRechazo ??
                            ""
                          }
                        >
                          {item.observacionRechazo ?? "—"}
                        </p>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              navigate(
                                `/facturas/${item.id}`,
                              )
                            }
                            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-[10px] font-bold text-[#00739B] hover:border-[#13A7C7] hover:bg-[#F2FBFD]"
                          >
                            <Eye
                              size={14}
                            />

                            Ver detalle
                          </button>

                          {systems && (
                            <button
                              type="button"
                              disabled={
                                actionId ===
                                item.id
                              }
                              onClick={() =>
                                void handleReactivate(
                                  item,
                                )
                              }
                              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#00739B] px-3 text-[10px] font-bold text-white hover:bg-[#05627F] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {actionId ===
                              item.id ? (
                                <LoaderCircle
                                  className="animate-spin"
                                  size={14}
                                />
                              ) : (
                                <RotateCcw
                                  size={14}
                                />
                              )}

                              Reactivar
                            </button>
                          )}
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
    </>
  );
};

export default Rechazadas;
