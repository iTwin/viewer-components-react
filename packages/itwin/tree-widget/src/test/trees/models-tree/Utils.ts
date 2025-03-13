/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { concatMap, EMPTY, expand, firstValueFrom, from, toArray } from "rxjs";
import sinon from "sinon";
import { createIModelHierarchyProvider } from "@itwin/presentation-hierarchies";
import { ModelsTreeIdsCache } from "../../../tree-widget-react/components/trees/models-tree/internal/ModelsTreeIdsCache.js";
import { defaultHierarchyConfiguration, ModelsTreeDefinition } from "../../../tree-widget-react/components/trees/models-tree/ModelsTreeDefinition.js";
import { createIModelAccess } from "../Common.js";

import type { Id64Array, Id64String } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type {
  ClassGroupingNodeKey,
  GroupingHierarchyNode,
  HierarchyFilteringPath,
  HierarchyNodeKey,
  HierarchyProvider,
  NonGroupingHierarchyNode,
} from "@itwin/presentation-hierarchies";
import type { ModelParentMap } from "../../../tree-widget-react/components/trees/models-tree/internal/ModelsTreeIdsCache.js";
import type { CategoryId, ElementId, ModelId, ParentId, SubjectId } from "../../../tree-widget-react/components/trees/common/internal/Types.js";

type ModelsTreeHierarchyConfiguration = ConstructorParameters<typeof ModelsTreeDefinition>[0]["hierarchyConfig"];

interface CreateModelsTreeProviderProps {
  imodel: IModelConnection;
  filteredNodePaths?: HierarchyFilteringPath[];
  hierarchyConfig?: Partial<ModelsTreeHierarchyConfiguration>;
}

export function createModelsTreeProvider({
  imodel,
  filteredNodePaths,
  hierarchyConfig,
}: CreateModelsTreeProviderProps): HierarchyProvider & { dispose: () => void; [Symbol.dispose]: () => void } {
  const config = { ...defaultHierarchyConfiguration, ...hierarchyConfig };
  const imodelAccess = createIModelAccess(imodel);
  const idsCache = new ModelsTreeIdsCache(imodelAccess, config);
  const provider = createIModelHierarchyProvider({
    imodelAccess,
    hierarchyDefinition: new ModelsTreeDefinition({
      imodelAccess,
      idsCache,
      hierarchyConfig: config,
    }),
    ...(filteredNodePaths
      ? { filtering: { paths: filteredNodePaths.map((path) => ("path" in path ? path : { path, options: { autoExpand: true } })) } }
      : undefined),
  });
  const dispose = () => {
    provider[Symbol.dispose]();
    idsCache[Symbol.dispose]();
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
  subjectModels?: Map<SubjectId, Array<ModelId>>;
  modelCategories?: Map<ModelId, Array<{ categoryId: CategoryId; isAtRoot: boolean }>>;
  categoryElements?: Map<CategoryId, Array<ElementId>>;
  childrenInfo?: Map<ModelId, ModelParentMap>;
}

export function createFakeIdsCache(props?: IdsCacheMockProps): ModelsTreeIdsCache {
  return sinon.createStubInstance(ModelsTreeIdsCache, {
    getChildSubjectIds: sinon.stub<[string[]], Promise<string[]>>().callsFake(async (subjectIds) => {
      const obs = from(subjectIds).pipe(
        concatMap((id) => props?.subjectsHierarchy?.get(id) ?? EMPTY),
        expand((id) => props?.subjectsHierarchy?.get(id) ?? EMPTY),
        toArray(),
      );
      return firstValueFrom(obs);
    }),
    getChildSubjectModelIds: sinon.stub(),
    getSubjectModelIds: sinon.stub<[string[]], Promise<string[]>>().callsFake(async (subjectIds) => {
      const obs = from(subjectIds).pipe(
        expand((id) => props?.subjectsHierarchy?.get(id) ?? EMPTY),
        concatMap((id) => props?.subjectModels?.get(id) ?? EMPTY),
        toArray(),
      );
      return firstValueFrom(obs);
    }),
    getModelCategories: sinon.stub<[ModelId], Promise<Array<CategoryId>>>().callsFake(async (modelId) => {
      return (
        props?.modelCategories
          ?.get(modelId)
          ?.filter(({ isAtRoot }) => isAtRoot)
          .map(({ categoryId }) => categoryId) ?? []
      );
    }),
    getAllModelCategories: sinon.stub<[ModelId], Promise<Array<CategoryId>>>().callsFake(async (modelId) => {
      return props?.modelCategories?.get(modelId)?.map(({ categoryId }) => categoryId) ?? [];
    }),
    getElementRootCategory: sinon.stub<[{ modelId: ModelId; childElementId: ElementId }], Promise<CategoryId | undefined>>().callsFake(async () => {
      return undefined;
    }),
    getElementsChildrenInfo: sinon
      .stub<[{ modelId: ModelId; parentElementIds: Set<ElementId> }], Promise<Map<CategoryId, Map<ElementId, boolean>>>>()
      .callsFake(async () => {
        return new Map();
      }),
    getAllChildrenInfo: sinon.stub<[], Promise<Map<ModelId, ModelParentMap>>>().callsFake(async () => props?.childrenInfo ?? new Map()),
    getCategoryChildrenInfo: sinon
      .stub<[{ categoryId: CategoryId; modelId: ModelId; parentElementIds: Array<ParentId> }], Promise<Map<ElementId, boolean>>>()
      .callsFake(async () => {
        return new Map();
      }),
    getRootCategoryElementsCount: sinon.stub<[ModelId, CategoryId], Promise<number>>().callsFake(async (_, categoryId) => {
      return props?.categoryElements?.get(categoryId)?.length ?? 0;
    }),
    hasSubModel: sinon.stub<[Id64String], Promise<boolean>>().callsFake(async () => false),
    getCategoriesModeledElements: sinon.stub<[Id64String, Id64Array], Promise<Id64Array>>().callsFake(async () => []),
  });
}

export function createSubjectHierarchyNode(...ids: Id64String[]): NonGroupingHierarchyNode {
  return {
    key: {
      type: "instances",
      instanceKeys: ids.map((id) => ({ className: "Bis:Subject", id })),
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
      instanceKeys: [{ className: "bis:Model", id: modelId ?? "" }],
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
export function createCategoryHierarchyNode(modelId?: ModelId, categoryId?: CategoryId, hasChildren?: boolean, parentId?: ParentId): NonGroupingHierarchyNode {
  return {
    key: {
      type: "instances",
      instanceKeys: [{ className: "bis:SpatialCategory", id: categoryId ?? "" }],
    },
    children: !!hasChildren,
    label: "",
    parentKeys: parentId ? [{ type: "instances", instanceKeys: [{ className: "bis:GeometricalElement3d", id: parentId }] }] : [],
    extendedData: {
      isCategory: true,
      modelId: modelId ?? "0x1",
      categoryId: categoryId ?? "0x2",
    },
  };
}
export function createElementHierarchyNode(props: {
  modelId: ModelId | undefined;
  categoryId: CategoryId | undefined;
  hasChildren?: boolean;
  elementId?: ElementId;
  parentId?: ParentId;
}): NonGroupingHierarchyNode {
  return {
    key: {
      type: "instances",
      instanceKeys: [{ className: "bis:GeometricalElement3d", id: props.elementId ?? "" }],
    },
    children: !!props.hasChildren,
    label: "",
    parentKeys: props.parentId ? [{ type: "instances", instanceKeys: [{ className: "bis:GeometricalElement3d", id: props.parentId }] }] : [],
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
    extendedData: props,
  };
}
