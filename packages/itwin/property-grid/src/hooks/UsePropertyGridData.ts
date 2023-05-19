/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { useEffect, useState } from "react";

import type { PropertyRecord } from "@itwin/appui-abstract";
import type { IPresentationPropertyDataProvider } from "@itwin/presentation-components";

/** Props for `usePropertyGridData` hook. */
export interface UsePropertyGridDataProps {
  dataProvider: IPresentationPropertyDataProvider;
}

/** Returns className and label of the instance that properties are currently loaded. */
export function usePropertyGridData({ dataProvider }: UsePropertyGridDataProps) {
  const [item, setItem] = useState<{className: string, label: PropertyRecord}>();

  useEffect(() => {
    const onDataChanged = async () => {
      const propertyData = await dataProvider.getData();
      setItem({ label: propertyData.label, className: propertyData.description ?? "" });
    };

    const removeListener = dataProvider.onDataChanged.addListener(onDataChanged);
    void onDataChanged();

    return () => { removeListener(); };
  }, [dataProvider]);

  return { item };
}
