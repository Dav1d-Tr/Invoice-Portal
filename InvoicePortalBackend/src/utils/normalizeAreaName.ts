export const normalizeAreaName = (
  value: string,
): string => {
  return value
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .trim()
    .replace(
      /\s+/g,
      " ",
    )
    .toUpperCase();
};

export default normalizeAreaName;