import type { Request, Response } from 'express';
import { sincronizarBuzonOutlook, sincronizarProveedorOutlook } from '../services/outlookService';
import { getAuth, positiveId, requestIp, requestAgent, handleBackendError } from '../utils/httpHelpers';
export const sincronizarBuzonController = async (req: Request, res: Response): Promise<void> => {
    if (!getAuth(req)) {
        res.status(401).json({ success: false, message: 'Sesion no valida.' });
        return;
    }
    try {
        const data = await sincronizarBuzonOutlook(req.body?.full === true);
        const parcial = data.errores > 0 || data.erroresMetadatos > 0;
        res.status(200).json({ success: true,
            message: `Sincronizacion ${parcial ? 'con advertencias' : 'completada'}. ${data.facturasCreadas} registro(s) nuevo(s), ${data.enviadasRecepcion} en RECEPCION.`,
            warning: parcial ? 'Revisa los errores del log y vuelve a sincronizar.' : null, data });
    }
    catch (error) {
        handleBackendError(error, res, 'No se completo la sincronizacion de Outlook; puedes volver a intentarlo sin duplicar mensajes.');
    }
};
export const sincronizarProveedorController = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(req);
    const id = positiveId(req.params.idProveedor);
    if (!auth || !id) {
        res.status(!auth ? 401 : 400).json({ success: false, message: 'Sesion o proveedor no valido.' });
        return;
    }
    try {
        const data = await sincronizarProveedorOutlook(id, { idAreaActor: auth.areaId,
            consultarOutlook: req.body?.consultarOutlook !== false,
            ip: requestIp(req), userAgent: requestAgent(req) });
        res.status(200).json({ success: true,
            message: `${data.facturasReclasificadas} registro(s) actualizado(s); ${data.facturasTransferidas} transferido(s) a ${data.area}.`,
            warning: data.warning, data });
    }
    catch (error) {
        handleBackendError(error, res, 'No fue posible reclasificar los pendientes del proveedor.');
    }
};
