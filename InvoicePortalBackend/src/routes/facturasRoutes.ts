import { Router } from 'express';
import { aprobarController, areasFacturasController, asignarProveedorController, descargarAdjuntoFacturaController, detalleFacturaController, detalleOutlookFacturaController, historialController, listarFacturasController, procesarController, proveedoresFacturasController, reactivarController, rechazadasController, rechazarController, remitirContabilidadController, remitirController, remitidasController, } from '../controllers/facturasController';
import { requireAuth } from '../middlewares/authMiddleware';
import { requireArea } from '../middlewares/areaAccessMiddleware';
import { buscarRevisionController, detalleRevisionController, corregirRevisionController } from '../controllers/revisionFacturasController';
const router = Router();
router.use(requireAuth);
// Administracion: rutas fijas y permiso real en backend, no solo menu oculto.
router.get('/sistemas/revision', requireArea('SISTEMAS'), buscarRevisionController);
router.get('/sistemas/revision/:id', requireArea('SISTEMAS'), detalleRevisionController);
router.patch('/sistemas/revision/:id/asignacion', requireArea('SISTEMAS'), corregirRevisionController);
// Rutas fijas antes del parametro /:id.
router.get('/panel/remitidas', remitidasController);
router.get('/panel/rechazadas', rechazadasController);
router.get('/catalogos/areas', areasFacturasController);
router.get('/catalogos/proveedores', proveedoresFacturasController);
router.get('/', listarFacturasController);
router.get('/:id/correo-outlook', detalleOutlookFacturaController);
router.get('/:id/adjuntos/:attachmentId/download', descargarAdjuntoFacturaController);
router.get('/:id/historial', historialController);
// El servicio valida RECEPCION consultando el area del JWT en PostgreSQL.
router.post('/:id/asignar-proveedor', asignarProveedorController);
router.post('/:id/aprobar', aprobarController);
// Todas las areas, incluida RECEPCION: mismo rechazo, mismas validaciones.
router.post('/:id/rechazar', rechazarController);
router.post('/:id/reactivar', requireArea('SISTEMAS'), reactivarController);
router.post('/:id/remitir', remitirController);
router.post('/:id/remitir-contabilidad', remitirContabilidadController);
router.post('/:id/procesar', requireArea('CONTABILIDAD'), procesarController);
// No se expone DELETE /:id: rechazar nunca elimina ni desactiva una factura.
router.get('/:id', detalleFacturaController);
export default router;
