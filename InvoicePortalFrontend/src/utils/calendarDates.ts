export interface CalendarRange { mode: 'rapido' | 'calendario'; from: string; to: string }
export const EMPTY_CALENDAR: CalendarRange = { mode: 'rapido', from: '', to: '' };
export function validDateInput(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' });
export function bogotaDateKey(value: string | null | undefined): string | null {
  if (!value) return null;
  // Un DATE ya es una fecha civil: no convertirlo a UTC para luego restarle 5 horas.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return validDateInput(value) ? value : null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function rangeError(from: string, to: string): string | null {
  if ((from && !validDateInput(from)) || (to && !validDateInput(to))) return 'Selecciona fechas validas.';
  return from && to && from > to ? 'La fecha inicial no puede superar la fecha final.' : null;
}
export function matchesBogotaRange(value: string | null | undefined, from: string, to: string): boolean {
  if (rangeError(from, to)) return false;
  if (!from && !to) return true;
  const key = bogotaDateKey(value);
  return key !== null && (!from || key >= from) && (!to || key <= to);
}
export function readCalendar(key: string): CalendarRange {
  try {
    const p: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!p || typeof p !== 'object' || Array.isArray(p)) return { ...EMPTY_CALENDAR };
    const v = p as Record<string, unknown>;
    return { mode: v.mode === 'calendario' ? 'calendario' : 'rapido',
      from: typeof v.from === 'string' && validDateInput(v.from) ? v.from : '',
      to: typeof v.to === 'string' && validDateInput(v.to) ? v.to : '' };
  } catch { return { ...EMPTY_CALENDAR }; }
}
