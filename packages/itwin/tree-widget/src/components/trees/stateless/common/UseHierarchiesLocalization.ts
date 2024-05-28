/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useMemo } from "react";
import { TreeWidget } from "../../../../TreeWidget";

import type { TreeRenderer, useTree } from "@itwin/presentation-hierarchies-react";

type UseTreeLocalizedStrings = Parameters<typeof useTree>[0]["localizedStrings"];
type TreeRendererLocalizedStrings = Parameters<typeof TreeRenderer>[0]["localizedStrings"];

type useHierarchiesLocalizationResult = UseTreeLocalizedStrings & TreeRendererLocalizedStrings;

/** @internal */
export function useHierarchiesLocalization(): useHierarchiesLocalizationResult {
  const stringValues = Object.values(getLocalizedStrings()!);
  const localizedStrings = useMemo(getLocalizedStrings, stringValues);

  return localizedStrings;
}

function getLocalizedStrings(): useHierarchiesLocalizationResult {
  return {
    // strings for the `useUnifiedSelectionTree` hook
    unspecified: TreeWidget.translate("stateless.hierarchies.unspecified"),
    other: TreeWidget.translate("stateless.hierarchies.other"),

    // strings for `TreeRenderer` and `TreeNodeRenderer`
    loading: TreeWidget.translate("stateless.hierarchies.loading"),
    filterHierarchyLevel: TreeWidget.translate("stateless.hierarchies.filterHierarchyLevel"),
    clearHierarchyLevelFilter: TreeWidget.translate("stateless.hierarchies.clearHierarchyLevelFilter"),
    noFilteredChildren: TreeWidget.translate("stateless.hierarchies.noFilteredChildren"),
    resultLimitExceeded: TreeWidget.translate("stateless.hierarchies.resultLimitExceeded"),
    resultLimitExceededWithFiltering: TreeWidget.translate("stateless.hierarchies.resultLimitExceededWithFiltering"),
    increaseHierarchyLimit: TreeWidget.translate("stateless.hierarchies.increaseHierarchyLimit"),
    increaseHierarchyLimitWithFiltering: TreeWidget.translate("stateless.hierarchies.increaseHierarchyLimitWithFiltering"),
  };
}
