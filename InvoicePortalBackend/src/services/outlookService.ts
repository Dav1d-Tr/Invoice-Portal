import { getProveedorConfigs, lockClasificacion, reclasificarPendientesProveedor, ClasificacionError } from './clasificacionProveedorService';
import type { ResultadoClasificacion } from './clasificacionProveedorService';
import { resolverProveedor, normalizeProviderNameExact, parseStructuredInvoiceSubject } from '../utils/proveedorMatch';
import type { ProveedorConfig, ProviderMatch } from '../utils/proveedorMatch';
import type { PoolClient, QueryResultRow, } from "pg";
import pool, { query, } from "../config/database";
import { env, } from "../config/env";
import { extractInvoiceMetadata, } from "./invoiceMetadataService";
import type { ExtractedInvoiceMetadata, } from "./invoiceMetadataService";
import type { GraphAttachment, GraphAttachmentsResponse, GraphMessage, GraphMessagesResponse, OutlookAttachmentDetail, OutlookAttachmentDownload, OutlookDocumentLink, OutlookMessageDetail, } from "../types/outlook.types";
/* =========================================================
   MICROSOFT TOKEN
========================================================= */
interface MicrosoftTokenResponse {
    access_token?: string;
    error?: string;
    error_description?: string;
}
interface GraphErrorResponse {
    error?: {
        code?: string;
        message?: string;
    };
}
interface AreaRecepcionRow extends QueryResultRow {
    id: number | string;
    nombre: string;
}
interface IdRow extends QueryResultRow {
    id: number | string;
}
interface LatestInvoiceDateRow extends QueryResultRow {
    ultima_fecha: string | Date | null;
}
export interface OutlookMailboxSyncResult {
    mensajesRevisados: number;
    candidatosFactura: number;
    facturasCreadas: number;
    reconocidas: number;
    enviadasRecepcion: number;
    duplicadas: number;
    errores: number;
    desde: string;
    coincidenciasPorCorreo: number;
    coincidenciasPorNombre: number;
    erroresMetadatos: number;
}
export interface OutlookSyncResult {
    proveedorId: number;
    proveedor: string;
    area: string;
    nit: string | null;
    correosConfigurados: number;
    mensajesRevisados: number;
    coincidencias: number;
    coincidenciasPorNombre: number;
    coincidenciasPorCorreo: number;
    facturasCreadas: number;
    duplicadas: number;
    enviadasRecepcion: number;
    facturasReclasificadas: number;
    facturasTransferidas: number;
    clasificacion: ResultadoClasificacion;
    outlook: OutlookMailboxSyncResult | null;
    outlookSincronizado: boolean;
    warning: string | null;
}
type MetadataRegistro = Partial<Pick<ExtractedInvoiceMetadata, 'tipoDocumento' | 'numeroDocumento' | 'proveedorSugerido' | 'nit' | 'valorTotal' | 'moneda'>>;
/* =========================================================
   CONFIG
========================================================= */
const validateConfig = (): void => {
    const missing: string[] = [];
    if (!env.outlook
        .tenantId) {
        missing.push("OUTLOOK_TENANT_ID");
    }
    if (!env.outlook
        .clientId) {
        missing.push("OUTLOOK_CLIENT_ID");
    }
    if (!env.outlook
        .clientSecret) {
        missing.push("OUTLOOK_CLIENT_SECRET");
    }
    if (!env.outlook
        .mailbox) {
        missing.push("OUTLOOK_MAILBOX");
    }
    if (missing.length >
        0) {
        throw new Error(`Falta configurar Outlook: ${missing.join(", ")}`);
    }
};
/* =========================================================
   FECHA MINIMA CONFIGURADA
========================================================= */
const OUTLOOK_MIN_START_DATE = new Date("2026-09-01T00:00:00-05:00");
const getConfiguredStartDate = (): Date => {
    /*
      Regla de negocio SGAF:
      nunca consultar Outlook antes del
      1 de septiembre de 2026, 00:00 Colombia.
    */
    if (env.outlook
        .syncFromDate) {
        const configuredDate = new Date(env.outlook
            .syncFromDate);
        if (Number.isNaN(configuredDate.getTime())) {
            throw new Error("OUTLOOK_SYNC_FROM_DATE no es válida.");
        }
        /*
          Si por error configuran una fecha anterior,
          conservamos el mínimo oficial.
        */
        return configuredDate >
            OUTLOOK_MIN_START_DATE
            ? configuredDate
            : OUTLOOK_MIN_START_DATE;
    }
    return OUTLOOK_MIN_START_DATE;
};
/* =========================================================
   FECHA PARA SINCRONIZACION RECIENTE

   - FULL = fecha configurada.
   - BACKGROUND = últimos 7 días como mínimo.
   - Si ya hay facturas, vuelve 2 días desde la última fecha
     para tolerar retrasos, movimientos y cambios de carpeta.
========================================================= */
const getSyncStartDate = async (full: boolean): Promise<string> => {
    const configured = getConfiguredStartDate();
    if (full) {
        return configured
            .toISOString();
    }
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() -
        7 *
            24 *
            60 *
            60 *
            1000);
    let recentStart = sevenDaysAgo;
    const latest = await query<LatestInvoiceDateRow>(`
          SELECT
            MAX(
              fecha_recepcion
            )
              AS ultima_fecha

          FROM
            public.facturas

          WHERE
            origen =
              'OUTLOOK'
        `);
    const latestValue = latest.rows[0]
        ?.ultima_fecha;
    if (latestValue) {
        const latestDate = new Date(latestValue);
        if (!Number.isNaN(latestDate.getTime())) {
            const twoDaysBeforeLatest = new Date(latestDate
                .getTime() -
                2 *
                    24 *
                    60 *
                    60 *
                    1000);
            if (twoDaysBeforeLatest >
                recentStart) {
                recentStart =
                    twoDaysBeforeLatest;
            }
        }
    }
    /*
      Nunca sincronizamos antes de la fecha configurada.
    */
    const start = recentStart >
        configured
        ? recentStart
        : configured;
    return start
        .toISOString();
};
/* =========================================================
   TOKEN
========================================================= */
const getAccessToken = async (): Promise<string> => {
    validateConfig();
    const body = new URLSearchParams();
    body.set("client_id", env.outlook
        .clientId);
    body.set("client_secret", env.outlook
        .clientSecret);
    body.set("scope", "https://graph.microsoft.com/.default");
    body.set("grant_type", "client_credentials");
    const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(env.outlook
        .tenantId)}/oauth2/v2.0/token`, {
        method: "POST",
        signal: AbortSignal.timeout(30000),
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
    });
    const result = (await response
        .json()) as MicrosoftTokenResponse;
    if (!response.ok ||
        !result
            .access_token) {
        throw new Error(result
            .error_description ??
            "No fue posible autenticar SGAF contra Microsoft.");
    }
    return result
        .access_token;
};
/* =========================================================
   NORMALIZAR TEXTO
========================================================= */
const normalizeText = (value: string): string => {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Za-z0-9@._\-\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toUpperCase();
};
const decodeHtmlEntities = (value: string): string => {
    return value
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'");
};
const htmlToText = (html: string): string => {
    return decodeHtmlEntities(html
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<\/div>/gi, "\n")
        .replace(/<\/tr>/gi, "\n")
        .replace(/<\/td>/gi, " ")
        .replace(/<[^>]+>/g, " "))
        .replace(/\r/g, "")
        .replace(/[ \t]+/g, " ")
        .replace(/\n\s+/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
};
const escapeRegExp = (value: string): string => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};
const escapeODataString = (value: string): string => {
    return value.replace(/'/g, "''");
};
const getAllProveedorConfigs = async (): Promise<ProveedorConfig[]> => {
    const client = await pool.connect();
    try {
        return await getProveedorConfigs(client);
    }
    finally {
        client.release();
    }
};
const getProveedorConfig = async (idProveedor: number): Promise<ProveedorConfig> => {
    const proveedores = await getAllProveedorConfigs();
    const proveedor = proveedores.find((item) => item.idProveedor ===
        idProveedor);
    if (!proveedor) {
        throw new Error("Proveedor no encontrado o inactivo.");
    }
    return proveedor;
};
const getRecepcionArea = async (): Promise<{
    id: number;
    nombre: string;
}> => {
    const result = await query<AreaRecepcionRow>(`
          SELECT
            id,
            nombre

          FROM
            public.areas

          WHERE
            activo =
              TRUE

            AND
            (
              nombre_normalizado =
                'RECEPCION'

              OR

              UPPER(
                BTRIM(nombre)
              )
                IN
                (
                  'RECEPCION',
                  'RECEPCIÓN'
                )
            )

          ORDER BY
            id ASC

          LIMIT 1
        `);
    const area = result.rows[0];
    if (!area) {
        throw new Error("No existe el área activa RECEPCIÓN. Créala desde Administración de usuarios para recibir facturas de proveedores no identificados.");
    }
    return {
        id: Number(area.id),
        nombre: area.nombre,
    };
};
/* =========================================================
   MENSAJE
========================================================= */
const mailboxPath = (): string => {
    return encodeURIComponent(env.outlook
        .mailbox);
};
const getSenderEmail = (message: GraphMessage): string => {
    return (message.from
        ?.emailAddress
        ?.address ??
        message.sender
            ?.emailAddress
            ?.address ??
        "")
        .trim()
        .toLowerCase();
};
const getSenderName = (message: GraphMessage): string => {
    return (message.from
        ?.emailAddress
        ?.name ??
        message.sender
            ?.emailAddress
            ?.name ??
        "")
        .trim();
};
/* =========================================================
   CANDIDATO A FACTURA / NOTA CREDITO
========================================================= */
const isInvoiceMessage = (message: GraphMessage, attachmentNames: string[] = [], extraText = ""): boolean => {
    /*
      Todos los correos con la estructura corporativa
      NIT;PROVEEDOR;DOCUMENTO;TIPO;PROVEEDOR;
      se inspeccionan como candidatos a factura.
    */
    if (parseStructuredInvoiceSubject(message.subject)) {
        return true;
    }
    const text = normalizeText([
        message.subject ??
            "",
        message.bodyPreview ??
            "",
        extraText,
        attachmentNames.join(" "),
    ].join(" "));
    const keywords = [
        "FACTURA",
        "FACTURACION",
        "VENCIMIENTO", "AVISO DE PAGO", "AVISO DE COBRO", "RECORDATORIO DE PAGO", "ESTADO DE CUENTA", "CARTERA", "COBRANZA",
        "FACTURA ELECTRONICA",
        "NOTA CREDITO",
        "NOTA DE CREDITO",
        "CREDIT NOTE",
        "INVOICE",
        "CUFE",
        "CUDE",
        "DOCUMENTO ELECTRONICO",
        "DIAN",
    ];
    if (keywords.some((keyword) => text.includes(keyword))) {
        return true;
    }
    if (!message
        .hasAttachments) {
        return false;
    }
    /*
      En la primera pasada todavía no conocemos el nombre
      de los adjuntos. Si Graph dice que hay adjuntos,
      inspeccionamos el correo una sola vez.
    */
    if (attachmentNames.length ===
        0) {
        return true;
    }
    return attachmentNames.some((name) => /\.(pdf|xml|zip)$/i.test(name));
};
const normalizeDocumentNumber = (value: string | null | undefined): string => {
    return (value ??
        "")
        .trim()
        .replace(/\s+/g, "")
        .toUpperCase();
};
const normalizeNitKey = (value: string | null | undefined): string => {
    return (value ??
        "")
        .replace(/\D/g, "")
        .trim();
};
const findProviderMatch = (message: GraphMessage, proveedores: ProveedorConfig[]): ProviderMatch | null => resolverProveedor(message.subject, getSenderEmail(message), proveedores).match;
/* =========================================================
   GRAPH MESSAGE
========================================================= */
const getMessageById = async (token: string, messageId: string): Promise<GraphMessage | null> => {
    const url = new URL(`https://graph.microsoft.com/v1.0/users/${mailboxPath()}/messages/${encodeURIComponent(messageId)}`);
    url.searchParams.set("$select", [
        "id",
        "subject",
        "from",
        "sender",
        "toRecipients",
        "ccRecipients",
        "receivedDateTime",
        "sentDateTime",
        "hasAttachments",
        "body",
        "bodyPreview",
        "webLink",
        "internetMessageId",
    ].join(","));
    const response = await graphFetch(url.toString(), {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            Prefer: 'IdType="ImmutableId", outlook.body-content-type="html"',
        },
    });
    if (response.status ===
        404) {
        return null;
    }
    const result = (await response
        .json()) as GraphMessage & GraphErrorResponse;
    if (!response.ok) {
        throw new Error(result.error
            ?.message ??
            "No fue posible obtener el mensaje de Outlook.");
    }
    return result;
};
const findMessageIdByInternetMessageId = async (token: string, internetMessageId: string | null | undefined): Promise<string | null> => {
    const clean = internetMessageId
        ?.trim();
    if (!clean) {
        return null;
    }
    const url = new URL(`https://graph.microsoft.com/v1.0/users/${mailboxPath()}/messages`);
    url.searchParams.set("$select", "id,internetMessageId");
    url.searchParams.set("$filter", `internetMessageId eq '${escapeODataString(clean)}'`);
    url.searchParams.set("$top", "1");
    const response = await graphFetch(url.toString(), {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            Prefer: 'IdType="ImmutableId"',
        },
    });
    const result = (await response
        .json()) as GraphMessagesResponse;
    if (!response.ok) {
        return null;
    }
    return result
        .value?.[0]
        ?.id ??
        null;
};
const resolveMessage = async (token: string, messageId: string, internetMessageId?: string | null): Promise<GraphMessage> => {
    const direct = await getMessageById(token, messageId);
    if (direct) {
        return direct;
    }
    const recoveredId = await findMessageIdByInternetMessageId(token, internetMessageId);
    if (recoveredId) {
        const recovered = await getMessageById(token, recoveredId);
        if (recovered) {
            return recovered;
        }
    }
    throw new Error("El correo ya no está disponible en el buzón de Outlook.");
};
/* =========================================================
   ADJUNTOS
========================================================= */
const getMessageAttachments = async (token: string, messageId: string): Promise<GraphAttachment[]> => {
    const first = new URL(`https://graph.microsoft.com/v1.0/users/${mailboxPath()}/messages/${encodeURIComponent(messageId)}/attachments`);
    /*
      IMPORTANTE:

      contentId NO se solicita aquí porque este endpoint
      devuelve microsoft.graph.attachment como tipo base.

      contentId pertenece específicamente a fileAttachment
      y Microsoft Graph falla si intentamos seleccionarlo
      desde la colección general.
    */
    first.searchParams.set("$select", [
        "id",
        "name",
        "contentType",
        "size",
        "isInline",
        "lastModifiedDateTime",
    ].join(","));
    first.searchParams.set("$top", "100");
    let nextUrl: string | undefined = first.toString();
    const attachments: GraphAttachment[] = [];
    while (nextUrl) {
        const response = await graphFetch(nextUrl, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
                Prefer: 'IdType="ImmutableId"',
            },
        });
        const result = (await response.json()) as GraphAttachmentsResponse;
        if (!response.ok) {
            throw new Error(result.error
                ?.message ??
                "No fue posible consultar los adjuntos de Outlook.");
        }
        attachments.push(...(result.value ??
            []));
        nextUrl =
            result["@odata.nextLink"];
    }
    return attachments;
};
const getAttachmentBuffer = async (token: string, messageId: string, attachmentId: string): Promise<Buffer> => {
    const url = `https://graph.microsoft.com/v1.0/users/${mailboxPath()}` +
        `/messages/${encodeURIComponent(messageId)}` +
        `/attachments/${encodeURIComponent(attachmentId)}/$value`;
    const response = await graphFetch(url, {
        headers: {
            Authorization: `Bearer ${token}`,
            Prefer: 'IdType="ImmutableId"',
        },
    });
    if (!response.ok) {
        let message = "No fue posible descargar el adjunto de Outlook.";
        try {
            const result = (await response
                .json()) as GraphErrorResponse;
            message =
                result.error
                    ?.message ??
                    message;
        }
        catch {
            // $value puede devolver binario o vacío.
        }
        throw new Error(message);
    }
    const arrayBuffer = await response
        .arrayBuffer();
    return Buffer.from(arrayBuffer);
};
const resolveInlineImages = async (token: string, messageId: string, bodyHtml: string, attachments: GraphAttachment[]): Promise<string> => {
    let html = bodyHtml;
    const inlineImages = attachments.filter((attachment) => Boolean(attachment
        .isInline) &&
        Boolean(attachment
            .contentId) &&
        (attachment["@odata.type"] ??
            "").includes("fileAttachment"));
    for (const attachment of inlineImages) {
        try {
            const buffer = await getAttachmentBuffer(token, messageId, attachment.id);
            const mime = attachment
                .contentType ??
                "application/octet-stream";
            const dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
            const contentId = attachment
                .contentId!
                .replace(/^<|>$/g, "");
            html =
                html.replace(new RegExp(`cid:${escapeRegExp(contentId)}`, "gi"), dataUrl);
        }
        catch (error) {
            console.warn("No fue posible resolver una imagen inline:", attachment.name, error);
        }
    }
    return html;
};
/* =========================================================
   LINKS DEL DOCUMENTO EN EL HTML

   Esto permite mostrar "Ver factura" cuando el proveedor no
   adjunta PDF y solo envía un enlace (por ejemplo SIIGO).
========================================================= */
const extractDocumentLinks = (html: string): OutlookDocumentLink[] => {
    const result: OutlookDocumentLink[] = [];
    const seen = new Set<string>();
    const expression = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;
    while ((match =
        expression.exec(html)) !==
        null) {
        const href = decodeHtmlEntities(match[1] ??
            "")
            .trim();
        if (!/^https?:\/\//i.test(href)) {
            continue;
        }
        let valid = false;
        try {
            const parsed = new URL(href);
            valid =
                parsed.protocol ===
                    "https:" ||
                    parsed.protocol ===
                        "http:";
        }
        catch {
            valid =
                false;
        }
        if (!valid) {
            continue;
        }
        const label = htmlToText(match[2] ??
            "")
            .trim();
        const searchable = normalizeText(`${label} ${href}`);
        const looksDocumentRelated = [
            "FACTURA",
            "DOCUMENTO",
            "DESCARG",
            "VER FACTURA",
            "INVOICE",
            "PDF",
            "SIIGO",
        ].some((keyword) => searchable.includes(keyword));
        if (!looksDocumentRelated ||
            seen.has(href)) {
            continue;
        }
        seen.add(href);
        result.push({
            url: href,
            label: label ||
                "Abrir documento",
        });
        if (result.length >=
            10) {
            break;
        }
    }
    return result;
};
/* =========================================================
   DETALLE INTERNO
========================================================= */
const getMessageDetailWithToken = async (token: string, messageId: string, internetMessageId?: string | null): Promise<OutlookMessageDetail> => {
    const message = await resolveMessage(token, messageId, internetMessageId);
    let attachments: GraphAttachment[] = [];
    try {
        attachments =
            await getMessageAttachments(token, message.id);
    }
    catch (error) {
        console.warn("No fue posible consultar los adjuntos:", error);
    }
    const contentType = message.body
        ?.contentType
        ?.toLowerCase();
    const originalContent = message.body
        ?.content ??
        "";
    const originalHtml = contentType ===
        "html"
        ? originalContent
        : "";
    const bodyHtml = originalHtml
        ? await resolveInlineImages(token, message.id, originalHtml, attachments)
        : "";
    const bodyText = originalHtml
        ? htmlToText(originalHtml)
        : originalContent ||
            message.bodyPreview ||
            "";
    const visibleAttachments: OutlookAttachmentDetail[] = attachments
        .filter((attachment) => !attachment
        .isInline)
        .map((attachment) => ({
        id: attachment.id,
        name: attachment.name ??
            "Adjunto",
        contentType: attachment
            .contentType ??
            "application/octet-stream",
        size: Number(attachment
            .size ??
            0),
        isInline: Boolean(attachment
            .isInline),
        contentId: attachment
            .contentId ??
            null,
        type: attachment["@odata.type"] ??
            "",
    }));
    const mapRecipient = (value: GraphMessage["toRecipients"]): string[] => {
        return (value ??
            [])
            .map((recipient) => recipient
            .emailAddress
            ?.address ??
            "")
            .filter(Boolean);
    };
    return {
        id: message.id,
        subject: message.subject ??
            "",
        fromName: message.from
            ?.emailAddress
            ?.name ??
            message.sender
                ?.emailAddress
                ?.name ??
            "",
        fromEmail: getSenderEmail(message),
        to: mapRecipient(message.toRecipients),
        cc: mapRecipient(message.ccRecipients),
        receivedDateTime: message
            .receivedDateTime ??
            null,
        sentDateTime: message
            .sentDateTime ??
            null,
        bodyHtml,
        bodyText,
        bodyPreview: message
            .bodyPreview ??
            "",
        hasAttachments: visibleAttachments
            .length >
            0 ||
            Boolean(message
                .hasAttachments),
        attachments: visibleAttachments,
        documentLinks: extractDocumentLinks(originalHtml),
        webLink: message
            .webLink ??
            null,
        internetMessageId: message
            .internetMessageId ??
            null,
    };
};
/* =========================================================
   XML PARA METADATOS
========================================================= */
const getXmlContentsForMetadata = async (token: string, messageId: string, attachments: OutlookAttachmentDetail[]): Promise<string[]> => {
    const xmls: string[] = [];
    const candidates = attachments.filter((attachment) => (/\.xml$/i.test(attachment.name) ||
        attachment
            .contentType
            .toLowerCase()
            .includes("xml")) &&
        attachment.size <=
            3000000);
    for (const attachment of candidates) {
        try {
            const buffer = await getAttachmentBuffer(token, messageId, attachment.id);
            xmls.push(buffer.toString("utf8"));
        }
        catch (error) {
            console.warn("No fue posible leer un XML para extracción de metadatos:", attachment.name, error);
        }
    }
    return xmls;
};
const extractMetadataForDetail = async (token: string, detail: OutlookMessageDetail): Promise<ExtractedInvoiceMetadata> => {
    const xmlContents = await getXmlContentsForMetadata(token, detail.id, detail.attachments);
    return extractInvoiceMetadata({
        subject: detail.subject,
        bodyText: detail.bodyText,
        bodyHtml: detail.bodyHtml,
        xmlContents,
        attachmentNames: detail.attachments
            .map((attachment) => attachment.name),
    });
};
/* =========================================================
   DUPLICADO
========================================================= */
const messageAlreadyRegistered = async (message: GraphMessage): Promise<boolean> => {
    const result = await query<IdRow>(`
          SELECT
            id

          FROM
            public.facturas

          WHERE
            outlook_message_id =
              $1

            OR
            (
              $2::text
                IS NOT NULL

              AND internet_message_id =
                  $2
            )

          LIMIT 1
        `, [
        message.id,
        message
            .internetMessageId ??
            null,
    ]);
    return Boolean(result.rows[0]);
};
/** Un aviso puede mencionar una factura; no por ello es el mismo documento. */
const esAvisoAdministrativo = (subject: string | null | undefined): boolean => {
    if (parseStructuredInvoiceSubject(subject))
        return false;
    return /\b(AVISO|VENCIMIENTO|PAGO|PAGOS|COBRO|COBRANZA|CARTERA|RECORDATORIO)\b|ESTADO DE CUENTA/
        .test(normalizeText(subject ?? ''));
};
const documentAlreadyRegistered = async (message: GraphMessage, metadata: MetadataRegistro, client?: PoolClient): Promise<boolean> => {
    if (esAvisoAdministrativo(message.subject))
        return false;
    const parsed = parseStructuredInvoiceSubject(message.subject);
    const numero = normalizeDocumentNumber(parsed?.numeroDocumento ?? metadata.numeroDocumento);
    const proveedor = normalizeProviderNameExact(parsed?.proveedor ?? metadata.proveedorSugerido ?? '');
    const nit = normalizeNitKey(parsed?.nit ?? metadata.nit);
    if (!numero || !proveedor)
        return false;
    const sql = `
    SELECT asunto, numero_factura, proveedor_snapshot, nit_snapshot, tipo_documento
    FROM public.facturas
    WHERE origen = 'OUTLOOK' AND (
      UPPER(REGEXP_REPLACE(BTRIM(COALESCE(numero_factura, '')), '\\s+', '', 'g')) = $1
      OR UPPER(REGEXP_REPLACE(BTRIM(SPLIT_PART(COALESCE(asunto, ''), ';', 3)), '\\s+', '', 'g')) = $1
    )`;
    type Row = {
        asunto: string | null;
        numero_factura: string | null;
        proveedor_snapshot: string | null;
        nit_snapshot: string | null;
        tipo_documento: string | null;
    };
    const result = client ? await client.query<Row>(sql, [numero]) : await query<Row>(sql, [numero]);
    // Se incluyen inactivas. Se preserva la barrera logica para facturas reales
    // y registros antiguos, pero no se colapsa la correspondencia de cartera.
    return result.rows.some(row => {
        if (esAvisoAdministrativo(row.asunto))
            return false;
        const anterior = parseStructuredInvoiceSubject(row.asunto);
        if (parsed?.codigoDocumento && anterior?.codigoDocumento
            && parsed.codigoDocumento !== anterior.codigoDocumento)
            return false;
        if (!parsed && metadata.tipoDocumento && row.tipo_documento
            && metadata.tipoDocumento !== row.tipo_documento)
            return false;
        const nitAnterior = normalizeNitKey(anterior?.nit ?? row.nit_snapshot);
        return normalizeDocumentNumber(anterior?.numeroDocumento ?? row.numero_factura) === numero
            && normalizeProviderNameExact(anterior?.proveedor ?? row.proveedor_snapshot ?? '') === proveedor
            && (!nit || !nitAnterior || nit === nitAnterior);
    });
};
const getLogicalDocumentLockKey = (message: GraphMessage, metadata: MetadataRegistro): string | null => {
    if (esAvisoAdministrativo(message.subject))
        return null;
    const parsed = parseStructuredInvoiceSubject(message.subject);
    const numero = normalizeDocumentNumber(parsed?.numeroDocumento ?? metadata.numeroDocumento);
    const proveedor = normalizeProviderNameExact(parsed?.proveedor ?? metadata.proveedorSugerido ?? '');
    return numero && proveedor ? [proveedor, numero].join('|') : null;
};
/* =========================================================
   REGISTRAR FACTURA NUEVA
========================================================= */
const registerInvoiceMessage = async (message: GraphMessage, detail: OutlookMessageDetail, match: ReturnType<typeof findProviderMatch>, recepcion: {
    id: number;
    nombre: string;
}, metadata: MetadataRegistro, soloProveedorId?: number): Promise<{
    created: boolean;
    recepcion: boolean;
}> => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await lockClasificacion(client);
        // El proveedor pudo registrarse/cambiar mientras Graph respondia.
        match = findProviderMatch(message, await getProveedorConfigs(client));
        if (soloProveedorId != null && match?.proveedor.idProveedor !== soloProveedorId) {
            await client.query('ROLLBACK');
            return { created: false, recepcion: !match };
        }
        if (!match) {
            const area = await client.query<{
                id: number | string;
                nombre: string;
            }>("SELECT id, nombre FROM public.areas WHERE activo = TRUE AND (nombre_normalizado = 'RECEPCION' OR UPPER(nombre) IN ('RECEPCION', 'RECEPCI\u00d3N')) ORDER BY id LIMIT 1");
            if (!area.rows[0])
                throw new Error('No existe el area activa RECEPCION.');
            recepcion = { id: Number(area.rows[0].id), nombre: area.rows[0].nombre };
        }
        /*
          Bloqueo transaccional por documento lógico.
  
          Evita que dos sincronizaciones concurrentes intenten
          insertar la misma factura al mismo tiempo aunque hayan
          llegado en mensajes Outlook distintos.
        */
        const logicalLockKey = getLogicalDocumentLockKey(message, metadata);
        if (logicalLockKey) {
            await client.query(`
            SELECT
              pg_advisory_xact_lock(
                hashtext($1)
              )
          `, [
                logicalLockKey,
            ]);
        }
        const duplicate = await client.query<IdRow>(`
            SELECT
              id

            FROM
              public.facturas

            WHERE
              outlook_message_id =
                $1

              OR
              (
                $2::text
                  IS NOT NULL

                AND internet_message_id =
                    $2
              )

            LIMIT 1

            FOR UPDATE
          `, [
            message.id,
            message
                .internetMessageId ??
                null,
        ]);
        if (duplicate.rows[0]) {
            await client.query("ROLLBACK");
            return {
                created: false,
                recepcion: !match,
            };
        }
        /*
          Segunda barrera anti-duplicado dentro de la misma
          transacción, protegida por advisory lock.
        */
        if (await documentAlreadyRegistered(message, metadata, client)) {
            await client.query("ROLLBACK");
            return {
                created: false,
                recepcion: !match,
            };
        }
        const state = await client.query<IdRow>(`
            SELECT
              id

            FROM
              public.estados_factura

            WHERE
              codigo =
                'PENDIENTE'

            LIMIT 1
          `);
        const idEstado = Number(state.rows[0]
            ?.id);
        if (!Number.isInteger(idEstado)) {
            throw new Error("No existe el estado PENDIENTE.");
        }
        const idProveedor = match
            ?.proveedor
            .idProveedor ??
            null;
        const idProveedorCorreo = match
            ?.idCorreo ??
            null;
        const idArea = match
            ?.proveedor
            .idArea ??
            recepcion.id;
        const area = match
            ?.proveedor
            .area ??
            recepcion.nombre;
        const senderEmail = detail.fromEmail ||
            getSenderEmail(message);
        const senderName = detail.fromName ||
            getSenderName(message);
        const structuredSubject = parseStructuredInvoiceSubject(detail.subject ||
            message.subject);
        const subjectProvider = structuredSubject
            ?.proveedor ??
            null;
        const subjectNit = structuredSubject
            ?.nit ??
            null;
        const subjectDocumentNumber = structuredSubject
            ?.numeroDocumento ??
            null;
        const proveedorSnapshot = match
            ?.proveedor
            .proveedor ??
            subjectProvider ??
            metadata
                .proveedorSugerido ??
            (senderName ||
                senderEmail ||
                "PROVEEDOR PENDIENTE");
        const nit = match?.proveedor.nit || subjectNit || null;
        const numeroDocumento = subjectDocumentNumber ??
            metadata
                .numeroDocumento ??
            null;
        const insert = await client.query<IdRow>(`
            INSERT INTO
              public.facturas
            (
              id_proveedor,
              id_proveedor_correo,
              id_area_origen,
              id_area_actual,
              id_estado,
              proveedor_snapshot,
              nit_snapshot,
              correo_proveedor_snapshot,
              tipo_documento,
              numero_factura,
              valor_total,
              moneda,
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
              $1,
              $2,
              $3,
              $3,
              $4,
              $5,
              $6,
              $7,
              $8,
              $9,
              $10,
              $11,
              'OUTLOOK',
              $12,
              $13,
              $14,
              $15,
              $16,
              $17,
              $18,
              $19
            )

            ON CONFLICT
              DO NOTHING

            RETURNING
              id
          `, [
            idProveedor,
            idProveedorCorreo,
            idArea,
            idEstado,
            proveedorSnapshot,
            nit,
            senderEmail ||
                null,
            metadata.tipoDocumento ?? "FACTURA",
            numeroDocumento,
            metadata
                .valorTotal,
            metadata
                .moneda,
            message.id,
            message
                .internetMessageId ??
                detail
                    .internetMessageId ??
                null,
            detail.subject ||
                message.subject ||
                null,
            senderEmail ||
                null,
            detail
                .receivedDateTime ??
                message
                    .receivedDateTime ??
                null,
            detail
                .attachments
                .length >
                0 ||
                Boolean(message
                    .hasAttachments),
            detail
                .webLink ??
                message
                    .webLink ??
                null,
            detail
                .bodyPreview ||
                message
                    .bodyPreview ||
                null,
        ]);
        const idFactura = Number(insert.rows[0]
            ?.id);
        if (!Number.isInteger(idFactura)) {
            await client.query("ROLLBACK");
            return {
                created: false,
                recepcion: !match,
            };
        }
        await client.query(`
          INSERT INTO
            public.factura_eventos
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
            $1,
            'RECIBIDA_OUTLOOK',
            NULL,
            'SISTEMA',
            NULL,
            NULL,
            $2,
            $3,
            NULL,
            $4,
            $5,
            $6::jsonb
          )
        `, [
            idFactura,
            idArea,
            area,
            idEstado,
            match
                ? "Factura identificada automáticamente desde Outlook."
                : "Factura sin proveedor identificado enviada automáticamente a RECEPCIÓN.",
            JSON.stringify({
                metodo_identificacion: match
                    ?.tipo ??
                    "RECEPCION",
                id_proveedor: idProveedor,
                correo_origen: senderEmail ||
                    null,
                tipo_documento: metadata.tipoDocumento ?? "FACTURA",
                numero_documento: numeroDocumento,
                proveedor_asunto: subjectProvider,
                nit_asunto: subjectNit,
                valor_total: metadata
                    .valorTotal,
                moneda: metadata
                    .moneda,
                outlook_message_id: message.id,
                internet_message_id: message
                    .internetMessageId ??
                    null,
            }),
        ]);
        await client.query("COMMIT");
        return {
            created: true,
            recepcion: !match,
        };
    }
    catch (error) {
        await client.query("ROLLBACK");
        throw error;
    }
    finally {
        client.release();
    }
};
const runMailboxSync = async (full: boolean, soloProveedorId?: number): Promise<OutlookMailboxSyncResult> => {
    validateConfig();
    const [token, proveedores, startDate] = await Promise.all([
        getAccessToken(), getAllProveedorConfigs(), getSyncStartDate(full),
    ]);
    const graphUrl = new URL(`https://graph.microsoft.com/v1.0/users/${mailboxPath()}/messages`);
    graphUrl.searchParams.set('$select', 'id,subject,from,sender,receivedDateTime,hasAttachments,bodyPreview,webLink,internetMessageId');
    graphUrl.searchParams.set('$filter', `receivedDateTime ge ${startDate}`);
    graphUrl.searchParams.set('$orderby', 'receivedDateTime desc');
    graphUrl.searchParams.set('$top', '100');
    let nextUrl: string | undefined = graphUrl.toString();
    const counters: OutlookMailboxSyncResult = {
        mensajesRevisados: 0, candidatosFactura: 0, facturasCreadas: 0,
        reconocidas: 0, enviadasRecepcion: 0, duplicadas: 0, errores: 0,
        desde: startDate, coincidenciasPorCorreo: 0, coincidenciasPorNombre: 0,
        erroresMetadatos: 0,
    };
    while (nextUrl) {
        const response = await graphFetch(nextUrl, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', Prefer: 'IdType="ImmutableId"' },
        });
        const result = await response.json() as GraphMessagesResponse;
        if (!response.ok)
            throw new Error(result.error?.message ?? 'No fue posible consultar Outlook.');
        for (const message of result.value ?? []) {
            counters.mensajesRevisados++;
            try {
                const match = findProviderMatch(message, proveedores);
                // Sincronizar UN proveedor no importa mensajes de los demas.
                if (soloProveedorId != null && match?.proveedor.idProveedor !== soloProveedorId)
                    continue;
                if (match?.tipo === 'CORREO_EXACTO')
                    counters.coincidenciasPorCorreo++;
                if (match?.tipo === 'NOMBRE_ASUNTO_EXACTO')
                    counters.coincidenciasPorNombre++;
                if (await messageAlreadyRegistered(message)) {
                    counters.duplicadas++;
                    continue;
                }
                // Los correos conocidos no necesitan numero, adjuntos, XML ni palabras clave.
                if (!match && !isInvoiceMessage(message))
                    continue;
                const detail = await getMessageDetailWithToken(token, message.id, message.internetMessageId ?? null);
                if (!match && !isInvoiceMessage(message, detail.attachments.map(a => a.name), detail.bodyText))
                    continue;
                counters.candidatosFactura++;
                let metadata: MetadataRegistro = {};
                try {
                    metadata = await extractMetadataForDetail(token, detail);
                }
                catch (error) {
                    counters.erroresMetadatos++;
                    console.warn('Metadatos no disponibles; se conserva el correo para gestion:', message.id, error);
                }
                const recepcion = match
                    ? { id: match.proveedor.idArea, nombre: match.proveedor.area }
                    : await getRecepcionArea();
                const registered = await registerInvoiceMessage(message, detail, match, recepcion, metadata, soloProveedorId);
                if (!registered.created) {
                    counters.duplicadas++;
                    continue;
                }
                counters.facturasCreadas++;
                if (registered.recepcion)
                    counters.enviadasRecepcion++;
                else
                    counters.reconocidas++;
            }
            catch (error) {
                counters.errores++;
                console.error('Error importando mensaje Outlook:', message.id, error);
            }
        }
        // Usar la URL completa que entrega Graph, no reconstruir $skip.
        nextUrl = result['@odata.nextLink'];
    }
    return counters;
};
export const sincronizarBuzonOutlook = (full = false): Promise<OutlookMailboxSyncResult> => enqueueMailboxSync(full);
export const sincronizarProveedorOutlook = async (idProveedor: number, options?: {
    idAreaActor: number;
    consultarOutlook?: boolean;
    ip?: string | null;
    userAgent?: string | null;
}): Promise<OutlookSyncResult> => {
    if (!options?.idAreaActor)
        throw new ClasificacionError('Se requiere el area autenticada de SISTEMAS.', 403);
    // Primero SIEMPRE PostgreSQL. No depende de que Microsoft este disponible.
    const clasificacion = await reclasificarPendientesProveedor({
        idProveedor, idAreaActor: options.idAreaActor, alcance: 'TODAS',
        ip: options.ip, userAgent: options.userAgent,
    });
    const proveedor = await getProveedorConfig(idProveedor);
    let remoto: OutlookMailboxSyncResult | null = null;
    let warning: string | null = null;
    if (options.consultarOutlook !== false) {
        try {
            remoto = await enqueueMailboxSync(true, idProveedor);
            if (remoto.errores || remoto.erroresMetadatos) {
                warning = `La clasificacion local termino. Outlook: ${remoto.errores} error(es) de mensaje y ${remoto.erroresMetadatos} error(es) de metadatos. Revisa el log y vuelve a sincronizar.`;
            }
        }
        catch (error) {
            console.error('Clasificacion local guardada; fallo la consulta a Outlook:', error);
            warning = 'Los pendientes de SGAF fueron reclasificados, pero no se completo la consulta a Outlook. Revisa la conexion y vuelve a sincronizar.';
        }
    }
    return {
        proveedorId: proveedor.idProveedor, proveedor: proveedor.proveedor, area: proveedor.area,
        nit: proveedor.nit, correosConfigurados: proveedor.correos.length,
        mensajesRevisados: remoto?.mensajesRevisados ?? 0,
        coincidencias: clasificacion.coincidencias,
        coincidenciasPorNombre: clasificacion.coincidenciasPorNombre,
        coincidenciasPorCorreo: clasificacion.coincidenciasPorCorreo,
        facturasCreadas: remoto?.facturasCreadas ?? 0,
        duplicadas: remoto?.duplicadas ?? 0,
        enviadasRecepcion: remoto?.enviadasRecepcion ?? 0,
        facturasReclasificadas: clasificacion.facturasActualizadas,
        facturasTransferidas: clasificacion.facturasTransferidas,
        clasificacion, outlook: remoto, outlookSincronizado: remoto !== null,
        warning,
    };
};
/* =========================================================
   DETALLE OUTLOOK
========================================================= */
export const getOutlookMessageDetail = async (messageId: string, internetMessageId?: string | null): Promise<OutlookMessageDetail> => {
    validateConfig();
    if (!messageId ||
        !messageId
            .trim()) {
        throw new Error("La factura no tiene un identificador de Outlook.");
    }
    const token = await getAccessToken();
    return getMessageDetailWithToken(token, messageId, internetMessageId);
};
/* =========================================================
   METADATOS DE UN MENSAJE YA CARGADO
========================================================= */
export const getOutlookInvoiceMetadata = async (detail: OutlookMessageDetail): Promise<ExtractedInvoiceMetadata> => {
    validateConfig();
    const token = await getAccessToken();
    return extractMetadataForDetail(token, detail);
};
/* =========================================================
   DESCARGAR ADJUNTO

   Firma compatible con el proyecto actual:
   (messageId, attachmentId, internetMessageId?)
========================================================= */
export const downloadOutlookAttachment = async (messageId: string, attachmentId: string, internetMessageId?: string | null): Promise<OutlookAttachmentDownload> => {
    validateConfig();
    if (!messageId
        .trim() ||
        !attachmentId
            .trim()) {
        throw new Error("Mensaje o adjunto inválido.");
    }
    const token = await getAccessToken();
    const message = await resolveMessage(token, messageId, internetMessageId);
    const attachments = await getMessageAttachments(token, message.id);
    const attachment = attachments.find((item) => item.id ===
        attachmentId);
    if (!attachment) {
        throw new Error("El adjunto ya no está disponible en Outlook.");
    }
    const type = attachment["@odata.type"] ??
        "";
    if (type &&
        !type.includes("fileAttachment")) {
        throw new Error("Este tipo de adjunto no puede descargarse directamente.");
    }
    const buffer = await getAttachmentBuffer(token, message.id, attachment.id);
    return {
        buffer,
        fileName: attachment.name ??
            "adjunto",
        contentType: attachment
            .contentType ??
            "application/octet-stream",
    };
};
/** Consulta con timeout y reintento acotado de respuestas transitorias. */
const graphFetch = async (url: string, init: RequestInit): Promise<globalThis.Response> => {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'graph.microsoft.com') {
        throw new Error('Graph devolvio una URL de paginacion no permitida.');
    }
    for (let attempt = 0;; attempt++) {
        const response = await fetch(url, { ...init, signal: AbortSignal.timeout(30000) });
        if (![429, 502, 503, 504].includes(response.status) || attempt >= 3)
            return response;
        const retryAfter = response.headers.get('retry-after');
        const seconds = retryAfter == null ? Number.NaN : Number(retryAfter);
        const rawMs = Number.isFinite(seconds) ? seconds * 1000 : retryAfter
            ? Date.parse(retryAfter) - Date.now() : 1000 * 2 ** attempt;
        const delay = Math.max(1000, Number.isFinite(rawMs) ? rawMs : 1000 * 2 ** attempt);
        // No reintentar ANTES del Retry-After si excede nuestro tiempo maximo.
        if (delay > 60000)
            return response;
        await response.arrayBuffer();
        await new Promise<void>(resolve => setTimeout(resolve, delay));
    }
};
let syncTail: Promise<void> = Promise.resolve();
const queuedSyncs = new Map<string, Promise<OutlookMailboxSyncResult>>();
const enqueueMailboxSync = (full: boolean, proveedorId?: number): Promise<OutlookMailboxSyncResult> => {
    const key = `${full ? 'full' : 'recent'}:${proveedorId ?? 'all'}`;
    const existing = queuedSyncs.get(key);
    if (existing)
        return existing;
    const task = syncTail.then(() => runMailboxSync(full, proveedorId));
    queuedSyncs.set(key, task);
    syncTail = task.then(() => undefined, () => undefined);
    const cleanup = () => {
        if (queuedSyncs.get(key) === task)
            queuedSyncs.delete(key);
    };
    void task.then(cleanup, cleanup);
    return task;
};
