/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useState } from "react";
import { usePreferencesContext } from "../PropertyGridPreferencesContext";

/**
 * Props for `useNullValueSetting` hook.
 * @public
 */
export interface NullValueSettingProps {
  /** Specifies whether setting for showing/hiding null values in property grid should be persisted. */
  persistNullValueToggle?: boolean;
}

/**
 * Custom hook for tracking of "show/hide null values" setting in property grid.
 * @internal
 */
export function useNullValueSetting({ persistNullValueToggle }: NullValueSettingProps) {
  const [showNullValues, setShowNullValues] = useState(true);
  const { getShowNullValuesPreference, setShowNullValuesPreference } = useNullValueStorage();

  // If persisting hide/show empty values, get the preference
  useEffect(() => {
    const setDefaultShowNullValues = async () => {
      if (persistNullValueToggle) {
        const res = await getShowNullValuesPreference();
        setShowNullValues(res);
      }
    };

    void setDefaultShowNullValues();
  }, [persistNullValueToggle, getShowNullValuesPreference]);

  // Fcn for updating toggle for Hide / Show Empty Fields menu options
  const updateShowNullValues = useCallback(async (value: boolean) => {
    setShowNullValues(value);

    // Persist hide/show value
    if (persistNullValueToggle) {
      await setShowNullValuesPreference(value);
    }
  }, [persistNullValueToggle, setShowNullValuesPreference]);

  return {
    showNullValues,
    setShowNullValues: updateShowNullValues,
  };
}

const SHOWNULL_KEY = "showNullValues";

function useNullValueStorage() {
  const { storage } = usePreferencesContext();

  const getShowNullValuesPreference = useCallback(async () => {
    const serializedValue = await storage.get(SHOWNULL_KEY);
    if (serializedValue !== undefined) {
      return JSON.parse(serializedValue);
    }
    // default to `true`
    return true;
  }, [storage]);

  const setShowNullValuesPreference = useCallback(async (value: boolean) => {
    await storage.set(SHOWNULL_KEY, JSON.stringify(value));
  }, [storage]);

  return {
    getShowNullValuesPreference,
    setShowNullValuesPreference,
  };
}
