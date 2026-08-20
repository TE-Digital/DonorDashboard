import React from "react";
import { Icon } from "./Icon";

/* ------------------------------------------------------------------ Button */

export type ControlSize = "sm" | "md" | "lg" | "xl";
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const H: Record<ControlSize, string> = {
  sm: "var(--control-h-sm)",
  md: "var(--control-h-md)",
  lg: "var(--control-h-lg)",
  // The form-field rung. A native input at `xl` is the same box as a Mantine
  // one at `size="md"`, so the two systems can share a row without a step.
  xl: "var(--control-h-xl)",
};
const PAD: Record<ControlSize, string> = {
  sm: "0 8px",
  md: "0 16px",
  lg: "0 20px",
  xl: "0 20px",
};

/* A field holds 16px text; anything denser than the form field holds 13–14px. */
const CONTROL_FS: Record<ControlSize, string> = {
  sm: "var(--fs-sm)",
  md: "var(--fs-body)",
  lg: "var(--fs-body)",
  xl: "var(--fs-control)",
};

/* Only `primary` is filled. Everything else is an outline button — that is what keeps
   the blue meaningful on a screen full of controls. */
const VARIANTS: Record<ButtonVariant, { bg: string; fg: string; bd: string; hbg: string; hbd: string }> = {
  primary: {
    bg: "var(--action-primary)",
    fg: "var(--text-inverse)",
    bd: "var(--action-primary)",
    hbg: "var(--action-primary-hover)",
    hbd: "var(--action-primary-hover)",
  },
  secondary: {
    bg: "var(--n-0)",
    fg: "var(--text-body)",
    bd: "var(--border-default)",
    hbg: "var(--n-50)",
    hbd: "var(--border-strong)",
  },
  ghost: {
    bg: "transparent",
    fg: "var(--text-muted)",
    bd: "transparent",
    hbg: "var(--surface-hover)",
    hbd: "transparent",
  },
  danger: {
    bg: "var(--n-0)",
    fg: "var(--red-600)",
    bd: "var(--red-500)",
    hbg: "var(--red-50)",
    hbd: "var(--red-600)",
  },
};

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ControlSize;
  icon?: string;
  iconAfter?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  type?: "button" | "submit" | "reset";
  children?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = "secondary",
  size = "md",
  icon,
  iconAfter,
  disabled,
  fullWidth,
  onClick,
  type = "button",
  children,
}) => {
  const v = VARIANTS[variant] || VARIANTS.secondary;
  const [h, setH] = React.useState(false);
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        height: H[size],
        padding: PAD[size],
        width: fullWidth ? "100%" : undefined,
        font: "inherit",
        fontSize: size === "sm" ? "var(--fs-sm)" : "var(--fs-body)",
        fontWeight: "var(--fw-medium)" as unknown as number,
        letterSpacing: ".002em",
        color: disabled ? "var(--text-subtle)" : v.fg,
        background: disabled ? "var(--surface-disabled)" : h ? v.hbg : v.bg,
        border: "1px solid " + (disabled ? "var(--border-subtle)" : h ? v.hbd : v.bd),
        borderRadius: "var(--radius-sm)",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "var(--motion-hover)",
        whiteSpace: "nowrap",
      }}
    >
      {icon && <Icon name={icon} size={size === "sm" ? 14 : 16} />}
      {children}
      {iconAfter && <Icon name={iconAfter} size={size === "sm" ? 14 : 16} />}
    </button>
  );
};

/* -------------------------------------------------------------- IconButton */

export interface IconButtonProps {
  icon: string;
  size?: ControlSize;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  tone?: "default" | "bordered";
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  size = "md",
  label,
  active,
  disabled,
  onClick,
  tone = "default",
}) => {
  const [h, setH] = React.useState(false);
  const d = H[size];
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        width: d,
        height: d,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--radius-sm)",
        cursor: disabled ? "not-allowed" : "pointer",
        background: active
          ? "var(--surface-selected)"
          : h && !disabled
            ? "var(--surface-hover)"
            : "transparent",
        border:
          "1px solid " +
          (active ? "var(--blue-200)" : tone === "bordered" ? "var(--border-default)" : "transparent"),
        color: disabled ? "var(--n-400)" : active ? "var(--blue-600)" : "var(--text-muted)",
        transition: "var(--motion-hover)",
        padding: 0,
      }}
    >
      <Icon name={icon} size={size === "sm" ? 14 : 16} />
    </button>
  );
};

