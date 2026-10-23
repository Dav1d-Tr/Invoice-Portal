import { getReturnContext, notifyFacturasUpdated } from "../utils/invoiceNavigation";
import { AlertCircle, ArrowLeft, Building2, Check, CheckCircle2, Download, ExternalLink, Eye, FileText, LoaderCircle, Mail, Paperclip, RefreshCw, Send, UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  abrirAdjuntoFactura, aprobarFactura, asociarProveedorExistente, descargarAdjuntoFactura,
  getAreasFactura, getFacturaCorreoOutlook, getFacturaDetalle, getProveedoresFactura, procesarFactura,
  rechazarFactura, registrarProveedorDesdeFactura, remitirFactura, remitirFacturaContabilidad
} from "../services/facturasService";
import type { AreaFactura, AsignarProveedorResult, Invoice, OutlookAttachment, OutlookMessageDetail, ProveedorFactura } from "../services/facturasService";
import { getStoredArea } from "../services/authService";
import { isAccountingArea, normalizeAreaName } from "../utils/areaPermissions";
import { errorMessage, isAbortError, joinWarnings } from "../utils/sgafApi";
import {
  canRejectInvoice, clearFeedback, isValidEmail, normalizeEmail, peekFeedback, prepareEmails, receptionPermissions,
  safeExternalUrl, saveFeedback, structuredSubject
} from "../utils/sgafUi";
import type { PageFeedback } from "../utils/sgafUi";
import { SgafModal as Modal, ModalButtons } from "../Components/SgafModal";
import { ResultadoOperacion } from "../Components/ResultadoOperacion";
const formatDateTime = (value: string | null | undefined): string => {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Bogota",
  }).format(date);
};
const formatMoney = (value: string | number | null | undefined, currency: string | null | undefined): string => {
  if (value ===
    null ||
    value ===
    undefined ||
    value ===
    "") {
    return "No disponible";
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return String(value);
  }
  const code = currency?.trim()
    .toUpperCase() ||
    "COP";
  try {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: code,
      maximumFractionDigits: code ===
        "COP"
        ? 0
        : 2,
    }).format(number);
  }
  catch {
    return `${number.toLocaleString("es-CO")} ${code}`;
  }
};
const formatSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) ||
    bytes <=
    0) {
    return "";
  }
  if (bytes <
    1024) {
    return `${bytes} B`;
  }
  if (bytes <
    1024 *
    1024) {
    return `${(bytes /
      1024).toFixed(1)} KB`;
  }
  return `${(bytes /
    1024 /
    1024).toFixed(1)} MB`;
};
const isPdf = (attachment: OutlookAttachment): boolean => {
  return (attachment
    .contentType
    .toLowerCase()
    .includes("pdf") ||
    /\.pdf$/i.test(attachment.name));
};
const statusClass = (code: Invoice["estadoCodigo"]): string => {
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

const FacturaDetalle = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const idFactura = Number(params.id);
  const currentArea = getStoredArea();
  const currentAreaId = Number(currentArea?.id ?? 0);
  const currentAreaName = currentArea?.nombre ?? "";
  useLayoutEffect(() => {
    // El detalle abre arriba; la posicion de la bandeja ya se guardo al seleccionar.
    let node = document.getElementById('main-content');
    while (node && node !== document.body) { node.scrollTop = 0; node = node.parentElement; }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [idFactura, currentAreaId]);
  const reception = normalizeAreaName(currentAreaName) === "RECEPCION";
  const accounting = isAccountingArea(currentAreaName);
  const scope = `factura:${idFactura}:${currentAreaId}`;
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [outlook, setOutlook] = useState<OutlookMessageDetail | null>(null);
  const [areas, setAreas] = useState<AreaFactura[]>([]);
  const [providers, setProviders] = useState<ProveedorFactura[]>([]);
  const [loading, setLoading] = useState(true);
  const [mailLoading, setMailLoading] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [attachmentLoading, setAttachmentLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mailError, setMailError] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<PageFeedback | null>(() => peekFeedback(scope));
  const [completed, setCompleted] = useState<PageFeedback | null>(null);
  const [remitOpen, setRemitOpen] = useState(false);
  const [remitAreaId, setRemitAreaId] = useState<number | "">("");
  const [remitObservation, setRemitObservation] = useState("");
  const [providerOpen, setProviderOpen] = useState(false);
  const [providerMode, setProviderMode] = useState<"EXISTENTE" | "NUEVO">("EXISTENTE");
  const [existingProviderId, setExistingProviderId] = useState<number | "">("");
  const [newProviderName, setNewProviderName] = useState("");
  const [newProviderNit, setNewProviderNit] = useState("");
  const [newProviderArea, setNewProviderArea] = useState<number | "">("");
  const [newProviderEmails, setNewProviderEmails] = useState<string[]>([]);
  const [newProviderEmailDraft, setNewProviderEmailDraft] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("Información incorrecta");
  const [rejectObservation, setRejectObservation] = useState("");
  const [confirmAction, setConfirmAction] = useState<"APROBAR" | "REMITIR_CONTABILIDAD" | "PROCESAR" | null>(null);
  const mounted = useRef(false);
  const scopeRef = useRef(scope); scopeRef.current = scope;
  const readVersion = useRef(0);
  const readController = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const actionVersion = useRef(0);
  const attachmentBusy = useRef(false);
  const dirty = useRef(false);

  const currentRead = (version: number, requestScope: string, signal?: AbortSignal) =>
    mounted.current && scopeRef.current === requestScope && version === readVersion.current && !signal?.aborted;

  const loadAll = useCallback(async (): Promise<boolean> => {
    readController.current?.abort();
    const controller = new AbortController(); readController.current = controller;
    const signal = controller.signal;
    const version = ++readVersion.current;
    const requestScope = `factura:${idFactura}:${currentAreaId}`;
    const valid = () => currentRead(version, requestScope, signal);
    setLoading(true); setError(null); setMailError(null); setCatalogError(null);
    if (!Number.isSafeInteger(idFactura) || idFactura <= 0) {
      setError("Registro no válido."); setLoading(false); return false;
    }
    try {
      const data = await getFacturaDetalle(idFactura, { signal });
      if (!valid()) return false;
      setInvoice(data); setLoading(false); setMailLoading(true); setCatalogLoading(true);
      const catalogs = (async () => {
        try {
          const [areaData, providerData] = await Promise.all([getAreasFactura({ signal }), getProveedoresFactura({ signal })]);
          if (valid()) { setAreas(areaData); setProviders(providerData); }
        } catch (err) {
          if (valid() && !isAbortError(err)) setCatalogError(errorMessage(err, "No se pudieron cargar los catálogos."));
        } finally { if (valid()) setCatalogLoading(false); }
      })();
      const mail = (async () => {
        try {
          const detail = await getFacturaCorreoOutlook(idFactura, { signal });
          if (!valid()) return false;
          setOutlook(detail);
          // El endpoint de correo puede actualizar metadatos; este GET nunca se hace tras un traslado.
          const updated = await getFacturaDetalle(idFactura, { signal });
          if (valid()) setInvoice(updated);
          return true;
        } catch (err) {
          if (valid() && !isAbortError(err)) setMailError(errorMessage(err, "No fue posible consultar Outlook. La clasificación local sigue disponible."));
          return false;
        } finally { if (valid()) setMailLoading(false); }
      })();
      const [, mailOk] = await Promise.all([catalogs, mail]);
      return valid() && mailOk;
    } catch (err) {
      if (valid() && !isAbortError(err)) setError(errorMessage(err, "No fue posible cargar el registro."));
      return false;
    } finally { if (valid()) setLoading(false); }
  }, [idFactura, currentAreaId]);

  useEffect(() => {
    mounted.current = true;
    ++actionVersion.current; busyRef.current = false; setActionLoading(false);
    setInvoice(null); setOutlook(null); setCompleted(null); setSuccess(null);
    setProviderOpen(false); setRemitOpen(false); setRejectOpen(false); setConfirmAction(null);
    setFeedback(peekFeedback(scope)); clearFeedback(scope); dirty.current = false;
    void loadAll();
    return () => { mounted.current = false; readController.current?.abort(); ++readVersion.current; ++actionVersion.current; };
  }, [loadAll, scope]);

  const ownsInvoice = Boolean(invoice && invoice.id === idFactura && invoice.activo !== false && invoice.idAreaActual === currentAreaId);
  const permissions = receptionPermissions(invoice?.id === idFactura ? invoice : null, currentAreaId, currentAreaName);
  const canClassify = permissions.clasificar && !completed;
  const availableAreas = useMemo(() => areas.filter(area => area.id !== currentAreaId && normalizeAreaName(area.nombre) !== "CONTABILIDAD"), [areas, currentAreaId]);
  const canRemit = Boolean(invoice && ownsInvoice && ["PENDIENTE", "APROBADA"].includes(invoice.estadoCodigo) && (!reception || invoice.idProveedor !== null));
  const canRemitAccounting = Boolean(invoice && ownsInvoice && !accounting && invoice.estadoCodigo === "APROBADA");
  const canApprove = Boolean(invoice && ownsInvoice && !reception && invoice.estadoCodigo === "PENDIENTE");
  const canReject = canRejectInvoice(invoice?.id === idFactura ? invoice : null, currentAreaId) && !completed;
  const canProcess = Boolean(invoice && ownsInvoice && accounting && invoice.estadoCodigo === "APROBADA");
  const selectedProvider = providers.find(provider => provider.id === Number(existingProviderId));
  const providerSender = normalizeEmail(invoice?.correo || outlook?.fromEmail || "");
  const structured = structuredSubject(invoice?.asunto);
  const existingMissingSender = Boolean(!structured && providerSender && selectedProvider &&
    normalizeEmail(selectedProvider.nombre) !== providerSender && !selectedProvider.correos.some(email => normalizeEmail(email) === providerSender));
  const outlookUrl = safeExternalUrl(outlook?.webLink || invoice?.webLink);

  const returnContext = getReturnContext(location.state, currentAreaId);
  const returnPath = returnContext?.path ?? "/facturas";
  const returnLabel = returnPath === "/sistemas/revision-facturas" ? "Volver a revision" : "Volver a facturas";
  const goBack = () => {
    if (busyRef.current) return;
    if (dirty.current || completed) notifyFacturasUpdated();
    // La bandeja vuelve a consultar datos y restaura pagina + fila + desplazamiento.
    // No se usa window.location.href: no se pierde el contexto de React Router.
    if (returnContext && Number(window.history.state?.idx ?? 0) > 0) navigate(-1);
    else navigate(returnPath, { replace: true, state: { sgafRestore: true } });
  };
  const cancelReads = () => {
    readController.current?.abort(); ++readVersion.current;
    setMailLoading(false); setCatalogLoading(false); setLoading(false);
  };
  const closeModals = () => { setProviderOpen(false); setRemitOpen(false); setRejectOpen(false); setConfirmAction(null); };
  const stayAfterMutation = async (notice: PageFeedback) => {
    setFeedback(notice);
    if (saveFeedback(scope, notice)) { window.location.reload(); return; }
    // No perder el resultado si el navegador bloquea sessionStorage.
    await loadAll();
  };
  async function runAction<T>(operation: () => Promise<T>, onSaved: (data: T) => void | Promise<void>, fallback: string) {
    if (busyRef.current || !ownsInvoice || completed) return;
    busyRef.current = true; setActionLoading(true); setError(null); setModalError(null); setSuccess(null); setFeedback(null);
    const requestScope = scope; const operationVersion = ++actionVersion.current; cancelReads();
    let saved = false;
    try {
      const data = await operation(); saved = true;
      if (!mounted.current || scopeRef.current !== requestScope || operationVersion !== actionVersion.current) return;
      dirty.current = true; notifyFacturasUpdated(); closeModals();
      await onSaved(data);
    } catch (err) {
      if (!mounted.current || scopeRef.current !== requestScope || operationVersion !== actionVersion.current) return;
      const message = errorMessage(err, fallback);
      if (saved) {
        setFeedback({ title: "Operación guardada", message: "El servidor confirmó la operación. No la repitas.", warning: `No se pudo actualizar la vista: ${message}` });
      } else { setError(message); setModalError(message); }
    } finally {
      if (operationVersion === actionVersion.current) {
        busyRef.current = false;
        if (mounted.current && scopeRef.current === requestScope) setActionLoading(false);
      }
    }
  }
  const refresh = async () => {
    if (busyRef.current || completed) return;
    busyRef.current = true; setActionLoading(true); setSuccess(null);
    const requestScope = scope;
    const operationVersion = ++actionVersion.current;
    try {
      const ok = await loadAll();
      if (mounted.current && scopeRef.current === requestScope && operationVersion === actionVersion.current && ok) setSuccess("Información actualizada.");
    } finally {
      if (operationVersion === actionVersion.current) {
        busyRef.current = false;
        if (mounted.current && scopeRef.current === requestScope) setActionLoading(false);
      }
    }
  };
  const executeConfirmation = async () => {
    if (!invoice || !confirmAction) return;
    const action = confirmAction;
    if (action === "APROBAR" && canApprove) {
      await runAction(() => aprobarFactura(invoice.id), () => stayAfterMutation({ title: "Factura aprobada", message: "Ahora puedes remitirla a Contabilidad con el botón independiente.", warning: null }), "No fue posible aprobar.");
    } else if (action === "REMITIR_CONTABILIDAD" && canRemitAccounting) {
      await runAction(() => remitirFacturaContabilidad(invoice.id, "Factura aprobada y remitida a Contabilidad."), () => setCompleted({ title: "Factura remitida a Contabilidad", message: "El registro salió de tu bandeja y conservó su estado APROBADA.", warning: null }), "No fue posible remitir a Contabilidad.");
    } else if (action === "PROCESAR" && canProcess) {
      await runAction(() => procesarFactura(invoice.id), () => setCompleted({ title: "Factura procesada", message: "La factura queda en el historial de procesadas y deja de aparecer como trabajo pendiente.", warning: null }), "No fue posible procesar.");
    }
  };
  const submitReject = async () => {
    if (!invoice || !canReject) return;
    const reason = [rejectReason, rejectObservation.trim()].filter(Boolean).join(" - ");
    await runAction(() => rechazarFactura(invoice.id, reason), () => setCompleted({ title: "Factura rechazada", message: "La factura quedó RECHAZADA y conserva su historial. Puedes consultarla en Rechazadas. No se desactivó el registro ni se eliminó el correo de Outlook.", warning: null }), "No fue posible rechazar.");
  };
  const openRemit = (suggestedId?: number) => {
    if (!canRemit || busyRef.current) return;
    const candidate = suggestedId ?? invoice?.idAreaProveedor;
    setRemitAreaId(availableAreas.some(area => area.id === candidate) ? Number(candidate) : "");
    setRemitObservation(""); setModalError(null); setRemitOpen(true);
  };
  const submitRemit = async () => {
    if (!invoice || !canRemit) return;
    const destination = availableAreas.find(area => area.id === Number(remitAreaId));
    if (!destination) { setModalError("Selecciona un área destino válida. Contabilidad tiene un botón independiente."); return; }
    await runAction(() => remitirFactura(invoice.id, destination.id, remitObservation), () => setCompleted({ title: "Registro remitido", message: `El registro fue remitido a ${destination.nombre}. La remisión quedó registrada en el historial.`, warning: null }), "No fue posible remitir.");
  };
  const openProvider = () => {
    if (!invoice || !canClassify || busyRef.current) return;
    const candidates = structured
      ? providers.filter(provider => provider.nombre.trim().replace(/\s+/g, " ").toUpperCase() === structured.proveedor.trim().replace(/\s+/g, " ").toUpperCase())
      : providers.filter(provider => normalizeEmail(provider.nombre) === providerSender || provider.correos.some(email => normalizeEmail(email) === providerSender));
    const existingId = invoice.idProveedor ?? (candidates.length === 1 ? candidates[0]?.id : null);
    setProviderMode(existingId ? "EXISTENTE" : "NUEVO"); setExistingProviderId(existingId ?? "");
    setNewProviderName(structured?.proveedor || (invoice.proveedor === "PROVEEDOR PENDIENTE" ? "" : invoice.proveedor));
    // No prellenar el NIT del destinatario encontrado dentro de un aviso de pago.
    setNewProviderNit(structured?.nit || (invoice.idProveedor ? invoice.nit ?? "" : ""));
    setNewProviderArea(invoice.idAreaProveedor ?? "");
    // No registrar automaticamente un operador de facturacion compartido.
    setNewProviderEmails(!structured && isValidEmail(providerSender) ? [providerSender] : []);
    setNewProviderEmailDraft(""); setModalError(null); setProviderOpen(true);
  };
  const addProviderEmail = () => {
    if (busyRef.current) return;
    try { setNewProviderEmails(prepareEmails(newProviderEmails, newProviderEmailDraft)); setNewProviderEmailDraft(""); setModalError(null); }
    catch (err) { setModalError(errorMessage(err, "Correo no válido.")); }
  };
  const submitProvider = async () => {
    if (!invoice || !canClassify || busyRef.current) return;
    let operation: () => Promise<AsignarProveedorResult>;
    try {
      if (providerMode === "EXISTENTE") {
        if (!selectedProvider) throw new Error("Selecciona un proveedor existente.");
        operation = () => asociarProveedorExistente(invoice.id, selectedProvider.id);
      } else {
        if (!newProviderName.trim()) throw new Error("El nombre del proveedor es obligatorio.");
        if (!areas.some(area => area.id === Number(newProviderArea))) throw new Error("Selecciona el área responsable del proveedor.");
        // Incluye el correo escrito aunque no se haya pulsado Agregar.
        const emails = prepareEmails(newProviderEmails, newProviderEmailDraft);
        operation = () => registrarProveedorDesdeFactura(invoice.id, { nombre: newProviderName.trim(), nit: newProviderNit.trim() || null, idArea: Number(newProviderArea), correos: emails });
      }
    } catch (err) { setModalError(errorMessage(err, "Revisa los datos del proveedor.")); return; }
    await runAction(operation, async result => {
      const c = result.clasificacion;
      const notice: PageFeedback = {
        title: result.creado ? "Proveedor registrado y clasificado" : "Proveedor asociado y clasificado",
        message: c ? `${result.proveedor}: ${c.facturasTransferidas} registro(s) transferido(s) a ${result.area}. El barrido se hizo solo sobre los registros activos de RECEPCIÓN, no sobre otras áreas. Llegan a Facturas, no a Remitidos.`
          : `Proveedor guardado: ${result.proveedor}. El backend no devolvió contadores de clasificación; no se muestran cifras estimadas.`,
        clasificacion: c,
        warning: joinWarnings(result.warning, existingMissingSender && providerMode === "EXISTENTE"
          ? `El remitente ${providerSender} no figura en los correos de este proveedor. La selección explícita clasifica este registro; para reconocer otros avisos sin estructura, SISTEMAS debe registrar ese correo y sincronizar.` : null),
      };
      if (result.correoOrigenRegistrado) notice.message += " El backend registró el remitente del aviso como correo del proveedor.";
      // NO abrir Remitir y NO volver a consultar un registro que ya salio del area.
      if (Number(result.idArea) !== currentAreaId) setCompleted(notice);
      else await stayAfterMutation(notice);
    }, "No fue posible registrar o asociar el proveedor.");
  };
  const fileAction = async (attachment: OutlookAttachment, view: boolean) => {
    if (!invoice || attachmentBusy.current || busyRef.current) return;
    attachmentBusy.current = true; setAttachmentLoading(attachment.id); setError(null);
    const requestScope = scope;
    try {
      if (view) await abrirAdjuntoFactura(invoice.id, attachment.id);
      else await descargarAdjuntoFactura(invoice.id, attachment.id, attachment.name);
    } catch (err) { if (mounted.current && scopeRef.current === requestScope) setError(errorMessage(err, "No fue posible obtener el adjunto.")); }
    finally { attachmentBusy.current = false; if (mounted.current && scopeRef.current === requestScope) setAttachmentLoading(null); }
  };
  const viewAttachment = (attachment: OutlookAttachment) => fileAction(attachment, true);
  const downloadAttachment = (attachment: OutlookAttachment) => fileAction(attachment, false);

  if (completed) return <div className="mx-auto max-w-4xl py-6">
    <h1 className="mb-5 text-2xl font-bold text-slate-800">Operación completada</h1>
    <ResultadoOperacion feedback={completed} />
    <button type="button" onClick={goBack} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#00739B] px-5 text-sm font-semibold text-white"><ArrowLeft size={16} />{returnLabel}</button>
    <p className="mt-3 text-xs text-slate-500">Al volver se recargan la bandeja y los contadores del menú. No es necesario remitir nuevamente.</p>
  </div>;
  if (loading &&
    !invoice) {
    return (<div className="flex min-h-[65vh] items-center justify-center gap-3 text-sm text-slate-500">
      <LoaderCircle size={20} className="animate-spin" />

      Cargando factura...
    </div>);
  }
  if (!invoice) {
    return (<div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
      {error ??
        "No fue posible cargar la factura."}

      <button type="button" onClick={goBack} className="mt-4 block rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-semibold">
        Volver a facturas
      </button>
    </div>);
  }
  const documentLabel = invoice.tipoDocumento ===
    "NOTA_CREDITO"
    ? "Número de nota crédito"
    : "Número de factura";
  /* =======================================================
     UI
  ======================================================= */
  return (<>
    {/* HEADER */}

    <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <button type="button" onClick={goBack} className="mb-3 inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-[#00739B]">
          <ArrowLeft size={15} />

          Volver
        </button>

        <h1 className="text-2xl font-bold text-slate-800">
          Detalle de factura
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Revisa el correo, los archivos adjuntos y la información antes de tomar una decisión.
        </p>
      </div>

      <button type="button" disabled={actionLoading ||
        mailLoading} onClick={() => void refresh()} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 hover:border-[#13A7C7] hover:text-[#00739B] disabled:opacity-50">
        <RefreshCw size={14} className={actionLoading ||
          mailLoading
          ? "animate-spin"
          : ""} />

        Actualizar
      </button>
    </div>

    {/* ALERTAS */}
    {feedback && <ResultadoOperacion feedback={feedback} />}
    {catalogError && <div role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">{catalogError} Usa Actualizar para reintentar.</div>}

    {success && (<div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
      <CheckCircle2 size={15} />

      {success}
    </div>)}

    {error && (<div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
      <AlertCircle size={15} />

      {error}
    </div>)}

    {/* CONTENIDO */}

    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_405px]">
      {/* =================================================
            IZQUIERDA
        ================================================== */}

      <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* MAIL HEADER */}

        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <h2 className="wrap-break-word text-lg font-bold text-slate-800">
                {outlook
                  ?.subject ??
                  invoice.asunto ??
                  "Sin asunto"}
              </h2>

              <div className="mt-4 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#DFF6FA] text-sm font-bold text-[#00739B]">
                  {(outlook
                    ?.fromName ||
                    invoice
                      .proveedor ||
                    "P")
                    .charAt(0)
                    .toUpperCase()}
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800">
                    {outlook
                      ?.fromName ||
                      invoice
                        .proveedor}
                  </p>

                  <p className="mt-1 break-all text-[10px] text-slate-500">
                    {outlook
                      ?.fromEmail ||
                      invoice
                        .correo ||
                      "Correo no disponible"}
                  </p>

                  {outlook
                    ?.to
                    .length ? (<p className="mt-1 break-all text-[10px] text-slate-400">
                      Para:{" "}
                      {outlook.to.join(", ")}
                    </p>) : null}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <span className="text-[10px] text-slate-400">
                {formatDateTime(outlook
                  ?.receivedDateTime ??
                  invoice
                    .fechaRecepcion)}
              </span>

              {outlookUrl && (<a href={outlookUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-[10px] font-semibold text-[#00739B] hover:bg-slate-50">
                <ExternalLink size={12} />

                Abrir en Outlook
              </a>)}
            </div>
          </div>
        </div>

        {/* ADJUNTOS */}

        <div className="border-b border-slate-200 bg-slate-50/70 px-6 py-4">
          <div className="flex items-center gap-2">
            <Paperclip size={14} className="text-[#00739B]" />

            <h3 className="text-xs font-bold text-slate-700">
              Documentos
            </h3>
          </div>

          {mailLoading ? (<div className="mt-3 flex items-center gap-2 text-[10px] text-slate-400">
            <LoaderCircle size={12} className="animate-spin" />

            Consultando Outlook...
          </div>) : (<>
            {outlook
              ?.attachments
              .length ? (<div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
                {outlook.attachments.map((attachment) => {
                  const busy = attachmentLoading ===
                    attachment.id;
                  return (<div key={attachment.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#DFF6FA] text-[#00739B]">
                      <FileText size={15} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[10px] font-bold text-slate-700" title={attachment.name}>
                        {attachment.name}
                      </p>

                      <p className="mt-0.5 text-[9px] text-slate-400">
                        {formatSize(attachment.size)}
                      </p>
                    </div>

                    <div className="flex shrink-0 gap-1">
                      {isPdf(attachment) && (<button type="button" disabled={Boolean(attachmentLoading) || actionLoading} onClick={() => void viewAttachment(attachment)} title="Ver documento" className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-[#13A7C7] hover:text-[#00739B] disabled:opacity-50">
                        {busy ? (<LoaderCircle size={12} className="animate-spin" />) : (<Eye size={13} />)}
                      </button>)}

                      <button type="button" disabled={Boolean(attachmentLoading) || actionLoading} onClick={() => void downloadAttachment(attachment)} title="Descargar documento" className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-[#13A7C7] hover:text-[#00739B] disabled:opacity-50">
                        {busy ? (<LoaderCircle size={12} className="animate-spin" />) : (<Download size={13} />)}
                      </button>
                    </div>
                  </div>);
                })}
              </div>) : (<p className="mt-3 text-[10px] text-slate-500">
                El correo no trae archivos adjuntos descargables.
              </p>)}

            {outlook
              ?.documentLinks
              .length ? (<div className="mt-3 flex flex-wrap gap-2">
                {outlook.documentLinks.filter(link => safeExternalUrl(link.url)).map((link) => (<a key={link.url} href={safeExternalUrl(link.url)!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-[#13A7C7] bg-[#F2FBFD] px-3 py-2 text-[10px] font-semibold text-[#00739B]">
                  <ExternalLink size={12} />

                  {link.label ||
                    "Abrir documento"}
                </a>))}
              </div>) : null}

            {mailError && (<p className="mt-3 text-[10px] text-amber-700">
              {mailError}
            </p>)}
          </>)}
        </div>

        {/* BODY */}

        <div className="bg-[#F6F8FA] p-5">
          {outlook
            ?.bodyHtml ? (<iframe title="Contenido del correo" sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" srcDoc={`
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
                `} className="h-170 w-full rounded-xl border border-slate-200 bg-white" />) : outlook
            ?.bodyText ? (<div className="max-h-170 overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-5 text-xs leading-6 text-slate-700">
              {outlook.bodyText}
            </div>) : (<div className="flex min-h-80 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm text-slate-400">
              {mailLoading
                ? "Cargando correo..."
                : (invoice.bodyPreview || "No hay contenido de correo disponible.")}
            </div>)}
        </div>
      </section>

      {/* =================================================
            PANEL DERECHO
        ================================================== */}

      <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-800">
          Información de factura
        </h2>

        <span className={`
              mt-4
              inline-flex
              rounded-full
              px-2.5
              py-1
              text-[10px]
              font-bold

              ${statusClass(invoice.estadoCodigo)}
            `}>
          {invoice.estado}
        </span>

        <div className="mt-6 space-y-5">
          <Info label="Proveedor" value={invoice.proveedor} />

          <Info label="NIT" value={invoice.nit ??
            "No registrado"} />

          <Info label="Tipo de documento" value={invoice.tipoDocumento ===
            "NOTA_CREDITO"
            ? "Nota crédito"
            : invoice.tipoDocumento ===
              "FACTURA"
              ? "Factura"
              : "Documento / aviso por identificar"} />

          <Info label={documentLabel} value={invoice.numeroFactura ??
            "Sin número"} />

          <Info label="Fecha recepción" value={formatDateTime(invoice.fechaRecepcion)} />

          <Info label="Correo remitente" value={invoice.correo ??
            "No disponible"} />

          <Info label="Área origen" value={invoice.areaOrigen} />

          <Info label="Área actual" value={invoice.areaActual} />

          {invoice.areaProveedor && (<Info label="Área del proveedor" value={invoice.areaProveedor} />)}
        </div>

        <div className="my-6 border-t border-slate-100" />

        <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
          Valor total
        </p>

        <p className="mt-1 text-2xl font-bold text-slate-800">
          {formatMoney(invoice.valorTotal, invoice.moneda)}
        </p>

        {/* RECEPCION */}

        {canClassify && (<div className="mt-6 rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">
          <p className="text-xs font-bold text-slate-700">
            Clasificación de Recepción
          </p>

          <p className="mt-1 text-[10px] leading-5 text-slate-500">
            {invoice.idProveedor
              ? `Proveedor asociado. Área configurada: ${invoice.areaProveedor ?? "sin área visible"}.`
              : "Esta factura todavía no tiene un proveedor registrado o asociado."}
          </p>

          <button type="button" disabled={actionLoading} onClick={openProvider} className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-[#13A7C7] bg-white text-[10px] font-bold text-[#00739B]">
            <UserPlus size={13} />

            {invoice.idProveedor
              ? "Cambiar / revisar proveedor"
              : "Registrar o asociar proveedor"}
          </button>
        </div>)}

        {/* ACCIONES */}

        <div className="mt-6 border-t border-slate-100 pt-5">
          <p className="mb-3 text-xs font-bold text-slate-700">
            ¿Qué deseas hacer?
          </p>

          {!ownsInvoice && (<p className="rounded-xl bg-slate-50 px-3 py-3 text-[10px] leading-5 text-slate-500">
            La factura ya no se encuentra actualmente en tu área. Puedes consultar el histórico, pero las acciones corresponden al área actual.
          </p>)}

          {ownsInvoice && (<div className="grid grid-cols-1 gap-2">
            {canApprove && (<button type="button" disabled={actionLoading} onClick={() => { setModalError(null); setConfirmAction("APROBAR"); }} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
              <Check size={14} />

              Aprobar factura
            </button>)}

            {canReject && (<button type="button" disabled={actionLoading} onClick={() => { setRejectReason("Información incorrecta"); setRejectObservation(""); setModalError(null); setRejectOpen(true); }} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50">
              <X size={14} />

              Rechazar factura
            </button>)}

            {canRemit && (<button type="button" disabled={actionLoading} onClick={() => openRemit()} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#00739B] px-4 text-xs font-bold text-white hover:bg-[#05627F] disabled:opacity-50">
              <Send size={14} />

              Remitir a otra área
            </button>)}

            {canRemitAccounting && (<button type="button" disabled={actionLoading} onClick={() => { setModalError(null); setConfirmAction("REMITIR_CONTABILIDAD"); }} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50">
              <Building2 size={14} />

              Remitir a Contabilidad
            </button>)}

            {reception &&
              !invoice.idProveedor &&
              [
                "PENDIENTE",
                "APROBADA",
              ].includes(invoice.estadoCodigo) && (<p className="rounded-xl bg-amber-50 px-3 py-3 text-[10px] leading-5 text-amber-700">
                Registra o asocia el proveedor. El backend clasificará los registros coincidentes y los trasladará al área responsable.
              </p>)}

            {canProcess && (<button type="button" disabled={actionLoading} onClick={() => { setModalError(null); setConfirmAction("PROCESAR"); }} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50">
              <CheckCircle2 size={14} />

              Procesar factura
            </button>)}
          </div>)}
        </div>
      </aside>
    </div>

    {/* ===================================================
            MODAL REMITIR
        ==================================================== */}

    {remitOpen && (<Modal busy={actionLoading} title="Remitir factura" onClose={() => !actionLoading &&
      setRemitOpen(false)}>
      <p className="text-xs leading-5 text-slate-500">
        La factura conservará su estado actual. La remisión quedará registrada en la auditoría.
      </p>

      <label className="mt-5 block text-xs font-bold text-slate-700">
        Área destino
      </label>

      <select aria-label="Área destino" disabled={actionLoading} value={remitAreaId} onChange={(event) => setRemitAreaId(event.target
        .value
        ? Number(event.target
          .value)
        : "")} className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-[#13A7C7]">
        <option value="">
          Selecciona un área
        </option>

        {availableAreas.map((area) => (<option key={area.id} value={area.id}>
          {area.nombre}
        </option>))}
      </select>

      <label className="mt-4 block text-xs font-bold text-slate-700">
        Observaciones
      </label>

      <textarea aria-label="Observaciones de remisión" disabled={actionLoading} value={remitObservation} onChange={(event) => setRemitObservation(event.target
        .value)} rows={4} placeholder="Información útil para el área que recibirá la factura..." className="mt-2 w-full resize-none rounded-xl border border-slate-200 p-3 text-xs outline-none focus:border-[#13A7C7]" />

      {modalError && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">{modalError}</p>}
      <ModalButtons loading={actionLoading} onCancel={() => setRemitOpen(false)} onConfirm={() => void submitRemit()} confirmText="Remitir factura" />
    </Modal>)}

    {/* ===================================================
            MODAL PROVEEDOR
        ==================================================== */}

    {providerOpen && (<Modal busy={actionLoading} title="Proveedor de la factura" onClose={() => !actionLoading &&
      setProviderOpen(false)}>
      <p className="mb-4 rounded-xl bg-cyan-50 p-3 text-xs leading-5 text-slate-600">
        Al guardar, SGAF clasifica todos los registros coincidentes de RECEPCIÓN y los pasa al área configurada. No se requieren XML, número de factura, valor ni adjuntos.
      </p>
      {catalogLoading && <p className="mb-3 text-xs text-slate-500">Cargando catálogos...</p>}
      {catalogError && <p role="alert" className="mb-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">{catalogError}</p>}
      <fieldset disabled={actionLoading}>

        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
          <button type="button" onClick={() => { setModalError(null); setProviderMode("EXISTENTE"); }} className={`
                h-9
                rounded-lg
                text-[10px]
                font-bold

                ${providerMode ===
              "EXISTENTE"
              ? "bg-white text-[#00739B] shadow-sm"
              : "text-slate-500"}
              `}>
            Asociar existente
          </button>

          <button type="button" onClick={() => { setModalError(null); setProviderMode("NUEVO"); }} className={`
                h-9
                rounded-lg
                text-[10px]
                font-bold

                ${providerMode ===
              "NUEVO"
              ? "bg-white text-[#00739B] shadow-sm"
              : "text-slate-500"}
              `}>
            Registrar nuevo
          </button>
        </div>

        {providerMode ===
          "EXISTENTE" ? (<div className="mt-5">
            <label className="block text-xs font-bold text-slate-700">
              Proveedor
            </label>

            <select aria-label="Proveedor existente" value={existingProviderId} onChange={(event) => setExistingProviderId(event.target
              .value
              ? Number(event.target
                .value)
              : "")} className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs">
              <option value="">
                Selecciona un proveedor
              </option>

              {providers.map((provider) => (<option key={provider.id} value={provider.id}>
                {provider.nombre}
                {" · "}
                {provider.area}
                {provider.nit
                  ? ` · NIT ${provider.nit}`
                  : ""}
              </option>))}
            </select>
          </div>) : (<div className="mt-5 space-y-4">
            <Field label="Nombre del proveedor" value={newProviderName} onChange={setNewProviderName} placeholder="Razón social" />

            <Field label="NIT" value={newProviderNit} onChange={setNewProviderNit} placeholder="Opcional" />

            <div>
              <label className="block text-xs font-bold text-slate-700">
                Área responsable
              </label>

              <select aria-label="Área responsable del nuevo proveedor" value={newProviderArea} onChange={(event) => setNewProviderArea(event.target
                .value
                ? Number(event.target
                  .value)
                : "")} className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs">
                <option value="">
                  Selecciona un área
                </option>

                {areas.map((area) => (<option key={area.id} value={area.id}>
                  {area.nombre}
                </option>))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700">
                Correos del proveedor
              </label>

              <div className="mt-2 flex gap-2">
                <input aria-label="Nuevo correo del proveedor" type="email" value={newProviderEmailDraft} onChange={(event) => setNewProviderEmailDraft(event.target
                  .value)} onKeyDown={(event) => {
                    if (event.key ===
                      "Enter") {
                      event.preventDefault();
                      addProviderEmail();
                    }
                  }} placeholder="correo@proveedor.com" className="h-10 flex-1 rounded-xl border border-slate-200 px-3 text-xs" />

                <button type="button" onClick={addProviderEmail} className="rounded-xl border border-[#13A7C7] px-3 text-[10px] font-bold text-[#00739B]">
                  Agregar
                </button>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                {newProviderEmails.map((email) => (<span key={email} className="inline-flex items-center gap-2 rounded-full bg-[#DFF6FA] px-3 py-1.5 text-[9px] font-semibold text-[#00739B]">
                  <Mail size={10} />

                  {email}

                  <button type="button" onClick={() => setNewProviderEmails((current) => current.filter((item) => item !==
                    email))}>
                    <X size={10} />
                  </button>
                </span>))}
              </div>
            </div>
          </div>)}

      </fieldset>
      {providerMode === "EXISTENTE" && selectedProvider && <p className="mt-3 text-xs text-slate-600">Área responsable: <strong>{selectedProvider.area}</strong>.</p>}
      {providerMode === "EXISTENTE" && existingMissingSender && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800">Este remitente no está configurado en el proveedor. SISTEMAS debe agregarlo para reconocer otros avisos sin estructura.</p>}
      {modalError && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">{modalError}</p>}
      <ModalButtons disabled={catalogLoading} loading={actionLoading} onCancel={() => setProviderOpen(false)} onConfirm={() => void submitProvider()} confirmText={providerMode ===
        "EXISTENTE"
        ? "Asociar proveedor"
        : "Registrar proveedor"} />
    </Modal>)}

    {/* ===================================================
            RECHAZO
        ==================================================== */}

    {rejectOpen && (<Modal busy={actionLoading} title="Rechazar factura" onClose={() => !actionLoading &&
      setRejectOpen(false)}>
      <p className="mb-4 rounded-xl bg-red-50 p-3 text-xs leading-5 text-red-800">
        La factura pasará a RECHAZADA, como en las demás áreas. Seguirá
        disponible en Rechazadas y conservará su historial. No se borrará ni
        se desactivará; el correo permanecerá en Outlook.
      </p>
      <label className="block text-xs font-bold text-slate-700">
        Motivo
      </label>

      <select aria-label="Motivo del rechazo" disabled={actionLoading} value={rejectReason} onChange={(event) => setRejectReason(event.target
        .value)} className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs">
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

      <label className="mt-4 block text-xs font-bold text-slate-700">
        Observaciones
      </label>

      <textarea aria-label="Observaciones del rechazo" disabled={actionLoading} rows={4} value={rejectObservation} onChange={(event) => setRejectObservation(event.target
        .value)} className="mt-2 w-full resize-none rounded-xl border border-slate-200 p-3 text-xs" />

      {modalError && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">{modalError}</p>}
      <ModalButtons loading={actionLoading} onCancel={() => setRejectOpen(false)} onConfirm={() => void submitReject()} confirmText="Confirmar rechazo" danger />
    </Modal>)}

    {/* ===================================================
            CONFIRMACION
        ==================================================== */}

    {confirmAction && (<Modal busy={actionLoading} title={confirmAction ===
      "APROBAR"
      ? "Confirmar aprobación"
      : confirmAction ===
        "REMITIR_CONTABILIDAD"
        ? "Remitir a Contabilidad"
        : "Confirmar procesamiento"} onClose={() => !actionLoading &&
          setConfirmAction(null)}>
      <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
        {confirmAction ===
          "APROBAR" ? (<CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-600" />) : confirmAction ===
            "REMITIR_CONTABILIDAD" ? (<Send size={20} className="mt-0.5 shrink-0 text-[#00739B]" />) : (<Building2 size={20} className="mt-0.5 shrink-0 text-violet-600" />)}

        <p className="text-xs leading-5 text-slate-600">
          {confirmAction ===
            "APROBAR"
            ? "La factura quedará aprobada. Después podrás remitirla directamente a Contabilidad."
            : confirmAction ===
              "REMITIR_CONTABILIDAD"
              ? "La factura será enviada a Contabilidad y desaparecerá de las facturas actuales de tu área."
              : "La factura quedará marcada como procesada en Contabilidad."}
        </p>
      </div>

      {modalError && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">{modalError}</p>}
      <ModalButtons loading={actionLoading} onCancel={() => setConfirmAction(null)} onConfirm={() => void executeConfirmation()} confirmText={confirmAction ===
        "APROBAR"
        ? "Aprobar"
        : confirmAction ===
          "REMITIR_CONTABILIDAD"
          ? "Remitir a Contabilidad"
          : "Procesar"} />
    </Modal>)}
  </>);
};

const Info = ({ label, value, }: {
  label: string;
  value: string;
}) => {
  return (<div>
    <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
      {label}
    </p>

    <p className="mt-1 wrap-break-word text-xs font-semibold text-slate-700">
      {value}
    </p>
  </div>);
};
const Field = ({ label, value, onChange, placeholder, }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) => {
  const fieldId = useId();
  return (<div>
    <label htmlFor={fieldId} className="block text-xs font-bold text-slate-700">
      {label}
    </label>

    <input id={fieldId} value={value} onChange={(event) => onChange(event.target
      .value)} placeholder={placeholder} className="mt-2 h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-[#13A7C7]" />
  </div>);
};

export default FacturaDetalle;
