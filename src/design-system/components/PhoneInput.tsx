// src/design-system/components/PhoneInput.tsx
//
// A phone number, typed the way the person knows it.
//
// With a country chosen, the dialling code sits beside the field and the number
// is typed as it's written locally: "081 234 5678" in Thailand. With no country,
// the number has to carry its own code ("+44 7400 123456"), because without one
// there is no way to know where to ring. Typing a leading "+" always wins over
// the chosen country, so a donor in Thailand with a UK mobile can still be
// recorded.
//
// The field holds exactly what was typed. Turning it into one stored form
// (E.164, via normalisePhone) is the form's job at save time, so an admin can
// finish typing without the text rearranging itself under the cursor.

import React from "react";
import { TextInput } from "@mantine/core";
import { callingCode, countryName } from "../countries";

/** Read by screen readers, invisible on screen. */
const srOnly: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

export interface PhoneInputProps {
  id?: string;
  label?: string;
  value: string;
  /** ISO 3166-1 alpha-2 of the donor's country, or null when not recorded. */
  country: string | null;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: React.ReactNode;
  disabled?: boolean;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
  id,
  label = "Phone",
  value,
  country,
  onChange,
  onBlur,
  error,
  disabled,
}) => {
  const code = callingCode(country);
  // The prefix only shows while it applies: once the number starts with "+",
  // it carries its own code and a second one beside it would be wrong.
  const showPrefix = Boolean(code) && !value.trim().startsWith("+");

  return (
    <TextInput
      id={id}
      // The dialling code is part of the label for a screen reader, which
      // otherwise would never hear it: it lives in a visual section of the
      // input, and Mantine's description text is hidden platform-wide.
      label={
        <>
          {label}
          {showPrefix && country ? (
            <span style={srOnly}>
              , {countryName(country)} numbers, country code {code}
            </span>
          ) : null}
        </>
      }
      type="tel"
      inputMode="tel"
      autoComplete={showPrefix ? "tel-national" : "tel"}
      placeholder={showPrefix ? "081 234 5678" : "+66 81 234 5678"}
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      onBlur={onBlur}
      error={error}
      disabled={disabled}
      leftSection={showPrefix ? <span aria-hidden="true">{code}</span> : undefined}
      leftSectionWidth={showPrefix ? 56 : undefined}
    />
  );
};

export default PhoneInput;
