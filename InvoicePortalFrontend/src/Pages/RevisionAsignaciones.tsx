import { Eye, FileSearch, LoaderCircle, Pencil, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getStoredArea } from '../services/authService';
import { isSystemsArea } from '../utils/areaPermissions';
import { getAreasFactura, getProveedoresFactura } from '../services/facturasService';
import type { AreaFactura, ProveedorFactura } from '../services/facturasService';
import { buscarRevision, corregirRevision, getRevision } from '../services/revisionFacturasService';
import type { FacturaRevision, FiltrosRevision, ListaRevision } from '../services/revisionFacturasService';
import { errorMessage, isAbortError } from '../utils/sgafApi';
import { rangeError } from '../utils/calendarDates';
import { boardMemoryKey, captureBoardPosition, notifyFacturasUpdated, readBoardMemory, restoreBoardPosition } from '../utils/invoiceNavigation';
import { displayDate, statusStyle } from '../Components/InvoiceBoardRestorable';
import { SgafModal, ModalButtons } from '../Components/SgafModal';
const INITIAL: FiltrosRevision = { buscar: '', estado: '', idArea: '', desde: '', hasta: '', pagina: 1, tamano: 25, similitud: 0.35 };
function readFilters(key: string): FiltrosRevision {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (!value || typeof value !== 'object') return { ...INITIAL };
    const v = value as Record<string, unknown>;
    return { buscar: typeof v.buscar === 'string' ? v.buscar.slice(0, 180) : '', estado: typeof v.estado === 'string' ? v.estado : '',
      idArea: typeof v.idArea === 'string' ? v.idArea : '', desde: typeof v.desde === 'string' ? v.desde : '', hasta: typeof v.hasta === 'string' ? v.hasta : '',
      pagina: Number.isSafeInteger(v.pagina) && Number(v.pagina) > 0 ? Number(v.pagina) : 1,
      tamano: [25, 50, 100].includes(Number(v.tamano)) ? Number(v.tamano) : 25,
      similitud: [0.25, 0.35, 0.55].includes(Number(v.similitud)) ? Number(v.similitud) : 0.35 };
  } catch { return { ...INITIAL }; }
}
function SystemsRevision({ areaId }: { areaId: number }) {
  const location = useLocation();
  const key = `sgaf:revision:filtros:${areaId}`;
  const memoryKey = boardMemoryKey(areaId, 'revision');
  const [draft, setDraft] = useState(() => readFilters(key));
  const [filters, setFilters] = useState(draft);
  const [revision, setRevision] = useState(0);
  const [list, setList] = useState<ListaRevision | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [areas, setAreas] = useState<AreaFactura[]>([]);
  const [providers, setProviders] = useState<ProveedorFactura[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [editor, setEditor] = useState<FacturaRevision | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [providerId, setProviderId] = useState('');
  const [destination, setDestination] = useState('');
  const [reason, setReason] = useState('');
  const [protect, setProtect] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [providerSearch, setProviderSearch] = useState('');
  const [memory] = useState(() => readBoardMemory(memoryKey));
  const [restorePending, setRestorePending] = useState(Boolean(memory));
  const mounted = useRef(false), busy = useRef(false), editSequence = useRef(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; ++editSequence.current; }; }, []);
  useEffect(() => {
    const abort = new AbortController(); setCatalogError(null);
    Promise.all([getAreasFactura({ signal: abort.signal }), getProveedoresFactura({ signal: abort.signal })])
      .then(([a, p]) => { if (!abort.signal.aborted) { setAreas(a); setProviders(p); } })
      .catch(err => { if (!abort.signal.aborted && !isAbortError(err)) setCatalogError(errorMessage(err, 'No se pudieron cargar los catalogos.')); });
    return () => abort.abort();
  }, [revision]);
  useEffect(() => {
    const abort = new AbortController(); setLoading(true); setError(null);
    try { sessionStorage.setItem(key, JSON.stringify(filters)); } catch { /* No es obligatorio para buscar. */ }
    buscarRevision(filters, abort.signal).then(data => {
      if (!abort.signal.aborted) {
        setList(data);
        try { sessionStorage.setItem(key, JSON.stringify({ ...filters, pagina: data.pagina })); } catch { /* Continuar. */ }
      }
    }).catch(err => { if (!abort.signal.aborted && !isAbortError(err)) setError(errorMessage(err, 'No se pudo buscar.')); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [filters, revision, key]);
  useLayoutEffect(() => {
    if (loading || error || !list || !memory || !restorePending) return;
    const frame = requestAnimationFrame(() => {
      const row = document.querySelector<HTMLElement>(`[data-revision-row="${memory.selectedId}"]`);
      restoreBoardPosition(memory, row); setRestorePending(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [loading, error, list, memory, restorePending]);
  const apply = (next: FiltrosRevision) => {
    const invalid = rangeError(next.desde, next.hasta);
    if (invalid) { setError(invalid); return; }
    if (next.buscar && next.buscar.replace(/[^a-zA-Z0-9\u00c0-\u00ff]/g, '').length < 3) { setError('Escribe al menos 3 letras o numeros, o deja la busqueda vacia para listar todo.'); return; }
    setRestorePending(false); setDraft(next); setFilters(next);
  };
  const search = (event: FormEvent) => { event.preventDefault(); apply({ ...draft, buscar: draft.buscar.trim(), pagina: 1 }); };
  const openEditor = async (item: FacturaRevision) => {
    if (busy.current || !item.editable) return;
    const seq = ++editSequence.current; setEditingId(item.id); setError(null); setModalError(null);
    try {
      const fresh = await getRevision(item.id);
      if (!mounted.current || seq !== editSequence.current) return;
      if (!fresh.editable) { setError('La factura ya no esta PENDIENTE. Actualiza la lista.'); return; }
      setEditor(fresh); setProviderId(fresh.idProveedor ? String(fresh.idProveedor) : ''); setDestination(String(fresh.idAreaActual));
      setProtect(true); setReason(''); setProviderSearch('');
    } catch (err) { if (mounted.current && seq === editSequence.current) setError(errorMessage(err, 'No se pudo abrir el formulario.')); }
    finally { if (mounted.current && seq === editSequence.current) setEditingId(null); }
  };
  const close = () => { if (!busy.current) { setEditor(null); setModalError(null); } };
  const save = async () => {
    if (!editor || busy.current) return;
    if (!providers.some(p => p.id === Number(providerId)) || !areas.some(a => a.id === Number(destination))) { setModalError('Selecciona un proveedor y un area activos.'); return; }
    if (reason.trim().length < 5) { setModalError('Describe el motivo de la correccion (minimo 5 caracteres).'); return; }
    busy.current = true; setSaving(true); setModalError(null);
    try {
      const result = await corregirRevision(editor.id, { idProveedor: Number(providerId), idAreaDestino: Number(destination),
        motivo: reason.trim(), version: editor.version, protegerAsignacion: protect });
      notifyFacturasUpdated();
      if (mounted.current) {
        setEditor(null); setMessage(result.sinCambios ? 'La asignacion ya tenia esos valores.' : `Factura #${result.idFactura}: proveedor ${result.proveedor}; area/perfil ${result.area}. ${result.protegida ? 'Quedo protegida frente a sincronizaciones.' : 'Sin proteccion: una sincronizacion podra reclasificarla.'}`);
        setRevision(value => value + 1);
      }
    } catch (err) { if (mounted.current) setModalError(errorMessage(err, 'No se pudo corregir la asignacion.')); }
    finally { busy.current = false; if (mounted.current) setSaving(false); }
  };
  const chosen = providers.find(p => p.id === Number(providerId));
  const displayedProviders = providers.filter(p => p.id === Number(providerId) || `${p.nombre} ${p.nit ?? ''}`.toLowerCase().includes(providerSearch.trim().toLowerCase()));
  const control = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs';
  return <>
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><h1 className="flex items-center gap-2 text-2xl font-bold text-slate-800"><FileSearch size={25} /> Revision de asignaciones</h1>
      <p className="mt-2 max-w-3xl text-sm text-slate-500">Busca facturas en todas las areas por nombre similar, asunto, remitente o numero. Compara antes de corregir el proveedor y el area/perfil.</p></div>
      <button type="button" disabled={loading || saving} onClick={() => setRevision(v => v + 1)} className="flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-xs disabled:opacity-40"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />Actualizar</button></header>
    <p className="mb-5 rounded-xl border border-cyan-100 bg-cyan-50 p-4 text-xs text-cyan-900">La similitud es textual, no una confirmacion del proveedor correcto. Se corrige una factura PENDIENTE a la vez. No cambia el catalogo del proveedor, el area de origen ni el estado; aprobadas, rechazadas y procesadas se muestran para consulta.</p>
    {message && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>}
    {(error || catalogError) && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error || catalogError}</p>}
    <form onSubmit={search} className="mb-5 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2 xl:grid-cols-4">
      <label className="text-xs font-semibold text-slate-700 sm:col-span-2">Nombre / asunto / correo / numero<input value={draft.buscar} maxLength={180} onChange={e => setDraft({ ...draft, buscar: e.target.value })} placeholder="Ejemplo: ADECCO, adriana.silvac..." className={`${control} mt-2`} /></label>
      <label className="text-xs font-semibold text-slate-700">Area actual<select value={draft.idArea} onChange={e => setDraft({ ...draft, idArea: e.target.value })} className={`${control} mt-2`}><option value="">Todas las areas</option>{areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></label>
      <label className="text-xs font-semibold text-slate-700">Estado<select value={draft.estado} onChange={e => setDraft({ ...draft, estado: e.target.value })} className={`${control} mt-2`}><option value="">Todos los estados</option>{['PENDIENTE', 'APROBADA', 'RECHAZADA', 'PROCESADA', 'REMITIDA'].map(s => <option key={s}>{s}</option>)}</select></label>
      <label className="text-xs font-semibold text-slate-700">Recepcion desde<input type="date" value={draft.desde} max={draft.hasta || undefined} onChange={e => setDraft({ ...draft, desde: e.target.value })} className={`${control} mt-2`} /></label>
      <label className="text-xs font-semibold text-slate-700">Recepcion hasta<input type="date" value={draft.hasta} min={draft.desde || undefined} onChange={e => setDraft({ ...draft, hasta: e.target.value })} className={`${control} mt-2`} /></label>
      <label className="text-xs font-semibold text-slate-700">Similitud textual<select value={draft.similitud} onChange={e => setDraft({ ...draft, similitud: Number(e.target.value) })} className={`${control} mt-2`}><option value={0.25}>Amplia (25%)</option><option value={0.35}>Normal (35%)</option><option value={0.55}>Exigente (55%)</option></select></label>
      <div className="flex items-end gap-2"><button type="submit" disabled={saving} className="flex items-center gap-2 rounded-xl bg-[#00739B] px-4 py-2.5 text-xs font-semibold text-white"><Search size={14} />Buscar</button><button type="button" disabled={saving} onClick={() => apply({ ...INITIAL })} className="rounded-xl border px-4 py-2.5 text-xs">Limpiar</button></div>
    </form>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b p-4 text-xs"><span>{list?.total ?? 0} coincidencia(s) en todas las areas</span>
        <label>Por pagina <select value={filters.tamano} onChange={e => apply({ ...filters, tamano: Number(e.target.value), pagina: 1 })} className="ml-2 rounded-lg border p-2">{[25, 50, 100].map(n => <option key={n}>{n}</option>)}</select></label></div>
      {loading ? <div role="status" className="flex min-h-40 items-center justify-center gap-2 text-sm"><LoaderCircle size={18} className="animate-spin" />Buscando...</div> : <>
        <div id="sgaf-revision-table-scroll" className="overflow-x-auto"><table className="w-full min-w-312.5 text-left text-xs"><thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr>{['Factura / nombre del asunto', 'Proveedor asignado', 'Area / perfil actual', 'Recepcion', 'Estado', 'Coincidencia', 'Acciones'].map(t => <th key={t} className="px-4 py-3">{t}</th>)}</tr></thead>
          <tbody>{list?.items.map(item => <tr key={item.id} data-revision-row={item.id} className={`border-t ${memory?.selectedId === item.id ? 'bg-cyan-50' : 'hover:bg-slate-50'}`}>
            <td className="max-w-75 px-4 py-4"><p className="font-semibold">{item.numeroFactura || `Registro #${item.id}`}</p><p className="mt-1 font-medium">{item.nombreEnAsunto || 'Sin nombre estructurado'}</p><p className="mt-1 line-clamp-2 text-slate-500" title={item.asunto || ''}>{item.asunto}</p><p className="mt-1 wrap-break-word text-slate-500">{item.correo}</p></td>
            <td className="max-w-60 px-4 py-4"><p className="font-semibold">{item.proveedorAsignado}</p><p className="mt-1 text-slate-500">NIT: {item.nit || '-'}</p>{item.proveedorSnapshot !== item.proveedorAsignado && <p className="mt-1 text-slate-500">Nombre guardado: {item.proveedorSnapshot}</p>}<p className="mt-1 text-slate-500">Area del proveedor: {item.areaProveedor || '-'}</p></td>
            <td className="px-4 py-4"><p className="font-semibold">{item.areaActual}</p>{item.protegida && <span className="mt-2 inline-flex items-center gap-1 text-[10px] text-[#00739B]"><ShieldCheck size={12} /> Asignacion protegida</span>}</td>
            <td className="whitespace-nowrap px-4 py-4">{displayDate(item.fechaRecepcion)}</td><td className="px-4 py-4"><span className={`rounded-full px-2 py-1 ${statusStyle(item.estadoCodigo)}`}>{item.estado}</span></td>
            <td className="px-4 py-4">{filters.buscar ? `${Math.round(item.similitud * 100)}% textual` : '-'}</td>
            <td className="px-4 py-4"><div className="flex flex-wrap gap-2"><Link data-open-invoice to={`/facturas/${item.id}`} state={{ sgafReturn: { path: '/sistemas/revision-facturas', areaId, sourceKey: location.key } }}
              onClick={e => { const row = e.currentTarget.closest<HTMLElement>('[data-revision-row]'); if (row) captureBoardPosition(memoryKey, { page: list.pagina, pageSize: list.tamano, sort: 'fecha-desc' }, item.id, row); }} className="inline-flex items-center gap-1 rounded-lg border px-2 py-2 text-[#00739B]"><Eye size={13} />Detalle</Link>
              <button type="button" disabled={!item.editable || saving || editingId !== null || !providers.length || !areas.length} title={item.editable ? 'Corregir proveedor y area' : 'Solo se modifican facturas PENDIENTES'} onClick={() => void openEditor(item)} className="inline-flex items-center gap-1 rounded-lg border px-2 py-2 text-[#00739B] disabled:opacity-40">{editingId === item.id ? <LoaderCircle size={13} className="animate-spin" /> : <Pencil size={13} />}Corregir</button>
              <button type="button" onClick={() => apply({ ...filters, buscar: (item.nombreEnAsunto || item.proveedorAsignado).slice(0, 180), pagina: 1 })} className="rounded-lg border px-2 py-2">Similares</button>
            </div></td>
          </tr>)}</tbody></table>{!list?.items.length && <p className="p-10 text-center text-sm text-slate-500">No hay coincidencias. Revisa los filtros o reduce la exigencia de similitud.</p>}</div>
        <div className="flex justify-between gap-3 border-t p-4 text-xs"><button type="button" disabled={!list || list.pagina <= 1} onClick={() => apply({ ...filters, pagina: (list?.pagina ?? 1) - 1 })} className="rounded-lg border px-3 py-2 disabled:opacity-40">Anterior</button><span>Pagina {list?.pagina ?? 1} de {list?.paginas ?? 1}</span><button type="button" disabled={!list || list.pagina >= list.paginas} onClick={() => apply({ ...filters, pagina: (list?.pagina ?? 1) + 1 })} className="rounded-lg border px-3 py-2 disabled:opacity-40">Siguiente</button></div>
      </>}
    </section>
    {editor && <SgafModal title={`Corregir asignacion #${editor.id}`} onClose={close} busy={saving}>
      <p className="mb-4 rounded-xl bg-slate-50 p-3 text-xs">Actual: <strong>{editor.proveedorAsignado}</strong> / <strong>{editor.areaActual}</strong>. Estado PENDIENTE.</p>
      {modalError && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-xs text-red-700">{modalError}</p>}
      <fieldset disabled={saving} className="space-y-4"><label className="block text-xs font-semibold">Buscar proveedor en el catalogo<input value={providerSearch} onChange={e => setProviderSearch(e.target.value)} placeholder="Nombre o NIT" className={`${control} mt-2`} /></label>
        <label className="block text-xs font-semibold">Proveedor correcto<select required value={providerId} onChange={e => { const p = providers.find(v => v.id === Number(e.target.value)); setProviderId(e.target.value); if (p) setDestination(String(p.idArea)); }} className={`${control} mt-2`}><option value="">Selecciona...</option>{displayedProviders.map(p => <option key={p.id} value={p.id}>{p.nombre} {p.nit ? `- ${p.nit}` : ''}</option>)}</select></label>
        <label className="block text-xs font-semibold">Area / perfil de destino<select required value={destination} onChange={e => setDestination(e.target.value)} className={`${control} mt-2`}><option value="">Selecciona...</option>{areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}</select></label>
        {chosen && <p className="text-xs text-slate-500">Area habitual del proveedor: {chosen.area}. Elegir otra aqui solo modifica esta factura, no el catalogo.</p>}
        <label className="block text-xs font-semibold">Motivo de la correccion<textarea required minLength={5} maxLength={2000} rows={3} value={reason} onChange={e => setReason(e.target.value)} className={`${control} mt-2`} /></label>
        <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={protect} onChange={e => setProtect(e.target.checked)} /> Proteger esta asignacion para que la sincronizacion de proveedores no la cambie.</label>
        {!protect && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">Sin proteccion, las reglas del asunto/remitente podran volver a asignar esta factura al sincronizar.</p>}
      </fieldset>
      <p className="mt-4 text-xs text-slate-500">Se guardara proveedor, area y motivo en el historial. No se borra ni rechaza la factura, no se cambia el correo original y no se asigna a un usuario individual.</p>
      <ModalButtons loading={saving} onCancel={close} onConfirm={() => void save()} confirmText="Confirmar correccion" />
    </SgafModal>}
  </>;
}
export default function RevisionAsignaciones() {
  const area = getStoredArea();
  if (!isSystemsArea(area?.nombre)) return <p role="alert" className="rounded-xl bg-red-50 p-5 text-red-700">Este modulo es exclusivo de SISTEMAS.</p>;
  return <SystemsRevision key={area?.id} areaId={Number(area?.id)} />;
}
