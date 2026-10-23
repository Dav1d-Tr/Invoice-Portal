import { CalendarDays } from 'lucide-react';
import { useId } from 'react';
import type { CalendarRange } from '../utils/calendarDates';
import { rangeError } from '../utils/calendarDates';

export default function CalendarDateFilter({ value, onChange }: {
  value: CalendarRange; onChange: (value: CalendarRange) => void;
}) {
  const id = useId();
  const error = rangeError(value.from, value.to);
  return <section className="mb-5 rounded-xl border border-slate-200 bg-white p-4" aria-label="Alternativa de filtro por calendario">
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
      <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700"><CalendarDays size={16} /> Fecha de recepción</span>
      <label className="flex items-center gap-2 text-xs"><input type="radio" name={id} checked={value.mode === 'rapido'} onChange={() => onChange({ ...value, mode: 'rapido' })} /> Filtro habitual</label>
      <label className="flex items-center gap-2 text-xs"><input type="radio" name={id} checked={value.mode === 'calendario'} onChange={() => onChange({ ...value, mode: 'calendario' })} /> Calendario</label>
      <label className="text-xs text-slate-600" htmlFor={`${id}-from`}>Desde <input id={`${id}-from`} type="date" value={value.from} max={value.to || undefined}
        onChange={e => onChange({ ...value, mode: 'calendario', from: e.target.value })} className="ml-2 rounded-lg border border-slate-200 px-2 py-2" /></label>
      <label className="text-xs text-slate-600" htmlFor={`${id}-to`}>Hasta <input id={`${id}-to`} type="date" value={value.to} min={value.from || undefined}
        onChange={e => onChange({ ...value, mode: 'calendario', to: e.target.value })} className="ml-2 rounded-lg border border-slate-200 px-2 py-2" /></label>
      <button type="button" onClick={() => onChange({ mode: 'rapido', from: '', to: '' })} className="text-xs font-semibold text-[#00739B]">Limpiar calendario</button>
    </div>
    <p className="mt-3 text-xs text-slate-500">{value.mode === 'calendario'
      ? 'Calendario activo. Ambos extremos están incluidos, en hora de Bogotá. Para un solo día, selecciona la misma fecha en Desde y Hasta. El filtro habitual se conserva, pero no se combina con este rango.'
      : 'Se aplica el filtro habitual de fecha. El calendario es una alternativa y no elimina las opciones existentes.'}</p>
    {value.mode === 'calendario' && error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
  </section>;
}
