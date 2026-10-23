import { ArrowDownUp, Eye, LoaderCircle, Paperclip } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import type { Invoice } from '../services/facturasService';
import type { BoardState } from '../utils/invoiceNavigation';
import { captureBoardPosition } from '../utils/invoiceNavigation';
export function displayDate(value: string | null): string {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Fecha no valida' : new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' }).format(date);
}
export function displayMoney(value: Invoice['valorTotal'], currency: string | null): string {
  if (value === null || value === undefined || value === '') return 'No disponible';
  const number = Number(value); if (!Number.isFinite(number)) return 'No disponible';
  try { return new Intl.NumberFormat('es-CO', { style: 'currency', currency: currency || 'COP', maximumFractionDigits: 2 }).format(number); }
  catch { return `${number.toLocaleString('es-CO')} ${currency ?? ''}`; }
}
export const statusStyle = (code: string) => code === 'PENDIENTE' ? 'bg-amber-50 text-amber-800' : code === 'APROBADA' ? 'bg-emerald-50 text-emerald-800' : code === 'RECHAZADA' ? 'bg-red-50 text-red-800' : 'bg-slate-100 text-slate-700';

/** Componente nuevo: no sobrescribe tu InvoiceBoard original, utilizado en otras pantallas. */
export default function InvoiceBoardRestorable({ invoices, loading, state, onStateChange, memoryKey, areaId, selectedId }: {
  invoices: Invoice[]; loading: boolean; state: BoardState; onStateChange: (state: BoardState) => void;
  memoryKey: string; areaId: number; selectedId: number | null;
}) {
  const location = useLocation();
  const pages = Math.max(1, Math.ceil(invoices.length / state.pageSize));
  const start = (state.page - 1) * state.pageSize;
  const visible = invoices.slice(start, start + state.pageSize);
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Facturas del area">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 text-xs text-slate-600">
      <span>{invoices.length} registro(s)</span>
      <label className="flex items-center gap-2"><ArrowDownUp size={14} /> Orden
        <select value={state.sort} onChange={e => onStateChange({ ...state, sort: e.target.value as BoardState['sort'], page: 1 })} className="rounded-lg border p-2">
          <option value="fecha-desc">Mas recientes</option><option value="fecha-asc">Mas antiguos</option><option value="proveedor">Proveedor</option><option value="numero">Numero</option>
        </select>
      </label>
      <label>Por pagina <select className="ml-2 rounded-lg border p-2" value={state.pageSize} onChange={e => onStateChange({ ...state, pageSize: Number(e.target.value), page: 1 })}>{[25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}</select></label>
    </div>
    {loading ? <div role="status" className="flex min-h-48 items-center justify-center gap-2 text-sm"><LoaderCircle className="animate-spin" size={18} /> Cargando facturas...</div> : <>
      <div id="sgaf-home-table-scroll" className="overflow-x-auto">
        <table className="w-full min-w-287.5 text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase text-slate-500"><tr>{['Factura / asunto', 'Proveedor / NIT', 'Remitente', 'Recepcion', 'Estado', 'Area actual', 'Total', 'Detalle'].map(title => <th key={title} className="px-4 py-3">{title}</th>)}</tr></thead>
          <tbody>{visible.map(invoice => <tr key={invoice.id} data-invoice-row={invoice.id} className={`border-t border-slate-100 ${selectedId === invoice.id ? 'bg-cyan-50' : 'hover:bg-slate-50'}`}>
            <td className="max-w-67.5 px-4 py-4"><p className="font-semibold text-slate-800">{invoice.numeroFactura || `Registro #${invoice.id}`} {invoice.tieneAdjuntos && <Paperclip size={12} className="inline" aria-label="Con adjuntos" />}</p><p className="mt-1 line-clamp-2 text-slate-500" title={invoice.asunto || ''}>{invoice.asunto || 'Sin asunto'}</p></td>
            <td className="max-w-55 px-4 py-4"><p className="font-semibold">{invoice.proveedor}</p><p className="mt-1 text-slate-500">{invoice.nit || 'Sin NIT'}</p></td>
            <td className="max-w-55 wrap-break-word px-4 py-4">{invoice.correo || '-'}</td><td className="whitespace-nowrap px-4 py-4">{displayDate(invoice.fechaRecepcion)}</td>
            <td className="px-4 py-4"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${statusStyle(invoice.estadoCodigo)}`}>{invoice.estado}</span></td>
            <td className="px-4 py-4">{invoice.areaActual}</td><td className="whitespace-nowrap px-4 py-4">{displayMoney(invoice.valorTotal, invoice.moneda)}</td>
            <td className="px-4 py-4"><Link data-open-invoice to={`/facturas/${invoice.id}`} state={{ sgafReturn: { path: '/facturas', areaId, sourceKey: location.key } }}
              onClick={event => { const row = event.currentTarget.closest<HTMLElement>('[data-invoice-row]'); if (row) captureBoardPosition(memoryKey, state, invoice.id, row); }}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 font-semibold text-[#00739B]" aria-label={`Ver factura ${invoice.numeroFactura || invoice.id}`}><Eye size={14} /> Ver</Link></td>
          </tr>)}</tbody>
        </table>
        {!visible.length && <p className="p-10 text-center text-sm text-slate-500">No hay facturas que coincidan con los filtros.</p>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-4 text-xs">
        <span>{invoices.length ? start + 1 : 0}-{Math.min(start + state.pageSize, invoices.length)} de {invoices.length}</span>
        <div className="flex items-center gap-3"><button type="button" disabled={state.page <= 1} onClick={() => onStateChange({ ...state, page: state.page - 1 })} className="rounded-lg border px-3 py-2 disabled:opacity-40">Anterior</button>
          <span>Pagina {state.page} de {pages}</span><button type="button" disabled={state.page >= pages} onClick={() => onStateChange({ ...state, page: state.page + 1 })} className="rounded-lg border px-3 py-2 disabled:opacity-40">Siguiente</button></div>
      </div>
    </>}
  </section>;
}
