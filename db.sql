-- ============================================================
-- PORTAL DE FACTURAS - DEMETALICOS
-- BASE INICIAL
-- AUTENTICACION POR AREA
-- ============================================================

BEGIN;


-- ============================================================
-- TABLA: areas
--
-- Cada area funciona como una cuenta de acceso al portal.
-- El usuario ingresara:
--
--   Area
--   Clave
--
-- La clave NO se almacena en texto plano.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.areas
(
    id BIGSERIAL PRIMARY KEY,

    nombre VARCHAR(100) NOT NULL,

    clave_hash VARCHAR(255) NOT NULL,

    activo BOOLEAN NOT NULL DEFAULT TRUE,

    ultimo_acceso TIMESTAMPTZ NULL,

    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_areas_nombre_no_vacio
        CHECK (BTRIM(nombre) <> '')
);


-- ============================================================
-- NOMBRE DE AREA UNICO
--
-- Evita tener:
--
-- Compras
-- COMPRAS
-- compras
--
-- como registros diferentes.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS
    ux_areas_nombre_normalizado
ON public.areas
(
    LOWER(BTRIM(nombre))
);


-- ============================================================
-- FUNCION:
-- Actualizar automaticamente fecha_actualizacion
-- ============================================================

CREATE OR REPLACE FUNCTION
    public.actualizar_fecha_modificacion()
RETURNS TRIGGER
LANGUAGE plpgsql
AS
$$
BEGIN

    NEW.fecha_actualizacion = NOW();

    RETURN NEW;

END;
$$;


-- ============================================================
-- TRIGGER
-- ============================================================

DROP TRIGGER IF EXISTS
    trg_areas_fecha_actualizacion
ON public.areas;


CREATE TRIGGER
    trg_areas_fecha_actualizacion
BEFORE UPDATE
ON public.areas
FOR EACH ROW
EXECUTE FUNCTION
    public.actualizar_fecha_modificacion();


COMMIT;













































BEGIN;

-- ============================================================
-- SGAF
-- ESTRUCTURA PRINCIPAL
--
-- EJECUTAR DIRECTAMENTE SOBRE:
-- Facturas_SGAF
--
-- NO CREA LA BASE DE DATOS.
-- NO MODIFICA LA TABLA public.areas.
-- ============================================================


-- ============================================================
-- FUNCIÓN GENERAL PARA fecha_actualizacion
-- ============================================================

CREATE OR REPLACE FUNCTION public.sgaf_actualizar_fecha()
RETURNS TRIGGER
LANGUAGE plpgsql
AS
$$
BEGIN
    NEW.fecha_actualizacion = NOW();

    RETURN NEW;
END;
$$;


