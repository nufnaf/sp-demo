import type { ReactNode } from "react";
import "./WorkspaceApps.css";
import { APP_LOGO_GLYPHS } from "./AppLogoGlyphs";

export type WorkspaceIconName = "recruiting" | "investment" | "sales" | "overview" | "customers" | "orders" | "sources";

const paths: Record<WorkspaceIconName, ReactNode> = {
  recruiting: APP_LOGO_GLYPHS.recruiting,
  investment: APP_LOGO_GLYPHS.investment,
  sales: <><rect x="3" y="6" width="18" height="15" rx="3"/><path d="M8 6V3h8v3M3 11a24 24 0 0 0 18 0m-11 1v3h4v-3"/></>,
  overview: <><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 10h18M10 10v11"/></>,
  customers: <><circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v3"/></>,
  orders: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6m-6 4h6m-6 4h3"/></>,
  sources: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 4 16 4 16 0V5M4 12v7c0 4 16 4 16 0v-7"/></>,
};

export function WorkspaceAppIcon({ name, size = 18 }: { name: WorkspaceIconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
