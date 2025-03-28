/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useMemo } from "react";
import { createIModelAccess } from "../internal/Utils.js";
import { useHierarchyVisibility } from "../UseHierarchyVisibility.js";
import { Tree } from "./Tree.js";

import type { FunctionProps } from "../Utils.js";
import type { TreeProps } from "./Tree.js";
import type { ReactNode } from "react";
import type { VisibilityTreeRendererProps } from "./VisibilityTreeRenderer.js";
import type { ECClassHierarchyInspector } from "@itwin/presentation-shared";
import type { HierarchyVisibilityHandler } from "../UseHierarchyVisibility.js";

/** @beta */
export type VisibilityTreeProps = Omit<TreeProps, "treeRenderer" | "imodelAccess"> & {
  /** Callback for creating visibility handler used to control visibility of instances represented by tree nodes. */
  visibilityHandlerFactory: (props: { imodelAccess: ECClassHierarchyInspector }) => HierarchyVisibilityHandler;
  /** Tree renderer that should be used to render tree data. */
  treeRenderer: (
    treeProps: FunctionProps<TreeProps["treeRenderer"]> & Pick<VisibilityTreeRendererProps, "getVisibilityButtonState" | "onVisibilityButtonClick">,
  ) => ReactNode;
};

/**
 * Tree component that can control visibility of instances represented by tree nodes.
 * @beta
 */
export function VisibilityTree({ visibilityHandlerFactory, treeRenderer, ...props }: VisibilityTreeProps) {
  const { imodel, getSchemaContext } = props;
  const imodelAccess = useMemo(() => createIModelAccess({ imodel, getSchemaContext }), [imodel, getSchemaContext]);
  const { getVisibilityButtonState, onVisibilityButtonClick, triggerRefresh } = useHierarchyVisibility({
    visibilityHandlerFactory: useCallback(() => visibilityHandlerFactory({ imodelAccess }), [visibilityHandlerFactory, imodelAccess]),
  });

  return (
    <Tree
      {...props}
      onReload={triggerRefresh}
      imodelAccess={imodelAccess}
      treeRenderer={(treeProps) => treeRenderer({ ...treeProps, getVisibilityButtonState, onVisibilityButtonClick })}
    />
  );
}
