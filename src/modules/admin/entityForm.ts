// src/modules/admin/entityForm.ts
//
// The contract between a form and whatever is holding it.
//
// School, student and teacher forms are each used twice: once as a route of
// their own, once inside a FormDrawer opened from another screen. The fields
// and the save belong to the form; the action bar belongs to the container,
// because a drawer pins it to the foot and a page puts it at the end of the
// document. The container therefore submits through this handle and is told
// when a save starts and stops.

export interface EntityFormHandle {
  /** Runs validation and saves, exactly as pressing the form's own submit would. */
  submit: () => void;
}

export interface EntityFormOwnerProps {
  /**
   * Reports the form's current error to whoever owns the action bar. In a
   * drawer the fields scroll and the button does not, so a validation message
   * rendered at the top of the form can sit off-screen at the exact moment the
   * admin presses Save. The container repeats it next to the button.
   */
  onErrorChange?: (message: string | null) => void;
  /** True once anything has been typed — used to guard an accidental close. */
  onDirtyChange?: (dirty: boolean) => void;
  /** Fires on every change of the in-flight state, so a container can disable
   *  its buttons and swap the label to "Saving…". */
  onSavingChange?: (saving: boolean) => void;
  /** Cancel, when the container wants the form to render its own action bar. */
  onCancel?: () => void;
  /** Renders the form's own action bar. A drawer passes false and supplies one. */
  showActions?: boolean;
  submitLabel?: string;
}

/**
 * Turns a Postgres refusal into a sentence.
 *
 * A teacher reaching /teacher/students/new hits the admin-only insert policy on
 * `students`, and PostgREST answers with the policy name. That is a true
 * statement about the database and a useless one to the person reading it.
 */
export const writeFailureMessage = (
  error: { code?: string; message?: string } | null,
  noun: string,
): string => {
  const message = error?.message ?? "";
  const denied =
    error?.code === "42501" ||
    message.toLowerCase().includes("row-level security") ||
    message.toLowerCase().includes("violates row-level security policy");

  if (denied) {
    return `Your account is not allowed to create a ${noun}. Ask an administrator to add it.`;
  }
  return message || `Could not create the ${noun}.`;
};
