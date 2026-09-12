export const DEFAULT_UI_PREFERENCES = Object.freeze({ desktopSpacesEnabled: false, previewWidthScale: 1.5 });
export const PREVIEW_WIDTH_SCALES = Object.freeze([1, 1.25, 1.5, 1.75, 2]);

/** Only these two presentation-independent values cross the desktop bridge. */
export function normalizeUiPreferences(value) {
  return {
    desktopSpacesEnabled: typeof value?.desktopSpacesEnabled === 'boolean' ? value.desktopSpacesEnabled : false,
    previewWidthScale: PREVIEW_WIDTH_SCALES.includes(value?.previewWidthScale) ? value.previewWidthScale : 1.5,
  };
}
