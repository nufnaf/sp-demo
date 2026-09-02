export type AppStorePackageType = "extension" | "skill" | "prompt" | "theme" | "package";

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
}

export interface AppStoreCatalogResponse {
  packages: AppStorePackage[];
  total: number;
  page: number;
  source: "pi.dev";
  fetchedAt: string;
}
