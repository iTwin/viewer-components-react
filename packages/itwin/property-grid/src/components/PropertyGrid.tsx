/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./PropertyGrid.scss";
import { FillCentered } from "@itwin/core-react";
import { useUnifiedSelectionDataProvider } from "../hooks/UseDataProvider";
import { PropertyGridManager } from "../PropertyGridManager";
import { PropertyGridContent } from "./PropertyGridContent";

import type { DataProviderProps } from "../hooks/UseDataProvider";
import type { PropertyGridContentProps } from "./PropertyGridContent";

/** Props for `PropertyGrid` component. */
export type PropertyGridProps = Omit<PropertyGridContentProps, "dataProvider"> & DataProviderProps;

/** Component that renders property grid for instances in `UnifiedSelection`. */
export function PropertyGrid({
  imodel,
  enableFavoriteProperties,
  enablePropertyGroupNesting,
  rulesetId,
  createDataProvider,
  ...props
}: PropertyGridProps) {
  const { dataProvider, isOverLimit } = useUnifiedSelectionDataProvider({
    imodel,
    enableFavoriteProperties,
    rulesetId,
    createDataProvider,
    enablePropertyGroupNesting,
  });

  if (isOverLimit) {
    return (
      <FillCentered style={{ flexDirection: "column" }}>
        <div className="property-grid-react-filtering-pg-label">
          {PropertyGridManager.translate(
            "context-menu.selection.too-many-elements-selected"
          )}
        </div>
      </FillCentered>
    );
  }

  return (
    <PropertyGridContent
      {...props}
      dataProvider={dataProvider}
      imodel={imodel}
    />
  );
}
