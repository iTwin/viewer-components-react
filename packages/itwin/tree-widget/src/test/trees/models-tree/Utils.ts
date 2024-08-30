/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { concatMap, count, EMPTY, expand, firstValueFrom, from, toArray } from "rxjs";
import sinon from "sinon";
import { createHierarchyProvider } from "@itwin/presentation-hierarchies";
import { ModelsTreeIdsCache } from "../../../components/trees/models-tree/internal/ModelsTreeIdsCache";
import { defaultHierarchyConfiguration, ModelsTreeDefinition } from "../../../components/trees/models-tree/ModelsTreeDefinition";
import { createIModelAccess } from "../Common";

import type { Id64Array, Id64String } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type { ClassGroupingNodeKey, GroupingHierarchyNode, HierarchyNodeKey, NonGroupingHierarchyNode } from "@itwin/presentation-hierarchies";

type ModelsTreeHierarchyConfiguration = ConstructorParameters<typeof ModelsTreeDefinition>[0]["hierarchyConfig"];
type HierarchyProviderProps = Parameters<typeof createHierarchyProvider>[0];
type HierarchyFilteringPaths = NonNullable<NonNullable<HierarchyProviderProps["filtering"]>["paths"]>;

interface CreateModelsTreeProviderProps {
  imodel: IModelConnection;
  filteredNodePaths?: HierarchyFilteringPaths;
  hierarchyConfig?: Partial<ModelsTreeHierarchyConfiguration>;
}

export function createModelsTreeProvider({ imodel, filteredNodePaths, hierarchyConfig }: CreateModelsTreeProviderProps) {
  const config = { ...defaultHierarchyConfiguration, ...hierarchyConfig };
  const imodelAccess = createIModelAccess(imodel);
  const idsCache = new ModelsTreeIdsCache(imodelAccess, config);
  return createHierarchyProvider({
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
}

interface IdsCacheMockProps {
  subjectsHierarchy?: Map<Id64String, Id64String[]>;
  subjectModels?: Map<Id64String, Id64String[]>;
  modelCategories?: Map<Id64String, Id64Array>;
  categoryElements?: Map<Id64String, Id64Array>;
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
    getModelCategories: sinon.stub<[Id64String], Promise<Id64Array>>().callsFake(async (modelId) => {
      return props?.modelCategories?.get(modelId) ?? [];
    }),
    getModelElementCount: sinon.stub<[Id64String], Promise<number>>().callsFake(async (modelId) => {
      const obs = from(props?.modelCategories?.get(modelId) ?? EMPTY).pipe(
        concatMap((categoryId) => props?.categoryElements?.get(categoryId) ?? EMPTY),
        count(),
      );
      return firstValueFrom(obs);
    }),
    getCategoryElementsCount: sinon.stub<[Id64String, Id64String], Promise<number>>().callsFake(async (_, categoryId) => {
      return props?.categoryElements?.get(categoryId)?.length ?? 0;
    }),
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
export function createCategoryHierarchyNode(modelId?: Id64String, categoryId?: Id64String, hasChildren?: boolean): NonGroupingHierarchyNode {
  return {
    key: {
      type: "instances",
      instanceKeys: [{ className: "bis:SpatialCategory", id: categoryId ?? "" }],
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
      instanceKeys: [{ className: "bis:GeometricalElement3d", id: props.elementId ?? "" }],
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
