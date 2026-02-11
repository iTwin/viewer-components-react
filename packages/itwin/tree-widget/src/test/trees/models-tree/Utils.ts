/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { concatMap, EMPTY, expand, from, mergeAll, of, toArray } from "rxjs";
import sinon from "sinon";
import { Id64 } from "@itwin/core-bentley";
import { createIModelHierarchyProvider } from "@itwin/presentation-hierarchies";
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

import type { Observable } from "rxjs";
import type { Id64Arg, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type {
  ClassGroupingNodeKey,
  GroupingHierarchyNode,
  HierarchyProvider,
  HierarchySearchPath,
  NonGroupingHierarchyNode,
} from "@itwin/presentation-hierarchies";
import type { InstanceKey } from "@itwin/presentation-shared";
import type { ChildrenTree } from "../../../tree-widget-react/components/trees/common/internal/Utils.js";

type ModelsTreeHierarchyConfiguration = ConstructorParameters<typeof ModelsTreeDefinition>[0]["hierarchyConfig"];

interface CreateModelsTreeProviderProps {
  imodel: IModelConnection;
  searchPaths?: HierarchySearchPath[];
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
  const createdIdsCache = idsCache ?? new ModelsTreeIdsCache(createdImodelAccess, config);
  const provider = createIModelHierarchyProvider({
    imodelAccess: createdImodelAccess,
    hierarchyDefinition: new ModelsTreeDefinition({
      imodelAccess: createdImodelAccess,
      idsCache: createdIdsCache,
      hierarchyConfig: config,
    }),
    ...(searchPaths ? { search: { paths: searchPaths.map((path) => ("path" in path ? path : { path, options: { reveal: true } })) } } : undefined),
  });
  const dispose = () => {
    provider[Symbol.dispose]();
    if (!idsCache) {
      createdIdsCache[Symbol.dispose]();
    }
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
  return sinon.createStubInstance(ModelsTreeIdsCache, {
    getChildSubjectIds: sinon.stub<[Id64Arg], Observable<Id64Array>>().callsFake((subjectIds) => {
      return from(Id64.iterable(subjectIds)).pipe(
        concatMap((id) => props?.subjectsHierarchy?.get(id) ?? EMPTY),
        expand((id) => props?.subjectsHierarchy?.get(id) ?? EMPTY),
        toArray(),
      );
    }),
    getChildSubjectModelIds: sinon.stub(),
    getSubjectModelIds: sinon.stub<[Id64Arg], Observable<Id64Array>>().callsFake((subjectIds) => {
      return from(Id64.iterable(subjectIds)).pipe(
        expand((id) => props?.subjectsHierarchy?.get(id) ?? EMPTY),
        concatMap((id) => props?.subjectModels?.get(id) ?? EMPTY),
        toArray(),
      );
    }),
    getModelCategoryIds: sinon
      .stub<[{ modelId: Id64String; includeOnlyIfCategoryOfTopMostElement?: boolean }], Observable<Id64Set>>()
      .callsFake(({ modelId }) => {
        return of(new Set(props?.modelCategories?.get(modelId) ?? []));
      }),
    getAllCategoriesOfElements: sinon.stub<[], Observable<Id64Set>>().callsFake(() => {
      const result = new Set<Id64String>();
      props?.modelCategories?.forEach((categories) => categories.forEach((category) => result.add(category)));
      return of(result);
    }),
    getCategoryElementsCount: sinon.stub<[{ modelId: Id64String; categoryId: Id64String }], Observable<number>>().callsFake(({ categoryId }) => {
      return of(props?.categoryElements?.get(categoryId)?.length ?? 0);
    }),
    getChildElementsTree: sinon.stub<[{ elementIds: Id64Arg }], Observable<ChildrenTree>>().callsFake(() => {
      return of(new Map());
    }),
    getAllChildElementsCount: sinon.stub<[{ elementIds: Id64Arg }], Observable<Map<Id64String, number>>>().callsFake(() => {
      return of(new Map());
    }),
    getSubModelsUnderElement: sinon.stub<[Id64String], Observable<Id64Array>>().callsFake(() => of([])),
    getCategoryModeledElements: sinon
      .stub<[{ modelId: Id64String; categoryId: Id64String }], Observable<Id64String>>()
      .callsFake(() => of([]).pipe(mergeAll())),
  });
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
  className?: string;
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
