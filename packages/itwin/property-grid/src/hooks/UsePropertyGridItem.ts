/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { PropertyRecord } from "@itwin/appui-abstract";
import type { IPropertyDataProvider } from "@itwin/components-react";
import { useEffect, useState } from "react";

/** Returns className and label of instance that properties are currently loaded. */
export function usePropertyGridItem(dataProvider: IPropertyDataProvider) {
  const [item, setItem] = useState<{className: string, label: PropertyRecord}>();

  useEffect(() => {
    const onDataChanged = async () => {
      const propertyData = await dataProvider.getData();
      setItem({ label: propertyData.label, className: propertyData.description ?? "" });
    };

    const removeListener = dataProvider.onDataChanged.addListener(onDataChanged);
    void onDataChanged();

    return () => {
      removeListener();
    };
  }, [dataProvider]);

  return item;
}
