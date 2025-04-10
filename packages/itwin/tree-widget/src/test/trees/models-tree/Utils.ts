/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { concatMap, EMPTY, expand, firstValueFrom, from, toArray } from "rxjs";
import sinon from "sinon";
import { createIModelHierarchyProvider } from "@itwin/presentation-hierarchies";
import {
  ELEMENT_CLASS_NAME,
  GEOMETRIC_ELEMENT_3D_CLASS_NAME,
  MODEL_CLASS_NAME,
  SPATIAL_CATEGORY_CLASS_NAME,
  SUBJECT_CLASS_NAME,
} from "../../../tree-widget-react/components/trees/common/internal/ClassNameDefinitions.js";
import { ModelsTreeIdsCache } from "../../../tree-widget-react/components/trees/models-tree/internal/ModelsTreeIdsCache.js";
import { defaultHierarchyConfiguration, ModelsTreeDefinition } from "../../../tree-widget-react/components/trees/models-tree/ModelsTreeDefinition.js";
import { createIModelAccess } from "../Common.js";

import type { ParentElementMap } from "../../../tree-widget-react/components/trees/models-tree/internal/ModelsTreeIdsCache.js";
import type { Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type {
  ClassGroupingNodeKey,
  GroupingHierarchyNode,
  HierarchyFilteringPath,
  HierarchyNodeKey,
  HierarchyProvider,
  NonGroupingHierarchyNode,
} from "@itwin/presentation-hierarchies";
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
  const config = { ...defaultHierarchyConfiguration, hideRootSubject: true, ...hierarchyConfig };
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
  subjectsHierarchy?: Map<SubjectId, Array<SubjectId>>;
  subjectModels?: Map<SubjectId, Array<ModelId>>;
  modelCategories?: Map<ModelId, Array<{ categoryId: CategoryId; isAtRoot: boolean }>>;
  categoryElements?: Map<CategoryId, Array<ElementId>>;
  childrenInfo?: Map<ModelId, ParentElementMap>;
}

export function createFakeIdsCache(props?: IdsCacheMockProps): ModelsTreeIdsCache {
  return sinon.createStubInstance(ModelsTreeIdsCache, {
    getChildSubjectIds: sinon.stub<[Id64Array], Promise<Id64Array>>().callsFake(async (subjectIds) => {
      const obs = from(subjectIds).pipe(
        concatMap((id) => props?.subjectsHierarchy?.get(id) ?? EMPTY),
        expand((id) => props?.subjectsHierarchy?.get(id) ?? EMPTY),
        toArray(),
      );
      return firstValueFrom(obs);
    }),
    getChildSubjectModelIds: sinon.stub(),
    getSubjectModelIds: sinon.stub<[Id64Array], Promise<Id64Array>>().callsFake(async (subjectIds) => {
      const obs = from(subjectIds).pipe(
        expand((id) => props?.subjectsHierarchy?.get(id) ?? EMPTY),
        concatMap((id) => props?.subjectModels?.get(id) ?? EMPTY),
        toArray(),
      );
      return firstValueFrom(obs);
    }),
    getModelCategoryIds: sinon.stub<[ModelId], Promise<Array<CategoryId>>>().callsFake(async (modelId) => {
      return (
        props?.modelCategories
          ?.get(modelId)
          ?.filter(({ isAtRoot }) => isAtRoot)
          .map(({ categoryId }) => categoryId) ?? []
      );
    }),
    getAllModelCategoryIds: sinon.stub<[ModelId], Promise<Array<CategoryId>>>().callsFake(async (modelId) => {
      return props?.modelCategories?.get(modelId)?.map(({ categoryId }) => categoryId) ?? [];
    }),
    getCategoryChildCategories: sinon
      .stub<[{ modelId: Id64String; categoryId: Id64String; parentElementIds?: Id64Array }], Promise<Map<ParentId, Set<CategoryId>>>>()
      .callsFake(async () => new Map()),
    getCategoryElementsCount: sinon.stub<[ModelId, CategoryId, Array<ElementId> | undefined], Promise<number>>().callsFake(async (_, categoryId) => {
      return props?.categoryElements?.get(categoryId)?.length ?? 0;
    }),
    getElementsAllChildren: sinon.stub<[{ modelId: Id64String; elementIds: Id64Array }]>().callsFake(async () => new Map()),
    getCategoryAllIndirectChildren: sinon
      .stub<[{ modelId: Id64String; categoryId: Id64String; parentElementIds?: Id64Array }], Promise<Map<CategoryId, Set<ElementId>>>>()
      .callsFake(async () => new Map()),
    getElementsChildCategories: sinon
      .stub<[{ modelId: Id64String; elementIds: Id64Set }], Promise<Map<ParentId, Set<CategoryId>>>>()
      .callsFake(async () => new Map()),
    hasSubModel: sinon.stub<[Id64String], Promise<boolean>>().callsFake(async () => false),
    getCategoriesModeledElements: sinon.stub<[Id64String, Id64Array], Promise<Id64Array>>().callsFake(async () => []),
  });
}

export function createSubjectHierarchyNode(...ids: Id64String[]): NonGroupingHierarchyNode {
  return {
    key: {
      type: "instances",
      instanceKeys: ids.map((id) => ({ className: SUBJECT_CLASS_NAME, id })),
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
      instanceKeys: [{ className: MODEL_CLASS_NAME, id: modelId ?? "" }],
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
export function createCategoryHierarchyNode(
  modelId?: Id64String,
  categoryId?: Id64String,
  hasChildren?: boolean,
  parentId?: ElementId,
): NonGroupingHierarchyNode {
  return {
    key: {
      type: "instances",
      instanceKeys: [{ className: SPATIAL_CATEGORY_CLASS_NAME, id: categoryId ?? "" }],
    },
    children: !!hasChildren,
    label: "",
    parentKeys: parentId ? [{ type: "instances", instanceKeys: [{ className: GEOMETRIC_ELEMENT_3D_CLASS_NAME, id: parentId }] }] : [],
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
  parentId?: ElementId;
}): NonGroupingHierarchyNode {
  return {
    key: {
      type: "instances",
      instanceKeys: [{ className: GEOMETRIC_ELEMENT_3D_CLASS_NAME, id: props.elementId ?? "" }],
    },
    children: !!props.hasChildren,
    label: "",
    parentKeys: props.parentId ? [{ type: "instances", instanceKeys: [{ className: GEOMETRIC_ELEMENT_3D_CLASS_NAME, id: props.parentId }] }] : [],
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
  const className = props.className ?? ELEMENT_CLASS_NAME;
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
