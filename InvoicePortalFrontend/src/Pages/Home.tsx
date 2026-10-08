import {
  Check,
  FileText,
  X,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import InvoiceBoard from "../Components/InvoiceBoard";
import InvoiceFilters from "../Components/InvoiceFilters";

import type {
  InvoiceFiltersValue,
} from "../Components/InvoiceFilters";

import StatCard from "../Components/StatCard";

import {
  getFacturas,
} from "../services/facturasService";

import type {
  Invoice,
} from "../services/facturasService";

import {
  getStoredArea,
} from "../services/authService";

import {
  getResumenArea,
} from "../services/historialService";

import type {
  ResumenArea,
} from "../services/historialService";

import {
  matchesBogotaDate,
} from "../utils/dateFilters";

const EMPTY_FILTERS: InvoiceFiltersValue = {
  search: "",
  status: "",
  supplier: "",
  date: "",
};

const readStoredFilters = (
  key: string,
): InvoiceFiltersValue => {
  try {
    const raw =
      window.localStorage.getItem(
        key,
      );

    if (!raw) {
      return EMPTY_FILTERS;
    }

    const parsed =
      JSON.parse(
        raw,
      ) as Partial<InvoiceFiltersValue>;

    return {
      ...EMPTY_FILTERS,
      ...parsed,
    };
  } catch {
    return EMPTY_FILTERS;
  }
};

/* =========================================================
   HOME

   La tabla sigue mostrando la bandeja ACTUAL de Facturas.

   Las tarjetas son GLOBALES para el área:
   - una aprobación sigue contándose aunque luego se remita;
   - un rechazo sigue contándose aunque la factura deje la bandeja;
   - pendientes representa lo que está pendiente actualmente.
========================================================= */

const Home = () => {
  const [
    invoices,
    setInvoices,
  ] =
    useState<Invoice[]>([]);

  const [
    globalSummary,
    setGlobalSummary,
  ] =
    useState<ResumenArea | null>(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const currentArea =
    getStoredArea();

  const filterStorageKey =
    `sgaf:facturas:filtros:${currentArea?.id ?? "sin-area"}`;

  const [
    filters,
    setFilters,
  ] =
    useState<InvoiceFiltersValue>(
      () =>
        readStoredFilters(
          filterStorageKey,
        ),
    );

  useEffect(
    () => {
      const isEmpty =
        Object.values(
          filters,
        ).every(
          (value) =>
            !value,
        );

      if (isEmpty) {
        window.localStorage.removeItem(
          filterStorageKey,
        );

        return;
      }

      window.localStorage.setItem(
        filterStorageKey,
        JSON.stringify(
          filters,
        ),
      );
    },
    [
      filters,
      filterStorageKey,
    ],
  );

  const load =
    async () => {
      try {
        setLoading(true);

        const [
          invoicesData,
          summaryData,
        ] =
          await Promise.all([
            getFacturas(),
            getResumenArea(),
          ]);

        setInvoices(
          invoicesData,
        );

        setGlobalSummary(
          summaryData,
        );
      } finally {
        setLoading(false);
      }
    };

  useEffect(
    () => {
      void load();
    },
    [],
  );

  /* =======================================================
     PROVEEDORES
  ======================================================= */

  const suppliers =
    useMemo(
      () =>
        Array.from(
          new Set(
            invoices.map(
              (
                invoice,
              ) =>
                invoice.proveedor,
            ),
          ),
        ).sort(),
      [invoices],
    );

  /* =======================================================
     FILTRAR BANDEJA ACTUAL
  ======================================================= */

  const filteredInvoices =
    useMemo(
      () => {
        const search =
          filters.search
            .trim()
            .toLowerCase();

        return invoices.filter(
          (
            invoice,
          ) => {
            if (
              filters.status &&
              invoice.estadoCodigo !== filters.status
            ) {
              return false;
            }

            if (
              filters.supplier &&
              invoice.proveedor !== filters.supplier
            ) {
              return false;
            }

            if (
              !matchesBogotaDate(
                invoice.fechaRecepcion,
                filters.date,
              )
            ) {
              return false;
            }

            if (!search) {
              return true;
            }

            return [
              invoice.proveedor,
              invoice.nit ?? "",
              invoice.numeroFactura ?? "",
              invoice.correo ?? "",
              invoice.asunto ?? "",
            ]
              .join(" ")
              .toLowerCase()
              .includes(search);
          },
        );
      },
      [
        invoices,
        filters,
      ],
    );

  /* =======================================================
     FALLBACK

     Si por alguna razón aún no llegó el resumen global,
     conservamos los cálculos locales para no romper la vista.
  ======================================================= */

  const localSummary =
    useMemo(
      () => ({
        total:
          invoices.length,

        pendientes:
          invoices.filter(
            (
              invoice,
            ) =>
              invoice.estadoCodigo === "PENDIENTE",
          ).length,

        aprobadas:
          invoices.filter(
            (
              invoice,
            ) =>
              invoice.estadoCodigo === "APROBADA",
          ).length,

        rechazadas:
          invoices.filter(
            (
              invoice,
            ) =>
              invoice.estadoCodigo === "RECHAZADA",
          ).length,
      }),
      [invoices],
    );

  const summary = {
    total:
      globalSummary?.totalGestionadas ??
      localSummary.total,

    pendientes:
      globalSummary?.pendientesActuales ??
      localSummary.pendientes,

    aprobadas:
      globalSummary?.aprobadas ??
      localSummary.aprobadas,

    rechazadas:
      globalSummary?.rechazadas ??
      localSummary.rechazadas,
  };

  return (
    <>
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">
          Gestión de facturas
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          La tabla muestra la bandeja actual del área. Las tarjetas conservan el control histórico global de aprobaciones y rechazos.
        </p>
      </header>

      <section
        className="
          grid
          grid-cols-1
          gap-4
          md:grid-cols-2
          xl:grid-cols-4
        "
      >
        <StatCard
          title="Total gestionadas"
          value={summary.total}
          icon={FileText}
          iconColor="text-[#13B8D4]"
          iconBackground="bg-[#13B8D4]/15"
        />

        <StatCard
          title="Pendientes actuales"
          value={summary.pendientes}
          icon={FileText}
          iconColor="text-[#D99A1C]"
          iconBackground="bg-[#D99A1C]/15"
        />

        <StatCard
          title="Aprobadas"
          value={summary.aprobadas}
          icon={Check}
          iconColor="text-[#159E67]"
          iconBackground="bg-[#159E67]/15"
        />

        <StatCard
          title="Rechazadas"
          value={summary.rechazadas}
          icon={X}
          iconColor="text-[#E34C4C]"
          iconBackground="bg-[#E34C4C]/15"
        />
      </section>

      <InvoiceFilters
        value={filters}
        suppliers={suppliers}
        onChange={setFilters}
      />

      <InvoiceBoard
        invoices={filteredInvoices}
        loading={loading}
      />
    </>
  );
};

export default Home;
