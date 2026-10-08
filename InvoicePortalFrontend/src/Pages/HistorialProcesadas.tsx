import {
  CheckCircle2,
  LoaderCircle,
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
  getHistorialProcesadas,
} from "../services/historialService";

import type {
  HistorialProcesadaItem,
} from "../services/historialService";

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
    new Date(value);

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
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Bogota",
    },
  ).format(date);
};

const formatMoney = (
  value:
    string |
    number |
    null,

  currency:
    string |
    null,
): string => {
  const parsed =
    Number(value);

  if (!Number.isFinite(parsed)) {
    return "—";
  }

  try {
    return new Intl.NumberFormat(
      "es-CO",
      {
        style: "currency",
        currency: currency || "COP",
        maximumFractionDigits:
          currency === "USD"
            ? 2
            : 0,
      },
    ).format(parsed);
  } catch {
    return `${parsed.toLocaleString("es-CO")} ${currency ?? ""}`.trim();
  }
};

const HistorialProcesadas = () => {
  const navigate =
    useNavigate();

  const [
    items,
    setItems,
  ] =
    useState<HistorialProcesadaItem[]>([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
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

  useEffect(
    () => {
      let active =
        true;

      const load =
        async () => {
          try {
            setLoading(true);
            setError(null);

            const data =
              await getHistorialProcesadas();

            if (active) {
              setItems(data);
            }
          } catch (loadError) {
            if (active) {
              setError(
                loadError instanceof Error
                  ? loadError.message
                  : "No fue posible consultar las facturas procesadas.",
              );
            }
          } finally {
            if (active) {
              setLoading(false);
            }
          }
        };

      void load();

      return () => {
        active = false;
      };
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
                  item.recibidaDesde,
              )
              .filter(
                (
                  value,
                ): value is string =>
                  Boolean(value),
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
              item.proveedor !== filters.supplier
            ) {
              return false;
            }

            if (
              filters.area &&
              item.recibidaDesde !== filters.area
            ) {
              return false;
            }

            if (
              !matchesBogotaDate(
                item.fechaProcesada,
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
              item.recibidaDesde ?? "",
              item.observacion ?? "",
            ]
              .join(" ")
              .toLowerCase()
              .includes(search);
          },
        );
      },
      [
        items,
        filters,
      ],
    );

  return (
    <>
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <CheckCircle2 size={21} />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Historial de procesadas
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Historial exclusivo de Contabilidad con las facturas que ya fueron procesadas.
            </p>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs text-slate-400">Total procesadas</p>
          <strong className="mt-2 block text-2xl text-slate-800">
            {items.length}
          </strong>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs text-slate-400">Resultados con filtros</p>
          <strong className="mt-2 block text-2xl text-slate-800">
            {filtered.length}
          </strong>
        </div>
      </section>

      <HistoryFilters
        value={filters}
        suppliers={suppliers}
        areas={areas}
        areaLabel="Recibida desde"
        showStatus={false}
        onChange={setFilters}
      />

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {error && (
          <div className="border-b border-red-200 bg-red-50 px-5 py-4 text-xs text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-slate-400">
            <LoaderCircle className="animate-spin" size={18} />
            Cargando procesadas...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex min-h-56 items-center justify-center text-sm text-slate-400">
            No hay facturas procesadas para mostrar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3">Factura</th>
                  <th className="px-4 py-3">Proveedor</th>
                  <th className="px-4 py-3">Recibida desde</th>
                  <th className="px-4 py-3">Fecha procesada</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filtered.map(
                  (
                    item,
                  ) => (
                    <tr
                      key={item.idEvento}
                      className="text-xs text-slate-600 transition hover:bg-slate-50/70"
                    >
                      <td className="px-4 py-4">
                        <p className="font-bold text-slate-800">
                          {item.numeroFactura ?? `#${item.idFactura}`}
                        </p>
                        <span className="mt-1 inline-flex rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[9px] font-bold text-sky-700">
                          Procesada
                        </span>
                      </td>

                      <td className="max-w-64 px-4 py-4">
                        <p className="truncate font-semibold text-slate-700" title={item.proveedor}>
                          {item.proveedor}
                        </p>
                        <p className="mt-1 text-[9px] text-slate-400">
                          NIT {item.nit ?? "—"}
                        </p>
                      </td>

                      <td className="px-4 py-4 font-semibold text-slate-700">
                        {item.recibidaDesde ?? item.areaOrigenFactura}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4">
                        {formatDate(item.fechaProcesada)}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4 font-semibold text-slate-700">
                        {formatMoney(item.valorTotal, item.moneda)}
                      </td>

                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/facturas/${item.idFactura}`,
                            )
                          }
                          className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-[#00739B] hover:border-[#13A7C7] hover:bg-[#F2FBFD]"
                        >
                          Ver detalle
                        </button>
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

export default HistorialProcesadas;
