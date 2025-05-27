/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { StrataKitTreeRenderer as PresentationTree } from "@itwin/presentation-hierarchies-react";
import { useHierarchiesLocalization } from "../internal/UseHierarchiesLocalization.js";

/** @beta */
export type BaseTreeRendererProps = React.ComponentPropsWithoutRef<typeof PresentationTree>;

/** @internal */
export function BaseTreeRenderer({ rootNodes, expandNode, getActions, ...props }: BaseTreeRendererProps) {
  const localizedStrings = useHierarchiesLocalization();
  return <PresentationTree {...props} localizedStrings={localizedStrings} expandNode={expandNode} rootNodes={rootNodes} getActions={getActions} />;
}
