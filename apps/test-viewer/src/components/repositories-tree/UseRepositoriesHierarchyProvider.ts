/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useMemo } from "react";
import { BeEvent } from "@itwin/core-bentley";
import { formatLabel } from "./FormatLabel";
import { getItwinRepositories, getRepositoryData } from "./RepositoriesService";

import type { EventListener } from "@itwin/presentation-shared";
import type { HierarchyNode, HierarchyProvider } from "@itwin/presentation-hierarchies";

interface UseRepositoriesHierarchyProviderProps {
  itwinId: string;
  environment?: "PROD" | "QA" | "DEV";
}

/**
 * @internal
 */
export function useRepositoriesHierarchyProvider({ itwinId, environment }: UseRepositoriesHierarchyProviderProps) {
  return useMemo<() => HierarchyProvider>(
    () => () => {
      const hierarchyChanged = new BeEvent<EventListener<HierarchyProvider["hierarchyChanged"]>>();
      return {
        async *getNodes({ parentNode }) {
          if (!parentNode) {
            const repositories = await getItwinRepositories(itwinId, environment);
            for (const repository of repositories) {
              yield {
                key: { type: "generic", id: repository.class },
                label: formatLabel(repository.class),
                children: !!repository.uri,
                extendedData: { url: repository.uri, repositoryType: repository.class },
                parentKeys: [],
              } satisfies HierarchyNode;
            }
          } else {
            const repositoryData = await getRepositoryData(parentNode.extendedData?.url);
            for (const data of repositoryData) {
              yield {
                key: { type: "generic", id: data.id ?? data.displayName },
                label: data.displayName ?? data.name,
                children: false,
                extendedData: { type: data.type, repositoryType: parentNode.extendedData?.repositoryType },
                parentKeys: [...parentNode.parentKeys, parentNode.key],
              } satisfies HierarchyNode;
            }
          }
        },
        setHierarchyFilter() {
          hierarchyChanged.raiseEvent();
        },
        async *getNodeInstanceKeys() {},
        setFormatter() {},
        hierarchyChanged,
      };
    },
    [environment, itwinId],
  );
}
