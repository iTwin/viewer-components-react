/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useEffect, useRef, useState } from "react";
import { Guid } from "@itwin/core-bentley";

import type { PropertyRecord } from "@itwin/appui-abstract";
import type { IPresentationPropertyDataProvider } from "@itwin/presentation-components";

/**
 * Props for `useLoadedInstanceInfo` hook.
 * @internal
 */
export interface UseLoadedInstanceInfoProps {
  dataProvider: IPresentationPropertyDataProvider;
}

/**
 * Returns class name and label of the instance which properties are currently shown.
 * @internal
 */
export function useLoadedInstanceInfo({ dataProvider }: UseLoadedInstanceInfoProps) {
  const [item, setItem] = useState<{ className: string; label: PropertyRecord }>();
  const inProgressId = useRef<string>();

  useEffect(() => {
    const onDataChanged = async () => {
      const currentId = Guid.createValue();
      inProgressId.current = currentId;

      // we need to make sure that the loaded propertyData is provided by the latest getData() call
      const propertyData = await dataProvider.getData();
      if (inProgressId.current === currentId) {
        setItem({ label: propertyData.label, className: propertyData.description ?? "" });
      }
    };

    const removeListener = dataProvider.onDataChanged.addListener(onDataChanged);
    void onDataChanged();

    return () => {
      removeListener();
    };
  }, [dataProvider]);

  return { item };
}
