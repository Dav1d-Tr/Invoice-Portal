import type { Request, Response } from 'express';
import { getHistorialProcesadasArea, getHistorialRemisionesArea, getResumenArea } from '../services/historialService';
import { getAuth, handleBackendError } from '../utils/httpHelpers';
export const resumenAreaController = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(req);
    if (!auth) {
        res.status(401).json({ success: false, message: 'Sesion no valida.' });
        return;
    }
    try {
        res.json({ success: true, data: await getResumenArea(auth.areaId) });
    }
    catch (error) {
        handleBackendError(error, res, 'No fue posible consultar el resumen del area.');
    }
};
export const historialRemisionesController = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(req);
    if (!auth) {
        res.status(401).json({ success: false, message: 'Sesion no valida.' });
        return;
    }
    try {
        res.json({ success: true, data: await getHistorialRemisionesArea(auth.areaId) });
    }
    catch (error) {
        handleBackendError(error, res, 'No fue posible consultar el historial de remisiones.');
    }
};
export const historialProcesadasController = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(req);
    if (!auth) {
        res.status(401).json({ success: false, message: 'Sesion no valida.' });
        return;
    }
    try {
        res.json({ success: true, data: await getHistorialProcesadasArea(auth.areaId) });
    }
    catch (error) {
        handleBackendError(error, res, 'No fue posible consultar el historial de procesadas.');
    }
};
