/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { NonGroupingHierarchyNode } from "@itwin/presentation-hierarchies";
import { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";

export function createPresentationHierarchyNode(partial?: Partial<PresentationHierarchyNode>): PresentationHierarchyNode {
  return {
    id: "test-node",
    label: "test-node",
    isExpanded: false,
    isLoading: false,
    isFilterable: false,
    isFiltered: false,
    nodeData: createNonGroupingHierarchyNode(),
    children: [],
    ...partial,
  };
}

export function createNonGroupingHierarchyNode(partial?: Partial<NonGroupingHierarchyNode>): NonGroupingHierarchyNode {
  return {
    label: "test-node",
    key: { type: "instances", instanceKeys: [] },
    parentKeys: [],
    children: false,
    ...partial,
  };
}
