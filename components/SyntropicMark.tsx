/** Original Syntropic silhouette, shared across light and dark surfaces. */
export function SyntropicMark({ size = 24 }: { size?: number | string }) {
  return <span aria-hidden="true" style={{
    display: "inline-block",
    width: size,
    height: size,
    flexShrink: 0,
    backgroundColor: "currentColor",
    mask: 'url("/icons/syntropic-mark.png") center / contain no-repeat',
    WebkitMask: 'url("/icons/syntropic-mark.png") center / contain no-repeat',
  }} />;
}
