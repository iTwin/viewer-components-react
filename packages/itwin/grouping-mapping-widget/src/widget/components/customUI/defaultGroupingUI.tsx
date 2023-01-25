import React from "react";
import { SvgCursor, SvgDraw, SvgSearch } from "@itwin/itwinui-icons-react";
import type { GroupingMappingCustomUI } from "./groupingMappingCustomUI";
import { GroupingMappingCustomUIType } from "./groupingMappingCustomUI";
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
    name: "Search",
    displayLabel: "Search",
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
