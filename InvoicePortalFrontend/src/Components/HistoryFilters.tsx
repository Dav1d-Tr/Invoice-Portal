import {
  Search,
} from "lucide-react";

import type {
  DateFilterValue,
} from "../utils/dateFilters";

export interface HistoryFiltersValue {
  search: string;
  status: string;
  supplier: string;
  area: string;
  date: DateFilterValue;
}

interface HistoryFiltersProps {
  value: HistoryFiltersValue;
  suppliers: string[];
  areas: string[];
  areaLabel?: string;
  showStatus?: boolean;
  onChange: (
    value:
      HistoryFiltersValue,
  ) => void;
}

const HistoryFilters = ({
  value,
  suppliers,
  areas,
  areaLabel = "Área",
  showStatus = true,
  onChange,
}: HistoryFiltersProps) => {
  const update = <K extends keyof HistoryFiltersValue>(
    key:
      K,
    nextValue:
      HistoryFiltersValue[K],
  ) => {
    onChange({
      ...value,
      [key]:
        nextValue,
    });
  };

  const clear =
    () => {
      onChange({
        search: "",
        status: "",
        supplier: "",
        area: "",
        date: "",
      });
    };

  return (
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
      aria-label="Filtros"
    >
      <div
        className="
          grid
          grid-cols-1
          gap-3
          md:grid-cols-2
          xl:grid-cols-[minmax(280px,2fr)_140px_190px_180px_140px_150px]
        "
      >
        <div className="relative">
          <Search
            size={17}
            strokeWidth={1.8}
            aria-hidden="true"
            className="
              pointer-events-none
              absolute
              left-3
              top-1/2
              -translate-y-1/2
              text-slate-400
            "
          />

          <input
            type="search"
            value={value.search}
            onChange={(event) =>
              update(
                "search",
                event.target.value,
              )
            }
            placeholder="Buscar factura, proveedor, NIT o área..."
            className="
              h-10
              w-full
              rounded-xl
              border
              border-slate-200
              bg-[#F8FBFC]
              pl-10
              pr-4
              text-xs
              text-slate-700
              outline-none
              transition
              placeholder:text-slate-400
              hover:border-slate-300
              focus:border-[#13A7C7]
              focus:ring-2
              focus:ring-[#13A7C7]/15
            "
          />
        </div>

        {showStatus ? (
          <select
            value={value.status}
            onChange={(event) =>
              update(
                "status",
                event.target.value,
              )
            }
            className="
              h-10
              w-full
              rounded-xl
              border
              border-slate-200
              bg-white
              px-3
              text-xs
              text-slate-700
              outline-none
            "
          >
            <option value="">Estado</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="APROBADA">Aprobada</option>
            <option value="RECHAZADA">Rechazada</option>
            <option value="PROCESADA">Procesada</option>
          </select>
        ) : (
          <div />
        )}

        <select
          value={value.supplier}
          onChange={(event) =>
            update(
              "supplier",
              event.target.value,
            )
          }
          className="
            h-10
            w-full
            rounded-xl
            border
            border-slate-200
            bg-white
            px-3
            text-xs
            text-slate-700
            outline-none
          "
        >
          <option value="">Proveedor</option>
          {suppliers.map(
            (
              supplier,
            ) => (
              <option
                key={supplier}
                value={supplier}
              >
                {supplier}
              </option>
            ),
          )}
        </select>

        <select
          value={value.area}
          onChange={(event) =>
            update(
              "area",
              event.target.value,
            )
          }
          className="
            h-10
            w-full
            rounded-xl
            border
            border-slate-200
            bg-white
            px-3
            text-xs
            text-slate-700
            outline-none
          "
        >
          <option value="">{areaLabel}</option>
          {areas.map(
            (
              area,
            ) => (
              <option
                key={area}
                value={area}
              >
                {area}
              </option>
            ),
          )}
        </select>

        <select
          value={value.date}
          onChange={(event) =>
            update(
              "date",
              event.target.value as DateFilterValue,
            )
          }
          className="
            h-10
            w-full
            rounded-xl
            border
            border-slate-200
            bg-white
            px-3
            text-xs
            text-slate-700
            outline-none
          "
        >
          <option value="">Fecha</option>
          <option value="hoy">Hoy</option>
          <option value="semana">Esta semana</option>
          <option value="mes">Este mes</option>
          <option value="anio">Este año</option>
        </select>

        <button
          type="button"
          onClick={clear}
          className="
            h-10
            rounded-xl
            border
            border-slate-200
            bg-white
            px-4
            text-xs
            font-semibold
            text-[#00739B]
            transition
            hover:border-[#13A7C7]
            hover:bg-[#F2FBFD]
          "
        >
          Limpiar filtros
        </button>
      </div>
    </section>
  );
};

export default HistoryFilters;
