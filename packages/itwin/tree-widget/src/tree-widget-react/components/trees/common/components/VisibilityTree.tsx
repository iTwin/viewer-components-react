/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback } from "react";
import { useIModelAccess } from "../internal/UseIModelAccess.js";
import { useHierarchyVisibility } from "../UseHierarchyVisibility.js";
import { Tree } from "./Tree.js";

import type { ReactNode } from "react";
import type { ECClassHierarchyInspector } from "@itwin/presentation-shared";
import type { HierarchyVisibilityHandler } from "../UseHierarchyVisibility.js";
import type { VisibilityContext } from "./TreeNodeVisibilityButton.js";

/** @beta */
export type VisibilityTreeProps = Omit<TreeProps, "treeRenderer" | "imodelAccess"> & {
  /** Callback for creating visibility handler used to control visibility of instances represented by tree nodes. */
  visibilityHandlerFactory: (props: { imodelAccess: ECClassHierarchyInspector }) => HierarchyVisibilityHandler;
  /** Tree renderer that should be used to render tree data. */
  treeRenderer: (
    treeProps: FunctionProps<TreeProps["treeRenderer"]> & Pick<VisibilityContext, "getVisibilityButtonState" | "onVisibilityButtonClick">,
  ) => ReactNode;
};

/**
 * Tree component that can control visibility of instances represented by tree nodes.
 * @beta
 */
export function VisibilityTree({ visibilityHandlerFactory, treeRenderer, hierarchyLevelSizeLimit, ...props }: VisibilityTreeProps) {
  const { imodel, treeName } = props;
  const { imodelAccess, currentHierarchyLevelSizeLimit } = useIModelAccess({
    imodel,
    treeName,
    hierarchyLevelSizeLimit,
  });

  const { getVisibilityButtonState, onVisibilityButtonClick, triggerRefresh } = useHierarchyVisibility({
    visibilityHandlerFactory: useCallback(() => visibilityHandlerFactory({ imodelAccess }), [visibilityHandlerFactory, imodelAccess]),
  });

  return (
    <Tree
      {...props}
      onReload={triggerRefresh}
      imodelAccess={imodelAccess}
      hierarchyLevelSizeLimit={currentHierarchyLevelSizeLimit}
      treeRenderer={(treeProps) => treeRenderer({ ...treeProps, getVisibilityButtonState, onVisibilityButtonClick })}
    />
  );
}
