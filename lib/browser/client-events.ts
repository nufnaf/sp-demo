import { subscribeDesktopEvents } from "../desktop-events-client";

export function subscribeBrowserEvents(listener: { message: (event: MessageEvent) => void; open?: () => void }): () => void {
  return subscribeDesktopEvents("browser", listener);
}
