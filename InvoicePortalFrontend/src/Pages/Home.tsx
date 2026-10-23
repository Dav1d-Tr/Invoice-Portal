import { Check, FileText, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

// Se conservan TUS componentes. No se utiliza InvoiceBoardRestorable.
import InvoiceBoard from "../Components/InvoiceBoard";
import InvoiceFilters from "../Components/InvoiceFilters";
import type { InvoiceFiltersValue } from "../Components/InvoiceFilters";
import StatCard from "../Components/StatCard";

import { getFacturas } from "../services/facturasService";
import type { Invoice } from "../services/facturasService";
import { getStoredArea } from "../services/authService";
import { getResumenArea } from "../services/historialService";
import type { ResumenArea } from "../services/historialService";
import { matchesBogotaDate } from "../utils/dateFilters";
import { matchesBogotaRange, readCalendar } from "../utils/calendarDates";
import type { CalendarRange } from "../utils/calendarDates";
import { subscribeFacturasUpdated } from "../utils/invoiceNavigation";

const EMPTY_FILTERS: InvoiceFiltersValue = {
  search: "",
  status: "",
  supplier: "",
  date: "",
};

/**
 * El filtro de fecha de InvoiceFilters es un tipo literal (DateFilter),
 * no cualquier string. Validamos el valor recuperado de localStorage
 * antes de colocarlo en el estado del componente.
 */
function parseStoredDate(value: unknown): InvoiceFiltersValue["date"] {
  if (
    value === "" ||
    value === "hoy" ||
    value === "semana" ||
    value === "mes" ||
    value === "anio"
  ) {
    return value as InvoiceFiltersValue["date"];
  }
  return "";
}

function readStoredFilters(key: string): InvoiceFiltersValue {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(key) ?? "null");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ...EMPTY_FILTERS };
    }
    const value = parsed as Record<string, unknown>;
    return {
      search: typeof value.search === "string" ? value.search : "",
      status: typeof value.status === "string" ? value.status : "",
      supplier: typeof value.supplier === "string" ? value.supplier : "",
      date: parseStoredDate(value.date),
    };
  } catch {
    return { ...EMPTY_FILTERS };
  }
}

function storeValue(key: string, value: unknown, empty = false): void {
  try {
    if (empty) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // No impedir el uso cuando el navegador bloquea localStorage.
  }
}

// Mantener la referencia evita reiniciar una tabla que observa invoices
// cuando el servidor devuelve exactamente la misma información.
function sameInvoices(previous: Invoice[], next: Invoice[]): boolean {
  return previous.length === next.length && previous.every(
    (invoice, index) => JSON.stringify(invoice) === JSON.stringify(next[index]),
  );
}

export interface HomeProps {
  active?: boolean;
  onContentReady?: () => void;
}

