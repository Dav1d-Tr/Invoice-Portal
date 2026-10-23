import type { Invoice } from '../services/facturasService';
export const FACTURAS_UPDATED = 'sgaf:facturas-actualizadas';
const CHANGE_KEY = 'sgaf:facturas:cambio';
export type BoardSort = 'fecha-desc' | 'fecha-asc' | 'proveedor' | 'numero';
export interface BoardState { page: number; pageSize: number; sort: BoardSort }
export interface BoardMemory extends BoardState {
  savedAt: number; selectedId: number | null; anchorTop: number | null;
  windowX: number; windowY: number; scrolls: Array<{ selector: string; x: number; y: number }>;
}
export const DEFAULT_BOARD: BoardState = { page: 1, pageSize: 25, sort: 'fecha-desc' };
export function boardMemoryKey(areaId: number, module = 'facturas'): string { return `sgaf:board:v2:${areaId}:${module}`; }
const num = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
export function readBoardMemory(key: string): BoardMemory | null {
  try {
    const p: unknown = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (!p || typeof p !== 'object') return null;
    const v = p as Record<string, unknown>;
    const savedAt = num(v.savedAt, 0);
    if (Date.now() - savedAt > 24 * 60 * 60 * 1000) return null;
    return { page: Math.max(1, Math.trunc(num(v.page, 1))),
      pageSize: [25, 50, 100].includes(num(v.pageSize, 25)) ? num(v.pageSize, 25) : 25,
      sort: ['fecha-desc', 'fecha-asc', 'proveedor', 'numero'].includes(String(v.sort)) ? v.sort as BoardSort : 'fecha-desc',
      selectedId: Number.isSafeInteger(v.selectedId) && Number(v.selectedId) > 0 ? Number(v.selectedId) : null,
      anchorTop: typeof v.anchorTop === 'number' && Number.isFinite(v.anchorTop) ? v.anchorTop : null,
      savedAt, windowX: num(v.windowX, 0), windowY: num(v.windowY, 0),
      scrolls: Array.isArray(v.scrolls) ? v.scrolls.slice(0, 15).filter(s => s && typeof s.selector === 'string' && s.selector.length < 2000)
        .map(s => ({ selector: s.selector, x: num(s.x, 0), y: num(s.y, 0) })) : [] };
  } catch { return null; }
}
export function saveBoardMemory(key: string, memory: BoardMemory): void {
  try { sessionStorage.setItem(key, JSON.stringify(memory)); } catch { /* Navegacion sigue funcionando sin almacenamiento. */ }
}
export function saveBoardState(key: string, state: BoardState): void {
  saveBoardMemory(key, { ...state, savedAt: Date.now(), selectedId: null, anchorTop: null, windowX: 0, windowY: 0, scrolls: [] });
}
function selectorFor(element: HTMLElement): string {
  if (element.id) return `#${CSS.escape(element.id)}`;
  const path: string[] = [];
  let node: HTMLElement | null = element;
  while (node && node !== document.documentElement) {
    const parent: HTMLElement | null = node.parentElement;
    if (!parent) break;
    path.unshift(`${node.tagName.toLowerCase()}:nth-child(${Array.prototype.indexOf.call(parent.children, node) + 1})`);
    if (parent.id) { path.unshift(`#${CSS.escape(parent.id)}`); break; }
    node = parent;
  }
  return path.join(' > ');
}
function scrollAncestors(element: HTMLElement): HTMLElement[] {
  const items: HTMLElement[] = [];
  for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (/(auto|scroll)/.test(`${style.overflowX} ${style.overflowY}`)) items.push(node);
  }
  return items;
}
export function captureBoardPosition(key: string, state: BoardState, selectedId: number, row: HTMLElement): void {
  saveBoardMemory(key, { ...state, selectedId, savedAt: Date.now(), anchorTop: row.getBoundingClientRect().top,
    windowX: window.scrollX, windowY: window.scrollY,
    scrolls: scrollAncestors(row).map(node => ({ selector: selectorFor(node), x: node.scrollLeft, y: node.scrollTop })) });
}
/** Se llama solo DESPUES de montar las filas y resolver la pagina que contiene el ID. */
export function restoreBoardPosition(memory: BoardMemory, row: HTMLElement | null): void {
  for (const position of memory.scrolls) {
    try {
      const element = document.querySelector<HTMLElement>(position.selector);
      if (element) { element.scrollLeft = position.x; element.scrollTop = position.y; }
    } catch { /* El layout pudo cambiar. Se conserva el anclaje como alternativa. */ }
  }
  window.scrollTo({ left: memory.windowX, top: memory.windowY, behavior: 'instant' });
  if (row && memory.anchorTop !== null) {
    const delta = row.getBoundingClientRect().top - memory.anchorTop;
    const container = scrollAncestors(row).find(node => node.scrollHeight > node.clientHeight && /(auto|scroll)/.test(getComputedStyle(node).overflowY));
    if (container) container.scrollTop += delta;
    else window.scrollTo({ left: window.scrollX, top: window.scrollY + delta, behavior: 'instant' });
    row.querySelector<HTMLElement>('[data-open-invoice]')?.focus({ preventScroll: true });
  }
}
export function sortInvoices(items: readonly Invoice[], sort: BoardSort): Invoice[] {
  return [...items].sort((a, b) => {
    if (sort === 'proveedor') return a.proveedor.localeCompare(b.proveedor, 'es', { sensitivity: 'base' }) || b.id - a.id;
    if (sort === 'numero') return (a.numeroFactura ?? '').localeCompare(b.numeroFactura ?? '', 'es', { numeric: true }) || b.id - a.id;
    const da = a.fechaRecepcion ? Date.parse(a.fechaRecepcion) : NaN, db = b.fechaRecepcion ? Date.parse(b.fechaRecepcion) : NaN;
    if (!Number.isFinite(da) && !Number.isFinite(db)) return b.id - a.id;
    if (!Number.isFinite(da)) return 1;
    if (!Number.isFinite(db)) return -1;
    return (sort === 'fecha-asc' ? da - db : db - da) || b.id - a.id;
  });
}
export function resolveBoardPage(ids: readonly number[], state: BoardState, anchor: number | null): number {
  const index = anchor == null ? -1 : ids.indexOf(anchor);
  if (index >= 0) return Math.floor(index / state.pageSize) + 1;
  return Math.max(1, Math.min(state.page, Math.max(1, Math.ceil(ids.length / state.pageSize))));
}
export interface ReturnContext { path: string; areaId: number; sourceKey: string }
export function getReturnContext(state: unknown, areaId: number): ReturnContext | null {
  if (!state || typeof state !== 'object') return null;
  const raw = (state as Record<string, unknown>).sgafReturn;
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  if (value.areaId !== areaId || !['/facturas', '/sistemas/revision-facturas'].includes(String(value.path)) || typeof value.sourceKey !== 'string') return null;
  return { path: String(value.path), areaId, sourceKey: value.sourceKey };
}
export function notifyFacturasUpdated(): void {
  window.dispatchEvent(new Event(FACTURAS_UPDATED));
  try { localStorage.setItem(CHANGE_KEY, `${Date.now()}-${Math.random()}`); } catch { /* No bloquear una operacion guardada. */ }
}
export function subscribeFacturasUpdated(callback: () => void): () => void {
  const onStorage = (event: StorageEvent) => { if (event.key === CHANGE_KEY) callback(); };
  window.addEventListener(FACTURAS_UPDATED, callback); window.addEventListener('storage', onStorage);
  return () => { window.removeEventListener(FACTURAS_UPDATED, callback); window.removeEventListener('storage', onStorage); };
}
export function clearBoardMemories(): void {
  try {
    Object.keys(sessionStorage).filter(key => key.startsWith('sgaf:board:') || key.startsWith('sgaf:revision:')).forEach(key => sessionStorage.removeItem(key));
  } catch { /* No impide cerrar sesion. */ }
}
