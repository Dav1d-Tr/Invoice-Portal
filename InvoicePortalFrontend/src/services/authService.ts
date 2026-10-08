import { API_BASE } from "../config/api";

/* =========================================================
   CONSTANTES
========================================================= */

const TOKEN_KEY = "invoice_portal_token";
const AREA_KEY = "invoice_portal_area";

/* =========================================================
   TIPOS
========================================================= */

export interface Area {
  id: number;
  nombre: string;
}

interface AreasResponse {
  success: boolean;
  message?: string;
  data?: Area[];
}

interface LoginResponse {
  success: boolean;
  message?: string;

  data?: {
    token: string;
    area: Area;
    expiresIn: number;
  };
}

/* =========================================================
   CARGAR ÁREAS
========================================================= */

export const getAreas = async (): Promise<Area[]> => {
  const response = await fetch(
    `${API_BASE}/auth/areas`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    },
  );

  const result =
    (await response.json()) as AreasResponse;

  if (!response.ok || !result.success) {
    throw new Error(
      result.message ??
        "No fue posible cargar las áreas.",
    );
  }

  return (result.data ?? []).map((area) => ({
    id: Number(area.id),
    nombre: area.nombre,
  }));
};

/* =========================================================
   LOGIN
========================================================= */

export const login = async (
  area: string,
  clave: string,
): Promise<Area> => {
  const response = await fetch(
    `${API_BASE}/auth/login`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },

      body: JSON.stringify({
        area,
        clave,
      }),
    },
  );

  const result =
    (await response.json()) as LoginResponse;

  if (
    !response.ok ||
    !result.success ||
    !result.data
  ) {
    throw new Error(
      result.message ??
        "No fue posible iniciar sesión.",
    );
  }

  const loggedArea: Area = {
    id: Number(
      result.data.area.id,
    ),

    nombre:
      result.data.area.nombre,
  };

  sessionStorage.setItem(
    TOKEN_KEY,
    result.data.token,
  );

  sessionStorage.setItem(
    AREA_KEY,
    JSON.stringify(
      loggedArea,
    ),
  );

  return loggedArea;
};

/* =========================================================
   TOKEN
========================================================= */

export const getToken = (): string | null => {
  return sessionStorage.getItem(
    TOKEN_KEY,
  );
};

/* =========================================================
   ÁREA ACTUAL
========================================================= */

export const getStoredArea =
  (): Area | null => {
    const data =
      sessionStorage.getItem(
        AREA_KEY,
      );

    if (!data) {
      return null;
    }

    try {
      const parsed =
        JSON.parse(
          data,
        ) as Area;

      return {
        id: Number(
          parsed.id,
        ),

        nombre:
          parsed.nombre,
      };
    } catch {
      clearSession();

      return null;
    }
  };

/* =========================================================
   LIMPIAR SESIÓN
========================================================= */

export const clearSession = (): void => {
  sessionStorage.removeItem(
    TOKEN_KEY,
  );

  sessionStorage.removeItem(
    AREA_KEY,
  );
};

/* =========================================================
   LOGOUT
========================================================= */

export const logout = (): void => {
  clearSession();
};

/* =========================================================
   VERIFICAR SESIÓN LOCAL
========================================================= */

export const isAuthenticated =
  (): boolean => {
    return Boolean(
      getToken() &&
        getStoredArea(),
    );
  };

/* =========================================================
   FETCH AUTENTICADO

   Todos los servicios protegidos pueden utilizar esta función.

   - Agrega JWT automáticamente.
   - Conserva headers existentes.
   - Si recibe 401 limpia sesión.
   - Redirige a Login.
========================================================= */

export const authFetch = async (
  input: string,
  init: RequestInit = {},
): Promise<Response> => {
  const token =
    getToken();

  if (!token) {
    clearSession();

    window.location.replace(
      "/login",
    );

    throw new Error(
      "Debes iniciar sesión nuevamente.",
    );
  }

  const headers =
    new Headers(
      init.headers,
    );

  headers.set(
    "Authorization",
    `Bearer ${token}`,
  );

  if (
    !headers.has(
      "Accept",
    )
  ) {
    headers.set(
      "Accept",
      "application/json",
    );
  }

  const response =
    await fetch(
      input,
      {
        ...init,
        headers,
      },
    );

  /* =======================================================
     JWT VENCIDO / INVÁLIDO
  ======================================================= */

  if (
    response.status === 401
  ) {
    clearSession();

    window.location.replace(
      "/login",
    );
  }

  return response;
};