function HomeForArea({
  areaId,
  active = true,
  onContentReady,
}: HomeProps & { areaId: number }) {
  const filterStorageKey = `sgaf:facturas:filtros:${areaId || "sin-area"}`;
  const calendarStorageKey = `sgaf:facturas:calendario:${areaId}`;

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [globalSummary, setGlobalSummary] = useState<ResumenArea | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summaryWarning, setSummaryWarning] = useState<string | null>(null);
  const [filters, setFilters] = useState<InvoiceFiltersValue>(() => readStoredFilters(filterStorageKey));
  const [calendar, setCalendar] = useState<CalendarRange>(() => readCalendar(calendarStorageKey));

  const mounted = useRef(false);
  const visible = useRef(active);
  const loaded = useRef(false);
  const needsRefresh = useRef(true);
  const requestVersion = useRef(0);

  useLayoutEffect(() => {
    visible.current = active;
    // Al volver se revalidan los datos sin desmontar la tabla visible.
    if (!active) needsRefresh.current = true;
  }, [active]);

  useEffect(() => {
    storeValue(filterStorageKey, filters, Object.values(filters).every(value => !value));
  }, [filters, filterStorageKey]);

  useEffect(() => {
    storeValue(calendarStorageKey, calendar,
      calendar.mode === "rapido" && !calendar.from && !calendar.to);
  }, [calendar, calendarStorageKey]);

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    needsRefresh.current = true;
    setRefreshing(true);
    // No desmontar las filas al revalidar una bandeja ya cargada.
    if (!loaded.current) setLoading(true);
    setError(null);
    setSummaryWarning(null);

    const [invoiceResult, summaryResult] = await Promise.allSettled([
      Promise.resolve().then(() => getFacturas()),
      Promise.resolve().then(() => getResumenArea()),
    ]);
    if (!mounted.current || requestVersion.current !== version) return;

    if (invoiceResult.status === "fulfilled") {
      setInvoices(previous => sameInvoices(previous, invoiceResult.value) ? previous : invoiceResult.value);
      loaded.current = true;
    } else {
      setError(invoiceResult.reason instanceof Error
        ? invoiceResult.reason.message
        : "No fue posible cargar las facturas.");
    }
    if (summaryResult.status === "fulfilled") {
      setGlobalSummary(summaryResult.value);
    } else {
      setGlobalSummary(null);
      setSummaryWarning("No fue posible cargar el resumen global. Las tarjetas muestran temporalmente los datos de la bandeja.");
    }
    needsRefresh.current = !visible.current;
    setRefreshing(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    mounted.current = true;
    const unsubscribe = subscribeFacturasUpdated(() => {
      needsRefresh.current = true;
      if (visible.current) void load();
    });
    return () => {
      mounted.current = false;
      needsRefresh.current = true;
      ++requestVersion.current;
      unsubscribe();
    };
  }, [load]);

  useEffect(() => {
    if (active && needsRefresh.current) void load();
  }, [active, load]);

  useLayoutEffect(() => {
    if (active && !loading && !refreshing && !needsRefresh.current) {
      onContentReady?.();
    }
  }, [active, loading, refreshing, invoices, onContentReady]);

  const changeFilters = (next: InvoiceFiltersValue) => {
    setFilters(next);
    // Elegir otro período habitual vuelve a activarlo. No se aplica
    // simultáneamente un rango oculto y, por ejemplo, "Hoy".
    if (next.date !== filters.date) {
      setCalendar(current => ({ ...current, mode: "rapido" }));
    }
  };

  const suppliers = useMemo(
    () => Array.from(new Set(invoices.map(invoice => invoice.proveedor))).sort(),
    [invoices],
  );

  const filteredInvoices = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return invoices.filter(invoice => {
      if (filters.status && invoice.estadoCodigo !== filters.status) return false;
      if (filters.supplier && invoice.proveedor !== filters.supplier) return false;
      if (calendar.mode === "calendario") {
        if (!matchesBogotaRange(invoice.fechaRecepcion, calendar.from, calendar.to)) return false;
      } else {
        try {
          if (!matchesBogotaDate(invoice.fechaRecepcion, filters.date)) return false;
        } catch {
          if (filters.date) return false;
        }
      }
      if (!search) return true;
      return [invoice.proveedor, invoice.nit ?? "", invoice.numeroFactura ?? "",
        invoice.correo ?? "", invoice.asunto ?? ""]
        .join(" ").toLowerCase().includes(search);
    });
  }, [invoices, filters, calendar]);

  const localSummary = useMemo(() => ({
    total: invoices.length,
    pendientes: invoices.filter(invoice => invoice.estadoCodigo === "PENDIENTE").length,
    aprobadas: invoices.filter(invoice => invoice.estadoCodigo === "APROBADA").length,
    rechazadas: invoices.filter(invoice => invoice.estadoCodigo === "RECHAZADA").length,
  }), [invoices]);

  const summary = {
    total: globalSummary?.totalGestionadas ?? localSummary.total,
    pendientes: globalSummary?.pendientesActuales ?? localSummary.pendientes,
    aprobadas: globalSummary?.aprobadas ?? localSummary.aprobadas,
    rechazadas: globalSummary?.rechazadas ?? localSummary.rechazadas,
  };

  return (
    <>
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Gestión de facturas</h1>
        <p className="mt-1 text-sm text-slate-500">
          La tabla muestra la bandeja actual del área. Las tarjetas conservan el control histórico global de aprobaciones y rechazos.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total gestionadas" value={summary.total} icon={FileText}
          iconColor="text-[#13B8D4]" iconBackground="bg-[#13B8D4]/15" />
        <StatCard title="Pendientes actuales" value={summary.pendientes} icon={FileText}
          iconColor="text-[#D99A1C]" iconBackground="bg-[#D99A1C]/15" />
        <StatCard title="Aprobadas" value={summary.aprobadas} icon={Check}
          iconColor="text-[#159E67]" iconBackground="bg-[#159E67]/15" />
        <StatCard title="Rechazadas" value={summary.rechazadas} icon={X}
          iconColor="text-[#E34C4C]" iconBackground="bg-[#E34C4C]/15" />
      </section>

      {error && (
        <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {error}{invoices.length > 0 && " La bandeja puede estar desactualizada."}
          <button type="button" disabled={refreshing} onClick={() => void load()}
            className="ml-3 font-semibold underline disabled:opacity-50">Reintentar</button>
        </div>
      )}
      {summaryWarning && <p role="status" className="mt-3 text-xs text-amber-700">{summaryWarning}</p>}

      <InvoiceFilters
        value={filters}
        suppliers={suppliers}
        onChange={changeFilters}
        calendar={calendar}
        onCalendarChange={setCalendar}
      />

      <InvoiceBoard invoices={filteredInvoices} loading={loading} />
    </>
  );
}

export default function Home(props: HomeProps = {}) {
  const areaId = Number(getStoredArea()?.id ?? 0);
  return <HomeForArea key={areaId} areaId={areaId} {...props} />;
}
