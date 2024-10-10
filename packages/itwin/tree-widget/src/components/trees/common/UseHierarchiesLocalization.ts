/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useMemo } from "react";
import { TreeWidget } from "../../../TreeWidget";

import type { TreeRenderer, useIModelTree } from "@itwin/presentation-hierarchies-react";

type UseTreeLocalizedStrings = NonNullable<Parameters<typeof useIModelTree>[0]["localizedStrings"]>;
type TreeRendererLocalizedStrings = NonNullable<Parameters<typeof TreeRenderer>[0]["localizedStrings"]>;

type UseHierarchiesLocalizationResult = UseTreeLocalizedStrings & TreeRendererLocalizedStrings;

export function useHierarchiesLocalization(): UseHierarchiesLocalizationResult {
  const stringValues = Object.values(getLocalizedStrings());
  const localizedStrings = useMemo(getLocalizedStrings, stringValues);
  return localizedStrings;
}

function getLocalizedStrings(): UseHierarchiesLocalizationResult {
  return {
    // strings for the `useUnifiedSelectionTree` hook
    unspecified: TreeWidget.translate("presentation-hierarchies.unspecified"),
    other: TreeWidget.translate("presentation-hierarchies.other"),

    // strings for `TreeRenderer` and `TreeNodeRenderer`
    loading: TreeWidget.translate("presentation-hierarchies.loading"),
    filterHierarchyLevel: TreeWidget.translate("presentation-hierarchies.filterHierarchyLevel"),
    clearHierarchyLevelFilter: TreeWidget.translate("presentation-hierarchies.clearHierarchyLevelFilter"),
    noFilteredChildren: TreeWidget.translate("presentation-hierarchies.noFilteredChildren"),
    resultLimitExceeded: TreeWidget.translate("presentation-hierarchies.resultLimitExceeded"),
    resultLimitExceededWithFiltering: TreeWidget.translate("presentation-hierarchies.resultLimitExceededWithFiltering"),
    increaseHierarchyLimit: TreeWidget.translate("presentation-hierarchies.increaseHierarchyLimit"),
    increaseHierarchyLimitWithFiltering: TreeWidget.translate("presentation-hierarchies.increaseHierarchyLimitWithFiltering"),
    retry: TreeWidget.translate("presentation-hierarchies.retry"),
  };
}
