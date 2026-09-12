import { SystemAppIcon } from "./SystemAppIcon";

/** One recruiting identity in the Dock, launcher and application header. */
export function RecruitingBrandIcon({ size = 38 }: { size?: number }) {
  return <SystemAppIcon name="hr" size={size} className="recruiting-brand-icon"/>;
}
