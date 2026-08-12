/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { concatMap, EMPTY, expand, from, of, toArray } from "rxjs";
import { vi } from "vitest";
import { Id64 } from "@itwin/core-bentley";
import { createIModelHierarchyProvider } from "@itwin/presentation-hierarchies";
import { BaseIdsCache } from "../../../tree-widget-react/shared/internal/caches/BaseIdsCache.js";
import {
  CLASS_NAME_Element,
  CLASS_NAME_GeometricElement3d,
  CLASS_NAME_Model,
  CLASS_NAME_SpatialCategory,
  CLASS_NAME_Subject,
} from "../../../tree-widget-react/shared/internal/ClassNameDefinitions.js";
import { mergeWithDefaults } from "../../../tree-widget-react/shared/internal/Utils.js";
import { ModelsTreeIdsCache } from "../../../tree-widget-react/trees/models-tree/internal/ModelsTreeIdsCache.js";
import { createModelsTreeVisibilityHandler } from "../../../tree-widget-react/trees/models-tree/internal/visibility/ModelsTreeVisibilityHandler.js";
import { defaultHierarchyConfiguration, ModelsTreeDefinition } from "../../../tree-widget-react/trees/models-tree/ModelsTreeDefinition.js";
import { createIModelAccess } from "../Common.js";
import { createTreeWidgetTestingViewport } from "../TreeUtils.js";

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
import type { ParentElementsPath } from "../../../tree-widget-react/shared/internal/Utils.js";
import type {
  ModelsTreeHierarchyConfiguration,
  RequiredModelsTreeHierarchyConfiguration,
} from "../../../tree-widget-react/trees/models-tree/ModelsTreeDefinition.js";
import type { IModelAccess } from "../Common.js";

interface CreateModelsTreeProviderProps {
  imodelConnection: IModelConnection;
  searchPaths?: HierarchySearchTree[];
  hierarchyConfig?: ModelsTreeHierarchyConfiguration;
  idsCache?: ModelsTreeIdsCache;
  imodelAccess?: ReturnType<typeof createIModelAccess>;
}

export function createModelsTreeProvider({
  imodelConnection,
  searchPaths,
  hierarchyConfig,
  imodelAccess,
  idsCache,
}: CreateModelsTreeProviderProps): HierarchyProvider & { dispose: () => void; [Symbol.dispose]: () => void } {
  const configOverrides: ModelsTreeHierarchyConfiguration = { subjects: { root: "exclude" }, ...hierarchyConfig };
  const config = mergeWithDefaults({
    defaults: defaultHierarchyConfiguration,
    overrides: configOverrides,
  });
  const createdImodelAccess = imodelAccess ?? createIModelAccess(imodelConnection);
  const baseIdsCache = new BaseIdsCache({
    queryExecutor: createdImodelAccess,
    elementClassName: config.elements.baseClass,
    type: "3d",
    excludedElementClassNames: config.elements.excludedClasses,
  });
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
  elementChildren?: Map<Id64String, Id64Array>;
}

