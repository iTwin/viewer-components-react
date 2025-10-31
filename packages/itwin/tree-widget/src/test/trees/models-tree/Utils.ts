/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { concatMap, EMPTY, expand, from, of, toArray } from "rxjs";
import sinon from "sinon";
import { Id64 } from "@itwin/core-bentley";
import { createIModelHierarchyProvider } from "@itwin/presentation-hierarchies";
import { ModelsTreeIdsCache } from "../../../tree-widget-react/components/trees/models-tree/internal/ModelsTreeIdsCache.js";
import { defaultHierarchyConfiguration, ModelsTreeDefinition } from "../../../tree-widget-react/components/trees/models-tree/ModelsTreeDefinition.js";
import { createIModelAccess } from "../Common.js";

import type { Observable } from "rxjs";
import type { Id64Arg, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type {
  ClassGroupingNodeKey,
  GroupingHierarchyNode,
  HierarchyFilteringPath,
  HierarchyNode,
  HierarchyNodeKey,
  HierarchyProvider,
  NonGroupingHierarchyNode,
} from "@itwin/presentation-hierarchies";
import type { InstanceKey } from "@itwin/presentation-shared";

type ModelsTreeHierarchyConfiguration = ConstructorParameters<typeof ModelsTreeDefinition>[0]["hierarchyConfig"];

interface CreateModelsTreeProviderProps {
  imodel: IModelConnection;
  filteredNodePaths?: HierarchyFilteringPath[];
  hierarchyConfig?: Partial<ModelsTreeHierarchyConfiguration>;
  idsCache?: ModelsTreeIdsCache;
  imodelAccess?: ReturnType<typeof createIModelAccess>;
}

export function createModelsTreeProvider({
  imodel,
  filteredNodePaths,
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
    ...(filteredNodePaths
      ? { filtering: { paths: filteredNodePaths.map((path) => ("path" in path ? path : { path, options: { autoExpand: true } })) } }
      : undefined),
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
    setHierarchyFilter: (props) => provider.setHierarchyFilter(props),
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
    getChildSubjectIds: sinon.stub<[string[]], Observable<string[]>>().callsFake((subjectIds) => {
      return from(subjectIds).pipe(
        concatMap((id) => props?.subjectsHierarchy?.get(id) ?? EMPTY),
        expand((id) => props?.subjectsHierarchy?.get(id) ?? EMPTY),
        toArray(),
      );
    }),
    getChildSubjectModelIds: sinon.stub(),
    getSubjectModelIds: sinon.stub<[string[]], Observable<string[]>>().callsFake((subjectIds) => {
      return from(subjectIds).pipe(
        expand((id) => props?.subjectsHierarchy?.get(id) ?? EMPTY),
        concatMap((id) => props?.subjectModels?.get(id) ?? EMPTY),
        toArray(),
      );
    }),
    getModelCategories: sinon.stub<[Id64String], Observable<Id64Array>>().callsFake((modelId) => {
      return of(props?.modelCategories?.get(modelId) ?? []);
    }),
    getAllCategories: sinon.stub<[], Observable<Id64Set>>().callsFake(() => {
      const result = new Set<Id64String>();
      props?.modelCategories?.forEach((categories) => categories.forEach((category) => result.add(category)));
      return of(result);
    }),
    getCategoryElementsCount: sinon.stub<[Id64String, Id64String], Observable<number>>().callsFake((_, categoryId) => {
      return of(props?.categoryElements?.get(categoryId)?.length ?? 0);
    }),
    hasSubModel: sinon.stub<[Id64String], Observable<boolean>>().callsFake(() => of(false)),
    getCategoriesModeledElements: sinon.stub<[Id64String, Id64Arg], Observable<Id64Array>>().callsFake(() => of([])),
  });
}

export function createSubjectHierarchyNode(props?: { ids?: Id64Arg; parentKeys?: HierarchyNodeKey[] }): NonGroupingHierarchyNode {
  const instanceKeys = new Array<InstanceKey>();
  for (const id of props?.ids ? Id64.iterable(props.ids) : []) {
    instanceKeys.push({ className: "Bis:Subject", id });
  }
  return {
    key: {
      type: "instances",
      instanceKeys,
    },
    children: false,
    label: "",
    parentKeys: props?.parentKeys ?? [],
    extendedData: {
      isSubject: true,
    },
  };
}
export function createModelHierarchyNode(props?: { modelId?: Id64String; hasChildren?: boolean; parentKeys?: HierarchyNodeKey[] }): NonGroupingHierarchyNode {
  return {
    key: {
      type: "instances",
      instanceKeys: [{ className: "bis:Model", id: props?.modelId ?? "" }],
    },
    children: !!props?.hasChildren,
    label: "",
    parentKeys: props?.parentKeys ?? [],
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
}: {
  modelId?: Id64String;
  categoryId?: Id64Arg;
  hasChildren?: boolean;
  parentKeys?: HierarchyNodeKey[];
}): NonGroupingHierarchyNode {
  return {
    key: {
      type: "instances",
      instanceKeys:
        typeof categoryId === "string"
          ? [{ className: "bis:SpatialCategory", id: categoryId ?? "" }]
          : [...(categoryId ?? [])].map((id) => ({ className: "bis:SpatialCategory", id })),
    },
    children: !!hasChildren,
    label: "",
    parentKeys: parentKeys ?? [],
    extendedData: {
      isCategory: true,
      modelId: modelId ?? "0x1",
      categoryId: categoryId ?? "0x2",
    },
  };
}
export function createElementHierarchyNode(props: {
  modelId: Id64String | undefined;
  categoryId: Id64String | undefined;
  hasChildren?: boolean;
  elementId?: Id64String;
  parentKeys?: HierarchyNodeKey[];
  filtering?: HierarchyNode["filtering"];
  childrenCount?: number;
}): NonGroupingHierarchyNode {
  return {
    key: {
      type: "instances",
      instanceKeys: [{ className: "bis:GeometricalElement3d", id: props.elementId ?? "" }],
    },
    children: !!props.hasChildren,
    label: "",
    filtering: props.filtering,
    parentKeys: props.parentKeys ?? [],
    extendedData: {
      modelId: props.modelId,
      categoryId: props.categoryId,
      childrenCount: props.childrenCount !== undefined ? props.childrenCount : undefined,
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
  className?: string;
  parentKeys?: HierarchyNodeKey[];
  modelId: Id64String;
  categoryId: Id64String;
}): GroupingHierarchyNode & { key: ClassGroupingNodeKey } {
  const className = props.className ?? "Bis:Element";
  return {
    key: {
      type: "class-grouping",
      className,
    },
    children: !!elements?.length,
    groupedInstanceKeys: elements ? elements.map((id) => ({ className, id })) : [],
    label: "",
    parentKeys: parentKeys ?? [],
    extendedData: { categoryId, modelId },
  };
}
