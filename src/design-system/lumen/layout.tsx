import React from "react";
import { Icon } from "./Icon";

/* ---------------------------------------------------------------- AppShell */

export interface AppShellProps {
  topBar?: React.ReactNode;
  rail?: React.ReactNode;
  nav?: React.ReactNode;
  banner?: React.ReactNode;
  children?: React.ReactNode;
}

/** Full-width top bar, then rail + labelled nav on the warm canvas, content floating as a white panel. */
export const AppShell: React.FC<AppShellProps> = ({ topBar, rail, nav, banner, children }) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      overflow: "hidden",
      background: "var(--bg-app)",
    }}
  >
    {topBar}
    <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
      {rail}
      {nav}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          padding: "0 10px 10px 0",
          gap: 10,
        }}
      >
        {banner}
        <main
          style={{
            flex: 1,
            minHeight: 0,
            background: "var(--surface-card)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-xl)",
            boxShadow: "var(--shadow-panel)",
            overflow: "auto",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  </div>
);

/* -------------------------------------------------------------- PageHeader */

export interface PageHeaderProps {
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  serif?: boolean;
  size?: "lg" | "md";
  /**
   * The header carries the screen's outer padding. Pass false when it sits
   * inside a container that already provides it, so the two don't stack.
   */
  padded?: boolean;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  eyebrow,
  title,
  description,
  actions,
  serif = true,
  size = "lg",
  padded = true,
}) => (
  <header
    style={{
      display: "flex",
      alignItems: "flex-start",
      gap: 24,
      padding: !padded ? 0 : size === "lg" ? "48px 48px 0" : "28px 32px 0",
    }}
  >
    <div style={{ minWidth: 0, flex: 1 }}>
      {eyebrow && (
        <div
          style={{
            fontSize: "var(--fs-xs)",
            letterSpacing: "var(--ls-caps)",
            textTransform: "uppercase",
            color: "var(--text-subtle)",
            marginBottom: 10,
          }}
        >
          {eyebrow}
        </div>
      )}
      <h1
        style={{
          fontFamily: serif ? "var(--font-display)" : "var(--font-core)",
          fontWeight: serif ? 400 : 600,
          fontSize: size === "lg" ? "var(--fs-hero)" : "var(--fs-h1)",
          lineHeight: size === "lg" ? "var(--lh-hero)" : "var(--lh-h1)",
          letterSpacing: serif ? "-0.01em" : "var(--ls-tight)",
          textWrap: "pretty",
        }}
      >
        {title}
      </h1>
      {description && (
        <p
          style={{
            margin: "10px 0 0",
            maxWidth: 620,
            fontSize: "var(--fs-body)",
            color: "var(--text-muted)",
            textWrap: "pretty",
          }}
        >
          {description}
        </p>
      )}
    </div>
    {actions && (
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          flexWrap: "wrap",
          gap: 8,
          paddingTop: 6,
        }}
      >
        {actions}
      </div>
    )}
  </header>
);

/* --------------------------------------------------------------- Checklist */

export interface ChecklistItem {
  id: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  done?: boolean;
}

export interface ChecklistProps {
  title?: React.ReactNode;
  progress?: React.ReactNode;
  items?: ChecklistItem[];
  expandedId?: string | null;
  onExpand?: (id: string | null) => void;
  media?: React.ReactNode;
}

export const Checklist: React.FC<ChecklistProps> = ({
  title,
  progress,
  items = [],
  expandedId,
  onExpand,
  media,
}) => (
  <div>
    {(title || progress) && (
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span
          style={{
            width: 20,
            height: 20,
            borderRadius: "50%",
            border: "1.5px solid var(--n-300)",
            flex: "0 0 auto",
          }}
        />
        <span
          style={{
            fontSize: "var(--fs-h3)",
            fontWeight: "var(--fw-semibold)" as unknown as number,
            color: "var(--text-heading)",
          }}
        >
          {title}
        </span>
        {progress && (
          <>
            <span style={{ color: "var(--n-300)" }}>·</span>
            <span style={{ fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>{progress}</span>
          </>
        )}
      </div>
    )}
    <div
      style={{
        display: "flex",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-xl)",
        background: "var(--surface-card)",
        boxShadow: "var(--shadow-card)",
        overflow: "hidden",
      }}
    >
      <div style={{ flex: 1, minWidth: 0, padding: "8px 24px" }}>
        {items.map((it, i) => {
          const open = expandedId === it.id;
          return (
            <div key={it.id} style={{ borderTop: i === 0 ? "none" : "1px solid var(--border-subtle)" }}>
              <button
                type="button"
                onClick={() => onExpand && onExpand(open ? null : it.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  width: "100%",
                  padding: "20px 0",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  font: "inherit",
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    flex: "0 0 auto",
                    border: "1.5px solid " + (it.done ? "var(--green-500)" : "var(--n-300)"),
                    background: it.done ? "var(--green-500)" : "transparent",
                    color: "#fff",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {it.done && <Icon name="check" size={11} strokeWidth={3} />}
                </span>
                <span
                  style={{
                    flex: 1,
                    fontSize: "var(--fs-h3)",
                    fontWeight: "var(--fw-semibold)" as unknown as number,
                    color: "var(--text-heading)",
                  }}
                >
                  {it.title}
                </span>
                {!open && <Icon name="chevron-right" size={16} color="var(--n-400)" />}
              </button>
              {open && (
                <div
                  style={{
                    padding: "0 0 20px 36px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 14,
                  }}
                >
                  {it.description && (
                    <p
                      style={{
                        margin: 0,
                        maxWidth: 460,
                        fontSize: "var(--fs-body)",
                        color: "var(--text-muted)",
                        textWrap: "pretty",
                      }}
                    >
                      {it.description}
                    </p>
                  )}
                  {it.action}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {media && <div style={{ width: 300, flex: "0 0 auto", padding: 16, display: "flex" }}>{media}</div>}
    </div>
  </div>
);

/* ---------------------------------------------------------------- TileCard */

export interface TileCardProps {
  media?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}

export const TileCard: React.FC<TileCardProps> = ({ media, title, description, meta, onClick }) => {
  const [h, setH] = React.useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 12,
        textAlign: "left",
        font: "inherit",
        padding: 20,
        background: "var(--surface-card)",
        border: "1px solid " + (h ? "var(--border-default)" : "var(--border-subtle)"),
        borderRadius: "var(--radius-xl)",
        boxShadow: h ? "var(--shadow-raised)" : "var(--shadow-card)",
        cursor: "pointer",
        transition: "var(--motion-hover), box-shadow var(--dur-base) var(--ease-standard)",
      }}
    >
      {media}
      <div>
        <div
          style={{
            fontSize: "var(--fs-h3)",
            fontWeight: "var(--fw-semibold)" as unknown as number,
            color: "var(--text-heading)",
          }}
        >
          {title}
        </div>
        {description && (
          <div
            style={{
              marginTop: 5,
              fontSize: "var(--fs-sm)",
              color: "var(--text-muted)",
              textWrap: "pretty",
            }}
          >
            {description}
          </div>
        )}
      </div>
      {meta && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            marginTop: "auto",
            fontSize: "var(--fs-xs)",
            color: "var(--text-subtle)",
          }}
        >
          {meta}
          <Icon name="arrow-right" size={13} />
        </div>
      )}
    </button>
  );
};
