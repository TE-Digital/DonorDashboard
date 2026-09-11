// src/modules/admin/ProfileCompletionBar.tsx
//
// How much of a student's record is filled in, as a bar and a number.
//
// The same component and the same calculation on the student's own page and in
// the directory, because a percentage that means one thing in a list and
// another on a record is a percentage nobody checks twice.
//
// The bar is never the only signal: the number is always beside it, and the
// tooltip names what is missing. A colour alone would say "something is wrong"
// without saying what, which is the least useful thing a screen can do.

import React from "react";
import { completionTone, type ProfileCompletion } from "./studentProfile";
import styles from "./ProfileCompletionBar.module.scss";

export interface ProfileCompletionBarProps {
  completion: ProfileCompletion;
  /** Compact drops the caption, for a table cell. */
  size?: "compact" | "full";
  /** Makes the whole thing a button — used to jump to the first missing field. */
  onJumpToFirstMissing?: () => void;
}

export const ProfileCompletionBar: React.FC<ProfileCompletionBarProps> = ({
  completion,
  size = "full",
  onJumpToFirstMissing,
}) => {
  const tone = completionTone(completion.percent);

  const title =
    completion.missing.length === 0
      ? "Every field on this record is filled in."
      : `Missing: ${completion.missing.map((field) => field.label).join(", ")}`;

  const body = (
    <>
      <span className={styles.track} aria-hidden="true">
        <span
          className={`${styles.fill} ${styles[tone]}`}
          style={{ width: `${completion.percent}%` }}
        />
      </span>
      <span className={styles.value}>{completion.percent}%</span>
    </>
  );

  const label = `Profile ${completion.percent} per cent complete. ${
    completion.missing.length
      ? `${completion.missing.length} fields missing.`
      : "Nothing missing."
  }`;

  if (onJumpToFirstMissing && completion.missing.length > 0) {
    return (
      <button
        type="button"
        className={`${styles.wrap} ${styles[size]} ${styles.clickable}`}
        title={`${title}. Select to go to the first one.`}
        aria-label={`${label} Jump to ${completion.missing[0].label}.`}
        onClick={(event) => {
          event.stopPropagation();
          onJumpToFirstMissing();
        }}
      >
        {body}
      </button>
    );
  }

  return (
    <span className={`${styles.wrap} ${styles[size]}`} title={title} aria-label={label}>
      {body}
    </span>
  );
};

export default ProfileCompletionBar;
