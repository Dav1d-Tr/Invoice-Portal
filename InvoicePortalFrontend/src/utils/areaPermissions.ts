export const normalizeAreaName = (
  value: string,
): string => {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
};

export const isSystemsArea = (
  area?: string,
): boolean => {
  return (
    normalizeAreaName(area ?? "") ===
    "SISTEMAS"
  );
};

export const isAccountingArea = (
  area?: string,
): boolean => {
  return (
    normalizeAreaName(area ?? "") ===
    "CONTABILIDAD"
  );
};

export const getAreaInitials = (
  area?: string,
): string => {
  const normalized =
    normalizeAreaName(area ?? "");

  if (!normalized) {
    return "--";
  }

  /*
    Casos especiales para que visualmente
    se vean mejor.
  */

  if (normalized === "SISTEMAS") {
    return "TI";
  }

  if (normalized === "CONTABILIDAD") {
    return "CT";
  }

  if (
    normalized === "GESTION HUMANA"
  ) {
    return "GH";
  }

  const words =
    normalized.split(" ");

  if (words.length >= 2) {
    return (
      words[0]?.charAt(0) ?? ""
    ) + (
      words[1]?.charAt(0) ?? ""
    );
  }

  return normalized.substring(0, 2);
};

export const isCommercialArea = (
  area?: string,
): boolean => {
  return (
    normalizeAreaName(
      area ?? "",
    ) === "COMERCIAL"
  );
};