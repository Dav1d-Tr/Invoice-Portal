export type InvoiceDocumentType =
  | "FACTURA"
  | "NOTA_CREDITO";

export interface ExtractedInvoiceMetadata {
  tipoDocumento: InvoiceDocumentType;
  numeroDocumento: string | null;
  nit: string | null;
  valorTotal: number | null;
  moneda: string | null;
  proveedorSugerido: string | null;
}

export interface InvoiceMetadataSource {
  subject?: string | null;
  bodyText?: string | null;
  bodyHtml?: string | null;
  xmlContents?: string[];
  attachmentNames?: string[];
}

const decodeHtmlEntities = (
  value: string,
): string => {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(
      /&#(\d+);/g,
      (_match, code) => {
        const parsed =
          Number(code);

        return Number.isFinite(
          parsed,
        )
          ? String.fromCharCode(
              parsed,
            )
          : " ";
      },
    );
};

const htmlToText = (
  html: string,
): string => {
  return decodeHtmlEntities(
    html
      .replace(
        /<style[\s\S]*?<\/style>/gi,
        " ",
      )
      .replace(
        /<script[\s\S]*?<\/script>/gi,
        " ",
      )
      .replace(
        /<br\s*\/?>/gi,
        "\n",
      )
      .replace(
        /<\/p>/gi,
        "\n",
      )
      .replace(
        /<\/div>/gi,
        "\n",
      )
      .replace(
        /<\/tr>/gi,
        "\n",
      )
      .replace(
        /<\/td>/gi,
        " ",
      )
      .replace(
        /<[^>]+>/g,
        " ",
      ),
  )
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const normalizeSearch = (
  value: string,
): string => {
  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
};

const cleanDocumentNumber = (
  value:
    string |
    null |
    undefined,
): string | null => {
  const clean =
    value
      ?.trim()
      .replace(
        /^[#:\s]+/,
        "",
      )
      .replace(
        /[;,.:]+$/g,
        "",
      )
      .replace(
        /\s+/g,
        "",
      );

  if (
    !clean ||
    clean.length < 3
  ) {
    return null;
  }

  return clean.toUpperCase();
};

const normalizeNit = (
  value:
    string |
    null |
    undefined,
): string | null => {
  const clean =
    value
      ?.trim()
      .replace(
        /[^0-9A-Za-z-]/g,
        "",
      ) ??
    "";

  return clean ||
    null;
};

const parseMoney = (
  raw:
    string |
    null |
    undefined,
): number | null => {
  if (!raw) {
    return null;
  }

  let value =
    raw
      .replace(
        /[^\d.,-]/g,
        "",
      )
      .trim();

  if (!value) {
    return null;
  }

  const lastComma =
    value.lastIndexOf(
      ",",
    );

  const lastDot =
    value.lastIndexOf(
      ".",
    );

  if (
    lastComma >= 0 &&
    lastDot >= 0
  ) {
    if (
      lastComma >
      lastDot
    ) {
      value =
        value
          .replace(
            /\./g,
            "",
          )
          .replace(
            ",",
            ".",
          );
    } else {
      value =
        value.replace(
          /,/g,
          "",
        );
    }
  } else if (
    lastComma >= 0
  ) {
    const decimals =
      value.length -
      lastComma -
      1;

    if (decimals === 2) {
      value =
        value
          .replace(
            /\./g,
            "",
          )
          .replace(
            ",",
            ".",
          );
    } else {
      value =
        value.replace(
          /,/g,
          "",
        );
    }
  } else if (
    lastDot >= 0
  ) {
    const pieces =
      value.split(
        ".",
      );

    if (
      pieces.length > 2 ||
      (
        pieces.length === 2 &&
        pieces[1]!.length === 3
      )
    ) {
      value =
        value.replace(
          /\./g,
          "",
        );
    }
  }

  const number =
    Number(
      value,
    );

  return Number.isFinite(
    number,
  )
    ? number
    : null;
};

const getSubjectParts = (
  subject: string,
): string[] => {
  return subject
    .split(";")
    .map(
      (value) =>
        value.trim(),
    )
    .filter(Boolean);
};

const extractXml = (
  xml: string,
): Partial<
  ExtractedInvoiceMetadata
> => {
  const type:
    InvoiceDocumentType =
      /<(?:\w+:)?CreditNote\b/i.test(
        xml,
      )
        ? "NOTA_CREDITO"
        : "FACTURA";

  const idMatch =
    xml.match(
      /<(?:cbc:)?ID(?:\s[^>]*)?>([^<]+)<\/(?:cbc:)?ID>/i,
    ) ??
    xml.match(
      /<(?:\w+:)?ID(?:\s[^>]*)?>([^<]+)<\/(?:\w+:)?ID>/i,
    );

  const payableMatch =
    xml.match(
      /<(?:\w+:)?PayableAmount\b([^>]*)>([^<]+)<\/(?:\w+:)?PayableAmount>/i,
    );

  const currencyMatch =
    payableMatch
      ?.[1]
      ?.match(
        /currencyID\s*=\s*["']([^"']+)["']/i,
      );

  const supplierBlock =
    xml.match(
      /<(?:\w+:)?AccountingSupplierParty\b[\s\S]*?<\/(?:\w+:)?AccountingSupplierParty>/i,
    )?.[0] ??
    "";

  const companyIdMatch =
    supplierBlock.match(
      /<(?:\w+:)?CompanyID(?:\s[^>]*)?>([^<]+)<\/(?:\w+:)?CompanyID>/i,
    );

  const supplierNameMatch =
    supplierBlock.match(
      /<(?:\w+:)?RegistrationName(?:\s[^>]*)?>([^<]+)<\/(?:\w+:)?RegistrationName>/i,
    ) ??
    supplierBlock.match(
      /<(?:\w+:)?Name(?:\s[^>]*)?>([^<]+)<\/(?:\w+:)?Name>/i,
    );

  return {
    tipoDocumento:
      type,

    numeroDocumento:
      cleanDocumentNumber(
        idMatch?.[1],
      ),

    nit:
      normalizeNit(
        companyIdMatch
          ?.[1],
      ),

    valorTotal:
      parseMoney(
        payableMatch?.[2],
      ),

    moneda:
      currencyMatch
        ?.[1]
        ?.trim()
        .toUpperCase() ||
      null,

    proveedorSugerido:
      supplierNameMatch
        ?.[1]
        ?.trim() ||
      null,
  };
};

const extractNumberFromSubject = (
  subject: string,
): string | null => {
  const parts =
    getSubjectParts(
      subject,
    );

  if (
    parts.length >= 3
  ) {
    const candidate =
      cleanDocumentNumber(
        parts[2],
      );

    if (
      candidate &&
      /[A-Z]/i.test(
        candidate,
      ) &&
      /\d/.test(
        candidate,
      )
    ) {
      return candidate;
    }
  }

  return null;
};

const extractNumberFromText = (
  text: string,
  type:
    InvoiceDocumentType,
): string | null => {
  const normalized =
    normalizeSearch(
      text,
    );

  const labels =
    type ===
    "NOTA_CREDITO"
      ? [
          /NUMERO\s+DE\s+NOTA\s+(?:DE\s+)?CREDITO\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{2,})/i,
          /NOTA\s+(?:DE\s+)?CREDITO\s*(?:NUMERO|NO\.?|#)?\s*[:#-]?\s*([A-Z]{0,8}-?\d{2,})/i,
        ]
      : [
          /NUMERO\s+DE\s+FACTURA\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{2,})/i,
          /FACTURA\s*(?:NUMERO|NO\.?|#)?\s*[:#-]?\s*([A-Z]{0,8}-?\d{2,})/i,
        ];

  for (
    const regex
    of labels
  ) {
    const match =
      normalized.match(
        regex,
      );

    const value =
      cleanDocumentNumber(
        match?.[1],
      );

    if (value) {
      return value;
    }
  }

  const fallback =
    normalized.match(
      /\b(?:FE|FVE|FV|FC|NC|NCE)[-]?\d{2,}\b/i,
    );

  return cleanDocumentNumber(
    fallback?.[0],
  );
};

const extractTotalFromText = (
  text: string,
): number | null => {
  const normalized =
    normalizeSearch(
      text,
    );

  const patterns = [
    /VALOR\s+TOTAL\s*[:$]?\s*(?:COP|USD)?\s*\$?\s*([0-9][0-9.,]*)/i,
    /TOTAL\s+A\s+PAGAR\s*[:$]?\s*(?:COP|USD)?\s*\$?\s*([0-9][0-9.,]*)/i,
    /IMPORTE\s+TOTAL\s*[:$]?\s*(?:COP|USD)?\s*\$?\s*([0-9][0-9.,]*)/i,
    /TOTAL\s*[:$]?\s*(?:COP|USD)?\s*\$?\s*([0-9][0-9.,]*)/i,
  ];

  for (
    const regex
    of patterns
  ) {
    const match =
      normalized.match(
        regex,
      );

    const value =
      parseMoney(
        match?.[1],
      );

    if (
      value !==
      null
    ) {
      return value;
    }
  }

  return null;
};

const extractNitFromText = (
  text: string,
  subject: string,
): string | null => {
  const normalized =
    normalizeSearch(
      text,
    );

  const labeled =
    normalized.match(
      /\bNIT\s*[:#-]?\s*(\d{6,15}(?:-\d)?)/i,
    );

  if (
    labeled?.[1]
  ) {
    return normalizeNit(
      labeled[1],
    );
  }

  const parts =
    getSubjectParts(
      subject,
    );

  const first =
    normalizeNit(
      parts[0],
    );

  if (
    first &&
    /^\d{6,15}(?:-\d)?$/.test(
      first,
    )
  ) {
    return first;
  }

  const subjectStart =
    subject
      .trim()
      .match(
        /^(\d{6,15})(?:-\d)?[;\s]/,
      );

  return normalizeNit(
    subjectStart?.[1],
  );
};

const extractProviderFromSubject = (
  subject: string,
): string | null => {
  const parts =
    getSubjectParts(
      subject,
    );

  if (
    parts.length >= 2 &&
    /^\d{6,15}(?:-\d)?$/.test(
      parts[0] ??
      "",
    )
  ) {
    return parts[1]
      ?.trim() ||
      null;
  }

  return null;
};

const detectCurrency = (
  text: string,
): string | null => {
  const normalized =
    normalizeSearch(
      text,
    );

  if (
    /\bUSD\b|US\$/.test(
      normalized,
    )
  ) {
    return "USD";
  }

  if (
    /\bCOP\b|\$\s*[0-9]/.test(
      text,
    )
  ) {
    return "COP";
  }

  return null;
};

export const extractInvoiceMetadata =
  (
    source:
      InvoiceMetadataSource,
  ): ExtractedInvoiceMetadata => {
    const subject =
      source.subject ??
      "";

    const bodyText =
      source.bodyText ??
      "";

    const bodyHtmlText =
      source.bodyHtml
        ? htmlToText(
            source.bodyHtml,
          )
        : "";

    const attachmentNames =
      source
        .attachmentNames
        ?.join(
          " ",
        ) ??
      "";

    const combined =
      [
        subject,
        bodyText,
        bodyHtmlText,
        attachmentNames,
      ]
        .filter(
          Boolean,
        )
        .join(
          "\n",
        );

    const normalizedCombined =
      normalizeSearch(
        combined,
      );

    let result:
      ExtractedInvoiceMetadata =
        {
          tipoDocumento:
            /NOTA\s+(?:DE\s+)?CREDITO|CREDIT\s+NOTE|\bNC[-]?\d+/i.test(
              normalizedCombined,
            )
              ? "NOTA_CREDITO"
              : "FACTURA",

          numeroDocumento:
            null,

          nit:
            null,

          valorTotal:
            null,

          moneda:
            null,

          proveedorSugerido:
            extractProviderFromSubject(
              subject,
            ),
        };

    for (
      const xml
      of source
        .xmlContents ??
        []
    ) {
      const extracted =
        extractXml(
          xml,
        );

      result = {
        tipoDocumento:
          extracted
            .tipoDocumento ??
          result
            .tipoDocumento,

        numeroDocumento:
          result
            .numeroDocumento ??
          extracted
            .numeroDocumento ??
          null,

        nit:
          result.nit ??
          extracted.nit ??
          null,

        valorTotal:
          result
            .valorTotal ??
          extracted
            .valorTotal ??
          null,

        moneda:
          result.moneda ??
          extracted.moneda ??
          null,

        proveedorSugerido:
          result
            .proveedorSugerido ??
          extracted
            .proveedorSugerido ??
          null,
      };
    }

    result.numeroDocumento =
      result
        .numeroDocumento ??
      extractNumberFromText(
        combined,
        result
          .tipoDocumento,
      ) ??
      extractNumberFromSubject(
        subject,
      );

    result.valorTotal =
      result
        .valorTotal ??
      extractTotalFromText(
        combined,
      );

    result.nit =
      result.nit ??
      extractNitFromText(
        combined,
        subject,
      );

    result.moneda =
      result.moneda ??
      detectCurrency(
        combined,
      );

    if (
      result.valorTotal !==
        null &&
      !result.moneda
    ) {
      result.moneda =
        "COP";
    }

    return result;
  };

export const normalizeNitForMatch = (
  value:
    string |
    null |
    undefined,
): string => {
  return (
    value ??
    ""
  )
    .toUpperCase()
    .replace(
      /[^0-9A-Z]/g,
      "",
    );
};
