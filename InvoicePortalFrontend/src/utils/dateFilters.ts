export type DateFilterValue =
  | ""
  | "hoy"
  | "semana"
  | "mes"
  | "anio";

const getBogotaParts = (
  value:
    string |
    Date,
) => {
  const date =
    value instanceof Date
      ? value
      : new Date(
          value,
        );

  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "America/Bogota",
        year:
          "numeric",
        month:
          "2-digit",
        day:
          "2-digit",
      },
    ).formatToParts(
      date,
    );

  const get = (
    type:
      "year" |
      "month" |
      "day",
  ) =>
    Number(
      parts.find(
        (
          part,
        ) =>
          part.type === type,
      )?.value,
    );

  return {
    year:
      get("year"),
    month:
      get("month"),
    day:
      get("day"),
  };
};

export const matchesBogotaDate = (
  value:
    string |
    null |
    undefined,

  filter:
    string,
): boolean => {
  if (
    !filter ||
    !value
  ) {
    return true;
  }

  const current =
    getBogotaParts(
      new Date(),
    );

  const target =
    getBogotaParts(
      value,
    );

  if (
    filter === "hoy"
  ) {
    return (
      current.year === target.year &&
      current.month === target.month &&
      current.day === target.day
    );
  }

  if (
    filter === "mes"
  ) {
    return (
      current.year === target.year &&
      current.month === target.month
    );
  }

  if (
    filter === "anio"
  ) {
    return current.year === target.year;
  }

  const currentDay =
    Date.UTC(
      current.year,
      current.month - 1,
      current.day,
    ) /
    86_400_000;

  const targetDay =
    Date.UTC(
      target.year,
      target.month - 1,
      target.day,
    ) /
    86_400_000;

  const weekDay =
    new Date(
      Date.UTC(
        current.year,
        current.month - 1,
        current.day,
      ),
    ).getUTCDay();

  const mondayOffset =
    (
      weekDay + 6
    ) % 7;

  const monday =
    currentDay - mondayOffset;

  return (
    targetDay >= monday &&
    targetDay <= currentDay
  );
};
