import type { Request, Response } from 'express';
import { actualizarProveedor, agregarCorreoProveedor, crearProveedor, eliminarProveedor, getProveedores } from '../services/proveedoresService';
import { sincronizarProveedorOutlook } from '../services/outlookService';
import { getAuth, positiveId, requestIp, requestAgent, handleBackendError, parseProveedorInput } from '../utils/httpHelpers';
const syncGuardado = async (idProveedor: number, req: Request) => {
    const auth = getAuth(req);
    if (!auth)
        throw new Error('Sesion no valida.');
    try {
        const sincronizacion = await sincronizarProveedorOutlook(idProveedor, {
            idAreaActor: auth.areaId, consultarOutlook: req.body?.consultarOutlook !== false,
            ip: requestIp(req), userAgent: requestAgent(req),
        });
        return { sincronizacion, warning: sincronizacion.warning };
    }
    catch (error) {
        console.error('Proveedor guardado; no se completo la reclasificacion:', error);
        return { sincronizacion: null,
            warning: 'El proveedor fue guardado, pero la reclasificacion no se completo. Revisa el log y usa Sincronizar.' };
    }
};
export const listarProveedoresController = async (_req: Request, res: Response): Promise<void> => {
    try {
        res.json({ success: true, data: await getProveedores() });
    }
    catch (error) {
        handleBackendError(error, res, 'No fue posible consultar los proveedores.');
    }
};
export const crearProveedorController = async (req: Request, res: Response): Promise<void> => {
    if (!getAuth(req)) {
        res.status(401).json({ success: false, message: 'Sesion no valida.' });
        return;
    }
    try {
        const proveedor = await crearProveedor(parseProveedorInput(req.body));
        const sync = await syncGuardado(proveedor.id, req);
        res.status(201).json({ success: true,
            message: sync.warning ? 'Proveedor registrado con advertencias.' : 'Proveedor registrado y pendientes reclasificados.',
            warning: sync.warning, data: { ...proveedor, sincronizacion: sync.sincronizacion } });
    }
    catch (error) {
        handleBackendError(error, res, 'No fue posible registrar el proveedor.');
    }
};
export const actualizarProveedorController = async (req: Request, res: Response): Promise<void> => {
    const id = positiveId(req.params.id);
    if (!getAuth(req) || !id) {
        res.status(!getAuth(req) ? 401 : 400).json({ success: false, message: 'Sesion o proveedor no valido.' });
        return;
    }
    try {
        const proveedor = await actualizarProveedor(id, parseProveedorInput(req.body));
        const sync = await syncGuardado(id, req);
        res.json({ success: true, message: 'Proveedor actualizado.', warning: sync.warning,
            data: { ...proveedor, sincronizacion: sync.sincronizacion } });
    }
    catch (error) {
        handleBackendError(error, res, 'No fue posible actualizar el proveedor.');
    }
};
export const eliminarProveedorController = async (req: Request, res: Response): Promise<void> => {
    const id = positiveId(req.params.id);
    if (!id) {
        res.status(400).json({ success: false, message: 'Proveedor no valido.' });
        return;
    }
    try {
        await eliminarProveedor(id);
        res.json({ success: true, message: 'Proveedor desactivado correctamente.' });
    }
    catch (error) {
        handleBackendError(error, res, 'No fue posible desactivar el proveedor.');
    }
};
export const agregarCorreoController = async (req: Request, res: Response): Promise<void> => {
    const id = positiveId(req.params.id);
    if (!getAuth(req) || !id || typeof req.body?.correo !== 'string') {
        res.status(!getAuth(req) ? 401 : 400).json({ success: false, message: 'Sesion, proveedor o correo no valido.' });
        return;
    }
    try {
        const correo = await agregarCorreoProveedor(id, req.body.correo);
        const sync = await syncGuardado(id, req);
        res.status(201).json({ success: true, message: 'Correo registrado.', warning: sync.warning,
            data: { ...correo, sincronizacion: sync.sincronizacion } });
    }
    catch (error) {
        handleBackendError(error, res, 'No fue posible registrar el correo.');
    }
};
