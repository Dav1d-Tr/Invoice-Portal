import {
  Search,
} from "lucide-react";

export type DateFilter =
  | ""
  | "hoy"
  | "semana"
  | "mes"
  | "anio";

export interface InvoiceFiltersValue {
  search: string;

  status: string;

  supplier: string;

  date:
    DateFilter;
}

interface InvoiceFiltersProps {
  value:
    InvoiceFiltersValue;

  suppliers:
    string[];

  onChange: (
    value:
      InvoiceFiltersValue,
  ) => void;
}

const InvoiceFilters = ({
  value,
  suppliers,
  onChange,
}: InvoiceFiltersProps) => {
  const update = (
    patch:
      Partial<
        InvoiceFiltersValue
      >,
  ) => {
    onChange({
      ...value,
      ...patch,
    });
  };

  const clear = () => {
    onChange({
      search: "",
      status: "",
      supplier: "",
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
    >
      <div
        className="
          grid
          grid-cols-1
          gap-3

          md:grid-cols-2

          lg:grid-cols-[minmax(300px,2fr)_140px_180px_140px_150px]
        "
      >
        {/* BUSCAR */}

        <div className="relative">
          <Search
            size={18}
            className="
              pointer-events-none
              absolute
              left-3
              top-1/2
              -translate-y-1/2
              text-slate-500
            "
          />

          <input
            type="search"
            value={
              value.search
            }
            onChange={(
              event,
            ) =>
              update({
                search:
                  event.target
                    .value,
              })
            }
            placeholder="Buscar proveedor, factura, NIT o correo..."
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
              outline-none

              focus:border-[#13A7C7]
              focus:ring-2
              focus:ring-[#13A7C7]/15
            "
          />
        </div>

        {/* ESTADO */}

        <select
          value={
            value.status
          }
          onChange={(
            event,
          ) =>
            update({
              status:
                event.target
                  .value,
            })
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
          <option value="">
            Estado
          </option>

          <option value="PENDIENTE">
            Pendiente
          </option>

          <option value="APROBADA">
            Aprobada
          </option>

          <option value="RECHAZADA">
            Rechazada
          </option>

          <option value="REMITIDA">
            Remitida
          </option>

          <option value="PROCESADA">
            Procesada
          </option>
        </select>

        {/* PROVEEDOR */}

        <select
          value={
            value.supplier
          }
          onChange={(
            event,
          ) =>
            update({
              supplier:
                event.target
                  .value,
            })
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
          <option value="">
            Proveedor
          </option>

          {suppliers.map(
            (supplier) => (
              <option
                key={
                  supplier
                }
                value={
                  supplier
                }
              >
                {supplier}
              </option>
            ),
          )}
        </select>

        {/* FECHA */}

        <select
          value={
            value.date
          }
          onChange={(
            event,
          ) =>
            update({
              date:
                event.target
                  .value as DateFilter,
            })
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
          <option value="">
            Fecha
          </option>

          <option value="hoy">
            Hoy
          </option>

          <option value="semana">
            Esta semana
          </option>

          <option value="mes">
            Este mes
          </option>

          <option value="anio">
            Este año
          </option>
        </select>

        <button
          type="button"
          onClick={
            clear
          }
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

            hover:bg-[#F2FBFD]
          "
        >
          Limpiar filtros
        </button>
      </div>
    </section>
  );
};

export default InvoiceFilters;