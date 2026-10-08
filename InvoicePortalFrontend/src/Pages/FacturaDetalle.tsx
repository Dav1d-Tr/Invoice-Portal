import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  FileText,
  LoaderCircle,
  Mail,
  Paperclip,
  RefreshCw,
  Send,
  UserPlus,
  X,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  abrirAdjuntoFactura,
  aprobarFactura,
  asociarProveedorExistente,
  descargarAdjuntoFactura,
  getAreasFactura,
  getFacturaCorreoOutlook,
  getFacturaDetalle,
  getProveedoresFactura,
  procesarFactura,
  rechazarFactura,
  registrarProveedorDesdeFactura,
  remitirFactura,
  remitirFacturaContabilidad,
} from "../services/facturasService";

import type {
  AreaFactura,
  Invoice,
  OutlookAttachment,
  OutlookMessageDetail,
  ProveedorFactura,
} from "../services/facturasService";

import {
  getStoredArea,
} from "../services/authService";

import {
  isAccountingArea,
  normalizeAreaName,
} from "../utils/areaPermissions";

/* =========================================================
   HELPERS
========================================================= */

const formatDateTime = (
  value:
    string |
    null |
    undefined,
): string => {
  if (!value) {
    return "-";
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
        "short",

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
  if (
    value ===
    null ||
    value ===
    undefined ||
    value ===
    ""
  ) {
    return "No disponible";
  }

  const number =
    Number(
      value,
    );

  if (
    !Number.isFinite(
      number,
    )
  ) {
    return String(
      value,
    );
  }

  const code =
    currency?.trim()
      .toUpperCase() ||
    "COP";

  try {
    return new Intl.NumberFormat(
      "es-CO",
      {
        style:
          "currency",

        currency:
          code,

        maximumFractionDigits:
          code ===
            "COP"
            ? 0
            : 2,
      },
    ).format(
      number,
    );
  } catch {
    return `${number.toLocaleString(
      "es-CO",
    )} ${code}`;
  }
};

const formatSize = (
  bytes:
    number,
): string => {
  if (
    !Number.isFinite(
      bytes,
    ) ||
    bytes <=
    0
  ) {
    return "";
  }

  if (
    bytes <
    1024
  ) {
    return `${bytes} B`;
  }

  if (
    bytes <
    1024 *
    1024
  ) {
    return `${(
      bytes /
      1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    1024 /
    1024
  ).toFixed(1)} MB`;
};

const isPdf = (
  attachment:
    OutlookAttachment,
): boolean => {
  return (
    attachment
      .contentType
      .toLowerCase()
      .includes(
        "pdf",
      ) ||
    /\.pdf$/i.test(
      attachment.name,
    )
  );
};

const statusClass = (
  code:
    Invoice[
    "estadoCodigo"
    ],
): string => {
  switch (code) {
    case "PENDIENTE":
      return "bg-amber-50 text-amber-700";

    case "APROBADA":
      return "bg-emerald-50 text-emerald-700";

    case "RECHAZADA":
      return "bg-red-50 text-red-700";

    case "PROCESADA":
      return "bg-violet-50 text-violet-700";

    case "REMITIDA":
      return "bg-blue-50 text-blue-700";
  }
};

/* =========================================================
   COMPONENTE
========================================================= */

const FacturaDetalle = () => {
  const navigate =
    useNavigate();

  const params =
    useParams();

  const idFactura =
    Number(
      params.id,
    );

  const currentArea =
    getStoredArea();

  const currentAreaName =
    currentArea?.nombre ??
    "";

  const reception =
    normalizeAreaName(
      currentAreaName,
    ) ===
    "RECEPCION";

  const accounting =
    isAccountingArea(
      currentAreaName,
    );

  /* =======================================================
     DATA
  ======================================================= */

  const [
    invoice,
    setInvoice,
  ] =
    useState<
      Invoice | null
    >(
      null,
    );

  const [
    outlook,
    setOutlook,
  ] =
    useState<
      OutlookMessageDetail |
      null
    >(
      null,
    );

  const [
    areas,
    setAreas,
  ] =
    useState<
      AreaFactura[]
    >([]);

  const [
    providers,
    setProviders,
  ] =
    useState<
      ProveedorFactura[]
    >([]);

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    mailLoading,
    setMailLoading,
  ] =
    useState(
      false,
    );

  const [
    actionLoading,
    setActionLoading,
  ] =
    useState(
      false,
    );

  const [
    attachmentLoading,
    setAttachmentLoading,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    mailError,
    setMailError,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    success,
    setSuccess,
  ] =
    useState<
      string | null
    >(
      null,
    );

  /* =======================================================
     MODAL REMITIR
  ======================================================= */

  const [
    remitOpen,
    setRemitOpen,
  ] =
    useState(
      false,
    );

  const [
    remitAreaId,
    setRemitAreaId,
  ] =
    useState<
      number | ""
    >(
      "",
    );

  const [
    remitObservation,
    setRemitObservation,
  ] =
    useState("");

  /* =======================================================
     MODAL PROVEEDOR
  ======================================================= */

  const [
    providerOpen,
    setProviderOpen,
  ] =
    useState(
      false,
    );

  const [
    providerMode,
    setProviderMode,
  ] =
    useState<
      "EXISTENTE" |
      "NUEVO"
    >(
      "EXISTENTE",
    );

  const [
    existingProviderId,
    setExistingProviderId,
  ] =
    useState<
      number | ""
    >(
      "",
    );

  const [
    newProviderName,
    setNewProviderName,
  ] =
    useState("");

  const [
    newProviderNit,
    setNewProviderNit,
  ] =
    useState("");

  const [
    newProviderArea,
    setNewProviderArea,
  ] =
    useState<
      number | ""
    >(
      "",
    );

  const [
    newProviderEmails,
    setNewProviderEmails,
  ] =
    useState<
      string[]
    >([]);

  const [
    newProviderEmailDraft,
    setNewProviderEmailDraft,
  ] =
    useState("");

  /* =======================================================
     MODAL RECHAZO
  ======================================================= */

  const [
    rejectOpen,
    setRejectOpen,
  ] =
    useState(
      false,
    );

  const [
    rejectReason,
    setRejectReason,
  ] =
    useState(
      "Información incorrecta",
    );

  const [
    rejectObservation,
    setRejectObservation,
  ] =
    useState("");

  /* =======================================================
     CONFIRMACION
  ======================================================= */

  const [
    confirmAction,
    setConfirmAction,
  ] =
    useState<
      "APROBAR" |
      "REMITIR_CONTABILIDAD" |
      "PROCESAR" |
      null
    >(
      null,
    );

  /* =======================================================
     CARGAR
  ======================================================= */

  const loadInvoice =
    useCallback(
      async () => {
        if (
          !Number.isInteger(
            idFactura,
          ) ||
          idFactura <=
          0
        ) {
          throw new Error(
            "Factura inválida.",
          );
        }

        const data =
          await getFacturaDetalle(
            idFactura,
          );

        setInvoice(
          data,
        );

        return data;
      },
      [
        idFactura,
      ],
    );

  const loadCatalogs =
    useCallback(
      async () => {
        try {
          const [
            areaData,
            providerData,
          ] =
            await Promise.all([
              getAreasFactura(),
              getProveedoresFactura(),
            ]);

          setAreas(
            areaData,
          );

          setProviders(
            providerData,
          );
        } catch (
        catalogError
        ) {
          console.warn(
            "No fue posible cargar catálogos:",
            catalogError,
          );
        }
      },
      [],
    );

  const loadOutlook =
    useCallback(
      async () => {
        if (
          !Number.isInteger(
            idFactura,
          ) ||
          idFactura <=
          0
        ) {
          return;
        }

        try {
          setMailLoading(
            true,
          );

          setMailError(
            null,
          );

          const data =
            await getFacturaCorreoOutlook(
              idFactura,
            );

          setOutlook(
            data,
          );

          /*
            El endpoint de correo también actualiza
            número, tipo y valor en PostgreSQL.
          */

          const updated =
            await getFacturaDetalle(
              idFactura,
            );

          setInvoice(
            updated,
          );
        } catch (
        mailLoadError
        ) {
          setMailError(
            mailLoadError instanceof
              Error
              ? mailLoadError.message
              : "No fue posible cargar el correo.",
          );
        } finally {
          setMailLoading(
            false,
          );
        }
      },
      [
        idFactura,
      ],
    );

  const loadAll =
    useCallback(
      async () => {
        try {
          setLoading(
            true,
          );

          setError(
            null,
          );

          await loadInvoice();

          await Promise.all([
            loadCatalogs(),
            loadOutlook(),
          ]);
        } catch (
        loadError
        ) {
          setError(
            loadError instanceof
              Error
              ? loadError.message
              : "No fue posible cargar la factura.",
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [
        loadCatalogs,
        loadInvoice,
        loadOutlook,
      ],
    );

  useEffect(
    () => {
      void loadAll();
    },
    [
      loadAll,
    ],
  );

  /* =======================================================
     DERIVADOS
  ======================================================= */

  const ownsInvoice =
    Boolean(
      invoice &&
      currentArea &&
      invoice
        .idAreaActual ===
      currentArea.id,
    );

  const availableAreas =
    useMemo(
      () => {
        return areas.filter(
          (
            area,
          ) => {
            const normalized =
              normalizeAreaName(
                area.nombre,
              );

            return (
              area.id !==
              currentArea?.id &&
              normalized !==
              "CONTABILIDAD"
            );
          },
        );
      },
      [
        areas,
        currentArea?.id,
      ],
    );

  const canRemit =
    Boolean(
      invoice &&
      ownsInvoice &&
      [
        "PENDIENTE",
        "APROBADA",
      ].includes(
        invoice
          .estadoCodigo,
      ) &&
      (
        !reception ||
        invoice
          .idProveedor !==
        null
      ),
    );

  /* =======================================================
   REMITIR A CONTABILIDAD

   Solo:
   - factura pertenece al área actual;
   - factura APROBADA;
   - usuario NO está ya en Contabilidad.
======================================================= */

  const canRemitAccounting =
    Boolean(
      invoice &&
      ownsInvoice &&
      !accounting &&
      invoice
        .estadoCodigo ===
      "APROBADA",
    );

  const canApprove =
    Boolean(
      invoice &&
      ownsInvoice &&
      !reception &&
      invoice
        .estadoCodigo ===
      "PENDIENTE",
    );

  const canReject =
    Boolean(
      invoice &&
      ownsInvoice &&
      !reception &&
      [
        "PENDIENTE",
        "APROBADA",
      ].includes(
        invoice
          .estadoCodigo,
      ),
    );

  const canProcess =
    Boolean(
      invoice &&
      ownsInvoice &&
      accounting &&
      invoice
        .estadoCodigo ===
      "APROBADA",
    );

  /* =======================================================
     REFRESH
  ======================================================= */

  const refresh =
    async () => {
      try {
        setActionLoading(
          true,
        );

        setSuccess(
          null,
        );

        setError(
          null,
        );

        await loadInvoice();

        await loadOutlook();

        setSuccess(
          "Información actualizada.",
        );
      } catch (
      refreshError
      ) {
        setError(
          refreshError instanceof
            Error
            ? refreshError.message
            : "No fue posible actualizar.",
        );
      } finally {
        setActionLoading(
          false,
        );
      }
    };

  /* =======================================================
     APROBAR / PROCESAR
  ======================================================= */

  const executeConfirmation =
    async () => {
      if (
        !invoice ||
        !confirmAction
      ) {
        return;
      }

      try {
        setActionLoading(
          true,
        );

        setError(
          null,
        );

        setSuccess(
          null,
        );

        /* ===================================================
           APROBAR
        =================================================== */

        if (
          confirmAction ===
          "APROBAR"
        ) {
          await aprobarFactura(
            invoice.id,
          );

          setSuccess(
            "Factura aprobada correctamente.",
          );

          setConfirmAction(
            null,
          );

          /*
            Al recargar, estado = APROBADA.
            En ese momento aparecerá el botón
            "Remitir a Contabilidad".
          */

          await loadInvoice();

          return;
        }

        /* ===================================================
           REMITIR A CONTABILIDAD
        =================================================== */

        if (
          confirmAction ===
          "REMITIR_CONTABILIDAD"
        ) {
          await remitirFacturaContabilidad(
            invoice.id,
            "Factura aprobada y remitida a Contabilidad.",
          );

          setSuccess(
            "Factura remitida a Contabilidad correctamente.",
          );

          setConfirmAction(
            null,
          );

          /*
            Como la factura deja de pertenecer al área actual,
            regresamos a la pantalla anterior.
          */

          window.setTimeout(
            () => {
              navigate(
                -1,
              );
            },
            600,
          );

          return;
        }

        /* ===================================================
           PROCESAR
        =================================================== */

        if (
          confirmAction ===
          "PROCESAR"
        ) {
          await procesarFactura(
            invoice.id,
          );

          setSuccess(
            "Factura procesada correctamente.",
          );

          setConfirmAction(
            null,
          );

          await loadInvoice();
        }
      } catch (
      actionError
      ) {
        setError(
          actionError instanceof
            Error
            ? actionError.message
            : "No fue posible completar la acción.",
        );
      } finally {
        setActionLoading(
          false,
        );
      }
    };

  /* =======================================================
     RECHAZAR
  ======================================================= */

  const submitReject =
    async () => {
      if (!invoice) {
        return;
      }

      const detail =
        [
          rejectReason,
          rejectObservation
            .trim(),
        ]
          .filter(
            Boolean,
          )
          .join(
            " - ",
          );

      try {
        setActionLoading(
          true,
        );

        setError(
          null,
        );

        await rechazarFactura(
          invoice.id,
          detail,
        );

        setRejectOpen(
          false,
        );

        setSuccess(
          "Factura rechazada correctamente.",
        );

        await loadInvoice();
      } catch (
      rejectError
      ) {
        setError(
          rejectError instanceof
            Error
            ? rejectError.message
            : "No fue posible rechazar la factura.",
        );
      } finally {
        setActionLoading(
          false,
        );
      }
    };

  /* =======================================================
     REMITIR
  ======================================================= */

  const openRemit =
    (
      suggestedId?:
        number,
    ) => {
      const candidate =
        suggestedId ??
        invoice
          ?.idAreaProveedor ??
        null;

      setRemitAreaId(
        candidate &&
          candidate !==
          currentArea?.id
          ? candidate
          : "",
      );

      setRemitObservation(
        "",
      );

      setRemitOpen(
        true,
      );
    };

  const submitRemit =
    async () => {
      if (
        !invoice ||
        remitAreaId ===
        ""
      ) {
        setError(
          "Debes seleccionar el área destino.",
        );

        return;
      }

      try {
        setActionLoading(
          true,
        );

        setError(
          null,
        );

        await remitirFactura(
          invoice.id,
          Number(
            remitAreaId,
          ),
          remitObservation,
        );

        setRemitOpen(
          false,
        );

        setSuccess(
          "Factura remitida correctamente.",
        );

        const updated =
          await loadInvoice();

        /*
          Si la factura salió del área actual,
          regresamos al listado después de mostrar
          el resultado brevemente.
        */

        if (
          currentArea &&
          updated.idAreaActual !==
          currentArea.id
        ) {
          setTimeout(
            () => {
              navigate(
                "/facturas",
              );
            },
            700,
          );
        }
      } catch (
      remitError
      ) {
        setError(
          remitError instanceof
            Error
            ? remitError.message
            : "No fue posible remitir la factura.",
        );
      } finally {
        setActionLoading(
          false,
        );
      }
    };

  /* =======================================================
     PROVEEDOR
  ======================================================= */

  const openProvider =
    () => {
      if (!invoice) {
        return;
      }

      setProviderMode(
        invoice.idProveedor
          ? "EXISTENTE"
          : "NUEVO",
      );

      setExistingProviderId(
        invoice.idProveedor ??
        "",
      );

      setNewProviderName(
        invoice.proveedor ===
          "PROVEEDOR PENDIENTE"
          ? ""
          : invoice.proveedor,
      );

      setNewProviderNit(
        invoice.nit ??
        "",
      );

      setNewProviderArea(
        invoice
          .idAreaProveedor ??
        "",
      );

      setNewProviderEmails(
        invoice.correo
          ? [
            invoice.correo,
          ]
          : [],
      );

      setNewProviderEmailDraft(
        "",
      );

      setProviderOpen(
        true,
      );
    };

  const addProviderEmail =
    () => {
      const email =
        newProviderEmailDraft
          .trim()
          .toLowerCase();

      if (!email) {
        return;
      }

      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          email,
        )
      ) {
        setError(
          "Ingresa un correo válido.",
        );

        return;
      }

      setNewProviderEmails(
        (
          current,
        ) =>
          current.includes(
            email,
          )
            ? current
            : [
              ...current,
              email,
            ],
      );

      setNewProviderEmailDraft(
        "",
      );

      setError(
        null,
      );
    };

  const submitProvider =
    async () => {
      if (!invoice) {
        return;
      }

      try {
        setActionLoading(
          true,
        );

        setError(
          null,
        );

        let result;

        if (
          providerMode ===
          "EXISTENTE"
        ) {
          if (
            existingProviderId ===
            ""
          ) {
            throw new Error(
              "Selecciona un proveedor existente.",
            );
          }

          result =
            await asociarProveedorExistente(
              invoice.id,
              Number(
                existingProviderId,
              ),
            );
        } else {
          if (
            !newProviderName
              .trim()
          ) {
            throw new Error(
              "El nombre del proveedor es obligatorio.",
            );
          }

          if (
            newProviderArea ===
            ""
          ) {
            throw new Error(
              "Selecciona el área responsable del proveedor.",
            );
          }

          result =
            await registrarProveedorDesdeFactura(
              invoice.id,
              {
                nombre:
                  newProviderName
                    .trim(),

                nit:
                  newProviderNit
                    .trim() ||
                  null,

                idArea:
                  Number(
                    newProviderArea,
                  ),

                correos:
                  newProviderEmails,
              },
            );
        }

        setProviderOpen(
          false,
        );

        setSuccess(
          result.creado
            ? "Proveedor registrado y asociado correctamente."
            : "Proveedor asociado correctamente.",
        );

        await Promise.all([
          loadInvoice(),
          loadCatalogs(),
        ]);

        /*
          El área configurada del proveedor queda sugerida
          para la remisión, pero el usuario todavía decide.
        */

        openRemit(
          result.idArea,
        );
      } catch (
      providerError
      ) {
        setError(
          providerError instanceof
            Error
            ? providerError.message
            : "No fue posible asociar el proveedor.",
        );
      } finally {
        setActionLoading(
          false,
        );
      }
    };

  /* =======================================================
     ARCHIVOS
  ======================================================= */

  const viewAttachment =
    async (
      attachment:
        OutlookAttachment,
    ) => {
      if (!invoice) {
        return;
      }

      try {
        setAttachmentLoading(
          attachment.id,
        );

        setError(
          null,
        );

        await abrirAdjuntoFactura(
          invoice.id,
          attachment.id,
        );
      } catch (
      fileError
      ) {
        setError(
          fileError instanceof
            Error
            ? fileError.message
            : "No fue posible abrir el archivo.",
        );
      } finally {
        setAttachmentLoading(
          null,
        );
      }
    };

  const downloadAttachment =
    async (
      attachment:
        OutlookAttachment,
    ) => {
      if (!invoice) {
        return;
      }

      try {
        setAttachmentLoading(
          attachment.id,
        );

        setError(
          null,
        );

        await descargarAdjuntoFactura(
          invoice.id,
          attachment.id,
          attachment.name,
        );
      } catch (
      fileError
      ) {
        setError(
          fileError instanceof
            Error
            ? fileError.message
            : "No fue posible descargar el archivo.",
        );
      } finally {
        setAttachmentLoading(
          null,
        );
      }
    };

  /* =======================================================
     RENDER LOADING / ERROR
  ======================================================= */

  if (
    loading &&
    !invoice
  ) {
    return (
      <div
        className="
          flex
          min-h-[65vh]
          items-center
          justify-center
          gap-3
          text-sm
          text-slate-500
        "
      >
        <LoaderCircle
          size={20}
          className="animate-spin"
        />

        Cargando factura...
      </div>
    );
  }

  if (!invoice) {
    return (
      <div
        className="
          rounded-2xl
          border
          border-red-200
          bg-red-50
          p-6
          text-sm
          text-red-700
        "
      >
        {error ??
          "No fue posible cargar la factura."}

        <button
          type="button"
          onClick={() =>
            navigate(
              "/facturas",
            )
          }
          className="
            mt-4
            block
            rounded-xl
            border
            border-red-200
            bg-white
            px-4
            py-2
            text-xs
            font-semibold
          "
        >
          Volver a facturas
        </button>
      </div>
    );
  }

  const documentLabel =
    invoice.tipoDocumento ===
      "NOTA_CREDITO"
      ? "Número de nota crédito"
      : "Número de factura";

  /* =======================================================
     UI
  ======================================================= */

  return (
    <>
      {/* HEADER */}

      <div
        className="
          mb-5
          flex
          flex-col
          gap-4

          lg:flex-row
          lg:items-center
          lg:justify-between
        "
      >
        <div>
          <button
            type="button"
            onClick={() =>
              navigate(
                -1,
              )
            }
            className="
              mb-3
              inline-flex
              items-center
              gap-2
              text-xs
              font-semibold
              text-slate-500

              hover:text-[#00739B]
            "
          >
            <ArrowLeft
              size={15}
            />

            Volver
          </button>

          <h1
            className="
              text-2xl
              font-bold
              text-slate-800
            "
          >
            Detalle de factura
          </h1>

          <p
            className="
              mt-1
              text-sm
              text-slate-500
            "
          >
            Revisa el correo, los archivos adjuntos y la información antes de tomar una decisión.
          </p>
        </div>

        <button
          type="button"
          disabled={
            actionLoading ||
            mailLoading
          }
          onClick={() =>
            void refresh()
          }
          className="
            inline-flex
            h-10
            items-center
            justify-center
            gap-2
            rounded-xl
            border
            border-slate-200
            bg-white
            px-4
            text-xs
            font-semibold
            text-slate-600

            hover:border-[#13A7C7]
            hover:text-[#00739B]

            disabled:opacity-50
          "
        >
          <RefreshCw
            size={14}
            className={
              actionLoading ||
                mailLoading
                ? "animate-spin"
                : ""
            }
          />

          Actualizar
        </button>
      </div>

      {/* ALERTAS */}

      {success && (
        <div
          className="
            mb-4
            flex
            items-center
            gap-2
            rounded-xl
            border
            border-emerald-200
            bg-emerald-50
            px-4
            py-3
            text-xs
            text-emerald-700
          "
        >
          <CheckCircle2
            size={15}
          />

          {success}
        </div>
      )}

      {error && (
        <div
          className="
            mb-4
            flex
            items-center
            gap-2
            rounded-xl
            border
            border-red-200
            bg-red-50
            px-4
            py-3
            text-xs
            text-red-700
          "
        >
          <AlertCircle
            size={15}
          />

          {error}
        </div>
      )}

      {/* CONTENIDO */}

      <div
        className="
          grid
          grid-cols-1
          gap-5

          xl:grid-cols-[minmax(0,1fr)_405px]
        "
      >
        {/* =================================================
            IZQUIERDA
        ================================================== */}

        <section
          className="
            min-w-0
            overflow-hidden
            rounded-2xl
            border
            border-slate-200
            bg-white
            shadow-sm
          "
        >
          {/* MAIL HEADER */}

          <div
            className="
              border-b
              border-slate-200
              px-6
              py-5
            "
          >
            <div
              className="
                flex
                flex-col
                gap-4

                lg:flex-row
                lg:items-start
                lg:justify-between
              "
            >
              <div
                className="
                  min-w-0
                  flex-1
                "
              >
                <h2
                  className="
                    wrap-break-words
                    text-lg
                    font-bold
                    text-slate-800
                  "
                >
                  {outlook
                    ?.subject ??
                    invoice.asunto ??
                    "Sin asunto"}
                </h2>

                <div
                  className="
                    mt-4
                    flex
                    items-start
                    gap-3
                  "
                >
                  <div
                    className="
                      flex
                      h-10
                      w-10
                      shrink-0
                      items-center
                      justify-center
                      rounded-full
                      bg-[#DFF6FA]
                      text-sm
                      font-bold
                      text-[#00739B]
                    "
                  >
                    {(
                      outlook
                        ?.fromName ||
                      invoice
                        .proveedor ||
                      "P"
                    )
                      .charAt(
                        0,
                      )
                      .toUpperCase()}
                  </div>

                  <div
                    className="min-w-0"
                  >
                    <p
                      className="
                        text-xs
                        font-bold
                        text-slate-800
                      "
                    >
                      {outlook
                        ?.fromName ||
                        invoice
                          .proveedor}
                    </p>

                    <p
                      className="
                        mt-1
                        break-all
                        text-[10px]
                        text-slate-500
                      "
                    >
                      {outlook
                        ?.fromEmail ||
                        invoice
                          .correo ||
                        "Correo no disponible"}
                    </p>

                    {outlook
                      ?.to
                      .length ? (
                      <p
                        className="
                          mt-1
                          break-all
                          text-[10px]
                          text-slate-400
                        "
                      >
                        Para:{" "}
                        {outlook.to.join(
                          ", ",
                        )}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div
                className="
                  flex
                  shrink-0
                  flex-wrap
                  items-center
                  gap-2
                "
              >
                <span
                  className="
                    text-[10px]
                    text-slate-400
                  "
                >
                  {formatDateTime(
                    outlook
                      ?.receivedDateTime ??
                    invoice
                      .fechaRecepcion,
                  )}
                </span>

                {(outlook
                  ?.webLink ||
                  invoice
                    .webLink) && (
                    <a
                      href={
                        outlook
                          ?.webLink ??
                        invoice
                          .webLink ??
                        "#"
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="
                      inline-flex
                      h-9
                      items-center
                      gap-2
                      rounded-xl
                      border
                      border-slate-200
                      px-3
                      text-[10px]
                      font-semibold
                      text-[#00739B]

                      hover:bg-slate-50
                    "
                    >
                      <ExternalLink
                        size={12}
                      />

                      Abrir en Outlook
                    </a>
                  )}
              </div>
            </div>
          </div>

          {/* ADJUNTOS */}

          <div
            className="
              border-b
              border-slate-200
              bg-slate-50/70
              px-6
              py-4
            "
          >
            <div
              className="
                flex
                items-center
                gap-2
              "
            >
              <Paperclip
                size={14}
                className="text-[#00739B]"
              />

              <h3
                className="
                  text-xs
                  font-bold
                  text-slate-700
                "
              >
                Documentos
              </h3>
            </div>

            {mailLoading ? (
              <div
                className="
                  mt-3
                  flex
                  items-center
                  gap-2
                  text-[10px]
                  text-slate-400
                "
              >
                <LoaderCircle
                  size={12}
                  className="animate-spin"
                />

                Consultando Outlook...
              </div>
            ) : (
              <>
                {outlook
                  ?.attachments
                  .length ? (
                  <div
                    className="
                      mt-3
                      grid
                      grid-cols-1
                      gap-2

                      lg:grid-cols-2
                    "
                  >
                    {outlook.attachments.map(
                      (
                        attachment,
                      ) => {
                        const busy =
                          attachmentLoading ===
                          attachment.id;

                        return (
                          <div
                            key={
                              attachment.id
                            }
                            className="
                              flex
                              min-w-0
                              items-center
                              gap-3
                              rounded-xl
                              border
                              border-slate-200
                              bg-white
                              p-3
                            "
                          >
                            <div
                              className="
                                flex
                                h-9
                                w-9
                                shrink-0
                                items-center
                                justify-center
                                rounded-lg
                                bg-[#DFF6FA]
                                text-[#00739B]
                              "
                            >
                              <FileText
                                size={15}
                              />
                            </div>

                            <div
                              className="
                                min-w-0
                                flex-1
                              "
                            >
                              <p
                                className="
                                  truncate
                                  text-[10px]
                                  font-bold
                                  text-slate-700
                                "
                                title={
                                  attachment.name
                                }
                              >
                                {attachment.name}
                              </p>

                              <p
                                className="
                                  mt-0.5
                                  text-[9px]
                                  text-slate-400
                                "
                              >
                                {formatSize(
                                  attachment.size,
                                )}
                              </p>
                            </div>

                            <div
                              className="
                                flex
                                shrink-0
                                gap-1
                              "
                            >
                              {isPdf(
                                attachment,
                              ) && (
                                  <button
                                    type="button"
                                    disabled={
                                      busy
                                    }
                                    onClick={() =>
                                      void viewAttachment(
                                        attachment,
                                      )
                                    }
                                    title="Ver documento"
                                    className="
                                    flex
                                    h-8
                                    w-8
                                    items-center
                                    justify-center
                                    rounded-lg
                                    border
                                    border-slate-200
                                    text-slate-500

                                    hover:border-[#13A7C7]
                                    hover:text-[#00739B]

                                    disabled:opacity-50
                                  "
                                  >
                                    {busy ? (
                                      <LoaderCircle
                                        size={12}
                                        className="animate-spin"
                                      />
                                    ) : (
                                      <Eye
                                        size={13}
                                      />
                                    )}
                                  </button>
                                )}

                              <button
                                type="button"
                                disabled={
                                  busy
                                }
                                onClick={() =>
                                  void downloadAttachment(
                                    attachment,
                                  )
                                }
                                title="Descargar documento"
                                className="
                                  flex
                                  h-8
                                  w-8
                                  items-center
                                  justify-center
                                  rounded-lg
                                  border
                                  border-slate-200
                                  text-slate-500

                                  hover:border-[#13A7C7]
                                  hover:text-[#00739B]

                                  disabled:opacity-50
                                "
                              >
                                {busy ? (
                                  <LoaderCircle
                                    size={12}
                                    className="animate-spin"
                                  />
                                ) : (
                                  <Download
                                    size={13}
                                  />
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                ) : (
                  <p
                    className="
                      mt-3
                      text-[10px]
                      text-slate-500
                    "
                  >
                    El correo no trae archivos adjuntos descargables.
                  </p>
                )}

                {outlook
                  ?.documentLinks
                  .length ? (
                  <div
                    className="
                      mt-3
                      flex
                      flex-wrap
                      gap-2
                    "
                  >
                    {outlook.documentLinks.map(
                      (
                        link,
                      ) => (
                        <a
                          key={
                            link.url
                          }
                          href={
                            link.url
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="
                            inline-flex
                            items-center
                            gap-2
                            rounded-xl
                            border
                            border-[#13A7C7]
                            bg-[#F2FBFD]
                            px-3
                            py-2
                            text-[10px]
                            font-semibold
                            text-[#00739B]
                          "
                        >
                          <ExternalLink
                            size={12}
                          />

                          {link.label ||
                            "Abrir documento"}
                        </a>
                      ),
                    )}
                  </div>
                ) : null}

                {mailError && (
                  <p
                    className="
                      mt-3
                      text-[10px]
                      text-amber-700
                    "
                  >
                    {mailError}
                  </p>
                )}
              </>
            )}
          </div>

          {/* BODY */}

          <div
            className="
              bg-[#F6F8FA]
              p-5
            "
          >
            {outlook
              ?.bodyHtml ? (
              <iframe
                title="Contenido del correo"
                sandbox="allow-popups allow-popups-to-escape-sandbox"
                srcDoc={`
                  <!doctype html>
                  <html>
                    <head>
                      <base target="_blank" />
                      <meta charset="utf-8" />
                      <style>
                        html,body{margin:0;padding:0;background:#fff;color:#172033;font-family:Arial,sans-serif}
                        body{padding:20px}
                        img{max-width:100%;height:auto}
                        table{max-width:100%!important}
                        a{word-break:break-word}
                      </style>
                    </head>
                    <body>
                      ${outlook.bodyHtml}
                    </body>
                  </html>
                `}
                className="
                  h-170
                  w-full
                  rounded-xl
                  border
                  border-slate-200
                  bg-white
                "
              />
            ) : outlook
              ?.bodyText ? (
              <div
                className="
                  max-h-170
                  overflow-auto
                  whitespace-pre-wrap
                  rounded-xl
                  border
                  border-slate-200
                  bg-white
                  p-5
                  text-xs
                  leading-6
                  text-slate-700
                "
              >
                {outlook.bodyText}
              </div>
            ) : (
              <div
                className="
                  flex
                  min-h-80
                  items-center
                  justify-center
                  rounded-xl
                  border
                  border-slate-200
                  bg-white
                  text-sm
                  text-slate-400
                "
              >
                {mailLoading
                  ? "Cargando correo..."
                  : "No hay contenido de correo disponible."}
              </div>
            )}
          </div>
        </section>

        {/* =================================================
            PANEL DERECHO
        ================================================== */}

        <aside
          className="
            h-fit
            rounded-2xl
            border
            border-slate-200
            bg-white
            p-6
            shadow-sm
          "
        >
          <h2
            className="
              text-base
              font-bold
              text-slate-800
            "
          >
            Información de factura
          </h2>

          <span
            className={`
              mt-4
              inline-flex
              rounded-full
              px-2.5
              py-1
              text-[10px]
              font-bold

              ${statusClass(
              invoice.estadoCodigo,
            )}
            `}
          >
            {invoice.estado}
          </span>

          <div
            className="
              mt-6
              space-y-5
            "
          >
            <Info
              label="Proveedor"
              value={
                invoice.proveedor
              }
            />

            <Info
              label="NIT"
              value={
                invoice.nit ??
                "No registrado"
              }
            />

            <Info
              label="Tipo de documento"
              value={
                invoice.tipoDocumento ===
                  "NOTA_CREDITO"
                  ? "Nota crédito"
                  : invoice.tipoDocumento ===
                    "FACTURA"
                    ? "Factura"
                    : "Por identificar"
              }
            />

            <Info
              label={
                documentLabel
              }
              value={
                invoice.numeroFactura ??
                "Sin número"
              }
            />

            <Info
              label="Fecha recepción"
              value={
                formatDateTime(
                  invoice.fechaRecepcion,
                )
              }
            />

            <Info
              label="Correo remitente"
              value={
                invoice.correo ??
                "No disponible"
              }
            />

            <Info
              label="Área origen"
              value={
                invoice.areaOrigen
              }
            />

            <Info
              label="Área actual"
              value={
                invoice.areaActual
              }
            />

            {invoice.areaProveedor && (
              <Info
                label="Área del proveedor"
                value={
                  invoice.areaProveedor
                }
              />
            )}
          </div>

          <div
            className="
              my-6
              border-t
              border-slate-100
            "
          />

          <p
            className="
              text-[9px]
              font-bold
              uppercase
              tracking-wide
              text-slate-400
            "
          >
            Valor total
          </p>

          <p
            className="
              mt-1
              text-2xl
              font-bold
              text-slate-800
            "
          >
            {formatMoney(
              invoice.valorTotal,
              invoice.moneda,
            )}
          </p>

          {/* RECEPCION */}

          {reception &&
            ownsInvoice && (
              <div
                className="
                mt-6
                rounded-xl
                border
                border-cyan-100
                bg-cyan-50/60
                p-4
              "
              >
                <p
                  className="
                  text-xs
                  font-bold
                  text-slate-700
                "
                >
                  Clasificación de Recepción
                </p>

                <p
                  className="
                  mt-1
                  text-[10px]
                  leading-5
                  text-slate-500
                "
                >
                  {invoice.idProveedor
                    ? `Proveedor asociado. Área configurada: ${invoice.areaProveedor ?? "sin área visible"}.`
                    : "Esta factura todavía no tiene un proveedor registrado o asociado."}
                </p>

                <button
                  type="button"
                  onClick={
                    openProvider
                  }
                  className="
                  mt-3
                  inline-flex
                  h-9
                  w-full
                  items-center
                  justify-center
                  gap-2
                  rounded-xl
                  border
                  border-[#13A7C7]
                  bg-white
                  text-[10px]
                  font-bold
                  text-[#00739B]
                "
                >
                  <UserPlus
                    size={13}
                  />

                  {invoice.idProveedor
                    ? "Cambiar / revisar proveedor"
                    : "Registrar o asociar proveedor"}
                </button>
              </div>
            )}

          {/* ACCIONES */}

          <div
            className="
              mt-6
              border-t
              border-slate-100
              pt-5
            "
          >
            <p
              className="
                mb-3
                text-xs
                font-bold
                text-slate-700
              "
            >
              ¿Qué deseas hacer?
            </p>

            {!ownsInvoice && (
              <p
                className="
                  rounded-xl
                  bg-slate-50
                  px-3
                  py-3
                  text-[10px]
                  leading-5
                  text-slate-500
                "
              >
                La factura ya no se encuentra actualmente en tu área. Puedes consultar el histórico, pero las acciones corresponden al área actual.
              </p>
            )}

            {ownsInvoice && (
              <div
                className="
                  grid
                  grid-cols-1
                  gap-2
                "
              >
                {canApprove && (
                  <button
                    type="button"
                    disabled={
                      actionLoading
                    }
                    onClick={() =>
                      setConfirmAction(
                        "APROBAR",
                      )
                    }
                    className="
                      inline-flex
                      h-10
                      items-center
                      justify-center
                      gap-2
                      rounded-xl
                      bg-emerald-600
                      px-4
                      text-xs
                      font-bold
                      text-white

                      hover:bg-emerald-700

                      disabled:opacity-50
                    "
                  >
                    <Check
                      size={14}
                    />

                    Aprobar factura
                  </button>
                )}

                {canReject && (
                  <button
                    type="button"
                    disabled={
                      actionLoading
                    }
                    onClick={() =>
                      setRejectOpen(
                        true,
                      )
                    }
                    className="
                      inline-flex
                      h-10
                      items-center
                      justify-center
                      gap-2
                      rounded-xl
                      border
                      border-red-200
                      bg-red-50
                      px-4
                      text-xs
                      font-bold
                      text-red-700

                      hover:bg-red-100

                      disabled:opacity-50
                    "
                  >
                    <X
                      size={14}
                    />

                    Rechazar factura
                  </button>
                )}

                {canRemit && (
                  <button
                    type="button"
                    disabled={
                      actionLoading
                    }
                    onClick={() =>
                      openRemit()
                    }
                    className="
                      inline-flex
                      h-10
                      items-center
                      justify-center
                      gap-2
                      rounded-xl
                      bg-[#00739B]
                      px-4
                      text-xs
                      font-bold
                      text-white

                      hover:bg-[#05627F]

                      disabled:opacity-50
                    "
                  >
                    <Send
                      size={14}
                    />

                    Remitir a otra área
                  </button>
                )}

                {canRemitAccounting && (
                  <button
                    type="button"
                    disabled={
                      actionLoading
                    }
                    onClick={() =>
                      setConfirmAction(
                        "REMITIR_CONTABILIDAD",
                      )
                    }
                    className="
                      inline-flex
                      h-10
                      items-center
                      justify-center
                      gap-2
                      rounded-xl
                      bg-violet-600
                      px-4
                      text-xs
                      font-bold
                      text-white

                      hover:bg-violet-700

                      disabled:opacity-50
                    "
                  >
                    <Building2
                      size={14}
                    />

                    Remitir a Contabilidad
                  </button>
                )}

                {reception &&
                  !invoice.idProveedor &&
                  [
                    "PENDIENTE",
                    "APROBADA",
                  ].includes(
                    invoice.estadoCodigo,
                  ) && (
                    <p
                      className="
                      rounded-xl
                      bg-amber-50
                      px-3
                      py-3
                      text-[10px]
                      leading-5
                      text-amber-700
                    "
                    >
                      Registra o asocia el proveedor antes de remitir esta factura.
                    </p>
                  )}

                {canProcess && (
                  <button
                    type="button"
                    disabled={
                      actionLoading
                    }
                    onClick={() =>
                      setConfirmAction(
                        "PROCESAR",
                      )
                    }
                    className="
                      inline-flex
                      h-10
                      items-center
                      justify-center
                      gap-2
                      rounded-xl
                      bg-violet-600
                      px-4
                      text-xs
                      font-bold
                      text-white

                      hover:bg-violet-700

                      disabled:opacity-50
                    "
                  >
                    <CheckCircle2
                      size={14}
                    />

                    Procesar factura
                  </button>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ===================================================
          MODAL REMITIR
      ==================================================== */}

      {remitOpen && (
        <Modal
          title="Remitir factura"
          onClose={() =>
            !actionLoading &&
            setRemitOpen(
              false,
            )
          }
        >
          <p
            className="
              text-xs
              leading-5
              text-slate-500
            "
          >
            La factura conservará su estado actual. La remisión quedará registrada en la auditoría.
          </p>

          <label
            className="
              mt-5
              block
              text-xs
              font-bold
              text-slate-700
            "
          >
            Área destino
          </label>

          <select
            value={
              remitAreaId
            }
            onChange={(
              event,
            ) =>
              setRemitAreaId(
                event.target
                  .value
                  ? Number(
                    event.target
                      .value,
                  )
                  : "",
              )
            }
            className="
              mt-2
              h-10
              w-full
              rounded-xl
              border
              border-slate-200
              bg-white
              px-3
              text-xs
              outline-none

              focus:border-[#13A7C7]
            "
          >
            <option value="">
              Selecciona un área
            </option>

            {availableAreas.map(
              (
                area,
              ) => (
                <option
                  key={
                    area.id
                  }
                  value={
                    area.id
                  }
                >
                  {area.nombre}
                </option>
              ),
            )}
          </select>

          <label
            className="
              mt-4
              block
              text-xs
              font-bold
              text-slate-700
            "
          >
            Observaciones
          </label>

          <textarea
            value={
              remitObservation
            }
            onChange={(
              event,
            ) =>
              setRemitObservation(
                event.target
                  .value,
              )
            }
            rows={4}
            placeholder="Información útil para el área que recibirá la factura..."
            className="
              mt-2
              w-full
              resize-none
              rounded-xl
              border
              border-slate-200
              p-3
              text-xs
              outline-none

              focus:border-[#13A7C7]
            "
          />

          <ModalButtons
            loading={
              actionLoading
            }
            onCancel={() =>
              setRemitOpen(
                false,
              )
            }
            onConfirm={() =>
              void submitRemit()
            }
            confirmText="Remitir factura"
          />
        </Modal>
      )}

      {/* ===================================================
          MODAL PROVEEDOR
      ==================================================== */}

      {providerOpen && (
        <Modal
          title="Proveedor de la factura"
          onClose={() =>
            !actionLoading &&
            setProviderOpen(
              false,
            )
          }
        >
          <div
            className="
              grid
              grid-cols-2
              gap-2
              rounded-xl
              bg-slate-100
              p-1
            "
          >
            <button
              type="button"
              onClick={() =>
                setProviderMode(
                  "EXISTENTE",
                )
              }
              className={`
                h-9
                rounded-lg
                text-[10px]
                font-bold

                ${providerMode ===
                  "EXISTENTE"
                  ? "bg-white text-[#00739B] shadow-sm"
                  : "text-slate-500"
                }
              `}
            >
              Asociar existente
            </button>

            <button
              type="button"
              onClick={() =>
                setProviderMode(
                  "NUEVO",
                )
              }
              className={`
                h-9
                rounded-lg
                text-[10px]
                font-bold

                ${providerMode ===
                  "NUEVO"
                  ? "bg-white text-[#00739B] shadow-sm"
                  : "text-slate-500"
                }
              `}
            >
              Registrar nuevo
            </button>
          </div>

          {providerMode ===
            "EXISTENTE" ? (
            <div
              className="mt-5"
            >
              <label
                className="
                  block
                  text-xs
                  font-bold
                  text-slate-700
                "
              >
                Proveedor
              </label>

              <select
                value={
                  existingProviderId
                }
                onChange={(
                  event,
                ) =>
                  setExistingProviderId(
                    event.target
                      .value
                      ? Number(
                        event.target
                          .value,
                      )
                      : "",
                  )
                }
                className="
                  mt-2
                  h-10
                  w-full
                  rounded-xl
                  border
                  border-slate-200
                  bg-white
                  px-3
                  text-xs
                "
              >
                <option value="">
                  Selecciona un proveedor
                </option>

                {providers.map(
                  (
                    provider,
                  ) => (
                    <option
                      key={
                        provider.id
                      }
                      value={
                        provider.id
                      }
                    >
                      {provider.nombre}
                      {" · "}
                      {provider.area}
                      {provider.nit
                        ? ` · NIT ${provider.nit}`
                        : ""}
                    </option>
                  ),
                )}
              </select>
            </div>
          ) : (
            <div
              className="
                mt-5
                space-y-4
              "
            >
              <Field
                label="Nombre del proveedor"
                value={
                  newProviderName
                }
                onChange={
                  setNewProviderName
                }
                placeholder="Razón social"
              />

              <Field
                label="NIT"
                value={
                  newProviderNit
                }
                onChange={
                  setNewProviderNit
                }
                placeholder="Opcional"
              />

              <div>
                <label
                  className="
                    block
                    text-xs
                    font-bold
                    text-slate-700
                  "
                >
                  Área responsable
                </label>

                <select
                  value={
                    newProviderArea
                  }
                  onChange={(
                    event,
                  ) =>
                    setNewProviderArea(
                      event.target
                        .value
                        ? Number(
                          event.target
                            .value,
                        )
                        : "",
                    )
                  }
                  className="
                    mt-2
                    h-10
                    w-full
                    rounded-xl
                    border
                    border-slate-200
                    bg-white
                    px-3
                    text-xs
                  "
                >
                  <option value="">
                    Selecciona un área
                  </option>

                  {areas.map(
                    (
                      area,
                    ) => (
                      <option
                        key={
                          area.id
                        }
                        value={
                          area.id
                        }
                      >
                        {area.nombre}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div>
                <label
                  className="
                    block
                    text-xs
                    font-bold
                    text-slate-700
                  "
                >
                  Correos del proveedor
                </label>

                <div
                  className="
                    mt-2
                    flex
                    gap-2
                  "
                >
                  <input
                    type="email"
                    value={
                      newProviderEmailDraft
                    }
                    onChange={(
                      event,
                    ) =>
                      setNewProviderEmailDraft(
                        event.target
                          .value,
                      )
                    }
                    onKeyDown={(
                      event,
                    ) => {
                      if (
                        event.key ===
                        "Enter"
                      ) {
                        event.preventDefault();

                        addProviderEmail();
                      }
                    }}
                    placeholder="correo@proveedor.com"
                    className="
                      h-10
                      flex-1
                      rounded-xl
                      border
                      border-slate-200
                      px-3
                      text-xs
                    "
                  />

                  <button
                    type="button"
                    onClick={
                      addProviderEmail
                    }
                    className="
                      rounded-xl
                      border
                      border-[#13A7C7]
                      px-3
                      text-[10px]
                      font-bold
                      text-[#00739B]
                    "
                  >
                    Agregar
                  </button>
                </div>

                <div
                  className="
                    mt-2
                    flex
                    flex-wrap
                    gap-2
                  "
                >
                  {newProviderEmails.map(
                    (
                      email,
                    ) => (
                      <span
                        key={
                          email
                        }
                        className="
                          inline-flex
                          items-center
                          gap-2
                          rounded-full
                          bg-[#DFF6FA]
                          px-3
                          py-1.5
                          text-[9px]
                          font-semibold
                          text-[#00739B]
                        "
                      >
                        <Mail
                          size={10}
                        />

                        {email}

                        <button
                          type="button"
                          onClick={() =>
                            setNewProviderEmails(
                              (
                                current,
                              ) =>
                                current.filter(
                                  (
                                    item,
                                  ) =>
                                    item !==
                                    email,
                                ),
                            )
                          }
                        >
                          <X
                            size={10}
                          />
                        </button>
                      </span>
                    ),
                  )}
                </div>
              </div>
            </div>
          )}

          <ModalButtons
            loading={
              actionLoading
            }
            onCancel={() =>
              setProviderOpen(
                false,
              )
            }
            onConfirm={() =>
              void submitProvider()
            }
            confirmText={
              providerMode ===
                "EXISTENTE"
                ? "Asociar proveedor"
                : "Registrar proveedor"
            }
          />
        </Modal>
      )}

      {/* ===================================================
          RECHAZO
      ==================================================== */}

      {rejectOpen && (
        <Modal
          title="Rechazar factura"
          onClose={() =>
            !actionLoading &&
            setRejectOpen(
              false,
            )
          }
        >
          <label
            className="
              block
              text-xs
              font-bold
              text-slate-700
            "
          >
            Motivo
          </label>

          <select
            value={
              rejectReason
            }
            onChange={(
              event,
            ) =>
              setRejectReason(
                event.target
                  .value,
              )
            }
            className="
              mt-2
              h-10
              w-full
              rounded-xl
              border
              border-slate-200
              bg-white
              px-3
              text-xs
            "
          >
            <option>
              Información incorrecta
            </option>

            <option>
              Factura duplicada
            </option>

            <option>
              Servicio o compra no reconocida
            </option>

            <option>
              Documento incompleto
            </option>

            <option>
              Otro
            </option>
          </select>

          <label
            className="
              mt-4
              block
              text-xs
              font-bold
              text-slate-700
            "
          >
            Observaciones
          </label>

          <textarea
            rows={4}
            value={
              rejectObservation
            }
            onChange={(
              event,
            ) =>
              setRejectObservation(
                event.target
                  .value,
              )
            }
            className="
              mt-2
              w-full
              resize-none
              rounded-xl
              border
              border-slate-200
              p-3
              text-xs
            "
          />

          <ModalButtons
            loading={
              actionLoading
            }
            onCancel={() =>
              setRejectOpen(
                false,
              )
            }
            onConfirm={() =>
              void submitReject()
            }
            confirmText="Confirmar rechazo"
            danger
          />
        </Modal>
      )}

      {/* ===================================================
          CONFIRMACION
      ==================================================== */}

      {confirmAction && (
        <Modal
          title={
            confirmAction ===
              "APROBAR"
              ? "Confirmar aprobación"
              : confirmAction ===
                "REMITIR_CONTABILIDAD"
                ? "Remitir a Contabilidad"
                : "Confirmar procesamiento"
          }
          onClose={() =>
            !actionLoading &&
            setConfirmAction(
              null,
            )
          }
        >
          <div
            className="
        flex
        items-start
        gap-3
        rounded-xl
        bg-slate-50
        p-4
      "
          >
            {confirmAction ===
              "APROBAR" ? (
              <CheckCircle2
                size={20}
                className="
            mt-0.5
            shrink-0
            text-emerald-600
          "
              />
            ) : confirmAction ===
              "REMITIR_CONTABILIDAD" ? (
              <Send
                size={20}
                className="
            mt-0.5
            shrink-0
            text-[#00739B]
          "
              />
            ) : (
              <Building2
                size={20}
                className="
            mt-0.5
            shrink-0
            text-violet-600
          "
              />
            )}

            <p
              className="
          text-xs
          leading-5
          text-slate-600
        "
            >
              {confirmAction ===
                "APROBAR"
                ? "La factura quedará aprobada. Después podrás remitirla directamente a Contabilidad."
                : confirmAction ===
                  "REMITIR_CONTABILIDAD"
                  ? "La factura será enviada a Contabilidad y desaparecerá de las facturas actuales de tu área."
                  : "La factura quedará marcada como procesada en Contabilidad."}
            </p>
          </div>

          <ModalButtons
            loading={
              actionLoading
            }
            onCancel={() =>
              setConfirmAction(
                null,
              )
            }
            onConfirm={() =>
              void executeConfirmation()
            }
            confirmText={
              confirmAction ===
                "APROBAR"
                ? "Aprobar"
                : confirmAction ===
                  "REMITIR_CONTABILIDAD"
                  ? "Remitir a Contabilidad"
                  : "Procesar"
            }
          />
        </Modal>
      )}
    </>
  );
};

/* =========================================================
   SUBCOMPONENTES
========================================================= */

const Info = ({
  label,
  value,
}: {
  label:
  string;

  value:
  string;
}) => {
  return (
    <div>
      <p
        className="
          text-[9px]
          font-bold
          uppercase
          tracking-wide
          text-slate-400
        "
      >
        {label}
      </p>

      <p
        className="
          mt-1
          wrap-break-words
          text-xs
          font-semibold
          text-slate-700
        "
      >
        {value}
      </p>
    </div>
  );
};

const Field = ({
  label,
  value,
  onChange,
  placeholder,
}: {
  label:
  string;

  value:
  string;

  onChange:
  (
    value:
      string,
  ) => void;

  placeholder?:
  string;
}) => {
  return (
    <div>
      <label
        className="
          block
          text-xs
          font-bold
          text-slate-700
        "
      >
        {label}
      </label>

      <input
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
        className="
          mt-2
          h-10
          w-full
          rounded-xl
          border
          border-slate-200
          px-3
          text-xs
          outline-none

          focus:border-[#13A7C7]
        "
      />
    </div>
  );
};

const Modal = ({
  title,
  onClose,
  children,
}: {
  title:
  string;

  onClose:
  () => void;

  children:
  React.ReactNode;
}) => {
  return (
    <div
      className="
        fixed
        inset-0
        z-50
        flex
        items-center
        justify-center
        bg-slate-900/35
        p-4
        backdrop-blur-[1px]
      "
    >
      <div
        className="
          max-h-[92vh]
          w-full
          max-w-lg
          overflow-y-auto
          rounded-3xl
          bg-white
          shadow-2xl
        "
      >
        <div
          className="
            flex
            items-center
            justify-between
            border-b
            border-slate-100
            px-6
            py-5
          "
        >
          <h3
            className="
              text-base
              font-bold
              text-slate-800
            "
          >
            {title}
          </h3>

          <button
            type="button"
            onClick={
              onClose
            }
            className="
              flex
              h-8
              w-8
              items-center
              justify-center
              rounded-lg
              text-slate-400

              hover:bg-slate-100
            "
          >
            <X
              size={16}
            />
          </button>
        </div>

        <div
          className="p-6"
        >
          {children}
        </div>
      </div>
    </div>
  );
};

const ModalButtons = ({
  loading,
  onCancel,
  onConfirm,
  confirmText,
  danger = false,
}: {
  loading:
  boolean;

  onCancel:
  () => void;

  onConfirm:
  () => void;

  confirmText:
  string;

  danger?:
  boolean;
}) => {
  return (
    <div
      className="
        mt-6
        flex
        justify-end
        gap-3
        border-t
        border-slate-100
        pt-5
      "
    >
      <button
        type="button"
        disabled={
          loading
        }
        onClick={
          onCancel
        }
        className="
          h-10
          rounded-xl
          border
          border-slate-200
          px-4
          text-xs
          font-semibold
          text-slate-600

          disabled:opacity-50
        "
      >
        Cancelar
      </button>

      <button
        type="button"
        disabled={
          loading
        }
        onClick={
          onConfirm
        }
        className={`
          inline-flex
          h-10
          items-center
          justify-center
          gap-2
          rounded-xl
          px-4
          text-xs
          font-bold
          text-white

          disabled:opacity-50

          ${danger
            ? "bg-red-600 hover:bg-red-700"
            : "bg-[#00739B] hover:bg-[#05627F]"
          }
        `}
      >
        {loading && (
          <LoaderCircle
            size={13}
            className="animate-spin"
          />
        )}

        {confirmText}
      </button>
    </div>
  );
};

export default FacturaDetalle;
