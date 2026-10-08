import type {
  Request,
} from "express";

export interface AuthPayload {
  areaId: number;
  area: string;
}

export interface AuthenticatedRequest
  extends Request {
  auth?: AuthPayload;
}