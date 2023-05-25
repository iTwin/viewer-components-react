/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useState } from "react";
import { getShowNullValuesPreference, saveShowNullValuesPreference } from "../api/ShowNullValuesPreferenceClient";

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

  // If persisting hide/show empty values, get the preference
  useEffect(() => {
    const setDefaultShowNullValues = async () => {
      if (persistNullValueToggle) {
        const res = await getShowNullValuesPreference();
        setShowNullValues(res);
      }
    };

    void setDefaultShowNullValues();
  }, [persistNullValueToggle]);

  // Fcn for updating toggle for Hide / Show Empty Fields menu options
  const updateShowNullValues = useCallback(async (value: boolean) => {
    setShowNullValues(value);

    // Persist hide/show value
    if (persistNullValueToggle) {
      await saveShowNullValuesPreference(value);
    }
  }, [persistNullValueToggle]);

  return {
    showNullValues,
    setShowNullValues: updateShowNullValues,
  };
}
