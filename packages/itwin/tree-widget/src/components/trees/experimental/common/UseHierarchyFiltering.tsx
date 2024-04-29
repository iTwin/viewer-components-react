/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useDebouncedAsyncValue } from "@itwin/components-react";
import { IModelConnection } from "@itwin/core-frontend";
import { ClassInfo, DefaultContentDisplayTypes, Descriptor, KeySet } from "@itwin/presentation-common";
import {
  PresentationInstanceFilter,
  PresentationInstanceFilterDialog,
  PresentationInstanceFilterInfo,
  PresentationInstanceFilterPropertiesSource,
} from "@itwin/presentation-components";
import { Presentation } from "@itwin/presentation-frontend";
import { GenericInstanceFilter, HierarchyProvider, RowsLimitExceededError } from "@itwin/presentation-hierarchies";
import { HierarchyLevelConfiguration, useTree } from "@itwin/presentation-hierarchies-react";
import { InstanceKey } from "@itwin/presentation-shared";
import { useCallback, useMemo, useState } from "react";

type UseTreeResult = ReturnType<typeof useTree>;

interface UseHierarchyFilteringOwnProps {
  imodel: IModelConnection;
  hierarchyProvider?: HierarchyProvider;
  defaultHierarchyLevelSizeLimit: number;
}

type UseHierarchyFilteringProps = UseHierarchyFilteringOwnProps & Pick<UseTreeResult, "setHierarchyLevelFilter" | "getHierarchyLevelConfiguration">;

/** @internal */
export function useHierarchyFiltering({
  imodel,
  hierarchyProvider,
  defaultHierarchyLevelSizeLimit,
  setHierarchyLevelFilter,
  getHierarchyLevelConfiguration,
}: UseHierarchyFilteringProps) {
  const [filteringOptions, setFilteringOptions] = useState<{ nodeId: string | undefined; configuration: HierarchyLevelConfiguration }>();
  const onFilterClick = useCallback(
    (nodeId: string | undefined) => {
      const configuration = getHierarchyLevelConfiguration(nodeId);
      setFilteringOptions(configuration ? { nodeId, configuration } : undefined);
    },
    [getHierarchyLevelConfiguration],
  );

  const propertiesSource = useMemo<(() => Promise<PresentationInstanceFilterPropertiesSource>) | undefined>(() => {
    if (!hierarchyProvider || !filteringOptions) {
      return undefined;
    }

    return async () => {
      const inputKeys = await collectInstanceKeys(hierarchyProvider.getNodeInstanceKeys({ parentNode: filteringOptions.configuration.hierarchyNode }));
      if (inputKeys.length === 0) {
        throw new Error("Hierarchy level is empty - unable to create content descriptor.");
      }

      const descriptor = await Presentation.presentation.getContentDescriptor({
        imodel,
        rulesetOrId: {
          id: `Hierarchy level descriptor ruleset`,
          rules: [
            {
              ruleType: "Content",
              specifications: [
                {
                  specType: "SelectedNodeInstances",
                },
              ],
            },
          ],
        },
        displayType: DefaultContentDisplayTypes.PropertyPane,
        keys: new KeySet(inputKeys),
      });
      if (!descriptor) {
        throw new Error("Failed to create content descriptor");
      }

      return { descriptor, inputKeys };
    };
  }, [filteringOptions, imodel, hierarchyProvider]);

  const getInitialFilter = useMemo(() => {
    const currentFilter = filteringOptions?.configuration.currentFilter;
    if (!currentFilter) {
      return undefined;
    }

    return (descriptor: Descriptor) => fromGenericFilter(descriptor, currentFilter);
  }, [filteringOptions]);

  const filteringDialog = (
    <PresentationInstanceFilterDialog
      imodel={imodel}
      isOpen={!!filteringOptions}
      onApply={(info) => {
        if (!filteringOptions) {
          return;
        }
        setHierarchyLevelFilter(filteringOptions.nodeId, toGenericFilter(info));
        setFilteringOptions(undefined);
      }}
      onClose={() => {
        setFilteringOptions(undefined);
      }}
      propertiesSource={propertiesSource}
      initialFilter={getInitialFilter}
      filterResultsCountRenderer={(filter) => {
        if (!filteringOptions || !hierarchyProvider) {
          return null;
        }

        return (
          <MatchingInstancesCount
            filter={filter}
            hierarchyLevelConfiguration={filteringOptions.configuration}
            hierarchyProvider={hierarchyProvider}
            defaultHierarchyLevelSizeLimit={defaultHierarchyLevelSizeLimit}
          />
        );
      }}
    />
  );

  return {
    onFilterClick,
    filteringDialog,
  };
}

interface MatchingInstancesCountProps {
  filter: PresentationInstanceFilterInfo;
  hierarchyLevelConfiguration: HierarchyLevelConfiguration;
  hierarchyProvider: HierarchyProvider;
  defaultHierarchyLevelSizeLimit: number;
}

function MatchingInstancesCount({ filter, hierarchyProvider, defaultHierarchyLevelSizeLimit, hierarchyLevelConfiguration }: MatchingInstancesCountProps) {
  const { value } = useDebouncedAsyncValue(
    useCallback(async () => {
      const instanceFilter = toGenericFilter(filter);
      try {
        const instanceKeys = await collectInstanceKeys(
          hierarchyProvider.getNodeInstanceKeys({
            parentNode: hierarchyLevelConfiguration.hierarchyNode,
            instanceFilter: instanceFilter,
            hierarchyLevelSizeLimit: hierarchyLevelConfiguration.hierarchyLevelSizeLimit ?? defaultHierarchyLevelSizeLimit,
          }),
        );
        return `Current filter matching instances count: ${instanceKeys.length}`;
      } catch (e) {
        if (e instanceof RowsLimitExceededError) {
          return `Current filter exceeds instances count of ${e.limit}`;
        }
      }

      return undefined;
    }, [filter, hierarchyLevelConfiguration, hierarchyProvider]),
  );
  if (!value) {
    return null;
  }
  return <>{value}</>;
}

async function collectInstanceKeys(iterator: AsyncIterableIterator<InstanceKey>) {
  const inputKeys = [];
  for await (const inputKey of iterator) {
    inputKeys.push(inputKey);
  }
  return inputKeys;
}

function fromGenericFilter(descriptor: Descriptor, filter: GenericInstanceFilter): PresentationInstanceFilterInfo {
  const presentationFilter =
    GenericInstanceFilter.isFilterRuleGroup(filter.rules) && filter.rules.rules.length === 0
      ? undefined
      : PresentationInstanceFilter.fromGenericInstanceFilter(descriptor, filter);
  return {
    filter: presentationFilter,
    usedClasses: (filter.filteredClassNames ?? [])
      .map((name) => descriptor.selectClasses.find((selectClass) => selectClass.selectClassInfo.name === name)?.selectClassInfo)
      .filter((classInfo): classInfo is ClassInfo => classInfo !== undefined),
  };
}

function toGenericFilter(filterInfo?: PresentationInstanceFilterInfo): GenericInstanceFilter | undefined {
  if (!filterInfo) {
    return undefined;
  }

  if (!filterInfo.filter) {
    return filterInfo.usedClasses.length > 0
      ? {
          propertyClassNames: [],
          relatedInstances: [],
          filteredClassNames: filterInfo.usedClasses.map((info) => info.name),
          rules: { operator: "and", rules: [] },
        }
      : undefined;
  }

  return PresentationInstanceFilter.toGenericInstanceFilter(filterInfo.filter, filterInfo.usedClasses);
}
