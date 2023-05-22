/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "@itwin/itwinui-variables";
import { useEffect } from "react";
import { useActiveIModelConnection, useSpecificWidgetDef, WidgetState } from "@itwin/appui-react";
import { Presentation } from "@itwin/presentation-frontend";
import { MultiElementPropertyGrid } from "./components/MultiElementPropertyGrid";

import type { MultiElementPropertyGridProps } from "./components/MultiElementPropertyGrid";

/**
 * Id of the property grid widget created by `PropertyGridUiItemsProvider`.
 * @public
 */
export const PropertyGridComponentId = "vcr:PropertyGridComponent";

/**
 * Props for `PropertyGridComponent`.
 * @public
 */
export type PropertyGridComponentProps = Omit<MultiElementPropertyGridProps, "imodel">;

/**
 * Component that renders `MultiElementPropertyGrid` if there is active iModel connection.
 * @public
 */
export function PropertyGridComponent(props: PropertyGridComponentProps) {
  const imodel = useActiveIModelConnection();
  if (!imodel) {
    return null;
  }

  return <PropertyGridComponentContent {...props} imodel={imodel} />;
}

/** Component that renders `MultiElementPropertyGrid` an hides/shows widget based on `UnifiedSelection`. */
function PropertyGridComponentContent(props: MultiElementPropertyGridProps) {
  const widgetDef = useSpecificWidgetDef(PropertyGridComponentId);

  useEffect(() => {
    if (!widgetDef) {
      return;
    }

    return Presentation.selection.selectionChange.addListener((args) => {
      const keys = Presentation.selection.getSelection(args.imodel);
      widgetDef.setWidgetState(keys.isEmpty ? WidgetState.Hidden : WidgetState.Open);
    });
  }, [widgetDef]);

  return <MultiElementPropertyGrid {...props} />;
}
