import "./AppBrandImage.css";
import { getChinaAppDefinition } from "@/lib/china-apps";

/** One asset and optical inset for the market, Dock and launcher. */
export function AppBrandImage({ appId, src }: { appId?: string; src?: string }) {
  const source = (appId ? getChinaAppDefinition(appId)?.logoUrl : undefined) ?? src;
  const inset = appId === "feishu" ? "76%" : appId === "huayu-law" ? "86%" : "100%";
  // Inline sizing intentionally wins over each surface's legacy image rules.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={source} alt="" data-app-brand={appId} referrerPolicy="no-referrer" draggable={false}
    style={{ width: inset, height: inset, objectFit: "contain", display: "block", borderRadius: inset === "100%" ? "inherit" : 0 }}/>;
}
