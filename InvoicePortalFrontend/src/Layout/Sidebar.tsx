import { ClipboardCheck, Clock3, FileSearch, FileText, Inbox, LogOut, Settings, Users, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import logo from '../assets/Logo.png';
import { getStoredArea, logout } from '../services/authService';
import { getFacturasRemitidas } from '../services/facturasService';
import { getAreaInitials, isSystemsArea } from '../utils/areaPermissions';
import { clearBoardMemories, subscribeFacturasUpdated } from '../utils/invoiceNavigation';
interface MenuItem { name: string; path: string; icon: LucideIcon }
const navLinkClass = ({ isActive }: { isActive: boolean }) => `flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-[13px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#076C8F] focus-visible:ring-offset-2 ${isActive ? 'bg-[#DFF6FA] font-semibold text-[#00698C]' : 'font-normal text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`;
export default function Sidebar() {
  const navigate = useNavigate(), location = useLocation();
  const currentArea = getStoredArea(), areaId = Number(currentArea?.id ?? 0);
  const areaName = currentArea?.nombre ?? 'Sin area';
  const isSystems = isSystemsArea(currentArea?.nombre);
  const isAccounting = areaName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase() === 'CONTABILIDAD';
  const [remitidosCount, setRemitidosCount] = useState(0);
  const mounted = useRef(false), version = useRef(0);
  const loadRemitidosCount = useCallback(async () => {
    const request = ++version.current;
    try {
      const result = await getFacturasRemitidas();
      if (mounted.current && request === version.current) setRemitidosCount(result.length);
    } catch (error) { if (mounted.current) console.warn('No se pudo actualizar el contador de remitidos:', error); }
  }, [areaId]);
  useEffect(() => {
    mounted.current = true; setRemitidosCount(0);
    return () => { mounted.current = false; ++version.current; };
  }, [areaId]);
  useEffect(() => { void loadRemitidosCount(); }, [loadRemitidosCount, location.pathname]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') void loadRemitidosCount(); };
    const interval = window.setInterval(refresh, 30000);
    const unsubscribe = subscribeFacturasUpdated(refresh);
    window.addEventListener('focus', refresh);
    return () => { window.clearInterval(interval); window.removeEventListener('focus', refresh); unsubscribe(); };
  }, [loadRemitidosCount]);
  const menu: MenuItem[] = [
    { name: 'Facturas', path: '/facturas', icon: FileText },
    { name: 'Remitidos', path: '/remitidos', icon: Inbox },
    { name: 'Rechazadas', path: '/rechazadas', icon: X },
    { name: 'Historial', path: '/historial', icon: Clock3 },
    ...(isAccounting ? [{ name: 'Procesadas', path: '/historial-procesadas', icon: ClipboardCheck }] : []),
  ];
  const systemMenu: MenuItem[] = [
    { name: 'Revision asignaciones', path: '/sistemas/revision-facturas', icon: FileSearch },
    { name: 'Configuracion', path: '/configuracion', icon: Settings },
    { name: 'Usuarios', path: '/usuarios', icon: Users },
  ];
  const renderLink = (item: MenuItem) => {
    const Icon = item.icon;
    return <NavLink key={item.path} to={item.path} className={navLinkClass} aria-label={`Ir a ${item.name}`}>
      {({ isActive }) => <><Icon size={17} strokeWidth={isActive ? 2 : 1.7} aria-hidden="true" /><span>{item.name}</span>
        {item.name === 'Remitidos' && remitidosCount > 0 && <span title={`${remitidosCount} facturas remitidas`} className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-[#13B8D4] px-1.5 py-1.5 text-[9px] font-bold leading-none text-white">{remitidosCount > 99 ? '99+' : remitidosCount}</span>}</>}
    </NavLink>;
  };
  return <>
    <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-[#076C8F] focus:shadow-lg">Ir al contenido principal</a>
    <aside className="flex h-full w-56 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white px-4 py-5" aria-label="Menu lateral">
      <div className="mb-7 flex shrink-0 items-center justify-center gap-1"><div className="flex w-12 items-center justify-center rounded-md bg-linear-to-br from-[#03263D] via-[#055F8C] to-[#3CC7E8] p-0.5"><img src={logo} alt="Demetalicos" className="h-auto w-full object-contain" /></div>
        <strong className="bg-linear-to-br from-[#03263D] via-[#055F8C] to-[#3CC7E8] bg-clip-text font-philosopher text-5xl font-extrabold text-transparent">SGAF</strong></div>
      <nav className="flex shrink-0 flex-col gap-2 font-philosopher" aria-label="Navegacion principal">{menu.map(renderLink)}</nav>
      {isSystems && <><div className="mx-2 mt-6 border-t border-slate-200" aria-hidden="true" /><nav className="mt-6 flex shrink-0 flex-col gap-2 font-philosopher" aria-label="Administracion del sistema"><p className="mb-2 px-2 text-[9px] font-bold uppercase tracking-wide text-slate-500">Sistema</p>{systemMenu.map(renderLink)}</nav></>}
      <div className="mt-auto shrink-0 pt-6 font-philosopher"><div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-[#F7FAFB] px-3 py-2.5"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#073F63] text-[9px] font-bold text-white" aria-hidden="true">{getAreaInitials(currentArea?.nombre)}</div>
        <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold text-slate-800" title={areaName}>Area {areaName}</p><button type="button" onClick={() => { clearBoardMemories(); logout(); navigate('/login', { replace: true }); }} className="mt-0.5 flex items-center gap-1 rounded text-[10px] text-slate-400 hover:text-slate-600" aria-label={`Cerrar sesion del area ${areaName}`}><LogOut size={10} aria-hidden="true" /> Cerrar sesion</button></div>
      </div></div>
    </aside>
  </>;
}
