"use client";

// Adapted from Magic UI Dock (MIT), commit ec1cce6c4192c0aaac279dd7e53537ccd5c99d44.
// See docs/third-party/magic-ui-dock.md for source, license and adaptations.
import { createContext, useContext, useCallback, useSyncExternalStore, useLayoutEffect, useEffect, useRef, useState, type ReactNode, type Ref, type RefObject } from "react";
import { motion, useAnimate, useMotionValue, useSpring, useTransform, type MotionValue, type HTMLMotionProps } from "motion/react";
import "./DesktopDock.css";

const ICON_SIZE = 44;
const ICON_MAGNIFICATION = 66;
const ICON_DISTANCE = 140;
type DockEntry = { node: HTMLElement; size: MotionValue<number>; baseSize: number; center: MotionValue<number> };
const EMPTY_ENTRIES: DockEntry[] = [];
const DockContext = createContext<{
  mouseX: MotionValue<number>;
  entries: MotionValue<DockEntry[]>;
  positions: MotionValue<{ offsets: Map<HTMLElement, number>; expansion: number }>;
  motionEnabled: boolean;
  magnify: boolean;
} | null>(null);

export function DesktopDock({ children }: { children: ReactNode }) {
  const dockRef = useRef<HTMLElement>(null);
  const mouseX = useMotionValue(Infinity);
  const entries = useMotionValue<DockEntry[]>([]);
  const width = useMotionValue(1);
  const subscribe = useCallback((listener: () => void) => entries.on("change", listener), [entries]);
  const registeredEntries = useSyncExternalStore(subscribe, () => entries.get(), () => EMPTY_ENTRIES);
  const [motionEnabled, setMotionEnabled] = useState(false);
  const [roomToMagnify, setRoomToMagnify] = useState(false);
  // Keep layout dimensions fixed. Motion derives every neighbour's translation
  // from the same spring sizes, so icons spread without triggering flex layout.
  const positions = useTransform(() => {
    const items = registeredEntries;
    const extra = items.map(item => item.size.get() - item.baseSize);
    const expansion = extra.reduce((sum, value) => sum + value, 0);
    const offsets = new Map<HTMLElement, number>();
    let before = -expansion / 2;
    items.forEach((item, i) => {
      offsets.set(item.node, before + extra[i] / 2);
      before += extra[i];
    });
    return { offsets, expansion };
  });
  const backdropTransform = useTransform(() => `scaleX(${1 + positions.get().expansion / width.get()})`);

  useLayoutEffect(() => {
    const dock = dockRef.current;
    if (!dock) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reset = () => mouseX.set(Infinity);
    const updateMotion = () => {
      setMotionEnabled(!reducedMotion.matches && finePointer.matches);
      reset();
    };
    const measure = () => {
      const bounds = dock.getBoundingClientRect();
      width.set(bounds.width);
      // Read neutral geometry only on structural changes/resize/scroll, never
      // in the pointer or animation loop. CSS transforms do not affect offsets.
      for (const entry of entries.get()) {
        entry.center.set(bounds.left + entry.node.offsetLeft + entry.node.offsetWidth / 2 - dock.scrollLeft);
      }
      const neutralWidth = Math.max(0, ...entries.get().map(entry => entry.node.offsetLeft + entry.node.offsetWidth))
        + parseFloat(getComputedStyle(dock).paddingRight);
      setRoomToMagnify(neutralWidth + 100 <= window.innerWidth - 32);
      dock.dataset.crowded = String(neutralWidth > dock.clientWidth + 1);
    };
    const onResize = () => { reset(); measure(); };
    const observer = new MutationObserver(measure);
    observer.observe(dock, { childList: true });
    const unsubscribe = entries.on("change", measure);
    updateMotion();
    measure();
    dock.addEventListener("scroll", onResize);
    window.addEventListener("resize", onResize);
    window.addEventListener("blur", reset);
    reducedMotion.addEventListener("change", updateMotion);
    finePointer.addEventListener("change", updateMotion);
    return () => {
      observer.disconnect();
      unsubscribe();
      dock.removeEventListener("scroll", onResize);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("blur", reset);
      reducedMotion.removeEventListener("change", updateMotion);
      finePointer.removeEventListener("change", updateMotion);
    };
  }, [mouseX, entries, width]);

  return <DockContext.Provider value={{ mouseX, entries, positions, motionEnabled, magnify: motionEnabled && roomToMagnify }}>
    <nav ref={dockRef} className="agent-os-dock desktop-dock" aria-label="应用程序 Dock"
      onPointerMove={event => { if (event.pointerType === "mouse") mouseX.set(event.clientX); }}
      onPointerLeave={() => mouseX.set(Infinity)}
      onPointerCancel={() => mouseX.set(Infinity)}
    >
      <motion.div aria-hidden="true" className="desktop-dock-backdrop" style={{ transform: backdropTransform }}/>
      {children}
    </nav>
  </DockContext.Provider>;
}

