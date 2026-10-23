import type { PoolClient } from 'pg';
import pool, { query } from '../config/database';
import { lockClasificacion } from './clasificacionProveedorService';
import { isValidEmail, normalizeEmail } from '../utils/proveedorMatch';
export interface CrearProveedorInput {
    nombre: string;
    nit?: string | null;
    idArea: number;
    correos?: string[];
}
export interface ActualizarProveedorInput extends CrearProveedorInput {
}
export interface ProveedorCreado {
    id: number;
    nombre: string;
    nit: string | null;
    idArea: number;
}
export class ProveedorError extends Error {
    constructor(message: string, public readonly statusCode = 400) {
        super(message);
        this.name = 'ProveedorError';
    }
}
const validId = (id: number): boolean => Number.isSafeInteger(id) && id > 0;
const cleanName = (nombre: string): string => {
    if (typeof nombre !== 'string' || !nombre.trim())
        throw new ProveedorError('El nombre es obligatorio.');
    return nombre.trim().replace(/\s+/g, ' ');
};
const cleanNit = (nit?: string | null): string | null => nit?.trim() || null;
const prepareEmails = (values: string[], nombre: string): string[] => {
    if (!Array.isArray(values) || values.some(v => typeof v !== 'string')) {
        throw new ProveedorError('correos debe ser una lista de direcciones de correo.');
    }
    const emails = values.map(normalizeEmail).filter(Boolean);
    if (isValidEmail(normalizeEmail(nombre)))
        emails.push(normalizeEmail(nombre));
    const unique = [...new Set(emails)];
    if (unique.some(email => !isValidEmail(email)))
        throw new ProveedorError('Hay un correo no valido.');
    return unique;
};
const validateArea = async (client: PoolClient, idArea: number): Promise<void> => {
    if (!validId(idArea))
        throw new ProveedorError('Area no valida.');
    const result = await client.query('SELECT id FROM public.areas WHERE id = $1 AND activo = TRUE', [idArea]);
    if (!result.rows.length)
        throw new ProveedorError('El area no existe o esta inactiva.');
};
const validateName = async (client: PoolClient, nombre: string, id: number | null): Promise<void> => {
    const result = await client.query(`
    SELECT id FROM public.proveedores WHERE activo = TRUE
      AND UPPER(REGEXP_REPLACE(BTRIM(nombre), '\\s+', ' ', 'g')) = UPPER($1)
      AND ($2::bigint IS NULL OR id <> $2) LIMIT 1`, [nombre, id]);
    if (result.rows.length)
        throw new ProveedorError('Ya existe un proveedor activo con ese nombre.', 409);
};
const putEmail = async (client: PoolClient, idProveedor: number, correo: string, principal: boolean): Promise<number> => {
    const found = await client.query<{
        id: number | string;
        id_proveedor: number | string;
    }>(`
    SELECT id, id_proveedor FROM public.proveedor_correos
    WHERE LOWER(BTRIM(correo)) = $1 ORDER BY id FOR UPDATE`, [correo]);
    if (found.rows.some(row => Number(row.id_proveedor) !== idProveedor)) {
        throw new ProveedorError(`El correo ${correo} ya pertenece a otro proveedor.`, 409);
    }
    const existing = found.rows[0];
    if (existing) {
        await client.query(`UPDATE public.proveedor_correos
      SET activo = TRUE, es_principal = $2, correo = $3 WHERE id = $1`, [existing.id, principal, correo]);
        return Number(existing.id);
    }
    const result = await client.query<{
        id: number | string;
    }>(`
    INSERT INTO public.proveedor_correos (id_proveedor, correo, es_principal, activo)
    VALUES ($1, $2, $3, TRUE) RETURNING id`, [idProveedor, correo, principal]);
    return Number(result.rows[0]!.id);
};
const replaceEmails = async (client: PoolClient, id: number, emails: string[]): Promise<void> => {
    await client.query(`UPDATE public.proveedor_correos SET activo = FALSE,
    es_principal = FALSE WHERE id_proveedor = $1`, [id]);
    for (let index = 0; index < emails.length; index++)
        await putEmail(client, id, emails[index]!, index === 0);
};
const translateError = (error: unknown): never => {
    if (error instanceof ProveedorError)
        throw error;
    if ((error as {
        code?: string;
    })?.code === '23505') {
        throw new ProveedorError('Ya existe un proveedor con ese nombre, NIT o correo.', 409);
    }
    throw error;
};
/** Permite registrar proveedor + clasificar RECEPCION en la misma transaccion. */
export const crearProveedorEnTransaccion = async (client: PoolClient, input: CrearProveedorInput): Promise<ProveedorCreado> => {
    await lockClasificacion(client);
    const nombre = cleanName(input.nombre);
    await validateArea(client, input.idArea);
    await validateName(client, nombre, null);
    const emails = prepareEmails(input.correos ?? [], nombre);
    const nit = cleanNit(input.nit);
    const result = await client.query<{
        id: number | string;
    }>(`
    INSERT INTO public.proveedores (nombre, nit, id_area, activo)
    VALUES ($1, $2, $3, TRUE) RETURNING id`, [nombre, nit, input.idArea]);
    const id = Number(result.rows[0]?.id);
    if (!validId(id))
        throw new Error('No se obtuvo el ID del proveedor.');
    await replaceEmails(client, id, emails);
    return { id, nombre, nit, idArea: input.idArea };
};
export const crearProveedor = async (input: CrearProveedorInput): Promise<ProveedorCreado> => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const proveedor = await crearProveedorEnTransaccion(client, input);
        await client.query('COMMIT');
        return proveedor;
    }
    catch (error) {
        await client.query('ROLLBACK');
        return translateError(error);
    }
    finally {
        client.release();
    }
};
export const actualizarProveedor = async (id: number, input: ActualizarProveedorInput): Promise<ProveedorCreado> => {
    if (!validId(id))
        throw new ProveedorError('Proveedor no valido.');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await lockClasificacion(client);
        const nombre = cleanName(input.nombre);
        await validateArea(client, input.idArea);
        await validateName(client, nombre, id);
        const nit = cleanNit(input.nit);
        const updated = await client.query(`UPDATE public.proveedores SET nombre = $1,
      nit = $2, id_area = $3, fecha_actualizacion = NOW()
      WHERE id = $4 AND activo = TRUE RETURNING id`, [nombre, nit, input.idArea, id]);
        if (!updated.rows.length)
            throw new ProveedorError('Proveedor no encontrado.', 404);
        // Campo omitido conserva correos; [] los desactiva explicitamente.
        if (input.correos !== undefined)
            await replaceEmails(client, id, prepareEmails(input.correos, nombre));
        await client.query('COMMIT');
        return { id, nombre, nit, idArea: input.idArea };
    }
    catch (error) {
        await client.query('ROLLBACK');
        return translateError(error);
    }
    finally {
        client.release();
    }
};
export const eliminarProveedor = async (id: number): Promise<void> => {
    if (!validId(id))
        throw new ProveedorError('Proveedor no valido.');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await lockClasificacion(client);
        const result = await client.query(`UPDATE public.proveedores SET activo = FALSE,
      fecha_actualizacion = NOW() WHERE id = $1 AND activo = TRUE RETURNING id`, [id]);
        if (!result.rows.length)
            throw new ProveedorError('Proveedor no encontrado.', 404);
        await client.query(`UPDATE public.proveedor_correos SET activo = FALSE,
      es_principal = FALSE WHERE id_proveedor = $1`, [id]);
        await client.query('COMMIT');
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
};
export const agregarCorreoProveedor = async (idProveedor: number, correo: string) => {
    const email = normalizeEmail(correo);
    if (!validId(idProveedor) || !isValidEmail(email))
        throw new ProveedorError('Proveedor o correo no valido.');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await lockClasificacion(client);
        const provider = await client.query('SELECT id FROM public.proveedores WHERE id = $1 AND activo = TRUE', [idProveedor]);
        if (!provider.rows.length)
            throw new ProveedorError('Proveedor no encontrado.', 404);
        const principal = await client.query<{
            correo: string;
        }>(`SELECT correo FROM public.proveedor_correos
      WHERE id_proveedor = $1 AND activo = TRUE AND es_principal = TRUE LIMIT 1`, [idProveedor]);
        const id = await putEmail(client, idProveedor, email, !principal.rows.length || normalizeEmail(principal.rows[0]!.correo) === email);
        await client.query('COMMIT');
        return { id, idProveedor, correo: email };
    }
    catch (error) {
        await client.query('ROLLBACK');
        return translateError(error);
    }
    finally {
        client.release();
    }
};
export const getProveedores = async () => {
    const result = await query(`
    SELECT p.id, p.nombre, p.nit, p.id_area AS "idArea", a.nombre AS area,
      p.activo, p.fecha_creacion AS "fechaCreacion", p.fecha_actualizacion AS "fechaActualizacion",
      COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT('id', pc.id, 'correo', pc.correo,
        'esPrincipal', pc.es_principal, 'activo', pc.activo)
        ORDER BY pc.es_principal DESC, pc.correo)
        FILTER (WHERE pc.id IS NOT NULL AND pc.activo = TRUE), '[]'::JSONB) AS correos
    FROM public.proveedores p JOIN public.areas a ON a.id = p.id_area
    LEFT JOIN public.proveedor_correos pc ON pc.id_proveedor = p.id
    WHERE p.activo = TRUE
    GROUP BY p.id, p.nombre, p.nit, p.id_area, a.nombre, p.activo,
      p.fecha_creacion, p.fecha_actualizacion
    ORDER BY p.nombre
  `);
    return result.rows;
};
