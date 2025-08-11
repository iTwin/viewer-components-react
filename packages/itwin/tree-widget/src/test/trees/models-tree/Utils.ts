/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { concatMap, EMPTY, expand, firstValueFrom, from, toArray } from "rxjs";
import sinon from "sinon";
import { Id64 } from "@itwin/core-bentley";
import { createIModelHierarchyProvider } from "@itwin/presentation-hierarchies";
import {
  CLASS_NAME_Element,
  CLASS_NAME_GeometricElement3d,
  CLASS_NAME_Model,
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
  HierarchyFilteringPath,
  HierarchyNodeKey,
  HierarchyProvider,
  NonGroupingHierarchyNode,
} from "@itwin/presentation-hierarchies";

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
    getChildSubjectIds: sinon.stub<[Id64Arg], Promise<Id64Array>>().callsFake(async (subjectIds) => {
      const obs = from(Id64.iterable(subjectIds)).pipe(
        concatMap((id) => props?.subjectsHierarchy?.get(id) ?? EMPTY),
        expand((id) => props?.subjectsHierarchy?.get(id) ?? EMPTY),
        toArray(),
      );
      return firstValueFrom(obs);
    }),
    getChildSubjectModelIds: sinon.stub(),
    getSubjectModelIds: sinon.stub<[Id64Arg], Promise<Id64Array>>().callsFake(async (subjectIds) => {
      const obs = from(Id64.iterable(subjectIds)).pipe(
        expand((id) => props?.subjectsHierarchy?.get(id) ?? EMPTY),
        concatMap((id) => props?.subjectModels?.get(id) ?? EMPTY),
        toArray(),
      );
      return firstValueFrom(obs);
    }),
    getModelCategoryIds: sinon.stub<[Id64String], Promise<Id64Array>>().callsFake(async (modelId) => {
      return props?.modelCategories?.get(modelId) ?? [];
    }),
    getCategoryElementsCount: sinon.stub<[Id64String, Id64String], Promise<number>>().callsFake(async (_, categoryId) => {
      return props?.categoryElements?.get(categoryId)?.length ?? 0;
    }),
    hasSubModel: sinon.stub<[Id64String], Promise<boolean>>().callsFake(async () => false),
    getCategoriesModeledElements: sinon.stub<[Id64String, Id64Arg], Promise<Id64Array>>().callsFake(async () => []),
  });
}

export function createSubjectHierarchyNode(...ids: Id64String[]): NonGroupingHierarchyNode {
  return {
    key: {
      type: "instances",
      instanceKeys: ids.map((id) => ({ className: CLASS_NAME_Subject, id })),
    },
    children: false,
    label: "",
    parentKeys: [],
    extendedData: {
      isSubject: true,
    },
  };
}
export function createModelHierarchyNode(modelId?: Id64String, hasChildren?: boolean): NonGroupingHierarchyNode {
  return {
    key: {
      type: "instances",
      instanceKeys: [{ className: CLASS_NAME_Model, id: modelId ?? "" }],
    },
    children: !!hasChildren,
    label: "",
    parentKeys: [],
    extendedData: {
      isModel: true,
      modelId: modelId ?? "0x1",
    },
  };
}
export function createCategoryHierarchyNode(modelId?: Id64String, categoryId?: Id64Arg, hasChildren?: boolean): NonGroupingHierarchyNode {
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
    parentKeys: [],
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
}): NonGroupingHierarchyNode {
  return {
    key: {
      type: "instances",
      instanceKeys: [{ className: CLASS_NAME_GeometricElement3d, id: props.elementId ?? "" }],
    },
    children: !!props.hasChildren,
    label: "",
    parentKeys: [],
    extendedData: {
      modelId: props.modelId,
      categoryId: props.categoryId,
    },
  };
}
export function createClassGroupingHierarchyNode({
  elements,
  parentKeys,
  ...props
}: {
  modelId: Id64String | undefined;
  categoryId: Id64String | undefined;
  elements: Id64Array;
  className?: string;
  parentKeys?: HierarchyNodeKey[];
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
    parentKeys: parentKeys ?? [],
    extendedData: props,
  };
}