function useDockContext() {
  const dock = useContext(DockContext);
  if (!dock) throw new Error("Dock entries must be rendered inside DesktopDock");
  return dock;
}

function useDockPosition(nodeRef: RefObject<HTMLElement | null>, size: MotionValue<number>, baseSize: number, center: MotionValue<number>) {
  const { entries, positions } = useDockContext();
  useLayoutEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    const entry = { node, size, baseSize, center };
    entries.set([...entries.get(), entry].sort((a, b) => a.node.compareDocumentPosition(b.node) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    return () => { entries.set(entries.get().filter(item => item !== entry)); };
  }, [entries, nodeRef, size, baseSize, center]);
  return useTransform(() => `translate3d(${positions.get().offsets.get(nodeRef.current!) ?? 0}px, 0, 0)`);
}

export function DesktopDockSeparator({ className }: { className?: string }) {
  const ref = useRef<HTMLElement>(null);
  const size = useMotionValue(0);
  const center = useMotionValue(0);
  const transform = useDockPosition(ref, size, 0, center);
  return <motion.i ref={ref} className={className} aria-hidden="true" style={{ transform }}/>;
}

type DesktopDockItemProps = Omit<HTMLMotionProps<"button">, "children"> & {
  children: ReactNode;
  open?: boolean;
  animateOpening?: boolean;
  ref?: Ref<HTMLButtonElement>;
};

export function DesktopDockItem({ children, open = false, animateOpening = true, className, ref: forwardedRef, ...props }: DesktopDockItemProps) {
  const { mouseX, motionEnabled, magnify } = useDockContext();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const keyboardFocus = useMotionValue(false);
  const center = useMotionValue(0);
  // Retain Magic UI's distance -> size -> spring pipeline, but apply the result
  // to transforms instead of width/height. Unrelated renders cannot move targets.
  const distance = useTransform(() => !magnify ? Infinity : keyboardFocus.get() ? 0 : mouseX.get() - center.get());
  const sizeTarget = useTransform(distance, [-ICON_DISTANCE, 0, ICON_DISTANCE], [ICON_SIZE, ICON_MAGNIFICATION, ICON_SIZE]);
  const springSize = useSpring(sizeTarget, { mass: 0.1, stiffness: 150, damping: 12 });
  const size = useTransform(() => magnify ? springSize.get() : ICON_SIZE);
  const transform = useDockPosition(buttonRef, size, ICON_SIZE, center);
  const scaleTransform = useTransform(size, value => `scale(${value / ICON_SIZE})`);
  const [iconRef, animate] = useAnimate<HTMLSpanElement>();
  const opening = useRef<ReturnType<typeof animate> | null>(null);
  const previouslyOpen = useRef(open);

  useEffect(() => {
    const didOpen = open && !previouslyOpen.current;
    previouslyOpen.current = open;
    if (!motionEnabled || !open) {
      opening.current?.cancel();
      opening.current = null;
      return;
    }
    if (!didOpen || !animateOpening || opening.current) return;
    // Animate the complete transform property so the launch can run on the
    // compositor, independently of React or Motion's spring calculations.
    const animation = animate(iconRef.current, { transform: ["translateY(0px)", "translateY(-16px)", "translateY(0px)"] }, {
      duration: 0.64, times: [0, 0.5, 1], ease: ["easeOut", "easeIn"],
    });
    opening.current = animation;
    void animation.then(() => { if (opening.current === animation) opening.current = null; });
  }, [open, animateOpening, motionEnabled, animate, iconRef]);

  return <motion.button {...props} ref={node => {
    buttonRef.current = node;
    if (typeof forwardedRef === "function") return forwardedRef(node);
    if (forwardedRef) forwardedRef.current = node;
  }} type={props.type ?? "button"} className={className}
    style={{ ...props.style, transform, "--dock-item-scale": scaleTransform } as HTMLMotionProps<"button">["style"]}
    onFocus={event => { keyboardFocus.set(event.currentTarget.matches(":focus-visible")); props.onFocus?.(event); }}
    onBlur={event => { keyboardFocus.set(false); props.onBlur?.(event); }}
  >
    <motion.span aria-hidden="true" className="desktop-dock-hit-area" style={{ transform: scaleTransform }}/>
    <motion.span className="desktop-dock-scale" style={{ transform: scaleTransform }}>
      <span ref={iconRef} className={`desktop-dock-icon ${className ?? ""}`}>{children}</span>
    </motion.span>
  </motion.button>;
}
