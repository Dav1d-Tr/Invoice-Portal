import { API_BASE } from "../config/api";
import { authFetch } from "../services/authService";

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  warning?: string | null;
  data?: T;
}
export class SgafApiError extends Error {
  readonly status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "SgafApiError";
    this.status = status;
  }
}
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
export function positiveId(value: number, label = "Identificador"): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} no válido.`);
  return value;
}
export const apiUrl = (path: string): string => `${API_BASE.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
export async function requestJson<T>(path: string, init: RequestInit = {}): Promise<ApiResponse<T>> {
  const response = await authFetch(apiUrl(path), { ...init, cache: "no-store" });
  if (response.status === 204 && response.ok) return { success: true };
  let raw: unknown;
  try { raw = await response.json(); }
  catch {
    throw new SgafApiError(`El servidor devolvió una respuesta no válida (HTTP ${response.status}).`, response.status);
  }
  if (!isRecord(raw)) throw new SgafApiError("Respuesta de SGAF no válida.", response.status);
  const message = typeof raw.message === "string" ? raw.message : undefined;
  if (!response.ok || raw.success !== true) {
    throw new SgafApiError(message || "No fue posible completar la operación.", response.status);
  }
  return {
    success: true, message,
    warning: typeof raw.warning === "string" ? raw.warning : null,
    data: raw.data as T | undefined,
  };
}
export function requireData<T>(response: ApiResponse<T>): T {
  if (response.data === undefined || response.data === null) {
    throw new SgafApiError("El servidor no devolvió los datos esperados. Revisa la versión del backend.");
  }
  return response.data;
}
export const jsonBody = (body: unknown, method = "POST"): RequestInit => ({
  method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
export const errorMessage = (error: unknown, fallback: string): string => error instanceof Error ? error.message : fallback;
export const isAbortError = (error: unknown): boolean => error instanceof Error && error.name === "AbortError";
export const joinWarnings = (...values: (string | null | undefined)[]): string | null =>
  [...new Set(values.map(value => value?.trim()).filter((value): value is string => Boolean(value)))].join(" ") || null;
