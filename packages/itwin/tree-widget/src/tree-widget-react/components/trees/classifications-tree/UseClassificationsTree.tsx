/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useMemo } from "react";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import iconBisCategory3d from "@stratakit/icons/bis-category-3d.svg";
import { EmptyTreeContent } from "../common/components/EmptyTree.js";
import { useCachedVisibility } from "../common/internal/useTreeHooks/UseCachedVisibility.js";
import { useIdsCache } from "../common/internal/useTreeHooks/UseIdsCache.js";
import { ClassificationsTreeComponent } from "./ClassificationsTreeComponent.js";
import { ClassificationsTreeDefinition } from "./ClassificationsTreeDefinition.js";
import { ClassificationsTreeIcon } from "./ClassificationsTreeIcon.js";
import { ClassificationsTreeIdsCache } from "./internal/ClassificationsTreeIdsCache.js";
import { createClassificationsTreeVisibilityHandler } from "./internal/ClassificationsTreeVisibilityHandler.js";

import type { UseIdsCacheProps } from "../common/internal/useTreeHooks/UseIdsCache.js";
import type { UseCachedVisibilityProps } from "../common/internal/useTreeHooks/UseCachedVisibility.js";
import type { ClassificationsTreeHierarchyConfiguration } from "./ClassificationsTreeDefinition.js";
import type { ReactNode } from "react";
import type { Viewport } from "@itwin/core-frontend";
import type { VisibilityTreeProps } from "../common/components/VisibilityTree.js";
import type { VisibilityTreeRendererProps } from "../common/components/VisibilityTreeRenderer.js";

/** @alpha */
export interface UseClassificationsTreeProps {
  activeView: Viewport;
  hierarchyConfig: ClassificationsTreeHierarchyConfiguration;
  emptyTreeContent?: ReactNode;
}

/** @alpha */
interface UseClassificationsTreeResult {
  categoriesTreeProps: Pick<VisibilityTreeProps, "treeName" | "getHierarchyDefinition" | "visibilityHandlerFactory" | "emptyTreeContent">;
  rendererProps: Required<Pick<VisibilityTreeRendererProps, "getDecorations">>;
}

/**
 * Custom hook to create and manage state for the categories tree.
 * @alpha
 */
export function useClassificationsTree({ activeView, emptyTreeContent, ...rest }: UseClassificationsTreeProps): UseClassificationsTreeResult {
  const hierarchyConfig = useMemo(
    () => ({ ...rest.hierarchyConfig }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [...Object.values(rest.hierarchyConfig)],
  );

  const { getCache: getClassificationsTreeIdsCache } = useIdsCache<ClassificationsTreeIdsCache, { hierarchyConfig: ClassificationsTreeHierarchyConfiguration }>(
    {
      imodel: activeView.iModel,
      createCache,
      cacheSpecificProps: useMemo(() => ({ hierarchyConfig }), [hierarchyConfig]),
    },
  );

  const { visibilityHandlerFactory } = useCachedVisibility<ClassificationsTreeIdsCache, undefined>({
    activeView,
    getCache: getClassificationsTreeIdsCache,
    factoryProps: undefined,
    createFactory: createVisibilityHandlerFactory,
  });

  const getHierarchyDefinition = useCallback<VisibilityTreeProps["getHierarchyDefinition"]>(
    (props) => {
      return new ClassificationsTreeDefinition({ ...props, idsCache: getClassificationsTreeIdsCache(), hierarchyConfig });
    },
    [getClassificationsTreeIdsCache, hierarchyConfig],
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
  props: Parameters<UseCachedVisibilityProps<ClassificationsTreeIdsCache, undefined>["createFactory"]>[0],
): VisibilityTreeProps["visibilityHandlerFactory"] {
  const { activeView, idsCacheGetter } = props;
  return ({ imodelAccess }) => createClassificationsTreeVisibilityHandler({ viewport: activeView, idsCache: idsCacheGetter(), imodelAccess });
}

function createCache(
  ...props: Parameters<UseIdsCacheProps<ClassificationsTreeIdsCache, { hierarchyConfig: ClassificationsTreeHierarchyConfiguration }>["createCache"]>
) {
  return new ClassificationsTreeIdsCache(createECSqlQueryExecutor(props[0]), props[1].hierarchyConfig);
}
