import type { InsightResult } from "./insight-automation";
import type { JdArtifact, PublishedRecruitingJob } from "./recruiting-publication";

interface InsightItemBase {
  id: string;
  title: string;
  detail: string;
  modified?: string;
}

export interface PublicationInsightItem extends InsightItemBase {
  kind: "publication";
  artifact: JdArtifact;
  stage: "ready" | "preparing" | "publishing" | "published" | "attention";
  job: PublishedRecruitingJob | null;
  includesBoss: boolean;
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
