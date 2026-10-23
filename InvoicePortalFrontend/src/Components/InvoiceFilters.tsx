import { CalendarDays, Search } from "lucide-react";
import { useEffect, useState } from "react";
import type { CalendarRange } from "../utils/calendarDates";
import { EMPTY_CALENDAR, rangeError } from "../utils/calendarDates";

export type DateFilter = "" | "hoy" | "semana" | "mes" | "anio";

export interface InvoiceFiltersValue {
  search: string;
  status: string;
  supplier: string;
  date: DateFilter;
}

interface InvoiceFiltersProps {
  value: InvoiceFiltersValue;
  suppliers: string[];
  onChange: (value: InvoiceFiltersValue) => void;
  // Optional: existing callers keep working with only value/suppliers/onChange.
  calendar?: CalendarRange;
  onCalendarChange?: (value: CalendarRange) => void;
}

const fieldClass =
  "h-10 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none " +
  "focus:border-[#13A7C7] focus:ring-2 focus:ring-[#13A7C7]/15";

const calendarFieldClass =
  "h-10 w-full rounded-xl border border-slate-200 bg-[#F8FBFC] px-3 text-xs outline-none " +
  "focus:border-[#13A7C7] focus:ring-2 focus:ring-[#13A7C7]/15";

const InvoiceFilters = ({
  value,
  suppliers,
  onChange,
  calendar,
  onCalendarChange,
}: InvoiceFiltersProps) => {
  const range = calendar ?? EMPTY_CALENDAR;
  const hasCalendar = typeof onCalendarChange === "function";
  const [showCalendar, setShowCalendar] = useState(
    range.mode === "calendario",
  );

  useEffect(() => {
    if (range.mode === "calendario") setShowCalendar(true);
  }, [range.mode]);

  const update = (patch: Partial<InvoiceFiltersValue>) => {
    onChange({ ...value, ...patch });
  };

  const clear = () => {
    onChange({ search: "", status: "", supplier: "", date: "" });
    onCalendarChange?.({ ...EMPTY_CALENDAR });
    setShowCalendar(false);
  };

  const changeQuickDate = (date: DateFilter) => {
    update({ date });
    if (hasCalendar) onCalendarChange({ ...range, mode: "rapido" });
    setShowCalendar(false);
  };

  const updateRange = (patch: Partial<CalendarRange>) => {
    onCalendarChange?.({ ...range, ...patch, mode: "calendario" });
  };

  const changeFrom = (from: string) => {
    // Keep a valid inclusive range even when dates are entered out of order.
    updateRange({ from, to: from && range.to && from > range.to ? from : range.to });
  };

  const changeTo = (to: string) => {
    updateRange({ to, from: to && range.from && to < range.from ? to : range.from });
  };

  const calendarActive = hasCalendar && range.mode === "calendario";
  const error = rangeError(range.from, range.to);

  return (
    <section
      className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      aria-label="Filtros de facturas"
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-[minmax(275px,2fr)_140px_175px_170px_150px]">
        {/* BUSCAR */}
        <div className="relative">
          <Search
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            type="search"
            value={value.search}
            onChange={(event) => update({ search: event.target.value })}
            placeholder="Buscar proveedor, factura, NIT o correo..."
            aria-label="Buscar facturas"
            className="h-10 w-full rounded-xl border border-slate-200 bg-[#F8FBFC] pl-10 pr-4 text-xs outline-none focus:border-[#13A7C7] focus:ring-2 focus:ring-[#13A7C7]/15"
          />
        </div>

        {/* ESTADO */}
        <select
          aria-label="Estado"
          value={value.status}
          onChange={(event) => update({ status: event.target.value })}
          className={fieldClass}
        >
          <option value="">Estado</option>
          <option value="PENDIENTE">Pendiente</option>
          <option value="APROBADA">Aprobada</option>
          <option value="RECHAZADA">Rechazada</option>
          <option value="REMITIDA">Remitida</option>
          <option value="PROCESADA">Procesada</option>
        </select>

        {/* PROVEEDOR */}
        <select
          aria-label="Proveedor"
          value={value.supplier}
          onChange={(event) => update({ supplier: event.target.value })}
          className={fieldClass}
        >
          <option value="">Proveedor</option>
          {suppliers.map((supplier) => (
            <option key={supplier} value={supplier}>
              {supplier}
            </option>
          ))}
        </select>

        {/* FECHA: quick period + calendar within the SAME filter bar */}
        <div className="flex min-w-0 items-center gap-2">
          <select
            aria-label="Periodo de fecha"
            value={calendarActive ? "" : value.date}
            onChange={(event) => changeQuickDate(event.target.value as DateFilter)}
            className={`${fieldClass} flex-1`}
          >
            <option value="">Fecha</option>
            <option value="hoy">Hoy</option>
            <option value="semana">Esta semana</option>
            <option value="mes">Este mes</option>
            <option value="anio">Este año</option>
          </select>
          {hasCalendar && (
            <button
              type="button"
              aria-label={calendarActive ? "Editar rango de fechas activo" : "Abrir calendario para fechas"}
              aria-expanded={showCalendar}
              title={calendarActive ? "Rango de calendario activo" : "Seleccionar fechas en calendario"}
              onClick={() => setShowCalendar((previous) => !previous)}
              className={
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors " +
                (calendarActive
                  ? "border-[#13A7C7] bg-[#E5F8FB] text-[#00739B]"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-[#F2FBFD] hover:text-[#00739B]")
              }
            >
              <CalendarDays size={17} aria-hidden="true" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={clear}
          className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-[#00739B] hover:bg-[#F2FBFD]"
        >
          Limpiar filtros
        </button>
      </div>

      {/* These controls belong to InvoiceFilters, not a separate Home card. */}
      {hasCalendar && showCalendar && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <span className="flex h-10 items-center text-xs font-semibold text-slate-700">
              <CalendarDays size={15} className="mr-2 text-[#00739B]" aria-hidden="true" />
              Fecha de recepcion
            </span>
            <label className="flex min-w-36 flex-1 flex-col gap-1 text-xs text-slate-600 sm:max-w-48">
              Desde
              <input
                type="date"
                aria-label="Fecha desde"
                value={range.from}
                max={range.to || undefined}
                onChange={(event) => changeFrom(event.target.value)}
                className={calendarFieldClass}
              />
            </label>
            <label className="flex min-w-36 flex-1 flex-col gap-1 text-xs text-slate-600 sm:max-w-48">
              Hasta
              <input
                type="date"
                aria-label="Fecha hasta"
                value={range.to}
                min={range.from || undefined}
                onChange={(event) => changeTo(event.target.value)}
                className={calendarFieldClass}
              />
            </label>
            <button
              type="button"
              onClick={() => onCalendarChange?.({ ...EMPTY_CALENDAR })}
              className="h-10 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-[#00739B] hover:bg-[#F2FBFD]"
            >
              Limpiar rango
            </button>
            {calendarActive && (
              <span className="flex h-10 items-center text-xs font-semibold text-[#00739B]" role="status">
                Rango activo
              </span>
            )}
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Calendario alternativo: al elegir fechas se desactiva el periodo rapido.
            Ambos extremos se incluyen segun la fecha de Bogota.
          </p>
          {calendarActive && error && (
            <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>
          )}
        </div>
      )}
    </section>
  );
};

export default InvoiceFilters;
