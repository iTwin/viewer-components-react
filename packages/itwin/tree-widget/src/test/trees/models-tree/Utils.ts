/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { concatMap, EMPTY, expand, from, of, toArray } from "rxjs";
import { vi } from "vitest";
import { Id64 } from "@itwin/core-bentley";
import { createIModelHierarchyProvider } from "@itwin/presentation-hierarchies";
import { BaseIdsCache } from "../../../tree-widget-react/components/trees/common/internal/caches/BaseIdsCache.js";
import {
  CLASS_NAME_Element,
  CLASS_NAME_GeometricElement3d,
  CLASS_NAME_Model,
  CLASS_NAME_SpatialCategory,
  CLASS_NAME_Subject,
} from "../../../tree-widget-react/components/trees/common/internal/ClassNameDefinitions.js";
import { ModelsTreeIdsCache } from "../../../tree-widget-react/components/trees/models-tree/internal/ModelsTreeIdsCache.js";
import { defaultHierarchyConfiguration, ModelsTreeDefinition } from "../../../tree-widget-react/components/trees/models-tree/ModelsTreeDefinition.js";
import { createIModelAccess } from "../Common.js";

import type { Id64Arg, Id64Array, Id64String } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type {
  ClassGroupingNodeKey,
  GroupingHierarchyNode,
  HierarchyProvider,
  HierarchySearchTree,
  NonGroupingHierarchyNode,
} from "@itwin/presentation-hierarchies";
import type { EC, InstanceKey } from "@itwin/presentation-shared";

type ModelsTreeHierarchyConfiguration = ConstructorParameters<typeof ModelsTreeDefinition>[0]["hierarchyConfig"];

interface CreateModelsTreeProviderProps {
  imodel: IModelConnection;
  searchPaths?: HierarchySearchTree[];
  hierarchyConfig?: Partial<ModelsTreeHierarchyConfiguration>;
  idsCache?: ModelsTreeIdsCache;
  imodelAccess?: ReturnType<typeof createIModelAccess>;
}

export function createModelsTreeProvider({
  imodel,
  searchPaths,
  hierarchyConfig,
  imodelAccess,
  idsCache,
}: CreateModelsTreeProviderProps): HierarchyProvider & { dispose: () => void; [Symbol.dispose]: () => void } {
  const config = { ...defaultHierarchyConfiguration, hideRootSubject: true, ...hierarchyConfig };
  const createdImodelAccess = imodelAccess ?? createIModelAccess(imodel);
  const baseIdsCache = new BaseIdsCache({ queryExecutor: createdImodelAccess, elementClassName: config.elementClassSpecification, type: "3d" });
  const createdIdsCache =
    idsCache ??
    new ModelsTreeIdsCache({
      queryExecutor: createdImodelAccess,
      hierarchyConfig: config,
      baseIdsCache,
    });
  const provider = createIModelHierarchyProvider({
    imodelAccess: createdImodelAccess,
    hierarchyDefinition: new ModelsTreeDefinition({
      imodelAccess: createdImodelAccess,
      idsCache: createdIdsCache,
      hierarchyConfig: config,
    }),
    ...(searchPaths ? { search: { paths: searchPaths } } : undefined),
  });
  const dispose = () => {
    provider[Symbol.dispose]();
  };
  return {
    hierarchyChanged: provider.hierarchyChanged,
    getNodes: (props) => provider.getNodes(props),
    getNodeInstanceKeys: (props) => provider.getNodeInstanceKeys(props),
    setFormatter: (formatter) => provider.setFormatter(formatter),
    setHierarchySearch: (props) => provider.setHierarchySearch(props),
    dispose,
    [Symbol.dispose]() {
      dispose();
    },
  };
}

interface IdsCacheMockProps {
  subjectsHierarchy?: Map<Id64String, Id64String[]>;
  subjectModels?: Map<Id64String, Id64String[]>;
  modelCategories?: Map<Id64String, Id64Array>;
  categoryElements?: Map<Id64String, Id64Array>;
}

export function createFakeIdsCache(props?: IdsCacheMockProps): ModelsTreeIdsCache {
  return {
    getChildSubjectIds: vi.fn((subjectIds: Id64Arg) => {
      return from(Id64.iterable(subjectIds)).pipe(
        concatMap((id) => props?.subjectsHierarchy?.get(id) ?? EMPTY),
        expand((id) => props?.subjectsHierarchy?.get(id) ?? EMPTY),
        toArray(),
      );
    }),
    getChildSubjectModelIds: vi.fn(),
    getSubjectModelIds: vi.fn((subjectIds: Id64Arg) => {
      return from(Id64.iterable(subjectIds)).pipe(
        expand((id) => props?.subjectsHierarchy?.get(id) ?? EMPTY),
        concatMap((id) => props?.subjectModels?.get(id) ?? EMPTY),
        toArray(),
      );
    }),
    getCategories: vi.fn(({ modelId }: { modelId: Id64String; includeOnlyIfCategoryOfTopMostElement?: boolean }) => {
      return of(new Set(props?.modelCategories?.get(modelId) ?? []));
    }),
    getAllCategoriesOfElements: vi.fn(() => {
      const result = new Set<Id64String>();
      for (const categories of props?.modelCategories?.values() ?? []) {
        categories.forEach((category) => {
          result.add(category);
        });
      }
      return of(result);
    }),
    getElementsCount: vi.fn(({ categoryId }: { modelId: Id64String; categoryId: Id64String }) => {
      return of(props?.categoryElements?.get(categoryId)?.length ?? 0);
    }),
    getChildElementsTree: vi.fn(() => {
      return of(new Map());
    }),
    getAllChildElementsCount: vi.fn(() => {
      return of(new Map());
    }),
    getSubModelsUnderElement: vi.fn(() => of([])),
    getSubModels: vi.fn(() => EMPTY),
    [Symbol.dispose]: vi.fn(),
  } as unknown as ModelsTreeIdsCache;
}

