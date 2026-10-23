/** Reglas compartidas por Outlook y la reclasificacion de registros existentes. */
export interface ProveedorConfig {
    idProveedor: number;
    proveedor: string;
    nit: string | null;
    idArea: number;
    area: string;
    correos: {
        id: number;
        correo: string;
    }[];
}
export interface StructuredInvoiceSubject {
    nit: string;
    proveedor: string;
    numeroDocumento: string;
    codigoDocumento: string;
    proveedorRepetido: string;
}
export type TipoCoincidencia = 'NOMBRE_ASUNTO_EXACTO' | 'CORREO_EXACTO';
export interface ProviderMatch {
    proveedor: ProveedorConfig;
    idCorreo: number | null;
    tipo: TipoCoincidencia;
}
export interface ResolucionProveedor {
    match: ProviderMatch | null;
    ambiguo: boolean;
}
export const normalizeEmail = (value: string | null | undefined): string => (value ?? '').trim().toLowerCase();
export const isValidEmail = (value: string): boolean => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export const normalizeProviderNameExact = (value: string): string => value.trim().replace(/\s+/g, ' ').toUpperCase();
export const parseStructuredInvoiceSubject = (subject: string | null | undefined): StructuredInvoiceSubject | null => {
    const parts = (subject ?? '').trim().split(';').map(part => part.trim());
    if (parts.length < 3 || !parts[1] || !parts[2])
        return null;
    return {
        nit: parts[0] ?? '', proveedor: parts[1], numeroDocumento: parts[2],
        codigoDocumento: parts[3] ?? '', proveedorRepetido: parts[4] ?? '',
    };
};
export const providerEmails = (p: ProveedorConfig): string[] => {
    const emails = p.correos.map(c => normalizeEmail(c.correo));
    // Compatibilidad con proveedores antiguos cuyo nombre es el propio correo.
    const nameEmail = normalizeEmail(p.proveedor);
    if (isValidEmail(nameEmail))
        emails.push(nameEmail);
    return [...new Set(emails.filter(Boolean))];
};
export const resolverProveedor = (asunto: string | null | undefined, correoOrigen: string | null | undefined, proveedores: readonly ProveedorConfig[]): ResolucionProveedor => {
    const parsed = parseStructuredInvoiceSubject(asunto);
    const email = normalizeEmail(correoOrigen);
    // El asunto estructurado sigue teniendo prioridad. No asignar facturas de
    // multiples empresas al operador de facturacion que comparte el remitente.
    const candidates = parsed
        ? proveedores.filter(p => normalizeProviderNameExact(p.proveedor) ===
            normalizeProviderNameExact(parsed.proveedor))
        : email ? proveedores.filter(p => providerEmails(p).includes(email)) : [];
    if (candidates.length !== 1)
        return { match: null, ambiguo: candidates.length > 1 };
    const proveedor = candidates[0]!;
    const idCorreo = proveedor.correos.find(c => normalizeEmail(c.correo) === email)?.id ?? null;
    return { match: { proveedor, idCorreo,
            tipo: parsed ? 'NOMBRE_ASUNTO_EXACTO' : 'CORREO_EXACTO' }, ambiguo: false };
};
/** Resuelve primero evidencia actual; una asociacion guardada es el respaldo. */
export const perteneceAlProveedor = (factura: {
    id: number | string;
    id_proveedor: number | string | null;
    asunto: string | null;
    correo_origen: string | null;
}, proveedorId: number, proveedores: readonly ProveedorConfig[], idSeleccionada?: number): {
    coincide: boolean;
    metodo: string;
    ambiguo: boolean;
} => {
    if (Number(factura.id) === idSeleccionada) {
        return { coincide: true, metodo: 'SELECCION_EXPLICITA', ambiguo: false };
    }
    const resolved = resolverProveedor(factura.asunto, factura.correo_origen, proveedores);
    if (resolved.ambiguo)
        return { coincide: false, metodo: 'AMBIGUO', ambiguo: true };
    if (resolved.match)
        return { coincide: resolved.match.proveedor.idProveedor === proveedorId,
            metodo: resolved.match.tipo, ambiguo: false };
    return { coincide: Number(factura.id_proveedor) === proveedorId,
        metodo: 'PROVEEDOR_YA_ASIGNADO', ambiguo: false };
};
