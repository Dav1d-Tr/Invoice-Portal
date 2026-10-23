/** Solo se interpolan alias escritos por el backend, nunca datos del cliente. */
export const ultimaRutaSql = (aliasFactura: 'f' | 'base'): string => `
  SELECT ev.id, ev.accion, ev.id_area_destino, ev.area_origen_snapshot,
         ev.fecha_evento,
         (ev.accion = 'REMITIDA' AND NOT (
           COALESCE(ev.datos ->> 'motivo', '') IN (
             'PROVEEDOR_REGISTRADO_O_ASIGNADO', 'PROVEEDOR_SINCRONIZADO',
             'PROVEEDOR_REGISTRADO_O_ACTUALIZADO'
           )
         )) AS es_remision
  FROM public.factura_eventos ev
  WHERE ev.id_factura = ${aliasFactura}.id
    AND ev.id_area_destino IS NOT NULL
    AND (ev.accion IN ('REMITIDA', 'RECIBIDA_OUTLOOK')
      OR (ev.accion = 'PROVEEDOR_ASIGNADO' AND (
        ev.id_area_origen IS DISTINCT FROM ev.id_area_destino
        OR COALESCE(ev.datos ->> 'reinicia_bandeja', 'false') = 'true'
      )))
  ORDER BY ev.fecha_evento DESC, ev.id DESC
  LIMIT 1
`;
