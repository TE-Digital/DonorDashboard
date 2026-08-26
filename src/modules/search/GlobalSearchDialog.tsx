// src/modules/search/GlobalSearchDialog.tsx
//
// The search behind the top bar's magnifier and ⌘K. One box over the whole
// directory: results arrive grouped by what they are, and Enter opens the
// record. Tables no longer carry their own search box — this is where finding
// a person or a place happens.

import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Icon, Input } from "../../design-system/lumen";
import {
  CATEGORY_LABELS,
  CATEGORY_MARKS,
  categoriesForRole,
  runGlobalSearch,
  type SearchCategory,
  type SearchHit,
} from "./globalSearch";
import styles from "./GlobalSearchDialog.module.scss";

export interface GlobalSearchDialogProps {
  open: boolean;
  onClose: () => void;
}

const TINTS: Record<string, string> = {
  blue: "var(--blue-25)",
  teal: "var(--teal-50)",
  amber: "var(--amber-50)",
  plum: "var(--plum-50)",
};

const MARKS: Record<string, string> = {
  blue: "var(--blue-500)",
  teal: "var(--teal-600)",
  amber: "var(--amber-700)",
  plum: "var(--plum-500)",
};

export const GlobalSearchDialog: React.FC<GlobalSearchDialogProps> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const { role } = useAuth();

  const [term, setTerm] = React.useState("");
  const [results, setResults] = React.useState<Record<SearchCategory, SearchHit[]> | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const categories = React.useMemo(() => categoriesForRole(role), [role]);

  // One flat list behind the grouped view, so the arrow keys can run straight
  // down the results without caring where a group ends.
  const flat = React.useMemo(() => {
    if (!results) return [];
    return categories.flatMap((c) => results[c]);
  }, [results, categories]);

  React.useEffect(() => {
    if (!open) {
      setTerm("");
      setResults(null);
      setActive(0);
      return;
    }
    const id = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(id);
  }, [open]);

  // Debounced, and every run is stamped: a slow early request can't overwrite
  // the results of a later, faster one.
  React.useEffect(() => {
    if (!open) return;
    if (term.trim().length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }

    let live = true;
    setLoading(true);
    const id = window.setTimeout(async () => {
      const next = await runGlobalSearch(term, role);
      if (!live) return;
      setResults(next);
      setActive(0);
      setLoading(false);
    }, 200);

    return () => {
      live = false;
      window.clearTimeout(id);
    };
  }, [term, role, open]);

  const go = React.useCallback(
    (hit: SearchHit) => {
      onClose();
      navigate(hit.to);
    },
    [navigate, onClose],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (flat.length ? (i + 1) % flat.length : 0));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0));
      return;
    }
    if (e.key === "Enter" && flat[active]) {
      e.preventDefault();
      go(flat[active]);
    }
  };

  if (!open) return null;

  const total = flat.length;
  const searched = term.trim().length >= 2;

  let index = -1;

  return (
    <div className={styles.overlay} role="presentation" onMouseDown={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className={styles.field}>
          <Input
            inputRef={inputRef}
            icon="search"
            size="lg"
            fullWidth
            placeholder="Search students, teachers, schools, donors"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            ariaLabel="Search the platform"
          />
        </div>

        <div className={styles.body}>
          {!searched && (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon} data-tone="prompt">
                <Icon name="search" size={20} strokeWidth={1.5} />
              </span>
              <p className={styles.emptyText}>Type at least two letters to search the directory.</p>
            </div>
          )}

          {searched && loading && total === 0 && (
            <div className={styles.emptyState}>
              <span className={`${styles.emptyIcon} ${styles.emptyIconPulse}`} data-tone="prompt">
                <Icon name="search" size={20} strokeWidth={1.5} />
              </span>
              <p className={styles.emptyText}>Searching…</p>
            </div>
          )}

          {searched && !loading && total === 0 && (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon} data-tone="empty">
                <Icon name="inbox" size={20} strokeWidth={1.5} />
              </span>
              <p className={styles.emptyText}>Nothing matches “{term.trim()}”.</p>
            </div>
          )}

          {searched &&
            results &&
            categories.map((category) => {
              const hits = results[category];
              if (!hits.length) return null;
              const mark = CATEGORY_MARKS[category];

              return (
                <section key={category} className={styles.group}>
                  <h2 className={styles.groupTitle}>{CATEGORY_LABELS[category]}</h2>
                  {hits.map((hit) => {
                    index += 1;
                    const i = index;
                    return (
                      <button
                        key={hit.id}
                        type="button"
                        className={styles.hit}
                        data-active={i === active || undefined}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => go(hit)}
                      >
                        <span
                          className={styles.mark}
                          style={{
                            background: TINTS[mark.accent],
                            color: MARKS[mark.accent],
                          }}
                        >
                          <Icon name={mark.icon} size={16} strokeWidth={1.5} />
                        </span>
                        <span className={styles.hitText}>
                          <span className={styles.hitTitle}>{hit.title}</span>
                          {hit.subtitle && <span className={styles.hitSub}>{hit.subtitle}</span>}
                        </span>
                        <Icon name="arrow-right" size={14} />
                      </button>
                    );
                  })}
                </section>
              );
            })}
        </div>

        <div className={styles.footer}>
          <span className={styles.footerHint}>
            <kbd>↑</kbd>
            <kbd>↓</kbd> to move
          </span>
          <span className={styles.footerHint}>
            <kbd>↵</kbd> to open
          </span>
          <span className={styles.footerHint}>
            <kbd>esc</kbd> to close
          </span>
        </div>
      </div>
    </div>
  );
};

export default GlobalSearchDialog;
