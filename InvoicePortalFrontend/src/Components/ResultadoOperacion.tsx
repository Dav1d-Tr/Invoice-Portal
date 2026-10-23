import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { PageFeedback } from "../utils/sgafUi";

export function ResultadoOperacion({ feedback }: { feedback: PageFeedback }) {
  const c = feedback.clasificacion;
  return (
    <section className="mb-5 space-y-3" aria-live="polite">
      <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800">
        <div className="flex items-center gap-2 font-bold"><CheckCircle2 size={16} />{feedback.title}</div>
        <p className="mt-2 leading-5">{feedback.message}</p>
      </div>
      {c && <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-3 text-xs font-semibold text-slate-700">
          {c.alcance === "TODAS" ? "SGAF: pendientes de todas las áreas" : "SGAF: registros activos de RECEPCIÓN"}
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[["Revisados", c.registrosRevisados], ["Coincidentes", c.coincidencias],
          ["Actualizados", c.facturasActualizadas], ["Transferidos", c.facturasTransferidas]].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-slate-50 p-3">
              <p className="text-[10px] text-slate-500">{label}</p>
              <p className="mt-1 text-xl font-bold text-[#00739B]">{Number(value).toLocaleString("es-CO")}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] leading-5 text-slate-500">
          Coincidencias por correo: {c.coincidenciasPorCorreo}. Por nombre: {c.coincidenciasPorNombre}.
          {" "}Ya asignados sin cambios: {c.yaAsignadas}.
          {" "}Actualizar proveedor y transferir de área son contadores diferentes.
        </p>
        {c.ambiguas > 0 && <p className="mt-2 text-[11px] text-amber-700">
          El barrido encontró {c.ambiguas} registro(s) con coincidencias ambiguas. No se asignaron automáticamente; requieren revisión.
        </p>}
      </div>}
      {feedback.remoto && <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-4 text-xs leading-5 text-slate-600">
        <strong>Consulta de Outlook: </strong>{feedback.remoto.nuevas} registro(s) nuevo(s), {feedback.remoto.duplicadas} ya registrado(s).
        {(feedback.remoto.errores > 0 || feedback.remoto.erroresMetadatos > 0) &&
          <p className="mt-1 text-amber-700">Errores de mensaje: {feedback.remoto.errores}. De metadatos: {feedback.remoto.erroresMetadatos}.</p>}
      </div>}
      {feedback.warning && <div role="alert" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800">
        <AlertCircle size={16} className="mt-0.5 shrink-0" /><span>{feedback.warning}</span>
      </div>}
    </section>
  );
}
