/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import { SvgCursor, SvgDraw, SvgSearch } from "@itwin/itwinui-icons-react";
import type { GroupingMappingCustomUI } from "./GroupingMappingCustomUI";
import { GroupingMappingCustomUIType } from "./GroupingMappingCustomUI";
import { GroupQueryBuilderCustomUI } from "./GroupQueryBuilderCustomUI";
import { ManualGroupingCustomUI } from "./ManualGroupingCustomUI";
import { SearchGroupingCustomUI } from "./SearchGroupingCustomUI";
import { GroupingMappingWidget } from "../../GroupingMappingWidget";

export const getDefaultGroupingUI = (): GroupingMappingCustomUI[] => [
  {
    name: "Selection",
    displayLabel: GroupingMappingWidget.translate("customUI.selection"),
    type: GroupingMappingCustomUIType.Grouping,
    icon: <SvgCursor />,
    uiComponent: GroupQueryBuilderCustomUI,
  },
  {
    name: "Query Keywords",
    displayLabel: GroupingMappingWidget.translate("customUI.queryKeywords"),
    type: GroupingMappingCustomUIType.Grouping,
    icon: <SvgSearch />,
    uiComponent: SearchGroupingCustomUI,
  },
  {
    name: "Manual",
    displayLabel: GroupingMappingWidget.translate("customUI.manual"),
    type: GroupingMappingCustomUIType.Grouping,
    icon: <SvgDraw />,
    uiComponent: ManualGroupingCustomUI,
  },
];
