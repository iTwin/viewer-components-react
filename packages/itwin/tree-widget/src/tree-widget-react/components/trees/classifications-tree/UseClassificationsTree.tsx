/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useState } from "react";
import iconBisCategory3d from "@stratakit/icons/bis-category-3d.svg";
import { EmptyTreeContent } from "../common/components/EmptyTree.js";
import { ClassificationsTreeComponent } from "./ClassificationsTreeComponent.js";
import { ClassificationsTreeDefinition } from "./ClassificationsTreeDefinition.js";
import { ClassificationsTreeIcon } from "./ClassificationsTreeIcon.js";
import { createClassificationsTreeVisibilityHandler } from "./internal/ClassificationsTreeVisibilityHandler.js";
import { useIdsCache } from "./internal/UseIdsCache.js";

import type { ReactNode } from "react";
import type { Viewport } from "@itwin/core-frontend";
import type { VisibilityTreeProps } from "../common/components/VisibilityTree.js";
import type { VisibilityTreeRendererProps } from "../common/components/VisibilityTreeRenderer.js";
import type { ClassificationsTreeIdsCache } from "./internal/ClassificationsTreeIdsCache.js";

/** @alpha */
export interface UseClassificationsTreeProps {
  activeView: Viewport;
  rootClassificationSystemCode: string;
  emptyTreeContent?: ReactNode;
}

/** @alpha */
interface UseClassificationsTreeResult {
  categoriesTreeProps: Pick<
    VisibilityTreeProps,
    "treeName" | "getHierarchyDefinition" | "visibilityHandlerFactory" | "emptyTreeContent"
  >;
  rendererProps: Required<Pick<VisibilityTreeRendererProps, "getDecorations">>;
}

/**
 * Custom hook to create and manage state for the categories tree.
 * @alpha
 */
export function useClassificationsTree({
  activeView,
  rootClassificationSystemCode,
  emptyTreeContent,
}: UseClassificationsTreeProps): UseClassificationsTreeResult {
  const { getClassificationsTreeIdsCache, visibilityHandlerFactory } = useCachedVisibility(activeView, rootClassificationSystemCode);

  const getHierarchyDefinition = useCallback<VisibilityTreeProps["getHierarchyDefinition"]>(
    (props) => {
      return new ClassificationsTreeDefinition({ ...props, idsCache: getClassificationsTreeIdsCache(), rootClassificationSystemCode });
    },
    [getClassificationsTreeIdsCache, rootClassificationSystemCode],
  );

  return {
    categoriesTreeProps: {
      treeName: ClassificationsTreeComponent.id,
      getHierarchyDefinition,
      visibilityHandlerFactory,
      emptyTreeContent: emptyTreeContent ?? <EmptyTreeContent icon={iconBisCategory3d} />,
    },
    rendererProps: {
      getDecorations: useCallback((node) => <ClassificationsTreeIcon node={node} />, []),
    },
  };
}

function createVisibilityHandlerFactory(
  activeView: Viewport,
  idsCacheGetter: () => ClassificationsTreeIdsCache,
): VisibilityTreeProps["visibilityHandlerFactory"] {
  return ({ imodelAccess }) =>
    createClassificationsTreeVisibilityHandler({ viewport: activeView, idsCache: idsCacheGetter(), imodelAccess });
}

function useCachedVisibility(activeView: Viewport, rootClassificationSystemCode: string) {
  const { getCache: getClassificationsTreeIdsCache } = useIdsCache(activeView.iModel, rootClassificationSystemCode);
  const [visibilityHandlerFactory, setVisibilityHandlerFactory] = useState<VisibilityTreeProps["visibilityHandlerFactory"]>(() =>
    createVisibilityHandlerFactory(activeView, getClassificationsTreeIdsCache),
  );
  useEffect(() => {
    setVisibilityHandlerFactory(() => createVisibilityHandlerFactory(activeView, getClassificationsTreeIdsCache));
  }, [activeView, getClassificationsTreeIdsCache]);
  return {
    getClassificationsTreeIdsCache,
    visibilityHandlerFactory,
  };
}
