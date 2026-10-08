import {
  API_BASE,
} from "../config/api";

import {
  authFetch,
} from "./authService";

export interface ResumenArea {
  totalGestionadas: number;
  pendientesActuales: number;
  aprobadas: number;
  rechazadas: number;
  remitidas: number;
  procesadas: number;
}

export interface HistorialRemisionItem {
  idEvento: number;
  idFactura: number;
  tipoDocumento: "FACTURA" | "NOTA_CREDITO" | null;
  numeroFactura: string | null;
  proveedor: string;
  nit: string | null;
  correo: string | null;
  estadoCodigo: string;
  estado: string;
  areaOrigenFactura: string;
  areaActual: string;
  remitidaDesde: string;
  remitidaA: string;
  fechaRecepcion: string | null;
  fechaRemision: string;
  observacion: string | null;
  valorTotal: string | number | null;
  moneda: string | null;
}

export interface HistorialProcesadaItem {
  idEvento: number;
  idFactura: number;
  tipoDocumento: "FACTURA" | "NOTA_CREDITO" | null;
  numeroFactura: string | null;
  proveedor: string;
  nit: string | null;
  correo: string | null;
  estadoCodigo: string;
  estado: string;
  areaOrigenFactura: string;
  areaActual: string;
  recibidaDesde: string | null;
  fechaRecepcion: string | null;
  fechaProcesada: string;
  observacion: string | null;
  valorTotal: string | number | null;
  moneda: string | null;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

const getJson =
  async <T>(
    url:
      string,
  ): Promise<T> => {
    const response =
      await authFetch(
        url,
        {
          method: "GET",
          cache: "no-store",
        },
      );

    let result:
      ApiResponse<T>;

    try {
      result =
        await response.json() as ApiResponse<T>;
    } catch {
      throw new Error(
        "El servidor devolvió una respuesta inválida.",
      );
    }

    if (
      !response.ok ||
      !result.success ||
      result.data === undefined
    ) {
      throw new Error(
        result.message ??
        "No fue posible completar la consulta.",
      );
    }

    return result.data;
  };

export const getResumenArea =
  async (): Promise<ResumenArea> => {
    return getJson<ResumenArea>(
      `${API_BASE}/historial/resumen`,
    );
  };

export const getHistorialRemisiones =
  async (): Promise<HistorialRemisionItem[]> => {
    return getJson<HistorialRemisionItem[]>(
      `${API_BASE}/historial/remisiones`,
    );
  };

export const getHistorialProcesadas =
  async (): Promise<HistorialProcesadaItem[]> => {
    return getJson<HistorialProcesadaItem[]>(
      `${API_BASE}/historial/procesadas`,
    );
  };
