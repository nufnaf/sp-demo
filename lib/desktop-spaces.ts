export interface DesktopSpace { id: string; name: string }
export interface SpacesState { spaces: DesktopSpace[]; active: string; windows: Record<string, string>; fronts: Record<string, string> }
export const initialSpaces = (): SpacesState => ({ spaces: [{ id: "desktop-1", name: "桌面 1" }], active: "desktop-1", windows: {}, fronts: {} });
export function spaceOf(state: SpacesState, windowId: string) { return state.windows[windowId] ?? state.spaces[0].id; }
export function focusSpaceWindow(state: SpacesState, id: string, reveal = true): SpacesState {
  // Closing one window must never pull a fallback window from another Space.
  if (!reveal && spaceOf(state, id) !== state.active) return state;
  const space = state.windows[id] ?? state.active;
  if (state.active === space && (id === "computer" || state.fronts[space] === id) && state.windows[id] === space) return state;
  // PiP has its own floating layer. Revealing it must preserve the app beneath it.
  return { ...state, active: space, windows: { ...state.windows, [id]: space }, fronts: appFronts(state, id, space) };
}
function appFronts(state: SpacesState, id: string, space: string) {
  return id === "computer" ? state.fronts : { ...state.fronts, [space]: id };
}
export function addSpace(state: SpacesState, id: string): SpacesState {
  if (state.spaces.length >= 6 || state.spaces.some(space => space.id === id)) return state;
  const number = Math.max(...state.spaces.map(space => Number(space.name.replace("桌面 ", "")) || 0)) + 1;
  return { ...state, spaces: [...state.spaces, { id, name: `桌面 ${number}` }], active: id };
}
export function moveToSpace(state: SpacesState, windowId: string, space: string): SpacesState {
  if (!state.spaces.some(item => item.id === space)) return state;
  return { ...state, active: space, windows: { ...state.windows, [windowId]: space }, fronts: appFronts(state, windowId, space) };
}
export function removeSpace(state: SpacesState, id: string): SpacesState {
  if (state.spaces.length === 1 || !state.spaces.some(space => space.id === id)) return state;
  const index = state.spaces.findIndex(space => space.id === id);
  const destination = state.spaces[Math.max(0, index - 1)].id === id ? state.spaces[1].id : state.spaces[Math.max(0, index - 1)].id;
  const windows = Object.fromEntries(Object.entries(state.windows).map(([window, space]) => [window, space === id ? destination : space]));
  const fronts = { ...state.fronts }; delete fronts[id];
  return { spaces: state.spaces.filter(space => space.id !== id), active: state.active === id ? destination : state.active, windows, fronts };
}
export function restoreSpaces(value: unknown): SpacesState {
  const candidate = value as SpacesState;
  if (!candidate || !Array.isArray(candidate.spaces) || !candidate.spaces.length || candidate.spaces.length > 6
    || candidate.spaces.some(space => !space || typeof space.id !== "string" || !/^desktop-[\w-]+$/.test(space.id) || typeof space.name !== "string" || space.name.length > 24)
    || new Set(candidate.spaces.map(space => space.id)).size !== candidate.spaces.length) return initialSpaces();
  const ids = new Set(candidate.spaces.map(space => space.id));
  const windows = Object.fromEntries(Object.entries(candidate.windows ?? {}).filter(([key, id]) => key.length < 500 && typeof id === "string" && ids.has(id)));
  return { spaces: candidate.spaces, active: ids.has(candidate.active) ? candidate.active : candidate.spaces[0].id, windows, fronts: {} };
}

/** Gather existing windows without closing their work when Spaces is disabled. */
export function collapseSpaces(state: SpacesState): SpacesState {
  if (state.spaces.length === 1) return state;
  const id = state.spaces[0].id;
  return { spaces: [state.spaces[0]], active: id,
    windows: Object.fromEntries(Object.keys(state.windows).map(window => [window, id])),
    fronts: { [id]: state.fronts[state.active] ?? state.fronts[id] ?? "tasks" } };
}
