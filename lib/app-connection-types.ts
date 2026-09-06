import type { ChinaConnectorAppId } from "./china-apps";

export type ConnectedAppId = "github" | "figma" | "slack" | "notion" | "linear" | "google" | ChinaConnectorAppId;

export type AppConnectionState = "connected" | "disconnected" | "connecting" | "setup_required" | "error";

export interface AppConnectionStatus {
  appId: ConnectedAppId;
  state: AppConnectionState;
  account?: string;
  detail: string;
  authMode: "token" | "oauth" | "mcp" | "openapi";
  dependency?: string;
  scopes: string[];
}

export interface AppDataItem {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  url?: string;
  kind: string;
}

export interface AppDataResponse {
  appId: ConnectedAppId;
  section: string;
  account?: string;
  items: AppDataItem[];
  note?: string;
}

export interface AppConnectResponse {
  status: AppConnectionStatus;
  authUrl?: string;
}
