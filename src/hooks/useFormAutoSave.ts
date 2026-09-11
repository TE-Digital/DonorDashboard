// src/hooks/useFormAutoSave.ts
import { useEffect, useState } from "react";

/**
 * Auto-saves form values to localStorage and restores them on page reload or tab switch.
 *
 * @param key Unique identifier for the form draft in localStorage
 * @param initialValues Default initial values for the form
 * @returns { values, setValues, updateField, clearDraft, hasRestoredDraft }
 */
export function useFormAutoSave<T extends Record<string, any>>(
  key: string,
  initialValues: T
) {
  const storageKey = `form_draft_${key}`;

  const [values, setValues] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...initialValues, ...parsed };
      }
    } catch (e) {
      console.warn(`[AutoSave] Failed to load draft for key "${key}":`, e);
    }
    return initialValues;
  });

  const [hasRestoredDraft, setHasRestoredDraft] = useState<boolean>(() => {
    try {
      return !!localStorage.getItem(storageKey);
    } catch {
      return false;
    }
  });

  // Auto-save changes to localStorage whenever values change
  useEffect(() => {
    try {
      if (values && Object.keys(values).length > 0) {
        localStorage.setItem(storageKey, JSON.stringify(values));
      }
    } catch (e) {
      console.warn(`[AutoSave] Failed to save draft for key "${key}":`, e);
    }
  }, [storageKey, values]);

  const updateField = <K extends keyof T>(field: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const clearDraft = () => {
    try {
      localStorage.removeItem(storageKey);
      setHasRestoredDraft(false);
    } catch (e) {
      console.warn(`[AutoSave] Failed to clear draft for key "${key}":`, e);
    }
  };

  return {
    values,
    setValues,
    updateField,
    clearDraft,
    hasRestoredDraft,
  };
}