-- ============================================================
-- PROVEEDORES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.proveedores
(
    id BIGSERIAL PRIMARY KEY,

    nombre VARCHAR(200) NOT NULL,

    -- El NIT NO es el ID.
    -- Puede ser NULL.
    nit VARCHAR(50),

    -- Área responsable del proveedor.
    id_area BIGINT NOT NULL,

    activo BOOLEAN NOT NULL DEFAULT TRUE,

    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_proveedores_area
        FOREIGN KEY (id_area)
        REFERENCES public.areas(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT ck_proveedores_nombre
        CHECK (
            BTRIM(nombre) <> ''
        ),

    CONSTRAINT ck_proveedores_nit
        CHECK (
            nit IS NULL
            OR BTRIM(nit) <> ''
        )
);


-- Evitar repetir proveedor dentro de la misma área.

CREATE UNIQUE INDEX IF NOT EXISTS
    ux_proveedores_area_nombre
ON public.proveedores
(
    id_area,
    LOWER(BTRIM(nombre))
);


-- Si existe NIT, no permitir repetirlo.

CREATE UNIQUE INDEX IF NOT EXISTS
    ux_proveedores_nit
ON public.proveedores
(
    UPPER(
        REGEXP_REPLACE(
            BTRIM(nit),
            '[^0-9A-Z]',
            '',
            'g'
        )
    )
)
WHERE
    nit IS NOT NULL
    AND BTRIM(nit) <> '';


CREATE INDEX IF NOT EXISTS
    ix_proveedores_area
ON public.proveedores(id_area);


CREATE INDEX IF NOT EXISTS
    ix_proveedores_activo
ON public.proveedores(activo);


DROP TRIGGER IF EXISTS
    trg_proveedores_fecha_actualizacion
ON public.proveedores;


CREATE TRIGGER
    trg_proveedores_fecha_actualizacion
BEFORE UPDATE
ON public.proveedores
FOR EACH ROW
EXECUTE FUNCTION
    public.sgaf_actualizar_fecha();


-- ============================================================
-- CORREOS DE PROVEEDORES
--
-- Un proveedor puede tener N correos.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.proveedor_correos
(
    id BIGSERIAL PRIMARY KEY,

    id_proveedor BIGINT NOT NULL,

    correo VARCHAR(320) NOT NULL,

    es_principal BOOLEAN NOT NULL DEFAULT FALSE,

    activo BOOLEAN NOT NULL DEFAULT TRUE,

    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_proveedor_correos_proveedor
        FOREIGN KEY (id_proveedor)
        REFERENCES public.proveedores(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT ck_proveedor_correos_correo
        CHECK (
            BTRIM(correo) <> ''
            AND POSITION('@' IN correo) > 1
        )
);


-- Un mismo correo no puede identificar dos proveedores.

CREATE UNIQUE INDEX IF NOT EXISTS
    ux_proveedor_correos_correo
ON public.proveedor_correos
(
    LOWER(BTRIM(correo))
);


CREATE INDEX IF NOT EXISTS
    ix_proveedor_correos_proveedor
ON public.proveedor_correos(id_proveedor);


CREATE INDEX IF NOT EXISTS
    ix_proveedor_correos_activo
ON public.proveedor_correos(activo);


-- Solo un principal activo.

CREATE UNIQUE INDEX IF NOT EXISTS
    ux_proveedor_correo_principal
ON public.proveedor_correos(id_proveedor)
WHERE
    es_principal = TRUE
    AND activo = TRUE;


DROP TRIGGER IF EXISTS
    trg_proveedor_correos_fecha_actualizacion
ON public.proveedor_correos;


CREATE TRIGGER
    trg_proveedor_correos_fecha_actualizacion
BEFORE UPDATE
ON public.proveedor_correos
FOR EACH ROW
EXECUTE FUNCTION
    public.sgaf_actualizar_fecha();


-- ============================================================
-- ESTADOS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.estados_factura
(
    id SMALLSERIAL PRIMARY KEY,

    codigo VARCHAR(30) NOT NULL UNIQUE,

    nombre VARCHAR(100) NOT NULL,

    activo BOOLEAN NOT NULL DEFAULT TRUE
);


INSERT INTO public.estados_factura
(
    codigo,
    nombre,
    activo
)
VALUES
    (
        'PENDIENTE',
        'Pendiente',
        TRUE
    ),
    (
        'APROBADA',
        'Aprobada',
        TRUE
    ),
    (
        'RECHAZADA',
        'Rechazada',
        TRUE
    ),
    (
        'REMITIDA',
        'Remitida',
        TRUE
    ),
    (
        'PROCESADA',
        'Procesada',
        TRUE
    )

ON CONFLICT (codigo)

DO UPDATE
SET
    nombre = EXCLUDED.nombre,
    activo = TRUE;


-- ============================================================
-- FACTURAS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.facturas
(
    id BIGSERIAL PRIMARY KEY,

    id_proveedor BIGINT NOT NULL,

    id_proveedor_correo BIGINT,

    id_area_origen BIGINT NOT NULL,

    id_area_actual BIGINT NOT NULL,

    id_estado SMALLINT NOT NULL,

    -- ========================================================
    -- SNAPSHOT DEL PROVEEDOR
    --
    -- Se copia al momento de ingresar la factura.
    -- Así el histórico no cambia si después modifican el NIT.
    -- ========================================================

    proveedor_snapshot VARCHAR(200) NOT NULL,

    nit_snapshot VARCHAR(50),

    correo_proveedor_snapshot VARCHAR(320),

    -- ========================================================
    -- DATOS DE LA FACTURA
    --
    -- Por ahora pueden ser NULL.
    -- Posteriormente vendrán del XML electrónico.
    -- ========================================================

    numero_factura VARCHAR(100),

    cufe VARCHAR(200),

    fecha_emision DATE,

    fecha_vencimiento DATE,

    subtotal NUMERIC(18,2),

    impuestos NUMERIC(18,2),

    valor_total NUMERIC(18,2),

    moneda VARCHAR(3),

    -- ========================================================
    -- ORIGEN
    -- ========================================================

    origen VARCHAR(20) NOT NULL DEFAULT 'OUTLOOK',

    -- Microsoft Graph
    outlook_message_id TEXT,

    internet_message_id TEXT,

    asunto TEXT,

    correo_origen VARCHAR(320),

    fecha_recepcion TIMESTAMPTZ,

    tiene_adjuntos BOOLEAN NOT NULL DEFAULT FALSE,

    web_link TEXT,

    body_preview TEXT,

    activo BOOLEAN NOT NULL DEFAULT TRUE,

    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_facturas_proveedor
        FOREIGN KEY (id_proveedor)
        REFERENCES public.proveedores(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_facturas_proveedor_correo
        FOREIGN KEY (id_proveedor_correo)
        REFERENCES public.proveedor_correos(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_facturas_area_origen
        FOREIGN KEY (id_area_origen)
        REFERENCES public.areas(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_facturas_area_actual
        FOREIGN KEY (id_area_actual)
        REFERENCES public.areas(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_facturas_estado
        FOREIGN KEY (id_estado)
        REFERENCES public.estados_factura(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT ck_facturas_origen
        CHECK (
            origen IN
            (
                'OUTLOOK',
                'MANUAL',
                'API'
            )
        ),

    CONSTRAINT uq_facturas_outlook_message
        UNIQUE (outlook_message_id),

    CONSTRAINT uq_facturas_internet_message
        UNIQUE (internet_message_id)
);


CREATE INDEX IF NOT EXISTS
    ix_facturas_proveedor
ON public.facturas(id_proveedor);


CREATE INDEX IF NOT EXISTS
    ix_facturas_area_actual
ON public.facturas(id_area_actual);


CREATE INDEX IF NOT EXISTS
    ix_facturas_area_origen
ON public.facturas(id_area_origen);


CREATE INDEX IF NOT EXISTS
    ix_facturas_estado
ON public.facturas(id_estado);


CREATE INDEX IF NOT EXISTS
    ix_facturas_fecha_recepcion
ON public.facturas(fecha_recepcion DESC);


DROP TRIGGER IF EXISTS
    trg_facturas_fecha_actualizacion
ON public.facturas;


CREATE TRIGGER
    trg_facturas_fecha_actualizacion
BEFORE UPDATE
ON public.facturas
FOR EACH ROW
EXECUTE FUNCTION
    public.sgaf_actualizar_fecha();


-- ============================================================
-- AUDITORÍA
--
-- Actor = Área, porque actualmente SGAF inicia sesión por área.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.factura_eventos
(
    id BIGSERIAL PRIMARY KEY,

    id_factura BIGINT NOT NULL,

    accion VARCHAR(50) NOT NULL,

    -- NULL = acción automática del sistema.
    id_area_actor BIGINT,

    -- Snapshot para conservar el nombre histórico.
    area_actor_snapshot VARCHAR(100),

    id_area_origen BIGINT,

    area_origen_snapshot VARCHAR(100),

    id_area_destino BIGINT,

    area_destino_snapshot VARCHAR(100),

    id_estado_anterior SMALLINT,

    id_estado_nuevo SMALLINT,

    observacion TEXT,

    -- Información adicional de auditoría.
    ip INET,

    user_agent TEXT,

    datos JSONB NOT NULL DEFAULT '{}'::JSONB,

    fecha_evento TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_eventos_factura
        FOREIGN KEY (id_factura)
        REFERENCES public.facturas(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_eventos_area_actor
        FOREIGN KEY (id_area_actor)
        REFERENCES public.areas(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_eventos_area_origen
        FOREIGN KEY (id_area_origen)
        REFERENCES public.areas(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_eventos_area_destino
        FOREIGN KEY (id_area_destino)
        REFERENCES public.areas(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_eventos_estado_anterior
        FOREIGN KEY (id_estado_anterior)
        REFERENCES public.estados_factura(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_eventos_estado_nuevo
        FOREIGN KEY (id_estado_nuevo)
        REFERENCES public.estados_factura(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_eventos_accion
        CHECK (
            accion IN
            (
                'RECIBIDA_OUTLOOK',
                'APROBADA',
                'RECHAZADA',
                'REMITIDA',
                'PROCESADA',
                'OBSERVACION'
            )
        )
);


CREATE INDEX IF NOT EXISTS
    ix_eventos_factura
ON public.factura_eventos
(
    id_factura,
    fecha_evento DESC
);


CREATE INDEX IF NOT EXISTS
    ix_eventos_actor
ON public.factura_eventos(id_area_actor);


CREATE INDEX IF NOT EXISTS
    ix_eventos_fecha
ON public.factura_eventos(fecha_evento DESC);


-- ============================================================
-- HACER AUDITORÍA INMUTABLE
-- ============================================================

CREATE OR REPLACE FUNCTION
    public.sgaf_bloquear_evento()
RETURNS TRIGGER
LANGUAGE plpgsql
AS
$$
BEGIN

    RAISE EXCEPTION
        'Los eventos de auditoría SGAF no pueden modificarse ni eliminarse.';

END;
$$;


DROP TRIGGER IF EXISTS
    trg_factura_eventos_inmutables
ON public.factura_eventos;


CREATE TRIGGER
    trg_factura_eventos_inmutables
BEFORE UPDATE OR DELETE
ON public.factura_eventos
FOR EACH ROW
EXECUTE FUNCTION
    public.sgaf_bloquear_evento();


-- ============================================================
-- REGISTRAR FACTURA OUTLOOK
-- ============================================================

CREATE OR REPLACE FUNCTION
public.fn_registrar_factura_outlook
(
    p_id_proveedor BIGINT,

    p_id_proveedor_correo BIGINT,

    p_outlook_message_id TEXT,

    p_internet_message_id TEXT,

    p_asunto TEXT,

    p_correo_origen TEXT,

    p_fecha_recepcion TIMESTAMPTZ,

    p_tiene_adjuntos BOOLEAN,

    p_web_link TEXT,

    p_body_preview TEXT
)
RETURNS TABLE
(
    id_factura BIGINT,
    creada BOOLEAN
)
LANGUAGE plpgsql
AS
$$

DECLARE

    v_id_area BIGINT;

    v_nombre_proveedor VARCHAR(200);

    v_nit VARCHAR(50);

    v_correo_registrado VARCHAR(320);

    v_estado_pendiente SMALLINT;

    v_factura_id BIGINT;

    v_area_nombre VARCHAR(100);

BEGIN

    -- ========================================================
    -- VALIDAR PROVEEDOR + CORREO
    -- ========================================================

    SELECT
        p.id_area,
        p.nombre,
        p.nit,
        pc.correo

    INTO
        v_id_area,
        v_nombre_proveedor,
        v_nit,
        v_correo_registrado

    FROM public.proveedores p

    INNER JOIN public.proveedor_correos pc
        ON pc.id_proveedor = p.id

    WHERE
        p.id = p_id_proveedor

        AND pc.id =
            p_id_proveedor_correo

        AND p.activo = TRUE

        AND pc.activo = TRUE;


    IF v_id_area IS NULL THEN

        RAISE EXCEPTION
            'Proveedor o correo no válido.';

    END IF;


    SELECT nombre

    INTO v_area_nombre

    FROM public.areas

    WHERE id = v_id_area;


    SELECT id

    INTO v_estado_pendiente

    FROM public.estados_factura

    WHERE codigo = 'PENDIENTE'

    LIMIT 1;


    -- ========================================================
    -- INSERTAR
    -- ========================================================

    INSERT INTO public.facturas
    (
        id_proveedor,

        id_proveedor_correo,

        id_area_origen,

        id_area_actual,

        id_estado,

        proveedor_snapshot,

        nit_snapshot,

        correo_proveedor_snapshot,

        origen,

        outlook_message_id,

        internet_message_id,

        asunto,

        correo_origen,

        fecha_recepcion,

        tiene_adjuntos,

        web_link,

        body_preview
    )

    VALUES
    (
        p_id_proveedor,

        p_id_proveedor_correo,

        v_id_area,

        v_id_area,

        v_estado_pendiente,

        v_nombre_proveedor,

        v_nit,

        v_correo_registrado,

        'OUTLOOK',

        p_outlook_message_id,

        p_internet_message_id,

        p_asunto,

        LOWER(
            BTRIM(
                p_correo_origen
            )
        ),

        p_fecha_recepcion,

        COALESCE(
            p_tiene_adjuntos,
            FALSE
        ),

        p_web_link,

        p_body_preview
    )

    ON CONFLICT DO NOTHING

    RETURNING id

    INTO v_factura_id;


    -- ========================================================
    -- YA EXISTÍA
    -- ========================================================

    IF v_factura_id IS NULL THEN

        SELECT id

        INTO v_factura_id

        FROM public.facturas

        WHERE
            outlook_message_id =
                p_outlook_message_id

            OR
            (
                p_internet_message_id
                IS NOT NULL

                AND
                internet_message_id =
                    p_internet_message_id
            )

        LIMIT 1;


        RETURN QUERY

        SELECT
            v_factura_id,
            FALSE;


        RETURN;

    END IF;


    -- ========================================================
    -- EVENTO INICIAL
    -- ========================================================

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

        datos
    )

    VALUES
    (
        v_factura_id,

        'RECIBIDA_OUTLOOK',

        NULL,

        'SISTEMA',

        NULL,

        NULL,

        v_id_area,

        v_area_nombre,

        NULL,

        v_estado_pendiente,

        'Factura recibida automáticamente desde Outlook.',

        JSONB_BUILD_OBJECT
        (
            'correo_origen',
            p_correo_origen,

            'outlook_message_id',
            p_outlook_message_id,

            'internet_message_id',
            p_internet_message_id
        )
    );


    RETURN QUERY

    SELECT
        v_factura_id,
        TRUE;

END;

$$;


-- ============================================================
-- APROBAR FACTURA
-- ============================================================

CREATE OR REPLACE FUNCTION
public.fn_aprobar_factura
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

    v_estado_anterior SMALLINT;

    v_codigo_anterior VARCHAR(30);

    v_estado_nuevo SMALLINT;

BEGIN

    SELECT
        f.id_area_actual,
        a.nombre,
        f.id_estado,
        e.codigo

    INTO
        v_area_actual,
        v_area_nombre,
        v_estado_anterior,
        v_codigo_anterior

    FROM public.facturas f

    INNER JOIN public.areas a
        ON a.id =
           f.id_area_actual

    INNER JOIN public.estados_factura e
        ON e.id =
           f.id_estado

    WHERE
        f.id =
        p_id_factura

    FOR UPDATE OF f;


    IF NOT FOUND THEN

        RAISE EXCEPTION
            'Factura no encontrada.';

    END IF;


    IF
        v_area_actual <>
        p_id_area_actor
    THEN

        RAISE EXCEPTION
            'La factura no pertenece al área que intenta aprobarla.';

    END IF;


    IF
        v_codigo_anterior <>
        'PENDIENTE'
    THEN

        RAISE EXCEPTION
            'Solo una factura pendiente puede aprobarse.';

    END IF;


    SELECT id

    INTO v_estado_nuevo

    FROM public.estados_factura

    WHERE codigo =
          'APROBADA';


    UPDATE public.facturas

    SET
        id_estado =
            v_estado_nuevo

    WHERE
        id =
        p_id_factura;


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

        user_agent
    )

    VALUES
    (
        p_id_factura,

        'APROBADA',

        p_id_area_actor,

        v_area_nombre,

        v_area_actual,

        v_area_nombre,

        v_area_actual,

        v_area_nombre,

        v_estado_anterior,

        v_estado_nuevo,

        p_observacion,

        p_ip,

        p_user_agent
    );


    RETURN p_id_factura;

END;

$$;


-- ============================================================
-- RECHAZAR
-- ============================================================

CREATE OR REPLACE FUNCTION
public.fn_rechazar_factura
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

    v_estado_anterior SMALLINT;

    v_codigo_anterior VARCHAR(30);

    v_estado_nuevo SMALLINT;

BEGIN

    SELECT
        f.id_area_actual,
        a.nombre,
        f.id_estado,
        e.codigo

    INTO
        v_area_actual,
        v_area_nombre,
        v_estado_anterior,
        v_codigo_anterior

    FROM public.facturas f

    INNER JOIN public.areas a
        ON a.id =
           f.id_area_actual

    INNER JOIN public.estados_factura e
        ON e.id =
           f.id_estado

    WHERE
        f.id =
        p_id_factura

    FOR UPDATE OF f;


    IF NOT FOUND THEN

        RAISE EXCEPTION
            'Factura no encontrada.';

    END IF;


    IF
        v_area_actual <>
        p_id_area_actor
    THEN

        RAISE EXCEPTION
            'La factura no pertenece al área actual.';

    END IF;


    IF
        v_codigo_anterior
        NOT IN
        (
            'PENDIENTE',
            'REMITIDA'
        )
    THEN

        RAISE EXCEPTION
            'La factura no puede rechazarse desde el estado actual.';

    END IF;


    SELECT id

    INTO v_estado_nuevo

    FROM public.estados_factura

    WHERE codigo =
          'RECHAZADA';


    UPDATE public.facturas

    SET
        id_estado =
            v_estado_nuevo

    WHERE id =
          p_id_factura;


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

        user_agent
    )

    VALUES
    (
        p_id_factura,

        'RECHAZADA',

        p_id_area_actor,

        v_area_nombre,

        v_area_actual,

        v_area_nombre,

        v_area_actual,

        v_area_nombre,

        v_estado_anterior,

        v_estado_nuevo,

        p_observacion,

        p_ip,

        p_user_agent
    );


    RETURN p_id_factura;

END;

$$;


-- ============================================================
-- REMITIR A CONTABILIDAD
-- ============================================================

CREATE OR REPLACE FUNCTION
public.fn_remitir_factura_contabilidad
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

    v_area_actual_nombre VARCHAR(100);

    v_area_contabilidad BIGINT;

    v_area_contabilidad_nombre VARCHAR(100);

    v_estado_anterior SMALLINT;

    v_codigo_anterior VARCHAR(30);

    v_estado_nuevo SMALLINT;

BEGIN

    SELECT
        id,
        nombre

    INTO
        v_area_contabilidad,
        v_area_contabilidad_nombre

    FROM public.areas

    WHERE
        UPPER(
            BTRIM(nombre)
        ) =
        'CONTABILIDAD'

        AND activo = TRUE

    LIMIT 1;


    IF
        v_area_contabilidad
        IS NULL
    THEN

        RAISE EXCEPTION
            'No existe el área CONTABILIDAD activa.';

    END IF;


    SELECT
        f.id_area_actual,
        a.nombre,
        f.id_estado,
        e.codigo

    INTO
        v_area_actual,
        v_area_actual_nombre,
        v_estado_anterior,
        v_codigo_anterior

    FROM public.facturas f

    INNER JOIN public.areas a
        ON a.id =
           f.id_area_actual

    INNER JOIN public.estados_factura e
        ON e.id =
           f.id_estado

    WHERE
        f.id =
        p_id_factura

    FOR UPDATE OF f;


    IF NOT FOUND THEN

        RAISE EXCEPTION
            'Factura no encontrada.';

    END IF;


    IF
        v_area_actual <>
        p_id_area_actor
    THEN

        RAISE EXCEPTION
            'El área actual no puede remitir esta factura.';

    END IF;


    IF
        v_codigo_anterior <>
        'APROBADA'
    THEN

        RAISE EXCEPTION
            'La factura debe estar aprobada antes de remitirse.';

    END IF;


    IF
        v_area_actual =
        v_area_contabilidad
    THEN

        RAISE EXCEPTION
            'La factura ya se encuentra en Contabilidad.';

    END IF;


    SELECT id

    INTO v_estado_nuevo

    FROM public.estados_factura

    WHERE codigo =
          'REMITIDA';


    UPDATE public.facturas

    SET
        id_area_actual =
            v_area_contabilidad,

        id_estado =
            v_estado_nuevo

    WHERE id =
          p_id_factura;


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

        user_agent
    )

    VALUES
    (
        p_id_factura,

        'REMITIDA',

        p_id_area_actor,

        v_area_actual_nombre,

        v_area_actual,

        v_area_actual_nombre,

        v_area_contabilidad,

        v_area_contabilidad_nombre,

        v_estado_anterior,

        v_estado_nuevo,

        p_observacion,

        p_ip,

        p_user_agent
    );


    RETURN p_id_factura;

END;

$$;


-- ============================================================
-- PROCESAR EN CONTABILIDAD
-- ============================================================

CREATE OR REPLACE FUNCTION
public.fn_procesar_factura
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

    v_estado_anterior SMALLINT;

    v_codigo_anterior VARCHAR(30);

    v_estado_nuevo SMALLINT;

BEGIN

    SELECT
        f.id_area_actual,
        a.nombre,
        f.id_estado,
        e.codigo

    INTO
        v_area_actual,
        v_area_nombre,
        v_estado_anterior,
        v_codigo_anterior

    FROM public.facturas f

    INNER JOIN public.areas a
        ON a.id =
           f.id_area_actual

    INNER JOIN public.estados_factura e
        ON e.id =
           f.id_estado

    WHERE
        f.id =
        p_id_factura

    FOR UPDATE OF f;


    IF NOT FOUND THEN

        RAISE EXCEPTION
            'Factura no encontrada.';

    END IF;


    IF
        v_area_actual <>
        p_id_area_actor
    THEN

        RAISE EXCEPTION
            'La factura no pertenece al área actual.';

    END IF;


    IF
        UPPER(
            BTRIM(
                v_area_nombre
            )
        ) <>
        'CONTABILIDAD'
    THEN

        RAISE EXCEPTION
            'Solo Contabilidad puede procesar facturas remitidas.';

    END IF;


    IF
        v_codigo_anterior <>
        'REMITIDA'
    THEN

        RAISE EXCEPTION
            'Solo una factura remitida puede procesarse.';

    END IF;


    SELECT id

    INTO v_estado_nuevo

    FROM public.estados_factura

    WHERE codigo =
          'PROCESADA';


    UPDATE public.facturas

    SET
        id_estado =
            v_estado_nuevo

    WHERE id =
          p_id_factura;


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

        user_agent
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

        p_observacion,

        p_ip,

        p_user_agent
    );


    RETURN p_id_factura;

END;

$$;


-- ============================================================
-- VISTA PRINCIPAL DE FACTURAS
-- ============================================================

CREATE OR REPLACE VIEW
public.vw_facturas_detalle
AS

SELECT

    f.id,

    f.id_proveedor,

    f.proveedor_snapshot
        AS proveedor,

    f.nit_snapshot
        AS nit,

    f.id_proveedor_correo,

    f.correo_proveedor_snapshot
        AS correo_proveedor,

    f.correo_origen,

    f.id_area_origen,

    area_origen.nombre
        AS area_origen,

    f.id_area_actual,

    area_actual.nombre
        AS area_actual,

    f.id_estado,

    estado.codigo
        AS estado_codigo,

    estado.nombre
        AS estado,

    f.numero_factura,

    f.cufe,

    f.fecha_emision,

    f.fecha_vencimiento,

    f.subtotal,

    f.impuestos,

    f.valor_total,

    f.moneda,

    f.origen,

    f.outlook_message_id,

    f.internet_message_id,

    f.asunto,

    f.fecha_recepcion,

    f.tiene_adjuntos,

    f.web_link,

    f.body_preview,

    f.activo,

    f.fecha_creacion,

    f.fecha_actualizacion

FROM public.facturas f

INNER JOIN public.areas area_origen
    ON area_origen.id =
       f.id_area_origen

INNER JOIN public.areas area_actual
    ON area_actual.id =
       f.id_area_actual

INNER JOIN public.estados_factura estado
    ON estado.id =
       f.id_estado;


-- ============================================================
-- VISTA AUDITORÍA
-- ============================================================

CREATE OR REPLACE VIEW
public.vw_factura_eventos_detalle
AS

SELECT

    evento.id,

    evento.id_factura,

    evento.accion,

    evento.id_area_actor,

    evento.area_actor_snapshot
        AS area_actor,

    evento.id_area_origen,

    evento.area_origen_snapshot
        AS area_origen,

    evento.id_area_destino,

    evento.area_destino_snapshot
        AS area_destino,

    evento.id_estado_anterior,

    anterior.codigo
        AS estado_anterior_codigo,

    anterior.nombre
        AS estado_anterior,

    evento.id_estado_nuevo,

    nuevo.codigo
        AS estado_nuevo_codigo,

    nuevo.nombre
        AS estado_nuevo,

    evento.observacion,

    evento.ip,

    evento.user_agent,

    evento.datos,

    evento.fecha_evento

FROM public.factura_eventos evento

LEFT JOIN public.estados_factura anterior
    ON anterior.id =
       evento.id_estado_anterior

LEFT JOIN public.estados_factura nuevo
    ON nuevo.id =
       evento.id_estado_nuevo;


COMMIT;

















































CREATE OR REPLACE FUNCTION
public.fn_registrar_factura_outlook
(
    p_id_proveedor BIGINT,
    p_id_proveedor_correo BIGINT,
    p_outlook_message_id TEXT,
    p_internet_message_id TEXT,
    p_asunto TEXT,
    p_correo_origen TEXT,
    p_fecha_recepcion TIMESTAMPTZ,
    p_tiene_adjuntos BOOLEAN,
    p_web_link TEXT,
    p_body_preview TEXT
)
RETURNS TABLE
(
    id_factura BIGINT,
    creada BOOLEAN
)
LANGUAGE plpgsql
AS
$$

DECLARE

    v_id_area BIGINT;

    v_nombre_proveedor VARCHAR(200);

    v_nit VARCHAR(50);

    v_correo_registrado VARCHAR(320);

    v_estado_pendiente SMALLINT;

    v_factura_id BIGINT;

    v_area_nombre VARCHAR(100);

BEGIN

    /* =====================================================
       PROVEEDOR

       YA NO DEPENDE DE QUE EXISTA UN CORREO CONFIGURADO.
    ===================================================== */

    SELECT
        p.id_area,
        p.nombre,
        p.nit

    INTO
        v_id_area,
        v_nombre_proveedor,
        v_nit

    FROM public.proveedores p

    WHERE
        p.id = p_id_proveedor
        AND p.activo = TRUE

    LIMIT 1;


    IF NOT FOUND THEN

        RAISE EXCEPTION
            'Proveedor no válido o inactivo.';

    END IF;


    /* =====================================================
       CORREO CONFIGURADO

       ES OPCIONAL.
    ===================================================== */

    v_correo_registrado := NULL;


    IF p_id_proveedor_correo IS NOT NULL THEN

        SELECT
            pc.correo

        INTO
            v_correo_registrado

        FROM public.proveedor_correos pc

        WHERE
            pc.id = p_id_proveedor_correo

            AND pc.id_proveedor =
                p_id_proveedor

            AND pc.activo = TRUE

        LIMIT 1;


        IF NOT FOUND THEN

            RAISE EXCEPTION
                'El correo indicado no pertenece al proveedor o está inactivo.';

        END IF;

    END IF;


    /* =====================================================
       ÁREA
    ===================================================== */

    SELECT
        nombre

    INTO
        v_area_nombre

    FROM public.areas

    WHERE
        id = v_id_area
        AND activo = TRUE

    LIMIT 1;


    IF v_area_nombre IS NULL THEN

        RAISE EXCEPTION
            'El área del proveedor no existe o está inactiva.';

    END IF;


    /* =====================================================
       ESTADO PENDIENTE
    ===================================================== */

    SELECT
        id

    INTO
        v_estado_pendiente

    FROM public.estados_factura

    WHERE
        codigo = 'PENDIENTE'

    LIMIT 1;


    IF v_estado_pendiente IS NULL THEN

        RAISE EXCEPTION
            'No existe el estado PENDIENTE.';

    END IF;


    /* =====================================================
       INSERTAR FACTURA
    ===================================================== */

    INSERT INTO public.facturas
    (
        id_proveedor,

        id_proveedor_correo,

        id_area_origen,

        id_area_actual,

        id_estado,

        proveedor_snapshot,

        nit_snapshot,

        correo_proveedor_snapshot,

        origen,

        outlook_message_id,

        internet_message_id,

        asunto,

        correo_origen,

        fecha_recepcion,

        tiene_adjuntos,

        web_link,

        body_preview
    )

    VALUES
    (
        p_id_proveedor,

        p_id_proveedor_correo,

        v_id_area,

        v_id_area,

        v_estado_pendiente,

        v_nombre_proveedor,

        v_nit,

        v_correo_registrado,

        'OUTLOOK',

        p_outlook_message_id,

        p_internet_message_id,

        p_asunto,

        LOWER(
            BTRIM(
                COALESCE(
                    p_correo_origen,
                    ''
                )
            )
        ),

        p_fecha_recepcion,

        COALESCE(
            p_tiene_adjuntos,
            FALSE
        ),

        p_web_link,

        p_body_preview
    )

    ON CONFLICT DO NOTHING

    RETURNING
        id

    INTO
        v_factura_id;


    /* =====================================================
       DUPLICADA
    ===================================================== */

    IF v_factura_id IS NULL THEN

        SELECT
            id

        INTO
            v_factura_id

        FROM public.facturas

        WHERE
            outlook_message_id =
                p_outlook_message_id

            OR
            (
                p_internet_message_id
                    IS NOT NULL

                AND

                internet_message_id =
                    p_internet_message_id
            )

        LIMIT 1;


        RETURN QUERY

        SELECT
            v_factura_id,
            FALSE;

        RETURN;

    END IF;


    /* =====================================================
       AUDITORÍA
    ===================================================== */

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

        datos
    )

    VALUES
    (
        v_factura_id,

        'RECIBIDA_OUTLOOK',

        NULL,

        'SISTEMA',

        NULL,

        NULL,

        v_id_area,

        v_area_nombre,

        NULL,

        v_estado_pendiente,

        'Factura identificada automáticamente desde Outlook.',

        JSONB_BUILD_OBJECT
        (
            'metodo_identificacion',
            CASE
                WHEN p_id_proveedor_correo IS NULL
                    THEN 'NOMBRE_PROVEEDOR'
                ELSE 'NOMBRE_O_CORREO'
            END,

            'correo_origen',
            p_correo_origen,

            'outlook_message_id',
            p_outlook_message_id,

            'internet_message_id',
            p_internet_message_id
        )
    );


    RETURN QUERY

    SELECT
        v_factura_id,
        TRUE;

END;

$$;































BEGIN;


/* ============================================================
   SGAF
   CONTACTOS MULTIPLES POR AREA

   Cada area puede tener:
   - 0..N correos
   - 0..N celulares
============================================================ */


/* ============================================================
   CORREOS POR AREA
============================================================ */

CREATE TABLE IF NOT EXISTS public.area_correos
(
    id BIGSERIAL PRIMARY KEY,

    id_area BIGINT NOT NULL,

    correo VARCHAR(320) NOT NULL,

    es_principal BOOLEAN NOT NULL DEFAULT FALSE,

    activo BOOLEAN NOT NULL DEFAULT TRUE,

    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_area_correos_area
        FOREIGN KEY (id_area)
        REFERENCES public.areas(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT ck_area_correos_correo
        CHECK
        (
            BTRIM(correo) <> ''
            AND POSITION('@' IN correo) > 1
        )
);


/* ============================================================
   EVITAR CORREO DUPLICADO DENTRO DE LA MISMA AREA
============================================================ */

CREATE UNIQUE INDEX IF NOT EXISTS
    ux_area_correos_area_correo
ON public.area_correos
(
    id_area,
    LOWER(BTRIM(correo))
);


/* ============================================================
   INDICES
============================================================ */

CREATE INDEX IF NOT EXISTS
    ix_area_correos_area
ON public.area_correos(id_area);


CREATE INDEX IF NOT EXISTS
    ix_area_correos_activo
ON public.area_correos(activo);


/* ============================================================
   SOLO UN CORREO PRINCIPAL ACTIVO POR AREA
============================================================ */

CREATE UNIQUE INDEX IF NOT EXISTS
    ux_area_correo_principal
ON public.area_correos(id_area)
WHERE
    es_principal = TRUE
    AND activo = TRUE;


/* ============================================================
   FECHA ACTUALIZACION
============================================================ */

DROP TRIGGER IF EXISTS
    trg_area_correos_fecha_actualizacion
ON public.area_correos;


CREATE TRIGGER
    trg_area_correos_fecha_actualizacion
BEFORE UPDATE
ON public.area_correos
FOR EACH ROW
EXECUTE FUNCTION
    public.sgaf_actualizar_fecha();



/* ============================================================
   CELULARES POR AREA
============================================================ */

CREATE TABLE IF NOT EXISTS public.area_celulares
(
    id BIGSERIAL PRIMARY KEY,

    id_area BIGINT NOT NULL,

    celular VARCHAR(30) NOT NULL,

    es_principal BOOLEAN NOT NULL DEFAULT FALSE,

    activo BOOLEAN NOT NULL DEFAULT TRUE,

    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_area_celulares_area
        FOREIGN KEY (id_area)
        REFERENCES public.areas(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT ck_area_celulares_celular
        CHECK
        (
            BTRIM(celular) <> ''
        )
);


/* ============================================================
   EVITAR CELULAR DUPLICADO DENTRO DE LA MISMA AREA
============================================================ */

CREATE UNIQUE INDEX IF NOT EXISTS
    ux_area_celulares_area_celular
ON public.area_celulares
(
    id_area,
    BTRIM(celular)
);


/* ============================================================
   INDICES
============================================================ */

CREATE INDEX IF NOT EXISTS
    ix_area_celulares_area
ON public.area_celulares(id_area);


CREATE INDEX IF NOT EXISTS
    ix_area_celulares_activo
ON public.area_celulares(activo);


/* ============================================================
   SOLO UN CELULAR PRINCIPAL ACTIVO POR AREA
============================================================ */

CREATE UNIQUE INDEX IF NOT EXISTS
    ux_area_celular_principal
ON public.area_celulares(id_area)
WHERE
    es_principal = TRUE
    AND activo = TRUE;


/* ============================================================
   FECHA ACTUALIZACION
============================================================ */

DROP TRIGGER IF EXISTS
    trg_area_celulares_fecha_actualizacion
ON public.area_celulares;


CREATE TRIGGER
    trg_area_celulares_fecha_actualizacion
BEFORE UPDATE
ON public.area_celulares
FOR EACH ROW
EXECUTE FUNCTION
    public.sgaf_actualizar_fecha();


COMMIT;