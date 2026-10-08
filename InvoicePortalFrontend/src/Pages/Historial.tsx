import {
  ArrowRight,
  Clock3,
  FileClock,
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
} from "../Components/HistoryFilters"

import {
  getHistorialRemisiones,
} from "../services/historialService";

import type {
  HistorialRemisionItem,
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
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Bogota",
    },
  ).format(
    date,
  );
};

const statusClass = (
  code:
    string,
): string => {
  switch (code) {
    case "PENDIENTE":
      return "bg-amber-50 text-amber-700 border-amber-200";

    case "APROBADA":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";

    case "RECHAZADA":
      return "bg-red-50 text-red-700 border-red-200";

    case "PROCESADA":
      return "bg-sky-50 text-sky-700 border-sky-200";

    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
};

const Historial = () => {
  const navigate =
    useNavigate();

  const [
    items,
    setItems,
  ] =
    useState<HistorialRemisionItem[]>([]);

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
            setLoading(
              true,
            );

            setError(
              null,
            );

            const data =
              await getHistorialRemisiones();

            if (active) {
              setItems(
                data,
              );
            }
          } catch (loadError) {
            if (active) {
              setError(
                loadError instanceof Error
                  ? loadError.message
                  : "No fue posible consultar el historial.",
              );
            }
          } finally {
            if (active) {
              setLoading(
                false,
              );
            }
          }
        };

      void load();

      return () => {
        active =
          false;
      };
    },
    [],
  );

  const suppliers =
    useMemo(
      () =>
        Array.from(
          new Set(
            items
              .map(
                (
                  item,
                ) =>
                  item.proveedor,
              )
              .filter(Boolean),
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
                  item.remitidaA,
              )
              .filter(Boolean),
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
              filters.status &&
              item.estadoCodigo !== filters.status
            ) {
              return false;
            }

            if (
              filters.supplier &&
              item.proveedor !== filters.supplier
            ) {
              return false;
            }

            if (
              filters.area &&
              item.remitidaA !== filters.area
            ) {
              return false;
            }

            if (
              !matchesBogotaDate(
                item.fechaRemision,
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
              item.remitidaDesde,
              item.remitidaA,
              item.areaActual,
              item.observacion ?? "",
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

  return (
    <>
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <div
            className="
              flex
              h-10
              w-10
              items-center
              justify-center
              rounded-xl
              bg-[#13B8D4]/15
              text-[#13B8D4]
            "
          >
            <Clock3
              size={21}
              aria-hidden="true"
            />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Historial de remisiones
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Facturas que esta área remitió y que ya continuaron su flujo en otra área.
            </p>
          </div>
        </div>
      </header>

      <section
        className="
          grid
          grid-cols-1
          gap-4
          md:grid-cols-2
        "
      >
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
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
              <FileClock size={19} />
            </div>
            <div>
              <p className="text-xs text-slate-400">Remisiones históricas</p>
              <strong className="text-2xl text-slate-800">{items.length}</strong>
            </div>
          </div>
        </div>

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
        areaLabel="Área destino"
        onChange={setFilters}
      />

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
        {error && (
          <div className="border-b border-red-200 bg-red-50 px-5 py-4 text-xs text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-slate-400">
            <LoaderCircle className="animate-spin" size={18} />
            Cargando historial...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex min-h-56 items-center justify-center text-sm text-slate-400">
            No hay remisiones para mostrar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Factura</th>
                  <th className="px-4 py-3">Proveedor</th>
                  <th className="px-4 py-3">Ruta</th>
                  <th className="px-4 py-3">Fecha remisión</th>
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
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-bold ${statusClass(item.estadoCodigo)}`}
                        >
                          {item.estado}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <p className="font-bold text-slate-800">
                          {item.numeroFactura ?? `#${item.idFactura}`}
                        </p>
                        <p className="mt-1 text-[9px] text-slate-400">
                          {item.tipoDocumento === "NOTA_CREDITO"
                            ? "Nota crédito"
                            : "Factura"}
                        </p>
                      </td>

                      <td className="max-w-64 px-4 py-4">
                        <p className="truncate font-semibold text-slate-700" title={item.proveedor}>
                          {item.proveedor}
                        </p>
                        <p className="mt-1 text-[9px] text-slate-400">
                          NIT {item.nit ?? "—"}
                        </p>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <span>{item.remitidaDesde}</span>
                          <ArrowRight size={11} className="text-slate-300" />
                          <strong className="text-slate-700">{item.remitidaA}</strong>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-4 py-4">
                        {formatDate(item.fechaRemision)}
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

export default Historial;
