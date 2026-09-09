/** Exact icon exports from the home frames; see public/design/home/sources.json. */
export function DesktopDesignIcon({ name, size = 24 }: {
  name: "microphone" | "bell" | "calendar" | "sparkles" | "people";
  size?: number;
}) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/design/home/${name}.svg`} width={size} height={size} alt="" aria-hidden="true" style={{ width: size, height: size, flexShrink: 0 }} />;
}
