import { Building2, Edit3, LoaderCircle, Mail, Plus, RefreshCw, Save, Search, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { getStoredArea } from "../services/authService";
import { getAreasFactura } from "../services/facturasService";
import type { AreaFactura } from "../services/facturasService";
import { actualizarProveedor, crearProveedor, eliminarProveedor, getProveedores, sincronizarProveedor } from "../services/proveedoresService";
import type { GuardarProveedorResult, OutlookSyncResult, Proveedor } from "../services/proveedoresService";
import { normalizeAreaName } from "../utils/areaPermissions";
import { errorMessage, isAbortError, joinWarnings } from "../utils/sgafApi";
import { clearFeedback, peekFeedback, prepareEmails, saveFeedback } from "../utils/sgafUi";
import type { PageFeedback } from "../utils/sgafUi";
import { SgafModal, ModalButtons } from "../Components/SgafModal";
import { ResultadoOperacion } from "../Components/ResultadoOperacion";

export function feedbackSincronizacion(sync: OutlookSyncResult, title: string, extraWarning?: string | null, requestedOutlook = true): PageFeedback {
  const summary = sync.clasificacion;
  const remote = sync.outlook;
  const message = summary
    ? `${sync.proveedor}: ${summary.facturasTransferidas} registro(s) transferido(s) a ${sync.area}. Se revisaron los PENDIENTES de todas las áreas. Las facturas aprobadas, rechazadas y procesadas no se reclasifican.`
    : `${sync.proveedor}: operación completada. El servidor no devolvió el detalle de la clasificación; no se muestran contadores estimados.`;
  return {
    title, message: message + (!requestedOutlook ? " No se consultó Outlook." : ""),
    warning: joinWarnings(extraWarning, sync.warning,
      requestedOutlook && !remote && !sync.warning && !extraWarning ? "No se recibió un resultado de Outlook. La operación local puede haberse completado." : null),
    clasificacion: summary,
    remoto: remote ? {
      nuevas: remote.facturasCreadas, duplicadas: remote.duplicadas,
      errores: remote.errores, erroresMetadatos: remote.erroresMetadatos
    } : null
  };
}

function readPreferences(scope: string): { search: string; consultarOutlook: boolean } {
  try {
    const raw = JSON.parse(sessionStorage.getItem(`sgaf:preferencias:${scope}`) ?? "null") as { search?: unknown; consultarOutlook?: unknown } | null;
    return { search: typeof raw?.search === "string" ? raw.search : "", consultarOutlook: raw?.consultarOutlook !== false };
  } catch { return { search: "", consultarOutlook: true }; }
}

const Configuracion = () => {
  const areaActual = getStoredArea();
  const systems = normalizeAreaName(areaActual?.nombre ?? "") === "SISTEMAS";
  const scope = `configuracion:${areaActual?.id ?? "sin-sesion"}`;
  const [areas, setAreas] = useState<AreaFactura[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [nombre, setNombre] = useState("");
  const [nit, setNit] = useState("");
  const [idArea, setIdArea] = useState("");
  const [correos, setCorreos] = useState<string[]>([""]);
  const [consultarOutlook, setConsultarOutlook] = useState(() => readPreferences(scope).consultarOutlook);
  const [search, setSearch] = useState(() => readPreferences(scope).search);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"guardar" | "sincronizar" | "eliminar" | null>(null);
  const [target, setTarget] = useState<{ mode: "sincronizar" | "eliminar"; provider: Proveedor } | null>(null);
  const [feedback, setFeedback] = useState<PageFeedback | null>(() => peekFeedback(scope));
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const actionVersion = useRef(0);
  const mounted = useRef(false);
  const loadNumber = useRef(0);
  const formTitleId = useId();
  const scopeRef = useRef(scope);
  scopeRef.current = scope;

  const load = useCallback(async (signal?: AbortSignal) => {
    const number = ++loadNumber.current;
    setLoading(true);
    try {
      const [areaData, providerData] = await Promise.all([getAreasFactura({ signal }), getProveedores({ signal })]);
      if (!mounted.current || signal?.aborted || number !== loadNumber.current) return;
      setAreas(areaData); setProveedores(providerData);
    } catch (err) {
      if (mounted.current && !signal?.aborted && number === loadNumber.current && !isAbortError(err)) {
        setError(errorMessage(err, "No fue posible cargar los proveedores."));
      }
    } finally {
      if (mounted.current && !signal?.aborted && number === loadNumber.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    ++actionVersion.current; busyRef.current = false; setBusy(null);
    clearFeedback(scope);
    const controller = new AbortController();
    if (systems) void load(controller.signal); else setLoading(false);
    return () => { mounted.current = false; ++loadNumber.current; ++actionVersion.current; controller.abort(); };
  }, [load, scope, systems]);

  useEffect(() => {
    try { sessionStorage.setItem(`sgaf:preferencias:${scope}`, JSON.stringify({ search, consultarOutlook })); }
    catch { /* Mantener el estado local si el almacenamiento esta bloqueado. */ }
  }, [scope, search, consultarOutlook]);

  const reset = () => { setEditingId(null); setNombre(""); setNit(""); setIdArea(""); setCorreos([""]); };
  const startEdit = (provider: Proveedor) => {
    if (busyRef.current) return;
    setEditingId(provider.id); setNombre(provider.nombre); setNit(provider.nit ?? ""); setIdArea(String(provider.idArea));
    setCorreos(provider.correos.length ? provider.correos.map(email => email.correo) : [""]);
    setError(null); window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const finish = async (notice: PageFeedback) => {
    if (!mounted.current) return;
    setFeedback(notice);
    // Remonta tambien tu sidebar actual: no supone un contexto o cache que no fue adjuntado.
    // El resultado se recupera una sola vez despues de recargar, sin repetir el POST.
    if (saveFeedback(scope, notice)) { window.location.reload(); return; }
    // Si el navegador bloquea sessionStorage, se conserva el resultado en pantalla.
    await load();
  };
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!systems || busyRef.current) return;
    busyRef.current = true; setBusy("guardar"); setError(null); setFeedback(null);
    const requestScope = scope; const operationVersion = ++actionVersion.current;
    try {
      if (!nombre.trim()) throw new Error("El nombre del proveedor es obligatorio.");
      if (!areas.some(area => area.id === Number(idArea))) throw new Error("Selecciona un área responsable válida.");
      const emails = prepareEmails(correos);
      const input = { nombre: nombre.trim(), nit: nit.trim() || null, idArea: Number(idArea), correos: emails, consultarOutlook };
      const result: GuardarProveedorResult = editingId ? await actualizarProveedor(editingId, input) : await crearProveedor(input);
      if (!mounted.current || scopeRef.current !== requestScope || operationVersion !== actionVersion.current) return;
      const title = editingId ? "Proveedor actualizado" : "Proveedor registrado";
      const notice = result.sincronizacion
        ? feedbackSincronizacion(result.sincronizacion, title, result.warning, consultarOutlook)
        : { title, message: "Los datos del proveedor quedaron guardados.", warning: result.warning || "No se recibió un resumen de clasificación. Usa Sincronizar para revisarlo." };
      reset(); await finish(notice);
    } catch (err) {
      if (mounted.current && scopeRef.current === requestScope && operationVersion === actionVersion.current) setError(errorMessage(err, "No fue posible guardar el proveedor."));
    } finally {
      if (operationVersion === actionVersion.current) {
        busyRef.current = false;
        if (mounted.current && scopeRef.current === requestScope) setBusy(null);
      }
    }
  };
  const executeTarget = async () => {
    if (!target || !systems || busyRef.current) return;
    const selected = target; const requestScope = scope; const operationVersion = ++actionVersion.current;
    busyRef.current = true; setBusy(selected.mode); setModalError(null); setError(null); setFeedback(null);
    try {
      let notice: PageFeedback;
      if (selected.mode === "sincronizar") {
        const result = await sincronizarProveedor(selected.provider.id, { consultarOutlook });
        notice = feedbackSincronizacion(result, "Sincronización del proveedor completada", null, consultarOutlook);
      } else {
        await eliminarProveedor(selected.provider.id);
        notice = { title: "Proveedor desactivado", message: `${selected.provider.nombre} fue desactivado. El historial de sus registros no fue borrado.`, warning: null };
      }
      if (!mounted.current || scopeRef.current !== requestScope || operationVersion !== actionVersion.current) return;
      if (selected.mode === "eliminar" && editingId === selected.provider.id) reset();
      setTarget(null); await finish(notice);
    } catch (err) {
      if (mounted.current && scopeRef.current === requestScope && operationVersion === actionVersion.current) setModalError(errorMessage(err, "No fue posible completar la operación."));
    } finally {
      if (operationVersion === actionVersion.current) {
        busyRef.current = false;
        if (mounted.current && scopeRef.current === requestScope) setBusy(null);
      }
    }
  };
  const filtered = useMemo(() => {
    const value = search.trim().toLocaleLowerCase("es");
    return proveedores.filter(provider => !value || [provider.nombre, provider.nit ?? "", provider.area,
    ...provider.correos.map(email => email.correo)].join(" ").toLocaleLowerCase("es").includes(value));
  }, [proveedores, search]);

  if (!systems) return <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
    Esta configuración es exclusiva de SISTEMAS. RECEPCIÓN registra o asocia proveedores desde el detalle de un registro.
  </div>;

  return <>
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-2xl font-bold text-slate-800">Configuración</h1>
        <p className="mt-1 text-sm text-slate-500">Proveedores, áreas responsables y clasificación de pendientes.</p></div>
      <button type="button" disabled={Boolean(busy) || loading} onClick={() => { setError(null); void load(); }}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 disabled:opacity-50">
        <RefreshCw size={14} className={loading ? "animate-spin" : ""} />Actualizar lista
      </button>
    </header>
    {feedback && <ResultadoOperacion feedback={feedback} />}
    {error && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">{error}</div>}
    <div className="mb-6 rounded-xl border border-cyan-100 bg-cyan-50/60 p-4">
      <label className="flex items-start gap-3 text-xs font-semibold text-slate-700">
        <input type="checkbox" checked={consultarOutlook} disabled={Boolean(busy) || Boolean(target)}
          onChange={event => setConsultarOutlook(event.target.checked)} className="mt-0.5 h-4 w-4" />
        <span>Consultar también Outlook al guardar o sincronizar
          <span className="mt-1 block font-normal leading-5 text-slate-500">
            Primero se reclasifican los PENDIENTES que ya están en SGAF, en todas las áreas. Desmarca esta opción para trabajar solo con los registros existentes, sin consultar el buzón.
          </span>
        </span>
      </label>
    </div>
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
      <section className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby={formTitleId}>
        <div className="mb-6 flex items-start justify-between gap-2">
          <div><h2 id={formTitleId} className="font-bold text-slate-800">{editingId ? "Editar proveedor" : "Registrar proveedor"}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Nombre exacto para asuntos estructurados; correo remitente para avisos de pago y otros mensajes sin estructura.
            </p></div>
          {editingId && <button type="button" aria-label="Cancelar edición" disabled={Boolean(busy)} onClick={reset} className="text-slate-400 hover:text-slate-700 disabled:opacity-50"><X size={18} /></button>}
        </div>
        <form onSubmit={save}>
          <fieldset disabled={Boolean(busy) || loading} className="space-y-5 disabled:opacity-70">
            <Field label="Proveedor" value={nombre} onChange={setNombre} placeholder="Nombre del proveedor" icon={<Building2 size={16} />} required />
            <Field label="NIT" value={nit} onChange={setNit} placeholder="Opcional" />
            <label className="block text-xs font-bold text-slate-700">Área responsable
              <select required value={idArea} onChange={event => setIdArea(event.target.value)}
                className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-normal text-slate-800">
                <option value="">Selecciona un área</option>
                {areas.map(area => <option key={area.id} value={area.id}>{area.nombre}</option>)}
              </select>
            </label>
            <div>
              <div className="mb-2 flex items-center justify-between"><p className="text-xs font-bold text-slate-700">Correos <span className="font-normal text-slate-400">opcionales</span></p>
                <button type="button" onClick={() => setCorreos(current => [...current, ""])} className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#00739B]"><Plus size={13} />Agregar</button></div>
              <div className="space-y-2">
                {correos.map((correo, index) => <div key={index} className="flex gap-2">
                  <div className="relative flex-1"><Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input aria-label={`Correo ${index + 1}`} type="email" value={correo}
                      onChange={event => setCorreos(current => current.map((value, position) => position === index ? event.target.value : value))}
                      placeholder="correo@proveedor.com" className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-xs" /></div>
                  <button type="button" aria-label={`Quitar correo ${index + 1}`} onClick={() => setCorreos(current => current.length === 1 ? [""] : current.filter((_, position) => position !== index))}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                </div>)}
              </div>
              <p className="mt-2 text-[10px] leading-5 text-slate-500">Para identificar avisos sin estructura, registra la dirección exacta del remitente. No se asignan proveedores por dominio completo.</p>
            </div>
            <button type="submit" className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#076C8F] text-xs font-bold text-white disabled:opacity-50">
              {busy === "guardar" ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
              {busy === "guardar" ? "Guardando y clasificando..." : editingId ? "Guardar y reclasificar pendientes" : "Registrar y clasificar pendientes"}
            </button>
          </fieldset>
        </form>
      </section>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <div className="relative max-w-md"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input aria-label="Buscar proveedor" type="search" value={search} onChange={event => setSearch(event.target.value)}
              placeholder="Buscar proveedor, NIT, correo o área..." className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-xs" /></div>
          <p className="mt-2 text-[10px] text-slate-400">{filtered.length} de {proveedores.length} proveedores activos</p>
        </div>
        {loading ? <div role="status" className="flex min-h-60 items-center justify-center gap-2 text-xs text-slate-500"><LoaderCircle className="animate-spin" size={18} />Cargando proveedores...</div>
          : <div className="overflow-x-auto p-4"><table className="w-full min-w-190">
            <thead><tr className="bg-[#F6F9FA]">{["Proveedor", "Área", "Correos", "Acciones"].map(title => <th key={title} className="px-4 py-3 text-left text-[10px] font-bold uppercase text-slate-500">{title}</th>)}</tr></thead>
            <tbody>{filtered.map(provider => <tr key={provider.id} className="border-b border-slate-100">
              <td className="px-4 py-4"><p className="text-xs font-bold text-slate-800">{provider.nombre}</p><p className="mt-1 text-[10px] text-slate-400">{provider.nit ? `NIT ${provider.nit}` : "Sin NIT"}</p></td>
              <td className="px-4 py-4 text-xs">{provider.area}</td>
              <td className="px-4 py-4">{provider.correos.length ? <div className="flex flex-wrap gap-1">{provider.correos.map(email => <span key={email.id} className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] text-slate-600">{email.correo}</span>)}</div> : <span className="text-[10px] text-slate-400">Sin correos configurados</span>}</td>
              <td className="px-4 py-4"><div className="flex gap-2">
                <button type="button" disabled={Boolean(busy)} onClick={() => startEdit(provider)} title="Editar" aria-label={`Editar ${provider.nombre}`} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:text-[#00739B] disabled:opacity-50"><Edit3 size={13} /></button>
                <button type="button" disabled={Boolean(busy)} onClick={() => { setModalError(null); setTarget({ mode: "sincronizar", provider }); }} title="Revisar pendientes de todas las áreas" aria-label={`Sincronizar ${provider.nombre}`} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-[#00739B] disabled:opacity-50"><RefreshCw size={13} /></button>
                <button type="button" disabled={Boolean(busy)} onClick={() => { setModalError(null); setTarget({ mode: "eliminar", provider }); }} title="Desactivar proveedor" aria-label={`Desactivar ${provider.nombre}`} className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-500 disabled:opacity-50"><Trash2 size={13} /></button>
              </div></td>
            </tr>)}
              {!filtered.length && <tr><td colSpan={4} className="px-4 py-10 text-center text-xs text-slate-500">No hay proveedores que coincidan con la búsqueda.</td></tr>}
            </tbody>
          </table></div>}
      </section>
    </div>
    {target && <SgafModal title={target.mode === "sincronizar" ? "Sincronizar proveedor" : "Desactivar proveedor"} busy={Boolean(busy)} onClose={() => setTarget(null)}>
      <p className="text-sm font-semibold text-slate-800">{target.provider.nombre}</p>
      <p className="mt-3 text-xs leading-6 text-slate-600">{target.mode === "sincronizar"
        ? `Se revisarán los registros PENDIENTES de todas las áreas y los coincidentes se transferirán a ${target.provider.area}. No se modificarán aprobadas, rechazadas ni procesadas.`
        : "El proveedor dejará de estar activo. No se borrará su historial ni los correos de Outlook."}</p>
      {target.mode === "sincronizar" && <p className="mt-3 text-xs text-[#00739B]">{consultarOutlook ? "Después se consultará Outlook. Esta operación puede tardar." : "Solo registros existentes en SGAF; sin consultar Outlook."}</p>}
      {modalError && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-xs text-red-700">{modalError}</p>}
      <ModalButtons loading={Boolean(busy)} onCancel={() => setTarget(null)} onConfirm={() => void executeTarget()}
        confirmText={target.mode === "sincronizar" ? "Sincronizar pendientes" : "Desactivar proveedor"} danger={target.mode === "eliminar"} />
    </SgafModal>}
  </>;
};
function Field({ label, value, onChange, placeholder, icon, required = false }: {
  label: string; value: string; onChange: (value: string) => void; placeholder: string; icon?: ReactNode; required?: boolean;
}) {
  const id = useId();
  return <div><label htmlFor={id} className="mb-2 block text-xs font-bold text-slate-700">{label}</label>
    <div className="relative">{icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</div>}
      <input id={id} value={value} onChange={event => onChange(event.target.value)} required={required} placeholder={placeholder}
        className={`h-10 w-full rounded-xl border border-slate-200 pr-3 text-xs ${icon ? "pl-9" : "pl-3"}`} /></div></div>;
}
export default Configuracion;
