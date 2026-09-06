import type { ConnectedAppId } from "./app-connection-types";

export type AppStorePackageType = "extension" | "skill" | "prompt" | "theme" | "package" | "connector";
export type AppStoreDelivery = "pi-package" | "connector" | "builtin";

export interface AppStorePackage {
  packageName: string;
  source: string;
  name: string;
  description: string;
  author: string;
  monthlyDownloads: number;
  downloadsLabel: string;
  updatedLabel: string;
  types: AppStorePackageType[];
  catalogUrl: string;
  npmUrl: string;
  repositoryUrl?: string;
  logoUrl?: string;
  delivery?: AppStoreDelivery;
  connectionId?: ConnectedAppId | "feishu";
  category?: string;
  capabilities?: string[];
}

export interface AppStoreCatalogResponse {
  packages: AppStorePackage[];
  total: number;
  page: number;
  source: "pi.dev" | "agent-os" | "hybrid";
  fetchedAt: string;
  warning?: string;
}
