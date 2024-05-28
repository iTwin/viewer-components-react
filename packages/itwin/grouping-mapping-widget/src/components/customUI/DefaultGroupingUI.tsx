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

export const defaultGroupingUI: GroupingMappingCustomUI[] = [
  {
    name: "Selection",
    displayLabel: "Selection",
    type: GroupingMappingCustomUIType.Grouping,
    icon: <SvgCursor />,
    uiComponent: GroupQueryBuilderCustomUI,
  },
  {
    name: "Query Keywords",
    displayLabel: "Query Keywords",
    type: GroupingMappingCustomUIType.Grouping,
    icon: <SvgSearch />,
    uiComponent: SearchGroupingCustomUI,
  },
  {
    name: "Manual",
    displayLabel: "Manual",
    type: GroupingMappingCustomUIType.Grouping,
    icon: <SvgDraw />,
    uiComponent: ManualGroupingCustomUI,
  },
];
