import type { Request, Response } from 'express';
import { isIP } from 'node:net';
import type { AuthenticatedRequest } from '../types/auth.types';
import { ProveedorError } from '../services/proveedoresService';
import type { CrearProveedorInput } from '../services/proveedoresService';
export const getAuth = (req: Request) => (req as AuthenticatedRequest).auth;
export const positiveId = (value: unknown): number | null => {
    if (typeof value !== 'string' && typeof value !== 'number')
        return null;
    if (typeof value === 'string' && !/^\d+$/.test(value.trim()))
        return null;
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
};
export const requestIp = (req: Request): string | null => req.ip && isIP(req.ip) ? req.ip : null;
export const requestAgent = (req: Request): string | null => req.get('user-agent') ?? null;
export const handleBackendError = (error: unknown, res: Response, fallback: string): void => {
    console.error(fallback, error);
    const e = error as {
        statusCode?: number;
        code?: string;
        message?: string;
    } | null;
    if (e?.statusCode && e.statusCode >= 400 && e.statusCode <= 499) {
        res.status(e.statusCode).json({ success: false, message: e.message ?? fallback });
        return;
    }
    if (e?.code === 'P0001') {
        res.status(400).json({ success: false, message: e.message ?? fallback });
        return;
    }
    if (e?.code === '23505') {
        res.status(409).json({ success: false, message: 'Ya existe un registro con esos datos.' });
        return;
    }
    res.status(500).json({ success: false, message: fallback });
};
export const parseProveedorInput = (body: unknown): CrearProveedorInput => {
    if (body == null || typeof body !== 'object' || Array.isArray(body))
        throw new ProveedorError('Datos de proveedor no validos.');
    const value = body as Record<string, unknown>;
    const idArea = positiveId(value.idArea);
    if (!idArea || typeof value.nombre !== 'string' || !value.nombre.trim()) {
        throw new ProveedorError('Debes indicar un nombre y un area valida.');
    }
    if (value.nit != null && typeof value.nit !== 'string')
        throw new ProveedorError('El NIT debe ser texto.');
    if (value.correos !== undefined && (!Array.isArray(value.correos)
        || value.correos.some(c => typeof c !== 'string'))) {
        throw new ProveedorError('correos debe ser una lista de textos.');
    }
    return { nombre: value.nombre, idArea, nit: value.nit as string | null | undefined,
        correos: value.correos as string[] | undefined };
};