export function createSubjectHierarchyNode(props?: { ids?: Id64Arg; parentKeys?: InstanceKey[] }): NonGroupingHierarchyNode {
  const instanceKeys = new Array<InstanceKey>();
  for (const id of props?.ids ? Id64.iterable(props.ids) : []) {
    instanceKeys.push({ className: CLASS_NAME_Subject, id });
  }
  return {
    key: {
      type: "instances",
      instanceKeys,
    },
    children: false,
    label: "",
    parentKeys: props?.parentKeys ? props.parentKeys.map((parentKey) => ({ type: "instances", instanceKeys: [parentKey] })) : [],
    extendedData: {
      isSubject: true,
    },
  };
}
export function createModelHierarchyNode(props?: {
  modelId?: Id64String;
  hasChildren?: boolean;
  parentKeys?: InstanceKey[];
  search?: NonGroupingHierarchyNode["search"];
}): NonGroupingHierarchyNode {
  return {
    key: {
      type: "instances",
      instanceKeys: [{ className: CLASS_NAME_Model, id: props?.modelId ?? "" }],
    },
    children: !!props?.hasChildren,
    label: "",
    parentKeys: props?.parentKeys ? props.parentKeys.map((parentKey) => ({ type: "instances", instanceKeys: [parentKey] })) : [],
    search: props?.search,
    extendedData: {
      isModel: true,
      modelId: props?.modelId ?? "0x1",
    },
  };
}
export function createCategoryHierarchyNode({
  modelId,
  categoryId,
  hasChildren,
  parentKeys,
  search,
}: {
  modelId?: Id64String;
  categoryId?: Id64Arg;
  hasChildren?: boolean;
  parentKeys?: Array<InstanceKey | ClassGroupingNodeKey>;
  search?: NonGroupingHierarchyNode["search"];
}): NonGroupingHierarchyNode {
  return {
    key: {
      type: "instances",
      instanceKeys:
        typeof categoryId === "string"
          ? [{ className: CLASS_NAME_SpatialCategory, id: categoryId ?? "" }]
          : [...(categoryId ?? [])].map((id) => ({ className: CLASS_NAME_SpatialCategory, id })),
    },
    children: !!hasChildren,
    label: "",
    parentKeys: parentKeys ? parentKeys.map((parentKey) => ("type" in parentKey ? parentKey : { type: "instances", instanceKeys: [parentKey] })) : [],
    search,
    extendedData: {
      isCategory: true,
      modelIds: [modelId ?? "0x1"],
      categoryId: categoryId ?? "0x2",
    },
  };
}
export function createElementHierarchyNode(props: {
  modelId: Id64String | undefined;
  categoryId: Id64String | undefined;
  hasChildren?: boolean;
  elementId?: Id64String;
  parentKeys?: Array<InstanceKey | ClassGroupingNodeKey>;
  search?: NonGroupingHierarchyNode["search"];
  childrenCount?: number;
  topMostParentElementId?: Id64String;
}): NonGroupingHierarchyNode {
  return {
    key: {
      type: "instances",
      instanceKeys: [{ className: CLASS_NAME_GeometricElement3d, id: props.elementId ?? "" }],
    },
    children: !!props.hasChildren,
    label: "",
    search: props.search,
    parentKeys: props.parentKeys
      ? props.parentKeys.map((parentKey) => ("type" in parentKey ? parentKey : { type: "instances", instanceKeys: [parentKey] }))
      : [],
    extendedData: {
      isElement: true,
      modelId: props.modelId,
      categoryId: props.categoryId,
      childrenCount: props.childrenCount !== undefined ? props.childrenCount : 0,
      topMostParentElementId: props.topMostParentElementId ?? props.elementId,
    },
  };
}
export function createClassGroupingHierarchyNode({
  elements,
  parentKeys,
  modelId,
  categoryId,
  childrenCount,
  ...props
}: {
  elements: Id64Array;
  className?: EC.FullClassName;
  parentKeys?: Array<InstanceKey | ClassGroupingNodeKey>;
  modelId: Id64String;
  categoryId: Id64String;
  hasDirectNonSearchTargets?: boolean;
  hasSearchTargetAncestor?: boolean;
  childrenCount?: number;
  topMostParentElementId?: Id64String;
}): GroupingHierarchyNode & { key: ClassGroupingNodeKey } {
  const className = props.className ?? CLASS_NAME_Element;
  return {
    key: {
      type: "class-grouping",
      className,
    },
    children: !!elements?.length,
    groupedInstanceKeys: elements ? elements.map((id) => ({ className, id })) : [],
    label: "",
    parentKeys: parentKeys ? parentKeys.map((parentKey) => ("type" in parentKey ? parentKey : { type: "instances", instanceKeys: [parentKey] })) : [],
    extendedData: {
      categoryId,
      modelId,
      categoryOfTopMostParentElement: categoryId,
      topMostParentElementId: props.topMostParentElementId,
      childrenCount: childrenCount !== undefined ? childrenCount : 0,
      ...(props.hasDirectNonSearchTargets ? { hasDirectNonSearchTargets: props.hasDirectNonSearchTargets } : {}),
      ...(props.hasSearchTargetAncestor ? { hasSearchTargetAncestor: props.hasSearchTargetAncestor } : {}),
    },
  };
}
