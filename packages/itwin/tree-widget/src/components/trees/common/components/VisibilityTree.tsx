/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useMemo } from "react";
import { useHierarchyVisibility } from "../UseHierarchyVisibility";
import { createIModelAccess } from "../Utils";
import { Tree } from "./Tree";

import type React from "react";
import type { VisibilityTreeRenderer } from "./VisibilityTreeRenderer";
import type { TreeRendererProps } from "./Tree";
import type { ECClassHierarchyInspector } from "@itwin/presentation-shared";
import type { HierarchyVisibilityHandler } from "../UseHierarchyVisibility";
import type { ComponentPropsWithoutRef } from "react";

type TreeProps = ComponentPropsWithoutRef<typeof Tree>;

/**
 * Properties that are passed to `treeRenderer` from `VisibilityTree` component.
 * @beta
 */
export type VisibilityTreeRendererProps = TreeRendererProps &
  Pick<ComponentPropsWithoutRef<typeof VisibilityTreeRenderer>, "getCheckboxState" | "onCheckboxClicked">;

interface VisibilityTreeOwnProps {
  /** Callback for creating visibility handler used to control visibility of instances represented by tree nodes. */
  visibilityHandlerFactory: (props: { imodelAccess: ECClassHierarchyInspector }) => HierarchyVisibilityHandler;
  /** Tree renderer that should be used to render tree data. */
  treeRenderer: (treeProps: VisibilityTreeRendererProps) => React.ReactNode;
}

type VisibilityTreeProps = VisibilityTreeOwnProps & Omit<TreeProps, "treeRenderer" | "imodelAccess">;

/**
 * Tree component that can control visibility of instances represented by tree nodes.
 * @beta
 */
export function VisibilityTree({ visibilityHandlerFactory, treeRenderer, ...props }: VisibilityTreeProps) {
  const { imodel, getSchemaContext } = props;
  const imodelAccess = useMemo(() => createIModelAccess({ imodel, getSchemaContext }), [imodel, getSchemaContext]);
  const { getCheckboxState, onCheckboxClicked, triggerRefresh } = useHierarchyVisibility({
    visibilityHandlerFactory: useCallback(() => visibilityHandlerFactory({ imodelAccess }), [visibilityHandlerFactory, imodelAccess]),
  });

  return (
    <Tree
      {...props}
      onReload={triggerRefresh}
      imodelAccess={imodelAccess}
      treeRenderer={(treeProps) => treeRenderer({ ...treeProps, getCheckboxState, onCheckboxClicked })}
    />
  );
}
