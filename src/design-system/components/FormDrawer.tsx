// src/design-system/components/FormDrawer.tsx
//
// The one way a form opens on top of a screen.
//
// Every "add X without leaving this page" flow in the product uses this: it
// slides in from the right, the title and the actions stay put, and only the
// fields scroll. A long form therefore never hides its own Save button, and the
// page underneath keeps its context — which is the whole reason the flow is a
// drawer rather than a route.
//
// Use FormPage for a form that owns a whole route; use this for one opened from
// another screen.

import React, { useEffect, useState } from "react";
import { Drawer } from "@mantine/core";
import { Button, Icon, IconButton } from "../lumen";
import styles from "./FormDrawer.module.scss";

export interface FormDrawerCrumb {
  label: string;
  /** Omitted on the last crumb — that one is where you already are. */
  onClick?: () => void;
}

export interface FormDrawerProps {
  opened: boolean;
  onClose: () => void;
  title: React.ReactNode;
  /** The supporting line under the title. */
  subtitle?: React.ReactNode;
  /**
   * The trail back through a drawer that has more than one step — creating a
   * student in the middle of creating a teacher, say. A second drawer stacked
   * on the first would bury the work in progress; a step inside the same panel
   * keeps one surface, and this says where you are in it.
   */
  breadcrumb?: FormDrawerCrumb[];
  /** Width of the panel. Forms with two columns want more than the default. */
  size?: number | string;
  /** The action bar. Pinned to the foot, never scrolls away. */
  footer?: React.ReactNode;
  /** A quiet line on the left of the action bar: "Saving…", a field count. */
  status?: React.ReactNode;
  /** Blocks the close button and the overlay while a save is in flight. */
  busy?: boolean;
  /**
   * True once the form holds work worth keeping. Closing then asks first: a
   * drawer sits under the pointer, and a stray click on the scrim should not be
   * able to bin twenty typed fields.
   */
  dirty?: boolean;
  children: React.ReactNode;
}

export const FormDrawer: React.FC<FormDrawerProps> = ({
  opened,
  onClose,
  title,
  subtitle,
  breadcrumb,
  size = 720,
  footer,
  status,
  busy,
  dirty,
  children,
}) => {
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  // A fresh opening always starts unconfirmed.
  useEffect(() => {
    if (!opened) setConfirmingDiscard(false);
  }, [opened]);

  const requestClose = () => {
    if (busy) return;
    if (dirty) {
      setConfirmingDiscard(true);
      return;
    }
    onClose();
  };

  const discard = () => {
    setConfirmingDiscard(false);
    onClose();
  };

  return (
    <Drawer
    opened={opened}
    onClose={requestClose}
    position="right"
    size={size}
    padding={0}
    withCloseButton={false}
    closeOnClickOutside={!busy}
    closeOnEscape={!busy}
    classNames={{ content: styles.content, body: styles.body }}
  >
    <header className={styles.header}>
      <div className={styles.heading}>
        {breadcrumb && breadcrumb.length > 1 && (
          <nav className={styles.crumbs} aria-label="Drawer steps">
            {breadcrumb.map((crumb, index) => {
              const last = index === breadcrumb.length - 1;
              return (
                <React.Fragment key={crumb.label}>
                  {index > 0 && (
                    <span className={styles.crumbSeparator} aria-hidden>
                      <Icon name="chevron-right" size={12} />
                    </span>
                  )}
                  {crumb.onClick && !last ? (
                    <button type="button" className={styles.crumb} onClick={crumb.onClick}>
                      {crumb.label}
                    </button>
                  ) : (
                    <span className={last ? styles.crumbCurrent : styles.crumb} aria-current={last ? "step" : undefined}>
                      {crumb.label}
                    </span>
                  )}
                </React.Fragment>
              );
            })}
          </nav>
        )}
        <h2 className={styles.title}>{title}</h2>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      <IconButton icon="x" label="Close" onClick={requestClose} disabled={busy} />
    </header>

    <div className={styles.scroll}>{children}</div>

    {(footer || confirmingDiscard) && (
      <footer className={styles.footer}>
        {confirmingDiscard ? (
          <>
            <span className={styles.footerStatus}>Discard this draft? Nothing has been saved.</span>
            <Button variant="ghost" onClick={() => setConfirmingDiscard(false)}>
              Keep editing
            </Button>
            <Button variant="danger" onClick={discard}>
              Discard
            </Button>
          </>
        ) : (
          <>
            {status && <span className={styles.footerStatus}>{status}</span>}
            {footer}
          </>
        )}
      </footer>
    )}
    </Drawer>
  );
};

export default FormDrawer;
