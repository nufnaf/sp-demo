import type { InsightResult } from "./insight-automation";
import type { JdArtifact } from "./recruiting-publication";

interface InsightItemBase {
  id: string;
  title: string;
  detail: string;
  modified?: string;
}

export interface PublicationInsightItem extends InsightItemBase {
  kind: "publication";
  artifact: JdArtifact;
  actionLabel: string;
  disabled: boolean;
  onPublish: () => void;
}

export interface ReportInsightItem extends InsightItemBase {
  kind: "report";
  result: InsightResult;
}

/** Shared client-side entries for the desktop and the insight application. */
export type WorkspaceInsightItem = PublicationInsightItem | ReportInsightItem;

export interface InsightSelection {
  cwd: string;
  id: string | null;
  // A freshly opened report can arrive before the results list refreshes.
  report?: InsightResult;
}
