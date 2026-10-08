BEGIN;

-- ============================================================
-- SGAF - OUTBOX DE NOTIFICACIONES
--
-- No modifica ni elimina facturas ni eventos existentes.
-- Solo crea la cola y captura FUTUROS eventos relevantes.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notificaciones
(
    id BIGSERIAL PRIMARY KEY,
    id_factura BIGINT NOT NULL,
    id_evento BIGINT NOT NULL,
    id_area_destino BIGINT NOT NULL,
    tipo VARCHAR(40) NOT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
    ultimo_error TEXT,
    proximo_intento TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_completada TIMESTAMPTZ,

    CONSTRAINT fk_notificaciones_factura
        FOREIGN KEY (id_factura)
        REFERENCES public.facturas(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_notificaciones_evento
        FOREIGN KEY (id_evento)
        REFERENCES public.factura_eventos(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_notificaciones_area
        FOREIGN KEY (id_area_destino)
        REFERENCES public.areas(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_notificaciones_tipo
        CHECK (tipo IN (
            'NUEVA_FACTURA',
            'FACTURA_ASIGNADA',
            'FACTURA_REMITIDA'
        )),

    CONSTRAINT ck_notificaciones_estado
        CHECK (estado IN (
            'PENDIENTE',
            'PROCESANDO',
            'ENVIADA',
            'PARCIAL',
            'ERROR',
            'SIN_DESTINATARIOS'
        )),

    CONSTRAINT uq_notificaciones_evento
        UNIQUE (id_evento)
);

CREATE INDEX IF NOT EXISTS ix_notificaciones_estado_proximo
ON public.notificaciones(estado, proximo_intento, id);

CREATE INDEX IF NOT EXISTS ix_notificaciones_area
ON public.notificaciones(id_area_destino, fecha_creacion DESC);


CREATE TABLE IF NOT EXISTS public.notificacion_envios
(
    id BIGSERIAL PRIMARY KEY,
    id_notificacion BIGINT NOT NULL,
    canal VARCHAR(20) NOT NULL,
    destinatario VARCHAR(320) NOT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
    intentos INTEGER NOT NULL DEFAULT 0,
    ultimo_error TEXT,
    proveedor_mensaje_id TEXT,
    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_envio TIMESTAMPTZ,

    CONSTRAINT fk_notificacion_envios_notificacion
        FOREIGN KEY (id_notificacion)
        REFERENCES public.notificaciones(id)
        ON DELETE CASCADE,

    CONSTRAINT ck_notificacion_envios_canal
        CHECK (canal IN ('EMAIL', 'WHATSAPP')),

    CONSTRAINT ck_notificacion_envios_estado
        CHECK (estado IN (
            'PENDIENTE',
            'ENVIANDO',
            'ENVIADA',
            'ERROR',
            'OMITIDA'
        )),

    CONSTRAINT uq_notificacion_envio_destinatario
        UNIQUE (id_notificacion, canal, destinatario)
);

CREATE INDEX IF NOT EXISTS ix_notificacion_envios_pendientes
ON public.notificacion_envios(estado, intentos, id);


-- ============================================================
-- FECHA ACTUALIZACION
-- ============================================================

CREATE OR REPLACE FUNCTION public.sgaf_notificacion_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
AS
$$
BEGIN
    NEW.fecha_actualizacion = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notificaciones_touch
ON public.notificaciones;

CREATE TRIGGER trg_notificaciones_touch
BEFORE UPDATE ON public.notificaciones
FOR EACH ROW
EXECUTE FUNCTION public.sgaf_notificacion_touch();

DROP TRIGGER IF EXISTS trg_notificacion_envios_touch
ON public.notificacion_envios;

CREATE TRIGGER trg_notificacion_envios_touch
BEFORE UPDATE ON public.notificacion_envios
FOR EACH ROW
EXECUTE FUNCTION public.sgaf_notificacion_touch();


-- ============================================================
-- CAPTURAR EVENTOS SGAF
--
-- RECIBIDA_OUTLOOK    -> nueva factura en el area destino
-- PROVEEDOR_ASIGNADO  -> factura clasificada desde RECEPCION
-- REMITIDA            -> remision manual entre areas
--
-- La clasificacion de RECEPCION NO se convierte en REMITIDA.
-- Solo genera su propia notificacion FACTURA_ASIGNADA.
-- ============================================================

CREATE OR REPLACE FUNCTION public.sgaf_encolar_notificacion_factura()
RETURNS TRIGGER
LANGUAGE plpgsql
AS
$$
DECLARE
    v_tipo VARCHAR(40);
BEGIN
    IF NEW.id_area_destino IS NULL THEN
        RETURN NEW;
    END IF;

    CASE NEW.accion
        WHEN 'RECIBIDA_OUTLOOK' THEN
            v_tipo := 'NUEVA_FACTURA';
        WHEN 'PROVEEDOR_ASIGNADO' THEN
            v_tipo := 'FACTURA_ASIGNADA';
        WHEN 'REMITIDA' THEN
            v_tipo := 'FACTURA_REMITIDA';
        ELSE
            RETURN NEW;
    END CASE;

    INSERT INTO public.notificaciones
    (
        id_factura,
        id_evento,
        id_area_destino,
        tipo,
        estado
    )
    VALUES
    (
        NEW.id_factura,
        NEW.id,
        NEW.id_area_destino,
        v_tipo,
        'PENDIENTE'
    )
    ON CONFLICT (id_evento)
    DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_factura_evento_notificacion
ON public.factura_eventos;

CREATE TRIGGER trg_factura_evento_notificacion
AFTER INSERT ON public.factura_eventos
FOR EACH ROW
EXECUTE FUNCTION public.sgaf_encolar_notificacion_factura();

COMMIT;

-- ============================================================
-- VERIFICACION
-- ============================================================

SELECT
    'notificaciones' AS tabla,
    COUNT(*) AS registros
FROM public.notificaciones
UNION ALL
SELECT
    'notificacion_envios' AS tabla,
    COUNT(*) AS registros
FROM public.notificacion_envios;
