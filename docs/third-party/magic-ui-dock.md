# Magic UI Dock attribution

`components/DesktopDock.tsx` adapts Magic UI's Dock and DockIcon under MIT.

- Upstream: https://github.com/magicuidesign/magicui/blob/ec1cce6c4192c0aaac279dd7e53537ccd5c99d44/apps/www/registry/magicui/dock.tsx
- Revision: `ec1cce6c4192c0aaac279dd7e53537ccd5c99d44`, retrieved 2026-09-11.
- Copyright and full license: [magic-ui-LICENSE.txt](magic-ui-LICENSE.txt).
- Runtime: `motion`, pinned in package.json/package-lock.json.

Retained upstream: shared pointer MotionValue, distance-to-size transform, useSpring with mass 0.1 / stiffness 150 / damping 12.

Adaptations: native buttons and context instead of divs/cloneElement; 44–66 px sizes; existing Syntropic appearance; viewport coordinates; keyboard focus; reduced motion/coarse pointer/overflow handling; separate scale, icon launch and fixed indicator layers. The launch animation is a local Motion sequence driven by a closed-to-open application state change, not code supplied by Magic UI. No native macOS animation parity is claimed.

Performance adaptation: item layout stays at 44 px. The upstream spring sizes drive icon scaling, neighbour translations and the separate backdrop's horizontal scale through complete CSS transform strings. The launch also animates the complete transform property. Indicator baselines remain fixed and a scaled transparent hit area covers enlarged icons.

Neutral pointer geometry is cached on membership, resize and scroll changes, outside pointer/animation callbacks. This prevents forced layout and stationary-pointer feedback. MotionValue membership is subscribed through React only when entries change, so newly added/removed items participate in derived positioning without per-frame React renders. The upstream distance mapping and spring parameters are retained.