/* ------------------------------------------------------------------- Input */

export interface InputProps {
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  icon?: string;
  size?: ControlSize;
  invalid?: boolean;
  disabled?: boolean;
  type?: string;
  fullWidth?: boolean;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  ariaLabel?: string;
  /** Reach the underlying field — focusing a dialog's box on open, mostly. */
  inputRef?: React.Ref<HTMLInputElement>;
}

export const Input: React.FC<InputProps> = ({
  value,
  defaultValue,
  placeholder,
  icon,
  size = "md",
  invalid,
  disabled,
  type = "text",
  fullWidth,
  onChange,
  ariaLabel,
  inputRef,
}) => {
  const [f, setF] = React.useState(false);
  const h = H[size];
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: h,
        width: fullWidth ? "100%" : undefined,
        padding: size === "xl" ? "0 16px" : "0 8px",
        background: disabled ? "var(--surface-disabled)" : "var(--n-0)",
        border:
          "1px solid " +
          (invalid ? "var(--red-500)" : f ? "var(--border-focus)" : "var(--border-default)"),
        borderRadius: "var(--radius)",
        boxShadow: f
          ? invalid
            ? "0 0 0 3px rgba(242, 87, 87, 0.16)"
            : "var(--focus-ring)"
          : "none",
        transition: "var(--motion-hover), box-shadow var(--dur-fast) var(--ease-standard)",
      }}
    >
      {icon && <Icon name={icon} size={14} color="var(--text-subtle)" />}
      <input
        ref={inputRef}
        type={type}
        value={value}
        defaultValue={defaultValue}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={onChange}
        onFocus={() => setF(true)}
        onBlur={() => setF(false)}
        style={{
          border: "none",
          outline: "none",
          background: "transparent",
          font: "inherit",
          fontSize: CONTROL_FS[size],
          color: "var(--text-body)",
          width: "100%",
          minWidth: 0,
          padding: 0,
        }}
      />
    </div>
  );
};

/* ------------------------------------------------------------------- Field */

export interface FieldProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
  children?: React.ReactNode;
}

export const Field: React.FC<FieldProps> = ({ label, hint, error, required, htmlFor, children }) => (
  <label htmlFor={htmlFor} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
    {label && (
      // The label names the field; it is not a caption. Same 14px medium ink as
      // the Mantine input label in styles/global.scss, so a native control and a
      // Mantine one standing in the same row read as one form.
      <span
        style={{
          fontSize: "var(--fs-control-label)",
          lineHeight: "var(--lh-body)",
          fontWeight: "var(--fw-medium)" as unknown as number,
          color: "var(--text-body)",
        }}
      >
        {label}
        {required && <span style={{ color: "var(--red-500)" }}> *</span>}
      </span>
    )}
    {children}
    {(error || hint) && (
      <span style={{ fontSize: "var(--fs-xs)", color: error ? "var(--red-500)" : "var(--text-subtle)" }}>
        {error || hint}
      </span>
    )}
  </label>
);

/* ------------------------------------------------------------------ Select */

export type SelectOption = string | { value: string; label?: string };

export interface SelectProps {
  value?: string;
  options?: SelectOption[];
  size?: ControlSize;
  disabled?: boolean;
  fullWidth?: boolean;
  placeholder?: string;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
}

