/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useState } from "react";
import { getShowNullValuesPreference, saveShowNullValuesPreference } from "../api/ShowNullValuesPreferenceClient";
import { NonEmptyValuesPropertyDataFilterer, NoopPropertyDataFilterer } from "../components/FilteringPropertyGrid";

import type { IPropertyDataFilterer } from "@itwin/components-react";

/** Props for `useNullValueSetting` hook. */
export interface NullValueSettingProps {
  /** Specifies whether setting for showing/hiding null values in property grid should be persisted. */
  persistNullValueToggle?: boolean;
}

/** Custom hook that track setting for showing/hiding null values in property grid. */
export function useNullValueSetting({ persistNullValueToggle }: NullValueSettingProps) {
  const [{ showNullValues, filterer }, setShowNullValues] = useState<{ showNullValues: boolean, filterer: IPropertyDataFilterer }>({ showNullValues: true, filterer: new NoopPropertyDataFilterer() });

  // If persisting hide/show empty values, get the preference
  useEffect(() => {
    const setDefaultShowNullValues = async () => {
      if (persistNullValueToggle) {
        const res = await getShowNullValuesPreference();
        setShowNullValues({ showNullValues: res, filterer: res ? new NoopPropertyDataFilterer() : new NonEmptyValuesPropertyDataFilterer() });
      }
    };

    void setDefaultShowNullValues();
  }, [persistNullValueToggle]);

  // Fcn for updating toggle for Hide / Show Empty Fields menu options
  const updateShowNullValues = useCallback(async (value: boolean) => {
    // Update filter and reset context menu
    setShowNullValues({ showNullValues: value, filterer: value ? new NoopPropertyDataFilterer() : new NonEmptyValuesPropertyDataFilterer() });

    // Persist hide/show value
    if (persistNullValueToggle) {
      await saveShowNullValuesPreference(value);
    }
  }, [persistNullValueToggle]);

  return {
    showNullValues,
    filterer,
    setShowNullValues: updateShowNullValues,
  };
}
