/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useMemo, useState } from "react";
import { useDebouncedAsyncValue } from "@itwin/components-react";
import { DefaultContentDisplayTypes, KeySet } from "@itwin/presentation-common";
import { PresentationInstanceFilter, PresentationInstanceFilterDialog } from "@itwin/presentation-components";
import { Presentation } from "@itwin/presentation-frontend";
import { GenericInstanceFilter, RowsLimitExceededError } from "@itwin/presentation-hierarchies";

import type { IModelConnection } from "@itwin/core-frontend";
import type { ClassInfo, Descriptor } from "@itwin/presentation-common";
import type { PresentationInstanceFilterInfo, PresentationInstanceFilterPropertiesSource } from "@itwin/presentation-components";
import type { HierarchyLevelDetails, useTree } from "@itwin/presentation-hierarchies-react";
import type { InstanceKey } from "@itwin/presentation-shared";

type UseTreeResult = ReturnType<typeof useTree>;

interface UseHierarchyLevelFilteringOwnProps {
  imodel: IModelConnection;
  defaultHierarchyLevelSizeLimit: number;
}

type UseHierarchyLevelFilteringProps = UseHierarchyLevelFilteringOwnProps & Pick<UseTreeResult, "getHierarchyLevelDetails">;

/** @internal */
export function useHierarchyLevelFiltering({ imodel, defaultHierarchyLevelSizeLimit, getHierarchyLevelDetails }: UseHierarchyLevelFilteringProps) {
  const [filteringOptions, setFilteringOptions] = useState<{ nodeId: string | undefined; hierarchyDetails: HierarchyLevelDetails }>();
  const onFilterClick = useCallback(
    (nodeId: string | undefined) => {
      const hierarchyDetails = getHierarchyLevelDetails(nodeId);
      setFilteringOptions(hierarchyDetails ? { nodeId, hierarchyDetails } : undefined);
    },
    [getHierarchyLevelDetails],
  );

  const propertiesSource = useMemo<(() => Promise<PresentationInstanceFilterPropertiesSource>) | undefined>(() => {
    if (!filteringOptions) {
      return undefined;
    }

    return async () => {
      const inputKeys = await collectInstanceKeys(filteringOptions.hierarchyDetails.getInstanceKeysIterator());
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
  }, [filteringOptions, imodel]);

  const getInitialFilter = useMemo(() => {
    const currentFilter = filteringOptions?.hierarchyDetails.instanceFilter;
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
        filteringOptions.hierarchyDetails.setInstanceFilter(toGenericFilter(info));
        setFilteringOptions(undefined);
      }}
      onClose={() => {
        setFilteringOptions(undefined);
      }}
      propertiesSource={propertiesSource}
      initialFilter={getInitialFilter}
      filterResultsCountRenderer={(filter) => {
        if (!filteringOptions) {
          return null;
        }

        return (
          <MatchingInstancesCount
            filter={filter}
            hierarchyLevelDetails={filteringOptions.hierarchyDetails}
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
  hierarchyLevelDetails: HierarchyLevelDetails;
  defaultHierarchyLevelSizeLimit: number;
}

function MatchingInstancesCount({ filter, defaultHierarchyLevelSizeLimit, hierarchyLevelDetails }: MatchingInstancesCountProps) {
  const { value } = useDebouncedAsyncValue(
    useCallback(async () => {
      const instanceFilter = toGenericFilter(filter);
      try {
        const instanceKeys = await collectInstanceKeys(
          hierarchyLevelDetails.getInstanceKeysIterator({
            instanceFilter,
            hierarchyLevelSizeLimit: hierarchyLevelDetails.sizeLimit ?? defaultHierarchyLevelSizeLimit,
          }),
        );
        return `Current filter matching instances count: ${instanceKeys.length}`;
      } catch (e) {
        if (e instanceof RowsLimitExceededError) {
          return `Current filter exceeds instances count of ${e.limit}`;
        }
        return "Failed to calculate matching instances count";
      }
    }, [filter, hierarchyLevelDetails, defaultHierarchyLevelSizeLimit]),
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
