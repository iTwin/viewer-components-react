/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useMemo, useState } from "react";
import { useDebouncedAsyncValue } from "@itwin/components-react";
import { CompressedId64Set } from "@itwin/core-bentley";
import { ProgressRadial } from "@itwin/itwinui-react";
import { DefaultContentDisplayTypes, KeySet } from "@itwin/presentation-common";
import { PresentationInstanceFilter, PresentationInstanceFilterDialog } from "@itwin/presentation-components";
import { Presentation } from "@itwin/presentation-frontend";
import { GenericInstanceFilter, RowsLimitExceededError } from "@itwin/presentation-hierarchies";
import { TreeWidget } from "../../../TreeWidget";
import { Delayed } from "./components/Delayed";

import type { Id64Array, Id64String } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type { ClassInfo, Descriptor } from "@itwin/presentation-common";
import type { PresentationInstanceFilterInfo, PresentationInstanceFilterPropertiesSource } from "@itwin/presentation-components";
import type { HierarchyLevelDetails } from "@itwin/presentation-hierarchies-react";
import type { InstanceKey } from "@itwin/presentation-shared";
import type { UsageTrackedFeatures } from "./UseFeatureReporting";

interface UseHierarchyLevelFilteringProps {
  imodel: IModelConnection;
  defaultHierarchyLevelSizeLimit: number;
  reportUsage?: (props: { featureId?: UsageTrackedFeatures; reportInteraction: true }) => void;
}

/** @internal */
export function useHierarchyLevelFiltering({ imodel, defaultHierarchyLevelSizeLimit, reportUsage }: UseHierarchyLevelFilteringProps) {
  const [filteringOptions, setFilteringOptions] = useState<HierarchyLevelDetails>();

  const propertiesSource = useMemo<(() => Promise<PresentationInstanceFilterPropertiesSource>) | undefined>(() => {
    if (!filteringOptions) {
      return undefined;
    }

    return async () => {
      const keySet = await collectInstanceKeys(filteringOptions.getInstanceKeysIterator());
      if (keySet.isEmpty) {
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
        keys: keySet,
      });
      if (!descriptor) {
        throw new Error("Failed to create content descriptor");
      }

      return { descriptor, inputKeys: keySet };
    };
  }, [filteringOptions, imodel]);

  const getInitialFilter = useMemo(() => {
    const currentFilter = filteringOptions?.instanceFilter;
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
        reportUsage?.({ featureId: info ? "hierarchy-level-filtering" : undefined, reportInteraction: true });
        filteringOptions.setInstanceFilter(toGenericFilter(info));
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
          <MatchingInstancesCount filter={filter} hierarchyLevelDetails={filteringOptions} defaultHierarchyLevelSizeLimit={defaultHierarchyLevelSizeLimit} />
        );
      }}
    />
  );

  return {
    onFilterClick: setFilteringOptions,
    filteringDialog,
  };
}

interface MatchingInstancesCountProps {
  filter: PresentationInstanceFilterInfo;
  hierarchyLevelDetails: HierarchyLevelDetails;
  defaultHierarchyLevelSizeLimit: number;
}

function MatchingInstancesCount({ filter, defaultHierarchyLevelSizeLimit, hierarchyLevelDetails }: MatchingInstancesCountProps) {
  const { value, inProgress } = useDebouncedAsyncValue(
    useCallback(async () => {
      const instanceFilter = toGenericFilter(filter);
      try {
        const instanceCount = await countInstanceKeys(
          hierarchyLevelDetails.getInstanceKeysIterator({
            instanceFilter,
            hierarchyLevelSizeLimit: hierarchyLevelDetails.sizeLimit ?? defaultHierarchyLevelSizeLimit,
          }),
        );
        return TreeWidget.translate("filteringDialog.matchingInstancesCount", {
          instanceCount: instanceCount.toLocaleString(undefined, { useGrouping: true }),
        });
      } catch (e) {
        if (e instanceof RowsLimitExceededError) {
          return TreeWidget.translate("filteringDialog.filterExceedsLimit", { limit: e.limit.toLocaleString(undefined, { useGrouping: true }) });
        }
        return TreeWidget.translate("filteringDialog.failedToCalculateMatchingInstancesCount");
      }
    }, [filter, hierarchyLevelDetails, defaultHierarchyLevelSizeLimit]),
  );

  if (inProgress) {
    return (
      <Delayed show={true}>
        {TreeWidget.translate("stateless.matchingInstancesCount", { instanceCount: "" })}
        <ProgressRadial size="x-small" />
      </Delayed>
    );
  }

  return value ? <>{value}</> : null;
}

async function countInstanceKeys(iterator: AsyncIterableIterator<InstanceKey>) {
  let result = 0;
  for await (const _ of iterator) {
    result++;
  }
  return result;
}

async function collectInstanceKeys(iterator: AsyncIterableIterator<InstanceKey>) {
  const idsByClassName = new Map<Id64String, Id64Array>();
  for await (const { className, id } of iterator) {
    let idSet = idsByClassName.get(className);
    if (!idSet) {
      idSet = [];
      idsByClassName.set(className, idSet);
    }
    idSet.push(id);
  }

  const instanceKeys = new Array<[className: string, compressedIds: CompressedId64Set]>();
  for (const [className, ids] of idsByClassName) {
    instanceKeys.push([className.toLowerCase(), CompressedId64Set.sortAndCompress(ids)]);
  }
  return KeySet.fromJSON({ instanceKeys, nodeKeys: [] });
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
