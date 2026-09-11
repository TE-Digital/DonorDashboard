// src/design-system/components/CountrySelect.tsx
//
// Where somebody is. Optional: blank means nobody has recorded it, and it reads
// "Not recorded" rather than defaulting to a guess. When it is set, the phone
// field next to it knows the dialling code.

import React, { useMemo } from "react";
import { Select } from "@mantine/core";
import { countryOptions } from "../countries";

export interface CountrySelectProps {
  id?: string;
  label?: string;
  /** ISO 3166-1 alpha-2, e.g. "TH", or null when not recorded. */
  value: string | null;
  onChange: (code: string | null) => void;
  error?: React.ReactNode;
  disabled?: boolean;
}

export const CountrySelect: React.FC<CountrySelectProps> = ({
  id,
  label = "Country",
  value,
  onChange,
  error,
  disabled,
}) => {
  const data = useMemo(countryOptions, []);

  return (
    <Select
      id={id}
      label={label}
      placeholder="Not recorded"
      searchable
      clearable
      data={data}
      value={value}
      onChange={onChange}
      error={error}
      disabled={disabled}
      nothingFoundMessage="No country matches"
      autoComplete="country"
    />
  );
};

export default CountrySelect;
