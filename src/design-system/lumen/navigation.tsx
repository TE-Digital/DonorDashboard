import React from "react";
import { Icon } from "./Icon";
import { IconButton } from "./core";
import { Tooltip } from "./feedback";

/* ---------------------------------------------------------------- IconRail */

export interface RailItem {
  id: string;
  icon: string;
  label: string;
  badge?: React.ReactNode;
}

export interface IconRailProps {
  items?: RailItem[];
  activeId?: string;
  onNavigate?: (id: string) => void;
  brand?: React.ReactNode;
  footer?: RailItem[];
}

export const IconRail: React.FC<IconRailProps> = ({
  items = [],
  activeId,
  onNavigate,
  brand = "L",
  footer = [],
}) => {
  const [h, setH] = React.useState<string | null>(null);

  const btn = (it: RailItem) => {
    const on = activeId === it.id;
    const hv = h === it.id;
    return (
      <Tooltip key={it.id} label={it.label} side="right">
        <button
          type="button"
          onClick={() => onNavigate && onNavigate(it.id)}
          onMouseEnter={() => setH(it.id)}
          onMouseLeave={() => setH(null)}
          style={{
            position: "relative",
            width: 36,
            height: 36,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "var(--radius-md)",
            border: "none",
            cursor: "pointer",
            background: on ? "var(--nav-item-active)" : hv ? "rgba(33,30,27,.05)" : "transparent",
            color: on ? "var(--text-heading)" : "var(--text-muted)",
            boxShadow: on ? "var(--shadow-card)" : "none",
            transition: "var(--motion-hover)",
          }}
        >
          <Icon name={it.icon} size={16} />
          {it.badge != null && (
            <span
              style={{
                position: "absolute",
                top: -2,
                right: -2,
                minWidth: 15,
                height: 15,
                padding: "0 3px",
                borderRadius: "var(--radius-pill)",
                background: "var(--amber-500)",
                color: "var(--text-inverse)",
                fontSize: "var(--fs-micro)",
                fontWeight: "var(--fw-bold)" as unknown as number,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1.5px solid var(--surface-rail)",
              }}
            >
              {it.badge}
            </span>
          )}
        </button>
      </Tooltip>
    );
  };

  return (
    <div
      style={{
        width: "var(--rail-w)",
        flex: "0 0 auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        padding: "16px 0 12px",
        background: "var(--surface-rail)",
      }}
    >
      <span
        style={{
          width: 32,
          height: 32,
          borderRadius: "var(--radius-md)",
          background: "var(--n-900)",
          color: "var(--text-inverse)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: "var(--fw-bold)" as unknown as number,
          fontSize: "var(--fs-sm)",
          marginBottom: 10,
        }}
      >
        {brand}
      </span>
      {items.map(btn)}
      <div style={{ flex: 1 }} />
      {footer.map(btn)}
    </div>
  );
};

/* ----------------------------------------------------------------- SideNav */

export interface NavChild {
  id: string;
  label: React.ReactNode;
  badge?: React.ReactNode;
}

export interface NavModule {
  id: string;
  label?: React.ReactNode;
  icon?: string;
  badge?: React.ReactNode;
  section?: React.ReactNode;
  children?: NavChild[];
}

export interface SideNavProps {
  modules?: NavModule[];
  activeId?: string;
  onNavigate?: (id: string) => void;
  workspace?: React.ReactNode;
  footer?: React.ReactNode;
  collapsed?: boolean;
}

