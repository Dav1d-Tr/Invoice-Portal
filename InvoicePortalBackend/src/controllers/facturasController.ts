import { positiveId, parseProveedorInput, requestIp, handleBackendError } from '../utils/httpHelpers';
import type { Request, Response, } from "express";
import type { AuthenticatedRequest, } from "../types/auth.types";
import { actualizarMetadatosFactura, aprobarFactura, asignarProveedorFactura, FacturasError, getAreasCatalogo, getFacturaDetalle, getFacturasArea, getFacturasRemitidas, getFacturasRechazadas, getHistorialFactura, getProveedoresCatalogo, procesarFactura, reactivarFactura, rechazarFactura, remitirFactura, remitirFacturaContabilidad, } from "../services/facturasService";
import { downloadOutlookAttachment, getOutlookInvoiceMetadata, getOutlookMessageDetail, } from "../services/outlookService";
/* =========================================================
   AUTH
========================================================= */
const getAuth = (req: Request) => {
    return (req as AuthenticatedRequest).auth;
};
/* =========================================================
   PARAMETROS
========================================================= */
const getSingleParam = (value: string | string[] | undefined): string => {
    if (typeof value ===
        "string") {
        return value.trim();
    }
    if (Array.isArray(value)) {
        return value[0]
            ?.trim() ??
            "";
    }
    return "";
};
const getPositiveId = (value: string | string[] | undefined): number | null => positiveId(Array.isArray(value) ? value[0] : value);
const getIp = (req: Request): string | null => requestIp(req);
const getUserAgent = (req: Request): string | null => {
    return req.get("user-agent") ??
        null;
};
const getObservacion = (req: Request): string | null => {
    const value = req.body
        ?.observacion;
    if (typeof value !==
        "string") {
        return null;
    }
    return value.trim() ||
        null;
};
const handleError = (error: unknown, res: Response, fallback: string): void => handleBackendError(error, res, fallback);
/* =========================================================
   LISTADO DIRECTO
========================================================= */
export const listarFacturasController = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(req);
    if (!auth) {
        res.status(401).json({
            success: false,
            message: "Sesión no válida.",
        });
        return;
    }
    try {
        const data = await getFacturasArea(auth.areaId);
        res.status(200).json({
            success: true,
            data,
        });
    }
    catch (error) {
        handleError(error, res, "No fue posible consultar las facturas.");
    }
};
/* =========================================================
   REMITIDAS
========================================================= */
export const remitidasController = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(req);
    if (!auth) {
        res.status(401).json({
            success: false,
            message: "Sesión no válida.",
        });
        return;
    }
    try {
        const data = await getFacturasRemitidas(auth.areaId);
        res.status(200).json({
            success: true,
            data,
        });
    }
    catch (error) {
        handleError(error, res, "No fue posible consultar las facturas remitidas.");
    }
};
/* =========================================================
   RECHAZADAS
   - Cada area ve las facturas que rechazo y siguen rechazadas.
   - SISTEMAS ve todas las rechazadas.
========================================================= */
export const rechazadasController = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(req);
    if (!auth) {
        res.status(401).json({
            success: false,
            message: "Sesión no válida.",
        });
        return;
    }
    try {
        const data = await getFacturasRechazadas(auth.areaId);
        res.status(200).json({
            success: true,
            data,
        });
    }
    catch (error) {
        handleError(error, res, "No fue posible consultar las facturas rechazadas.");
    }
};
/* =========================================================
   CATALOGOS
========================================================= */
export const areasFacturasController = async (_req: Request, res: Response): Promise<void> => {
    try {
        res.status(200).json({
            success: true,
            data: await getAreasCatalogo(),
        });
    }
    catch (error) {
        handleError(error, res, "No fue posible consultar las áreas.");
    }
};
export const proveedoresFacturasController = async (_req: Request, res: Response): Promise<void> => {
    try {
        res.status(200).json({
            success: true,
            data: await getProveedoresCatalogo(),
        });
    }
    catch (error) {
        handleError(error, res, "No fue posible consultar los proveedores.");
    }
};
/* =========================================================
   DETALLE
========================================================= */
export const detalleFacturaController = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(req);
    const idFactura = getPositiveId(req.params.id);
    if (!auth ||
        !idFactura) {
        res.status(!auth
            ? 401
            : 400).json({
            success: false,
            message: !auth
                ? "Sesión no válida."
                : "Factura inválida.",
        });
        return;
    }
    try {
        const data = await getFacturaDetalle(idFactura, auth.areaId);
        res.status(200).json({
            success: true,
            data,
        });
    }
    catch (error) {
        handleError(error, res, "Factura no encontrada.");
    }
};
/* =========================================================
   CORREO OUTLOOK + ACTUALIZACION AUTOMATICA DE METADATOS
   Al abrir el detalle:
   - recupera correo;
   - vuelve a extraer factura/nota crédito, número y valor;
   - actualiza PostgreSQL si encontró información.
========================================================= */
export const detalleOutlookFacturaController = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(req);
    const idFactura = getPositiveId(req.params.id);
    if (!auth ||
        !idFactura) {
        res.status(!auth
            ? 401
            : 400).json({
            success: false,
            message: !auth
                ? "Sesión no válida."
                : "Factura inválida.",
        });
        return;
    }
    try {
        const factura = await getFacturaDetalle(idFactura, auth.areaId);
        const messageId = typeof factura
            .outlookMessageId ===
            "string"
            ? factura
                .outlookMessageId
                .trim()
            : "";
        const internetMessageId = typeof factura
            .internetMessageId ===
            "string"
            ? factura
                .internetMessageId
            : null;
        if (!messageId) {
            res.status(404).json({
                success: false,
                message: "Esta factura no tiene un mensaje de Outlook asociado.",
            });
            return;
        }
        const data = await getOutlookMessageDetail(messageId, internetMessageId);
        /*
          La extracción de metadatos es auxiliar.
          Si falla, el correo sigue mostrándose.
        */
        try {
            const metadata = await getOutlookInvoiceMetadata(data);
            await actualizarMetadatosFactura(idFactura, metadata);
        }
        catch (metadataError) {
            console.warn("No fue posible actualizar metadatos de la factura:", metadataError);
        }
        res.status(200).json({
            success: true,
            data,
        });
    }
    catch (error) {
        handleError(error, res, "No fue posible obtener el correo desde Outlook.");
    }
};
/* =========================================================
   DESCARGAR / VER ADJUNTO
========================================================= */
export const descargarAdjuntoFacturaController = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(req);
    const idFactura = getPositiveId(req.params.id);
    const attachmentId = getSingleParam(req.params
        .attachmentId);
    if (!auth ||
        !idFactura ||
        !attachmentId) {
        res.status(!auth
            ? 401
            : 400).json({
            success: false,
            message: !auth
                ? "Sesión no válida."
                : "Factura o adjunto inválido.",
        });
        return;
    }
    try {
        const factura = await getFacturaDetalle(idFactura, auth.areaId);
        const messageId = typeof factura
            .outlookMessageId ===
            "string"
            ? factura
                .outlookMessageId
                .trim()
            : "";
        const internetMessageId = typeof factura
            .internetMessageId ===
            "string"
            ? factura
                .internetMessageId
            : null;
        if (!messageId) {
            res.status(404).json({
                success: false,
                message: "La factura no tiene un correo de Outlook asociado.",
            });
            return;
        }
        const file = await downloadOutlookAttachment(messageId, attachmentId, internetMessageId);
        const inline = req.query.inline ===
            "1";
        const disposition = inline
            ? "inline"
            : "attachment";
        res.setHeader("Content-Type", file.contentType ||
            "application/octet-stream");
        res.setHeader("Content-Length", String(file.buffer.length));
        res.setHeader("Cache-Control", "private, no-store");
        res.setHeader("Content-Disposition", `${disposition}; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
        res.status(200).send(file.buffer);
    }
    catch (error) {
        handleError(error, res, "No fue posible recuperar el archivo adjunto.");
    }
};
/* =========================================================
   APROBAR
========================================================= */
export const aprobarController = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(req);
    const idFactura = getPositiveId(req.params.id);
    if (!auth ||
        !idFactura) {
        res.status(!auth
            ? 401
            : 400).json({
            success: false,
            message: !auth
                ? "Sesión no válida."
                : "Factura inválida.",
        });
        return;
    }
    try {
        await aprobarFactura(idFactura, auth.areaId, getObservacion(req), getIp(req), getUserAgent(req));
        res.status(200).json({
            success: true,
            message: "Factura aprobada correctamente.",
        });
    }
    catch (error) {
        handleError(error, res, "No fue posible aprobar la factura.");
    }
};
/* =========================================================
   RECHAZAR
   RECEPCION utiliza este mismo controlador; el area siempre viene del JWT.
   Nunca se usa motivo ni una ruta DELETE para rechazar facturas.
========================================================= */
export const rechazarController = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(req);
    const idFactura = getPositiveId(req.params.id);
    if (!auth ||
        !idFactura) {
        res.status(!auth
            ? 401
            : 400).json({
            success: false,
            message: !auth
                ? "Sesión no válida."
                : "Factura inválida.",
        });
        return;
    }
    try {
        await rechazarFactura(idFactura, auth.areaId, getObservacion(req), getIp(req), getUserAgent(req));
        res.status(200).json({
            success: true,
            message: "Factura rechazada correctamente.",
        });
    }
    catch (error) {
        handleError(error, res, "No fue posible rechazar la factura.");
    }
};
/* =========================================================
   REACTIVAR
   La ruta ya restringe esta accion a SISTEMAS. PostgreSQL
   vuelve a validarlo y solo permite RECHAZADA -> PENDIENTE.
========================================================= */
export const reactivarController = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(req);
    const idFactura = getPositiveId(req.params.id);
    if (!auth ||
        !idFactura) {
        res.status(!auth
            ? 401
            : 400).json({
            success: false,
            message: !auth
                ? "Sesión no válida."
                : "Factura inválida.",
        });
        return;
    }
    try {
        await reactivarFactura(idFactura, auth.areaId, getObservacion(req), getIp(req), getUserAgent(req));
        res.status(200).json({
            success: true,
            message: "Factura reactivada correctamente.",
        });
    }
    catch (error) {
        handleError(error, res, "No fue posible reactivar la factura.");
    }
};
/* =========================================================
   REMITIR
========================================================= */
export const remitirController = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(req);
    const idFactura = getPositiveId(req.params.id);
    if (!auth ||
        !idFactura) {
        res.status(!auth
            ? 401
            : 400).json({
            success: false,
            message: !auth
                ? "Sesión no válida."
                : "Factura inválida.",
        });
        return;
    }
    const idAreaDestino = Number(req.body
        ?.idAreaDestino);
    if (!Number.isInteger(idAreaDestino) ||
        idAreaDestino <=
            0) {
        res.status(400).json({
            success: false,
            message: "Debes seleccionar un área destino.",
        });
        return;
    }
    try {
        await remitirFactura(idFactura, auth.areaId, {
            idAreaDestino,
            observacion: getObservacion(req),
        }, getIp(req), getUserAgent(req));
        res.status(200).json({
            success: true,
            message: "Factura remitida correctamente.",
        });
    }
    catch (error) {
        handleError(error, res, "No fue posible remitir la factura.");
    }
};
/* =========================================================
   REMITIR A CONTABILIDAD
   El área destino NO viene desde React.
   El backend busca directamente CONTABILIDAD.
   Esto evita manipulación del destino desde el navegador.
========================================================= */
export const remitirContabilidadController = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(req);
    const idFactura = getPositiveId(req.params.id);
    if (!auth ||
        !idFactura) {
        res.status(!auth
            ? 401
            : 400).json({
            success: false,
            message: !auth
                ? "Sesión no válida."
                : "Factura inválida.",
        });
        return;
    }
    try {
        await remitirFacturaContabilidad(idFactura, auth.areaId, getObservacion(req), getIp(req), getUserAgent(req));
        res.status(200).json({
            success: true,
            message: "Factura remitida a CONTABILIDAD correctamente.",
        });
    }
    catch (error) {
        handleError(error, res, "No fue posible remitir la factura a CONTABILIDAD.");
    }
};
export const asignarProveedorController = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(req), idFactura = getPositiveId(req.params.id);
    if (!auth || !idFactura) {
        res.status(!auth ? 401 : 400).json({ success: false, message: 'Sesion o registro no valido.' });
        return;
    }
    try {
        const idProveedor = req.body?.idProveedor == null ? null : positiveId(req.body.idProveedor);
        if (req.body?.idProveedor != null && !idProveedor)
            throw new FacturasError('Proveedor no valido.');
        const nuevo = req.body?.nuevoProveedor == null ? null : parseProveedorInput(req.body.nuevoProveedor);
        const data = await asignarProveedorFactura(idFactura, auth.areaId, {
            idProveedor,
            nuevoProveedor: nuevo ? { ...nuevo, nit: nuevo.nit ?? null, correos: nuevo.correos ?? [] } : null,
        }, getIp(req), getUserAgent(req));
        res.status(200).json({ success: true,
            message: `Proveedor ${data.creado ? 'registrado' : 'asociado'}. ${data.facturasActualizadas} registro(s) actualizado(s), ${data.facturasTransferidas} transferido(s).`,
            data });
    }
    catch (error) {
        handleError(error, res, 'No fue posible asociar el proveedor.');
    }
};
/* =========================================================
   PROCESAR
========================================================= */
export const procesarController = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(req);
    const idFactura = getPositiveId(req.params.id);
    if (!auth ||
        !idFactura) {
        res.status(!auth
            ? 401
            : 400).json({
            success: false,
            message: !auth
                ? "Sesión no válida."
                : "Factura inválida.",
        });
        return;
    }
    try {
        await procesarFactura(idFactura, auth.areaId, getObservacion(req), getIp(req), getUserAgent(req));
        res.status(200).json({
            success: true,
            message: "Factura procesada correctamente.",
        });
    }
    catch (error) {
        handleError(error, res, "No fue posible procesar la factura.");
    }
};
/* =========================================================
   HISTORIAL
========================================================= */
export const historialController = async (req: Request, res: Response): Promise<void> => {
    const auth = getAuth(req);
    const idFactura = getPositiveId(req.params.id);
    if (!auth ||
        !idFactura) {
        res.status(!auth
            ? 401
            : 400).json({
            success: false,
            message: !auth
                ? "Sesión no válida."
                : "Factura inválida.",
        });
        return;
    }
    try {
        const data = await getHistorialFactura(idFactura, auth.areaId);
        res.status(200).json({
            success: true,
            data,
        });
    }
    catch (error) {
        handleError(error, res, "No fue posible consultar el historial.");
    }
};
