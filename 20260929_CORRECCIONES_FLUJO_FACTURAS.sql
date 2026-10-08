BEGIN;

/* =========================================================
   SGAF - CORRECCIONES DE FLUJO

   1. CONTABILIDAD puede procesar cualquier factura APROBADA
      que este actualmente en CONTABILIDAD, haya sido remitida
      o haya llegado directamente por Outlook / RECEPCION.

   2. Se agrega el evento REACTIVADA.

   3. SISTEMAS puede reactivar una factura RECHAZADA y
      devolverla a PENDIENTE sin cambiar su area actual.

   Esta migracion NO elimina facturas ni eventos historicos.
========================================================= */

/* =========================================================
   1. ACCIONES PERMITIDAS EN factura_eventos
========================================================= */

ALTER TABLE public.factura_eventos
  DROP CONSTRAINT IF EXISTS ck_eventos_accion;

ALTER TABLE public.factura_eventos
  ADD CONSTRAINT ck_eventos_accion
  CHECK
  (
    accion IN
    (
      'RECIBIDA_OUTLOOK',
      'APROBADA',
      'RECHAZADA',
      'REMITIDA',
      'PROCESADA',
      'OBSERVACION',
      'PROVEEDOR_ASIGNADO',
      'REACTIVADA'
    )
  );

/* =========================================================
   2. PROCESAR FACTURA EN CONTABILIDAD

   CAMBIO IMPORTANTE:
   Ya NO exige que la factura haya sido remitida.

   Solo exige:
   - factura activa;
   - area actual = CONTABILIDAD;
   - actor = la misma CONTABILIDAD;
   - estado actual = APROBADA.
========================================================= */

