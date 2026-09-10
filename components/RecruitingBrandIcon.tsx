import type { CSSProperties } from "react";
import { DesktopDesignIcon } from "./DesktopDesignIcon";

/** One recruiting identity in the Dock, launcher and application header. */
export function RecruitingBrandIcon({ size = 38 }: { size?: number }) {
  const style: CSSProperties = {
    display: "inline-grid", placeItems: "center", flexShrink: 0,
    width: size, height: size, borderRadius: "28%", background: "#00a67d",
  };
  return <span style={style} data-app-brand="recruiting" aria-hidden="true">
    <DesktopDesignIcon name="people" size={Math.round(size * .68)}/>
  </span>;
}