export const Select: React.FC<SelectProps> = ({
  value,
  options = [],
  size = "md",
  disabled,
  fullWidth,
  placeholder,
  onChange,
}) => {
  const h = H[size];
  const [f, setF] = React.useState(false);
  return (
    <div style={{ position: "relative", display: "inline-flex", width: fullWidth ? "100%" : undefined }}>
      <select
        value={value}
        disabled={disabled}
        onChange={onChange}
        onFocus={() => setF(true)}
        onBlur={() => setF(false)}
        style={{
          appearance: "none",
          height: h,
          width: "100%",
          padding: size === "xl" ? "0 34px 0 16px" : "0 26px 0 8px",
          font: "inherit",
          fontSize: CONTROL_FS[size],
          color: "var(--text-body)",
          background: disabled ? "var(--surface-disabled)" : "var(--n-0)",
          border: "1px solid " + (f ? "var(--border-focus)" : "var(--border-default)"),
          borderRadius: "var(--radius)",
          boxShadow: f ? "var(--focus-ring)" : "none",
          outline: "none",
          transition: "var(--motion-hover), box-shadow var(--dur-fast) var(--ease-standard)",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => {
          const val = typeof o === "string" ? o : o.value;
          const label = typeof o === "string" ? o : (o.label ?? o.value);
          return (
            <option key={val} value={val}>
              {label}
            </option>
          );
        })}
      </select>
      <span
        style={{
          position: "absolute",
          right: 7,
          top: "50%",
          transform: "translateY(-50%)",
          pointerEvents: "none",
          display: "flex",
          color: "var(--text-subtle)",
        }}
      >
        <Icon name="chevron-down" size={14} />
      </span>
    </div>
  );
};

/* ---------------------------------------------------------------- Checkbox */

export interface CheckboxProps {
  checked?: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  label?: React.ReactNode;
  onChange?: (next: boolean) => void;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  indeterminate,
  disabled,
  label,
  onChange,
}) => {
  const on = checked || indeterminate;
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: "var(--fs-body)",
        color: disabled ? "var(--text-subtle)" : "var(--text-body)",
      }}
    >
      <span
        onClick={() => !disabled && onChange && onChange(!checked)}
        style={{
          width: 16,
          height: 16,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 5,
          flex: "0 0 auto",
          background: disabled
            ? "var(--surface-disabled)"
            : on
              ? "var(--action-primary)"
              : "var(--n-0)",
          border: "1px solid " + (on ? "var(--action-primary)" : "var(--border-default)"),
          color: "#fff",
          transition: "var(--motion-hover)",
        }}
      >
        {on && <Icon name={indeterminate ? "minus" : "check"} size={11} strokeWidth={3} />}
      </span>
      {label}
    </label>
  );
};

/* ------------------------------------------------------------------- Radio */

export interface RadioProps {
  checked?: boolean;
  disabled?: boolean;
  label?: React.ReactNode;
  name?: string;
  onChange?: (next: boolean) => void;
}

export const Radio: React.FC<RadioProps> = ({ checked, disabled, label, name, onChange }) => (
  <label
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      cursor: disabled ? "not-allowed" : "pointer",
      fontSize: "var(--fs-body)",
      color: disabled ? "var(--text-subtle)" : "var(--text-body)",
    }}
  >
    <input
      type="radio"
      name={name}
      checked={!!checked}
      disabled={disabled}
      onChange={() => onChange && onChange(true)}
      style={{ display: "none" }}
    />
    <span
      style={{
        width: 16,
        height: 16,
        borderRadius: "var(--radius-pill)",
        flex: "0 0 auto",
        border: "1px solid " + (checked ? "var(--action-primary)" : "var(--border-default)"),
        background: disabled ? "var(--surface-disabled)" : "var(--n-0)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "var(--motion-hover)",
      }}
    >
      {checked && (
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "var(--radius-pill)",
            background: "var(--action-primary)",
          }}
        />
      )}
    </span>
    {label}
  </label>
);

/* ------------------------------------------------------------------ Switch */

export interface SwitchProps {
  checked?: boolean;
  disabled?: boolean;
  label?: React.ReactNode;
  onChange?: (next: boolean) => void;
}

