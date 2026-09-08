"use client";

import { useEffect, useRef } from "react";
import { SyntropicMark } from "./SyntropicMark";

interface Props {
  label: string;
  title: string;
  description?: string;
  ariaLabel: string;
  action?: { label: string; onClick: () => void; disabled?: boolean };
  onDismiss: () => void;
  dismissLabel: string;
  autoDismiss?: boolean;
}

/** One visible surface for workspace status, insights and publication actions. */
export function DesktopNotification({ label, title, description, ariaLabel, action, onDismiss, dismissLabel, autoDismiss = false }: Props) {
  const dismissRef = useRef(onDismiss);
  useEffect(() => { dismissRef.current = onDismiss; }, [onDismiss]);
  useEffect(() => {
    if (!autoDismiss) return;
    // Time only while visible: a publication action can preempt a status notice.
    const timer = window.setTimeout(() => dismissRef.current(), 3200);
    return () => window.clearTimeout(timer);
  }, [autoDismiss, title]);

  return <aside className="agent-os-insight-notification agent-os-jd-notification" data-testid="desktop-notification" aria-label={ariaLabel} role={autoDismiss ? "status" : undefined}>
    <span><SyntropicMark size={25}/></span>
    <span><small className="label">{label}</small><strong>{title}</strong>{description && <small>{description}</small>}</span>
    {action && <button type="button" disabled={action.disabled} onClick={action.onClick}>{action.label}</button>}
    <button type="button" className="jd-dismiss" aria-label={dismissLabel} onClick={onDismiss}>×</button>
  </aside>;
}