export function createFakeIdsCache(props?: IdsCacheMockProps): ModelsTreeIdsCache {
  return {
    getChildSubjectIds: vi.fn(({ parentSubjectIds }: { parentSubjectIds: Id64Arg; excludeIfOnlyExcludedClasses?: boolean }) => {
      return from(Id64.iterable(parentSubjectIds)).pipe(
        concatMap((id) => props?.subjectsHierarchy?.get(id) ?? EMPTY),
        expand((id) => props?.subjectsHierarchy?.get(id) ?? EMPTY),
        toArray(),
      );
    }),
    canHaveHiddenChildren: vi.fn(() => false),
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
    getDescendantsCounts: vi.fn(({ categoryId, parentElementId }: { modelId: Id64String; categoryId?: Id64String; parentElementId?: Id64String }) => {
      if (parentElementId) {
        const children = props?.elementChildren?.get(parentElementId) ?? [];
        if (children.length === 0) {
          return of(categoryId ? [{ categoryId, count: 0 }] : []);
        }
        // When querying by parentElementId, return all children grouped under the parent's category
        const parentCategory = [...(props?.categoryElements?.entries() ?? [])].find(([, elements]) => elements.includes(parentElementId))?.[0];
        return of([{ categoryId: parentCategory ?? categoryId ?? "0x0", count: children.length }]);
      }
      if (categoryId) {
        const count = props?.categoryElements?.get(categoryId)?.length ?? 0;
        if (count === 0) {
          return of([{ categoryId, count: 0 }]);
        }
        return of([{ categoryId, count }]);
      }
      return of([]);
    }),
    getChildElements: vi.fn(() => {
      return of([]);
    }),
    categoryHasParentElements: vi.fn(() => of(false)),
    getSubModelsUnderElement: vi.fn(() => of([])),
    getSubModels: vi.fn(() => EMPTY),
    hasSubModels: vi.fn(() => of(false)),
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
      type: "subject",
    },
  };
}
export function createModelHierarchyNode(props?: {
  modelId?: Id64String;
  hasChildren?: boolean;
  parentKeys?: InstanceKey[];
  search?: NonGroupingHierarchyNode["search"];
  className?: EC.FullClassNameDotNotation;
}): NonGroupingHierarchyNode {
  return {
    key: {
      type: "instances",
      instanceKeys: [{ className: props?.className ?? CLASS_NAME_Model, id: props?.modelId ?? "" }],
    },
    children: !!props?.hasChildren,
    label: "",
    parentKeys: props?.parentKeys ? props.parentKeys.map((parentKey) => ({ type: "instances", instanceKeys: [parentKey] })) : [],
    search: props?.search,
    extendedData: {
      type: "model",
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
  parentElementsPath,
}: {
  modelId?: Id64String;
  categoryId?: Id64Arg;
  hasChildren?: boolean;
  parentKeys?: Array<InstanceKey | ClassGroupingNodeKey>;
  search?: NonGroupingHierarchyNode["search"];
  parentElementsPath?: ParentElementsPath;
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
      type: "category",
      modelIds: [modelId ?? "0x1"],
      parentElementsPath: parentElementsPath ?? [],
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
  parentElementsPath?: ParentElementsPath;
  className?: EC.FullClassNameDotNotation;
}): NonGroupingHierarchyNode {
  return {
    key: {
      type: "instances",
      instanceKeys: [{ className: props.className ?? CLASS_NAME_GeometricElement3d, id: props.elementId ?? "" }],
    },
    children: !!props.hasChildren,
    label: "",
    search: props.search,
    parentKeys: props.parentKeys
      ? props.parentKeys.map((parentKey) => ("type" in parentKey ? parentKey : { type: "instances", instanceKeys: [parentKey] }))
      : [],
    extendedData: {
      type: "element",
      modelId: props.modelId,
      categoryId: props.categoryId,
      parentElementsPath: props.parentElementsPath ?? [],
    },
  };
}
export function createClassGroupingHierarchyNode({
  elements,
  parentKeys,
  modelId,
  categoryId,
  ...props
}: {
  elements: Id64Array;
  className?: EC.FullClassNameDotNotation;
  parentKeys?: Array<InstanceKey | ClassGroupingNodeKey>;
  modelId: Id64String;
  categoryId: Id64String;
  hasDirectNonSearchTargets?: boolean;
  hasSearchTargetAncestor?: boolean;
  parentElementsPath?: ParentElementsPath;
  childrenWhichAreParents?: Set<Id64String>;
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
      parentElementsPath: props.parentElementsPath ?? [],
      childrenWhichAreParents: props.childrenWhichAreParents ?? new Set(),
      ...(props.hasDirectNonSearchTargets ? { hasDirectNonSearchTargets: props.hasDirectNonSearchTargets } : {}),
      ...(props.hasSearchTargetAncestor ? { hasSearchTargetAncestor: props.hasSearchTargetAncestor } : {}),
    },
  };
}

export function createAccessAndCache({
  imodelConnection,
  hierarchyConfig,
}: {
  imodelConnection: IModelConnection;
  hierarchyConfig?: ModelsTreeHierarchyConfiguration;
}) {
  const imodelAccess = createIModelAccess(imodelConnection);
  const mergedConfig = mergeWithDefaults({
    defaults: defaultHierarchyConfiguration,
    overrides: hierarchyConfig,
  });
  const baseIdsCache = new BaseIdsCache({
    queryExecutor: imodelAccess,
    elementClassName: mergedConfig.elements.baseClass,
    type: "3d",
    excludedElementClassNames: mergedConfig.elements.excludedClasses,
  });
  const idsCache = new ModelsTreeIdsCache({
    queryExecutor: imodelAccess,
    hierarchyConfig: mergedConfig,
    baseIdsCache,
  });
  return { imodelAccess, idsCache };
}

export function createVisibilityTestData(props: {
  imodelConnection: IModelConnection;
  hierarchyConfig?: ModelsTreeHierarchyConfiguration;
  visibleByDefault?: boolean;
  imodelAccess: IModelAccess;
  idsCache: ModelsTreeIdsCache;
}) {
  const { idsCache, imodelAccess, imodelConnection, hierarchyConfig, visibleByDefault } = props;
  const defaultConfig = mergeWithDefaults({ defaults: defaultHierarchyConfiguration, overrides: { subjects: { root: "exclude" } } });
  const hierarchyConfigWithDefaults = mergeWithDefaults({ defaults: defaultConfig, overrides: hierarchyConfig });
  const viewport = createTreeWidgetTestingViewport({ iModel: imodelConnection, viewType: "3d", visibleByDefault });
  const handler = createModelsTreeVisibilityHandler({ viewport, imodelAccess, idsCache });
  const provider = createProvider({ hierarchyConfig: hierarchyConfigWithDefaults, idsCache, imodelAccess });
  return {
    handler,
    provider,
    viewport,
    [Symbol.dispose]() {
      handler[Symbol.dispose]();
      provider[Symbol.dispose]();
    },
  };
}

function createProvider(props: {
  idsCache: ModelsTreeIdsCache;
  imodelAccess: ReturnType<typeof createIModelAccess>;
  hierarchyConfig: RequiredModelsTreeHierarchyConfiguration;
  searchPaths?: HierarchySearchTree[];
}) {
  return createIModelHierarchyProvider({
    hierarchyDefinition: new ModelsTreeDefinition(props),
    imodelAccess: props.imodelAccess,
    ...(props.searchPaths ? { search: { paths: props.searchPaths } } : undefined),
  });
}
