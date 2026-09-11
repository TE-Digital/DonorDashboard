import React from "react";
import { Icon } from "./Icon";
import { IconButton } from "./core";

/* ------------------------------------------------------------------ Banner */

export type FeedbackTone = "info" | "success" | "warning" | "danger";

const BANNER: Record<FeedbackTone, [string, string, string, string]> = {
  info: ["var(--blue-50)", "var(--blue-100)", "var(--blue-700)", "info"],
  warning: ["var(--amber-50)", "#eeddc0", "var(--amber-700)", "triangle-alert"],
  danger: ["var(--red-50)", "#f0d2cd", "var(--red-700)", "circle-alert"],
  success: ["var(--green-50)", "#cfe3d8", "var(--green-700)", "check-circle-2"],
};

export interface BannerProps {
  tone?: FeedbackTone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
}

export const Banner: React.FC<BannerProps> = ({ tone = "info", title, children, action }) => {
  const [bg, bd, fg, ic] = BANNER[tone] || BANNER.info;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 9,
        padding: "10px 12px",
        background: bg,
        border: "1px solid " + bd,
        borderRadius: "var(--radius-md)",
        fontSize: "var(--fs-sm)",
        color: "var(--text-body)",
      }}
    >
      <span style={{ color: fg, display: "flex", marginTop: 1 }}>
        <Icon name={ic} size={15} />
      </span>
      <div style={{ flex: 1, textWrap: "pretty" }}>
        {title && (
          <div style={{ fontWeight: "var(--fw-semibold)" as unknown as number, color: fg }}>{title}</div>
        )}
        {children}
      </div>
      {action}
    </div>
  );
};

/* ------------------------------------------------------------------- Toast */

const TOAST: Record<FeedbackTone, [string, string]> = {
  info: ["var(--blue-500)", "info"],
  success: ["var(--green-500)", "check-circle-2"],
  warning: ["var(--amber-500)", "triangle-alert"],
  danger: ["var(--red-500)", "circle-alert"],
};

export interface ToastProps {
  tone?: FeedbackTone;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  onDismiss?: () => void;
}

export const Toast: React.FC<ToastProps> = ({ tone = "info", title, description, action, onDismiss }) => {
  const [c, ic] = TOAST[tone] || TOAST.info;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        width: 340,
        padding: "10px 10px 10px 12px",
        background: "var(--n-0)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border-subtle)",
        boxShadow: "var(--shadow-overlay)",
      }}
    >
      <span style={{ color: c, display: "flex", marginTop: 1 }}>
        <Icon name={ic} size={16} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "var(--fs-sm)",
            fontWeight: "var(--fw-semibold)" as unknown as number,
            color: "var(--text-heading)",
          }}
        >
          {title}
        </div>
        {description && (
          <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-muted)", marginTop: 2 }}>
            {description}
          </div>
        )}
        {action && <div style={{ marginTop: 6 }}>{action}</div>}
      </div>
      <IconButton icon="x" size="sm" label="Dismiss" onClick={onDismiss} />
    </div>
  );
};

/* ----------------------------------------------------------------- Tooltip */

export interface TooltipProps {
  label: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  children?: React.ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({ label, side = "top", children }) => {
  const [on, setOn] = React.useState(false);
  const pos: React.CSSProperties =
    side === "top"
      ? { bottom: "100%", left: "50%", transform: "translate(-50%,-6px)" }
      : side === "bottom"
        ? { top: "100%", left: "50%", transform: "translate(-50%,6px)" }
        : side === "left"
          ? { right: "100%", top: "50%", transform: "translate(-6px,-50%)" }
          : { left: "100%", top: "50%", transform: "translate(6px,-50%)" };
  return (
    <span
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setOn(true)}
      onMouseLeave={() => setOn(false)}
    >
      {children}
      {on && (
        <span
          role="tooltip"
          style={{
            position: "absolute",
            ...pos,
            zIndex: 50,
            background: "var(--n-900)",
            color: "var(--n-0)",
            fontSize: "var(--fs-micro)",
            lineHeight: 1.4,
            padding: "4px 7px",
            borderRadius: "var(--radius-sm)",
            whiteSpace: "nowrap",
            boxShadow: "var(--shadow-raised)",
          }}
        >
          {label}
        </span>
      )}
    </span>
  );
};

/* ------------------------------------------------------------------ Dialog */

export interface DialogProps {
  open?: boolean;
  title?: React.ReactNode;
  description?: React.ReactNode;
  width?: number | string;
  footer?: React.ReactNode;
  onClose?: () => void;
  children?: React.ReactNode;
}

export const Dialog: React.FC<DialogProps> = ({
  open = true,
  title,
  description,
  width = 460,
  footer,
  onClose,
  children,
}) => {
  // Named by its title and described by its description, so a screen reader
  // announces what the dialog is for, not just "dialog".
  const titleId = React.useId();
  const descriptionId = React.useId();
  if (!open) return null;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 60,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: 72,
        background: "rgba(33,30,27,.34)",
        backdropFilter: "blur(1.5px)",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        style={{
          width,
          maxWidth: "92%",
          background: "var(--n-0)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-subtle)",
          boxShadow: "var(--shadow-overlay)",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 14px 0 18px" }}>
          <div style={{ flex: 1 }}>
            <h2
              id={titleId}
              style={{
                fontSize: "var(--fs-h2)",
                lineHeight: "var(--lh-h2)",
                fontWeight: "var(--fw-semibold)" as unknown as number,
              }}
            >
              {title}
            </h2>
            {description && (
              <p
                id={descriptionId}
                style={{
                  margin: "4px 0 0",
                  fontSize: "var(--fs-sm)",
                  color: "var(--text-muted)",
                  textWrap: "pretty",
                }}
              >
                {description}
              </p>
            )}
          </div>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </div>
        <div style={{ padding: "14px 18px 18px" }}>{children}</div>
        {footer && (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              padding: "12px 18px",
              background: "var(--n-25)",
              borderTop: "1px solid var(--border-subtle)",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
