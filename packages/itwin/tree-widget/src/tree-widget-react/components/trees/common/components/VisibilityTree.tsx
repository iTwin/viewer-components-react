/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback } from "react";
import { useHierarchyVisibility } from "../UseHierarchyVisibility.js";
import { useIModelAccess } from "../UseIModelAccess.js";
import { TreeBase } from "./Tree.js";

import type { ReactNode } from "react";
import type { ECClassHierarchyInspector } from "@itwin/presentation-shared";
import type { HierarchyVisibilityHandler } from "../UseHierarchyVisibility.js";
import type { FunctionProps } from "../Utils.js";
import type { TreeProps } from "./Tree.js";
import type { VisibilityTreeRendererProps } from "./VisibilityTreeRenderer.js";

/** @beta */
export type VisibilityTreeProps = Omit<TreeProps, "treeRenderer" | "imodelAccess"> & {
  /** Callback for creating visibility handler used to control visibility of instances represented by tree nodes. */
  visibilityHandlerFactory: (props: { imodelAccess: ECClassHierarchyInspector }) => HierarchyVisibilityHandler;
  /** Tree renderer that should be used to render tree data. */
  treeRenderer: (
    treeProps: FunctionProps<TreeProps["treeRenderer"]> & Pick<VisibilityTreeRendererProps, "getCheckboxState" | "onCheckboxClicked">,
  ) => ReactNode;
};

/**
 * Tree component that can control visibility of instances represented by tree nodes.
 * @beta
 */
export function VisibilityTree({ visibilityHandlerFactory, treeRenderer, hierarchyLevelSizeLimit, ...props }: VisibilityTreeProps) {
  const { imodel, getSchemaContext } = props;
  const { imodelAccess, currentHierarchyLevelSizeLimit } = useIModelAccess({
    imodel,
    getSchemaContext,
    hierarchyLevelSizeLimit,
  });

  const { getCheckboxState, onCheckboxClicked, triggerRefresh } = useHierarchyVisibility({
    visibilityHandlerFactory: useCallback(() => visibilityHandlerFactory({ imodelAccess }), [visibilityHandlerFactory, imodelAccess]),
  });

  return (
    <TreeBase
      {...props}
      onReload={triggerRefresh}
      imodelAccess={imodelAccess}
      currentHierarchyLevelSizeLimit={currentHierarchyLevelSizeLimit}
      treeRenderer={(treeProps) => treeRenderer({ ...treeProps, getCheckboxState, onCheckboxClicked })}
    />
  );
}
