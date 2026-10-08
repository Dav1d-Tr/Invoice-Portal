import {
  ArrowRight,
  Inbox,
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
  getFacturasRemitidas,
  type Invoice,
} from "../services/facturasService";

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
    null |
    undefined,

  currency:
    string |
    null |
    undefined,
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
        maximumFractionDigits: 0,
      },
    ).format(parsed);
  } catch {
    return `${parsed.toLocaleString("es-CO")} ${currency ?? ""}`.trim();
  }
};

const statusClasses: Record<string, string> = {
  PENDIENTE:
    "bg-amber-50 text-amber-700 border-amber-200",
  APROBADA:
    "bg-emerald-50 text-emerald-700 border-emerald-200",
  RECHAZADA:
    "bg-red-50 text-red-700 border-red-200",
  PROCESADA:
    "bg-sky-50 text-sky-700 border-sky-200",
  REMITIDA:
    "bg-violet-50 text-violet-700 border-violet-200",
};

export default function Remitidos() {
  const navigate =
    useNavigate();

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
              await getFacturasRemitidas();

            if (active) {
              setItems(data);
            }
          } catch (loadError) {
            if (active) {
              setError(
                loadError instanceof Error
                  ? loadError.message
                  : "No fue posible consultar las facturas remitidas.",
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
                  item.remitidaDesde ??
                  item.areaOrigen,
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
            const sourceArea =
              item.remitidaDesde ??
              item.areaOrigen;

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
              sourceArea !== filters.area
            ) {
              return false;
            }

            if (
              !matchesBogotaDate(
                item.fechaRemision ??
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
              sourceArea,
              item.areaActual,
              item.estado,
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
    <div className="min-h-full">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Facturas remitidas
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Bandeja activa de documentos que otra área remitió al área en la que tienes sesión.
          </p>
        </div>

        {items.length > 0 && (
          <div className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm">
            {items.length} recibida{items.length === 1 ? "" : "s"}
          </div>
        )}
      </div>

      <HistoryFilters
        value={filters}
        suppliers={suppliers}
        areas={areas}
        areaLabel="Remitida desde"
        onChange={setFilters}
      />

      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading && (
          <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-slate-500">
            <LoaderCircle size={18} className="animate-spin" />
            Cargando facturas remitidas...
          </div>
        )}

        {!loading && error && (
          <div className="p-8 text-center text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <Inbox size={24} />
            </div>

            <p className="mt-4 font-semibold text-slate-800">
              No hay facturas remitidas
            </p>

            <p className="mt-1 max-w-md text-sm text-slate-500">
              {items.length > 0
                ? "No hay resultados que coincidan con los filtros."
                : "Cuando otra área remita una factura al área actual, aparecerá aquí."}
            </p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-275 w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Documento</th>
                  <th className="px-4 py-3">Proveedor</th>
                  <th className="px-4 py-3">Remitida desde</th>
                  <th className="px-4 py-3">Fecha remisión</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filtered.map(
                  (
                    item,
                  ) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/70"
                    >
                      <td className="px-4 py-4">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusClasses[item.estadoCodigo] ?? "border-slate-200 bg-slate-50 text-slate-600"}`}
                        >
                          {item.estado}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <p className="font-semibold text-slate-900">
                          {item.numeroFactura || "Número pendiente"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.tipoDocumento === "NOTA_CREDITO"
                            ? "Nota crédito"
                            : "Factura"}
                        </p>
                      </td>

                      <td className="px-4 py-4">
                        <p className="font-medium text-slate-800">
                          {item.proveedor}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.nit || item.correo || "—"}
                        </p>
                      </td>

                      <td className="px-4 py-4 font-medium text-slate-700">
                        {item.remitidaDesde || item.areaOrigen}
                      </td>

                      <td className="px-4 py-4 text-slate-600">
                        {formatDate(
                          item.fechaRemision ||
                          item.fechaRecepcion,
                        )}
                      </td>

                      <td className="px-4 py-4 font-semibold text-slate-800">
                        {formatMoney(
                          item.valorTotal,
                          item.moneda,
                        )}
                      </td>

                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/facturas/${item.id}`,
                            )
                          }
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-[#8E1A32] hover:text-[#8E1A32]"
                        >
                          Ver detalle
                          <ArrowRight size={15} />
                        </button>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