export const SideNav: React.FC<SideNavProps> = ({
  modules = [],
  activeId,
  onNavigate,
  workspace,
  footer,
  collapsed,
}) => {
  const [open, setOpen] = React.useState<Record<string, boolean>>(() => {
    const s: Record<string, boolean> = {};
    modules.forEach((m) => {
      if (m.children && m.children.some((c) => c.id === activeId)) s[m.id] = true;
    });
    return s;
  });
  const [hover, setHover] = React.useState<string | null>(null);
  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  const rowBase: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
    height: 36,
    padding: "0 12px",
    background: "transparent",
    border: "none",
    borderRadius: "var(--radius-md)",
    cursor: "pointer",
    font: "inherit",
    fontSize: "var(--fs-body)",
    textAlign: "left",
    transition: "var(--motion-hover)",
    color: "var(--text-body)",
  };

  return (
    <nav
      style={{
        width: collapsed ? "var(--nav-w-collapsed)" : "var(--nav-w)",
        flex: "0 0 auto",
        display: "flex",
        flexDirection: "column",
        background: "var(--surface-nav)",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {workspace && !collapsed && (
        <div
          style={{
            padding: "18px 16px 10px",
            fontSize: "var(--fs-xs)",
            color: "var(--text-subtle)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {workspace}
        </div>
      )}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "6px 10px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {modules.map((m) => {
          if (m.section)
            return (
              <div
                key={m.id}
                style={{
                  padding: "16px 10px 6px",
                  fontSize: "var(--fs-micro)",
                  letterSpacing: "var(--ls-caps)",
                  textTransform: "uppercase",
                  color: "var(--n-400)",
                }}
              >
                {!collapsed && m.section}
              </div>
            );

          const kids = m.children || [];
          const isOpen = !!open[m.id];
          const activeSelf = activeId === m.id;
          const activeChild = kids.some((c) => c.id === activeId);
          const hl = hover === m.id;

          return (
            <div key={m.id}>
              <button
                type="button"
                onMouseEnter={() => setHover(m.id)}
                onMouseLeave={() => setHover(null)}
                onClick={() => (kids.length ? toggle(m.id) : onNavigate && onNavigate(m.id))}
                style={{
                  ...rowBase,
                  background: activeSelf
                    ? "var(--nav-item-active)"
                    : hl
                      ? "rgba(33,30,27,.045)"
                      : "transparent",
                  boxShadow: activeSelf ? "var(--shadow-card)" : "none",
                  color: activeSelf || activeChild ? "var(--text-heading)" : "var(--text-body)",
                  fontWeight: (activeSelf || activeChild
                    ? "var(--fw-medium)"
                    : "var(--fw-regular)") as unknown as number,
                }}
              >
                <span
                  style={{ display: "flex", color: activeSelf ? "var(--text-heading)" : "var(--n-500)" }}
                >
                  <Icon name={m.icon || "circle"} size={16} />
                </span>
                {!collapsed && (
                  <>
                    <span
                      style={{
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {m.label}
                    </span>
                    {m.badge && (
                      <span
                        style={{
                          minWidth: 18,
                          height: 18,
                          padding: "0 5px",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: "var(--radius-pill)",
                          background: "var(--n-200)",
                          color: "var(--text-muted)",
                          fontSize: "var(--fs-micro)",
                          fontWeight: "var(--fw-semibold)" as unknown as number,
                        }}
                      >
                        {m.badge}
                      </span>
                    )}
                    {kids.length > 0 && (
                      <span
                        style={{
                          display: "inline-flex",
                          transform: "rotate(" + (isOpen ? 90 : 0) + "deg)",
                          transition: "transform var(--dur-base) var(--ease-standard)",
                          color: "var(--n-400)",
                        }}
                      >
                        <Icon name="chevron-right" size={12} />
                      </span>
                    )}
                  </>
                )}
              </button>
              {!collapsed && kids.length > 0 && isOpen && (
                <div
                  style={{
                    marginLeft: 18,
                    paddingLeft: 12,
                    borderLeft: "1px solid var(--n-200)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                    marginTop: 2,
                    marginBottom: 4,
                  }}
                >
                  {kids.map((c) => {
                    const on = activeId === c.id;
                    const ch = hover === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onMouseEnter={() => setHover(c.id)}
                        onMouseLeave={() => setHover(null)}
                        onClick={() => onNavigate && onNavigate(c.id)}
                        style={{
                          ...rowBase,
                          height: 32,
                          fontSize: "var(--fs-sm)",
                          background: on
                            ? "var(--nav-item-active)"
                            : ch
                              ? "rgba(33,30,27,.04)"
                              : "transparent",
                          boxShadow: on ? "var(--shadow-card)" : "none",
                          color: on ? "var(--text-heading)" : "var(--text-muted)",
                          fontWeight: (on
                            ? "var(--fw-medium)"
                            : "var(--fw-regular)") as unknown as number,
                        }}
                      >
                        <span
                          style={{
                            flex: 1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {c.label}
                        </span>
                        {c.badge && (
                          <span style={{ fontSize: "var(--fs-micro)", color: "var(--n-400)" }}>
                            {c.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {footer && <div style={{ padding: "10px 14px 14px" }}>{footer}</div>}
    </nav>
  );
};

/* -------------------------------------------------------------------- Tabs */

export interface TabItem {
  value: string;
  label: React.ReactNode;
  count?: number;
  /** Unreachable for now — an unsaved edit on the current tab, typically. */
  disabled?: boolean;
}

export interface TabsProps {
  tabs?: TabItem[];
  value?: string;
  onChange?: (value: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({ tabs = [], value, onChange }) => {
  const [h, setH] = React.useState<string | null>(null);
  return (
    <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--border-subtle)" }}>
      {tabs.map((t) => {
        const on = value === t.value;
        return (
          <button
            key={t.value}
            type="button"
            disabled={t.disabled}
            title={t.disabled ? "Finish or cancel the edit first" : undefined}
            onClick={() => !t.disabled && onChange && onChange(t.value)}
            onMouseEnter={() => setH(t.value)}
            onMouseLeave={() => setH(null)}
            style={{
              background: "transparent",
              border: "none",
              padding: "0 10px",
              height: 34,
              font: "inherit",
              fontSize: "var(--fs-body)",
              fontWeight: (on ? "var(--fw-semibold)" : "var(--fw-regular)") as unknown as number,
              color: t.disabled
                ? "var(--text-subtle)"
                : on
                  ? "var(--text-heading)"
                  : h === t.value
                    ? "var(--text-body)"
                    : "var(--text-muted)",
              borderBottom: "2px solid " + (on ? "var(--action-primary)" : "transparent"),
              marginBottom: -1,
              cursor: t.disabled ? "not-allowed" : "pointer",
              transition: "var(--motion-hover)",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {t.label}
            {t.count != null && (
              <span
                style={{
                  fontSize: "var(--fs-micro)",
                  color: "var(--text-subtle)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------------ TopBar */

export interface TopBarProps {
  workspace?: string;
  breadcrumbs?: Array<string | { label: string; onClick?: () => void }>;
  title?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  notifications?: number;
  user?: React.ReactNode;
  /** Opens the global search. Without it the magnifier is not rendered. */
  onSearch?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  workspace,
  breadcrumbs = [],
  title,
  meta,
  actions,
  notifications,
  user,
  onSearch,
}) => (
  <header
    style={{
      display: "flex",
      alignItems: "center",
      gap: 16,
      height: 56,
      padding: "0 12px 0 16px",
      background: "var(--surface-nav)",
      flex: "0 0 auto",
    }}
  >
    {workspace && (
      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingRight: 10, minWidth: 0 }}>
        <span
          style={{
            width: 24,
            height: 24,
            borderRadius: "var(--radius-sm)",
            background: "var(--n-900)",
            color: "var(--text-inverse)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "var(--fs-micro)",
            fontWeight: "var(--fw-bold)" as unknown as number,
            flex: "0 0 auto",
          }}
        >
          {workspace.slice(0, 1)}
        </span>
        <span
          style={{
            fontSize: "var(--fs-body)",
            fontWeight: "var(--fw-semibold)" as unknown as number,
            color: "var(--text-heading)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {workspace}
        </span>
        <Icon name="chevron-down" size={16} color="var(--n-500)" />
      </div>
    )}
    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
      {breadcrumbs.map((breadcrumb, index) => {
        const item = typeof breadcrumb === "string" ? { label: breadcrumb } : breadcrumb;
        return (
        <React.Fragment key={`${item.label}-${index}`}>
          {item.onClick ? (
            <button
              type="button"
              onClick={item.onClick}
              style={{
                padding: 0,
                border: 0,
                background: "transparent",
                color: "var(--text-muted)",
                font: "inherit",
                fontSize: "var(--fs-body)",
                whiteSpace: "nowrap",
                cursor: "pointer",
              }}
            >
              {item.label}
            </button>
          ) : (
            <span style={{ fontSize: "var(--fs-body)", color: "var(--text-subtle)", whiteSpace: "nowrap" }}>
              {item.label}
            </span>
          )}
          <span style={{ color: "var(--n-300)" }}>/</span>
        </React.Fragment>
        );
      })}
      <span
        style={{
          fontSize: "var(--fs-body)",
          fontWeight: "var(--fw-semibold)" as unknown as number,
          color: "var(--text-heading)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {title}
      </span>
      {meta && (
        <span style={{ fontSize: "var(--fs-sm)", color: "var(--text-subtle)", whiteSpace: "nowrap" }}>
          {meta}
        </span>
      )}
    </div>
    <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
      {actions}
      {onSearch && <IconButton icon="search" label="Search" onClick={onSearch} />}
      <span style={{ position: "relative", display: "inline-flex" }}>
        <IconButton icon="bell" label="Notifications" />
        {!!notifications && notifications > 0 && (
          <span
            style={{
              position: "absolute",
              top: 3,
              right: 3,
              minWidth: 14,
              height: 14,
              padding: "0 3px",
              borderRadius: "var(--radius-pill)",
              background: "var(--red-500)",
              color: "var(--text-inverse)",
              fontSize: "var(--fs-micro)",
              fontWeight: "var(--fw-bold)" as unknown as number,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1.5px solid var(--surface-nav)",
            }}
          >
            {notifications}
          </span>
        )}
      </span>
      <IconButton icon="circle-help" label="Help" />
      {user && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: "var(--radius-pill)",
            background: "var(--n-0)",
            border: "1px solid var(--border-subtle)",
            fontSize: "var(--fs-micro)",
            fontWeight: "var(--fw-semibold)" as unknown as number,
            color: "var(--text-muted)",
            marginLeft: 2,
          }}
        >
          {user}
        </span>
      )}
    </div>
  </header>
);
