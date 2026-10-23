-- SGAF: ejecutar en la base de datos de la aplicacion, con el backend detenido.
-- No borra facturas, no altera estados ni reemplaza funciones del flujo de rechazo.
-- Requiere PostgreSQL 12+ y permisos para instalar pg_trgm (o que lo instale el DBA).
BEGIN;
SET LOCAL lock_timeout = '10s';
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
DO $check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'pg_trgm' AND n.nspname = 'public'
  ) THEN
    RAISE EXCEPTION 'pg_trgm esta instalado fuera de public. No se mueve automaticamente. Ajuste los calificadores public.word_similarity y public.gin_trgm_ops al esquema real antes de ejecutar.';
  END IF;
END;
$check$;

ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS asignacion_manual_bloqueada BOOLEAN NOT NULL DEFAULT FALSE;

-- Normalizacion exclusiva de BUSQUEDA; nunca decide automaticamente el proveedor.
CREATE OR REPLACE FUNCTION public.sgaf_normalizar_busqueda(p_texto TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $normalizar$
  SELECT BTRIM(REGEXP_REPLACE(
    TRANSLATE(LOWER(COALESCE(p_texto, '')),
      U&'\00e1\00e9\00ed\00f3\00fa\00fc\00f1', 'aeiouun'),
    '[^a-z0-9]+', ' ', 'g'));
$normalizar$;

CREATE INDEX IF NOT EXISTS ix_sgaf_revision_asunto_trgm
 ON public.facturas USING gin (public.sgaf_normalizar_busqueda(asunto) public.gin_trgm_ops)
 WHERE activo = TRUE;
CREATE INDEX IF NOT EXISTS ix_sgaf_revision_proveedor_trgm
 ON public.facturas USING gin (public.sgaf_normalizar_busqueda(proveedor_snapshot) public.gin_trgm_ops)
 WHERE activo = TRUE;
CREATE INDEX IF NOT EXISTS ix_sgaf_revision_proveedor_catalogo_trgm
 ON public.proveedores USING gin (public.sgaf_normalizar_busqueda(nombre) public.gin_trgm_ops);
COMMIT;
-- Si el rol del backend no es propietario: necesita SELECT/UPDATE en facturas,
-- SELECT en catalogos e INSERT en factura_eventos (los permisos normales de SGAF).