export const Switch: React.FC<SwitchProps> = ({ checked, disabled, label, onChange }) => (
  <label
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      cursor: disabled ? "not-allowed" : "pointer",
      fontSize: "var(--fs-body)",
      color: "var(--text-body)",
    }}
  >
    <span
      onClick={() => !disabled && onChange && onChange(!checked)}
      style={{
        width: 32,
        height: 20,
        borderRadius: "var(--radius-pill)",
        padding: 2,
        flex: "0 0 auto",
        background: disabled ? "var(--n-200)" : checked ? "var(--action-primary)" : "var(--n-300)",
        transition: "background-color var(--dur-base) var(--ease-standard)",
      }}
    >
      <span
        style={{
          display: "block",
          width: 16,
          height: 16,
          borderRadius: "var(--radius-pill)",
          background: "#fff",
          transform: "translateX(" + (checked ? 12 : 0) + "px)",
          transition: "transform var(--dur-base) var(--ease-standard)",
          boxShadow: "0 1px 2px rgba(33,30,27,.3)",
        }}
      />
    </span>
    {label}
  </label>
);

/* ------------------------------------------------------------------- Badge */

export type BadgeTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "teal"
  | "plum"
  | "orange"
  | "pink";

const BADGE_TONES: Record<BadgeTone, [string, string, string]> = {
  neutral: ["var(--n-100)", "var(--n-700)", "var(--n-200)"],
  info: ["var(--blue-50)", "var(--blue-700)", "var(--blue-100)"],
  success: ["var(--green-50)", "var(--green-700)", "var(--green-100)"],
  warning: ["var(--amber-50)", "var(--amber-700)", "var(--amber-100)"],
  danger: ["var(--red-50)", "var(--red-700)", "var(--red-100)"],
  teal: ["var(--teal-50)", "var(--teal-700)", "var(--teal-100)"],
  plum: ["var(--plum-50)", "var(--plum-700)", "var(--plum-100)"],
  orange: ["var(--orange-50)", "var(--orange-700)", "#f6ddc7"],
  pink: ["var(--pink-50)", "var(--pink-700)", "#f3d5e0"],
};

export interface BadgeProps {
  tone?: BadgeTone;
  dot?: boolean;
  children?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ tone = "neutral", dot, children }) => {
  const [bg, fg, bd] = BADGE_TONES[tone] || BADGE_TONES.neutral;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        height: 20,
        padding: "0 8px",
        background: bg,
        color: fg,
        border: "1px solid " + bd,
        borderRadius: "var(--radius-sm)",
        fontSize: "var(--fs-micro)",
        lineHeight: 1,
        fontWeight: "var(--fw-semibold)" as unknown as number,
        letterSpacing: ".01em",
        whiteSpace: "nowrap",
      }}
    >
      {dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: fg }} />}
      {children}
    </span>
  );
};

/* --------------------------------------------------------------------- Tag */

export interface TagProps {
  children?: React.ReactNode;
  onRemove?: () => void;
}

export const Tag: React.FC<TagProps> = ({ children, onRemove }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      height: 24,
      padding: "0 4px 0 8px",
      background: "var(--n-50)",
      color: "var(--text-body)",
      border: "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-sm)",
      fontSize: "var(--fs-xs)",
      whiteSpace: "nowrap",
    }}
  >
    {children}
    {onRemove && (
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove"
        style={{
          display: "inline-flex",
          border: "none",
          background: "transparent",
          padding: 2,
          cursor: "pointer",
          color: "var(--text-subtle)",
          borderRadius: "var(--radius-xs)",
        }}
      >
        <Icon name="x" size={12} />
      </button>
    )}
  </span>
);

/* -------------------------------------------------------------------- Card */

export interface CardProps {
  title?: React.ReactNode;
  action?: React.ReactNode;
  padding?: number | string;
  flush?: boolean;
  children?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ title, action, padding = 16, flush, children }) => (
  <section
    style={{
      background: "var(--surface-card)",
      border: "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-md)",
      boxShadow: "var(--shadow-card)",
      overflow: "hidden",
    }}
  >
    {(title || action) && (
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "10px 16px",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <h3
          style={{
            fontSize: "var(--fs-h3)",
            lineHeight: "var(--lh-h3)",
            fontWeight: "var(--fw-semibold)" as unknown as number,
          }}
        >
          {title}
        </h3>
        {action}
      </header>
    )}
    <div style={{ padding: flush ? 0 : padding }}>{children}</div>
  </section>
);
