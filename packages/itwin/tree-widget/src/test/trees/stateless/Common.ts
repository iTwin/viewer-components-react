/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { concatMap, count, EMPTY, expand, firstValueFrom, from, toArray } from "rxjs";
import sinon from "sinon";
import { ModelsTreeIdsCache } from "../../../components/trees/stateless/models-tree/internal/ModelsTreeIdsCache";

import type { Id64Array, Id64String } from "@itwin/core-bentley";
import type { GroupingHierarchyNode, NonGroupingHierarchyNode } from "@itwin/presentation-hierarchies";

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

type CreateHierarchyNodeProps = Partial<Pick<NonGroupingHierarchyNode, "children" | "filtering">>;

export function createSubjectHierarchyNode({ subjectIds, ...props }: CreateHierarchyNodeProps & { subjectIds: Id64String[] }): NonGroupingHierarchyNode {
  return {
    children: false,
    ...props,
    key: {
      type: "instances",
      instanceKeys: subjectIds.map((id) => ({ className: "Bis:Subject", id })),
    },
    label: "",
    parentKeys: [],
    extendedData: {
      isSubject: true,
    },
  };
}
export function createModelHierarchyNode(
  props?: CreateHierarchyNodeProps & {
    modelId?: Id64String;
  },
): NonGroupingHierarchyNode {
  return {
    children: false,
    ...props,
    key: {
      type: "instances",
      instanceKeys: [{ className: "bis:Model", id: props?.modelId ?? "" }],
    },
    label: "",
    parentKeys: [],
    extendedData: {
      isModel: true,
      modelId: props?.modelId ?? "0x1",
    },
  };
}
export function createCategoryHierarchyNode({
  modelId,
  categoryId,
  ...props
}: CreateHierarchyNodeProps & {
  modelId?: Id64String;
  categoryId?: Id64String;
}): NonGroupingHierarchyNode {
  return {
    children: false,
    ...props,
    key: {
      type: "instances",
      instanceKeys: [{ className: "bis:SpatialCategory", id: categoryId ?? "" }],
    },
    label: "",
    parentKeys: [],
    extendedData: {
      isCategory: true,
      modelId: modelId ?? "0x1",
      categoryId: categoryId ?? "0x2",
    },
  };
}
export function createElementHierarchyNode({
  modelId,
  categoryId,
  elementId,
  ...props
}: CreateHierarchyNodeProps & {
  modelId: Id64String | undefined;
  categoryId: Id64String | undefined;
  elementId?: Id64String;
}): NonGroupingHierarchyNode {
  return {
    children: false,
    ...props,
    key: {
      type: "instances",
      instanceKeys: [{ className: "bis:GeometricalElement3d", id: elementId ?? "" }],
    },
    label: "",
    parentKeys: [],
    extendedData: {
      modelId,
      categoryId,
    },
  };
}
export function createClassGroupingHierarchyNode(props: {
  modelId: Id64String | undefined;
  categoryId: Id64String | undefined;
  elements: Id64Array;
}): GroupingHierarchyNode {
  return {
    key: {
      type: "class-grouping",
      className: "",
    },
    children: !!props?.elements?.length,
    groupedInstanceKeys: props?.elements ? props.elements.map((id) => ({ className: "Bis:Element", id })) : [],
    label: "",
    parentKeys: [],
    extendedData: props,
  };
}