CREATE OR REPLACE FUNCTION public.fn_procesar_factura
(
  p_id_factura BIGINT,
  p_id_area_actor BIGINT,
  p_observacion TEXT DEFAULT NULL,
  p_ip INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
AS
$$
DECLARE
  v_area_actual BIGINT;
  v_area_nombre VARCHAR(100);
  v_area_normalizada VARCHAR(120);
  v_estado_anterior SMALLINT;
  v_codigo_anterior VARCHAR(30);
  v_estado_nuevo SMALLINT;
BEGIN
  SELECT
    f.id_area_actual,
    a.nombre,
    COALESCE(
      a.nombre_normalizado,
      UPPER(BTRIM(a.nombre))
    ),
    f.id_estado,
    e.codigo
  INTO
    v_area_actual,
    v_area_nombre,
    v_area_normalizada,
    v_estado_anterior,
    v_codigo_anterior
  FROM public.facturas f
  INNER JOIN public.areas a
    ON a.id = f.id_area_actual
  INNER JOIN public.estados_factura e
    ON e.id = f.id_estado
  WHERE f.id = p_id_factura
    AND f.activo = TRUE
  FOR UPDATE OF f;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Factura no encontrada.';
  END IF;

  IF v_area_actual <> p_id_area_actor THEN
    RAISE EXCEPTION
      'La factura no pertenece actualmente al área autenticada.';
  END IF;

  IF
    v_area_normalizada <> 'CONTABILIDAD'
    AND UPPER(BTRIM(v_area_nombre)) <> 'CONTABILIDAD'
  THEN
    RAISE EXCEPTION
      'Solo CONTABILIDAD puede procesar facturas.';
  END IF;

  IF v_codigo_anterior <> 'APROBADA' THEN
    RAISE EXCEPTION
      'Solo una factura aprobada puede procesarse.';
  END IF;

  SELECT id
  INTO v_estado_nuevo
  FROM public.estados_factura
  WHERE codigo = 'PROCESADA'
  LIMIT 1;

  IF v_estado_nuevo IS NULL THEN
    RAISE EXCEPTION 'No existe el estado PROCESADA.';
  END IF;

  UPDATE public.facturas
  SET id_estado = v_estado_nuevo
  WHERE id = p_id_factura;

  INSERT INTO public.factura_eventos
  (
    id_factura,
    accion,
    id_area_actor,
    area_actor_snapshot,
    id_area_origen,
    area_origen_snapshot,
    id_area_destino,
    area_destino_snapshot,
    id_estado_anterior,
    id_estado_nuevo,
    observacion,
    ip,
    user_agent,
    datos
  )
  VALUES
  (
    p_id_factura,
    'PROCESADA',
    p_id_area_actor,
    v_area_nombre,
    v_area_actual,
    v_area_nombre,
    v_area_actual,
    v_area_nombre,
    v_estado_anterior,
    v_estado_nuevo,
    NULLIF(BTRIM(COALESCE(p_observacion, '')), ''),
    p_ip,
    p_user_agent,
    jsonb_build_object(
      'estado_anterior', v_codigo_anterior,
      'estado_nuevo', 'PROCESADA',
      'requiere_remision_previa', FALSE
    )
  );

  RETURN p_id_factura;
END;
$$;

/* =========================================================
   3. REACTIVAR FACTURA RECHAZADA

   Solo SISTEMAS.
   RECHAZADA -> PENDIENTE.

   El area actual NO cambia. De esta forma la factura vuelve
   a la bandeja que corresponde:
   - si era directa, vuelve a Facturas;
   - si habia sido remitida, vuelve a Remitidos del destino.
========================================================= */

CREATE OR REPLACE FUNCTION public.fn_reactivar_factura
(
  p_id_factura BIGINT,
  p_id_area_actor BIGINT,
  p_observacion TEXT DEFAULT NULL,
  p_ip INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
AS
$$
DECLARE
  v_actor_nombre VARCHAR(100);
  v_actor_normalizado VARCHAR(120);
  v_id_area_actual BIGINT;
  v_area_actual_nombre VARCHAR(100);
  v_id_estado_anterior SMALLINT;
  v_codigo_anterior VARCHAR(30);
  v_id_estado_pendiente SMALLINT;
BEGIN
  SELECT
    a.nombre,
    COALESCE(
      a.nombre_normalizado,
      UPPER(BTRIM(a.nombre))
    )
  INTO
    v_actor_nombre,
    v_actor_normalizado
  FROM public.areas a
  WHERE a.id = p_id_area_actor
    AND a.activo = TRUE
  LIMIT 1;

  IF v_actor_nombre IS NULL THEN
    RAISE EXCEPTION 'El área autenticada no existe o está inactiva.';
  END IF;

  IF
    v_actor_normalizado <> 'SISTEMAS'
    AND UPPER(BTRIM(v_actor_nombre)) <> 'SISTEMAS'
  THEN
    RAISE EXCEPTION
      'Solo SISTEMAS puede reactivar facturas rechazadas.';
  END IF;

  SELECT
    f.id_area_actual,
    a.nombre,
    f.id_estado,
    e.codigo
  INTO
    v_id_area_actual,
    v_area_actual_nombre,
    v_id_estado_anterior,
    v_codigo_anterior
  FROM public.facturas f
  INNER JOIN public.areas a
    ON a.id = f.id_area_actual
  INNER JOIN public.estados_factura e
    ON e.id = f.id_estado
  WHERE f.id = p_id_factura
    AND f.activo = TRUE
  FOR UPDATE OF f;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Factura no encontrada.';
  END IF;

  IF v_codigo_anterior <> 'RECHAZADA' THEN
    RAISE EXCEPTION
      'Solo una factura rechazada puede reactivarse.';
  END IF;

  SELECT id
  INTO v_id_estado_pendiente
  FROM public.estados_factura
  WHERE codigo = 'PENDIENTE'
  LIMIT 1;

  IF v_id_estado_pendiente IS NULL THEN
    RAISE EXCEPTION 'No existe el estado PENDIENTE.';
  END IF;

  UPDATE public.facturas
  SET id_estado = v_id_estado_pendiente
  WHERE id = p_id_factura;

  INSERT INTO public.factura_eventos
  (
    id_factura,
    accion,
    id_area_actor,
    area_actor_snapshot,
    id_area_origen,
    area_origen_snapshot,
    id_area_destino,
    area_destino_snapshot,
    id_estado_anterior,
    id_estado_nuevo,
    observacion,
    ip,
    user_agent,
    datos
  )
  VALUES
  (
    p_id_factura,
    'REACTIVADA',
    p_id_area_actor,
    v_actor_nombre,
    v_id_area_actual,
    v_area_actual_nombre,
    v_id_area_actual,
    v_area_actual_nombre,
    v_id_estado_anterior,
    v_id_estado_pendiente,
    COALESCE(
      NULLIF(BTRIM(COALESCE(p_observacion, '')), ''),
      'Factura reactivada por SISTEMAS.'
    ),
    p_ip,
    p_user_agent,
    jsonb_build_object(
      'estado_anterior', v_codigo_anterior,
      'estado_nuevo', 'PENDIENTE',
      'area_conservada', v_area_actual_nombre,
      'motivo', 'REACTIVACION_SISTEMAS'
    )
  );

  RETURN p_id_factura;
END;
$$;

COMMIT;

/* =========================================================
   VALIDACION POSTERIOR
========================================================= */

SELECT
  p.proname AS funcion,
  pg_get_function_identity_arguments(p.oid) AS argumentos
FROM pg_proc p
INNER JOIN pg_namespace n
  ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN
  (
    'fn_procesar_factura',
    'fn_reactivar_factura'
  )
ORDER BY p.proname;

SELECT
  conname,
  pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE conrelid = 'public.factura_eventos'::regclass
  AND conname = 'ck_eventos_accion';
