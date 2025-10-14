/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { Observable } from "rxjs";
import { concatMap, EMPTY, expand, firstValueFrom, from, map, of, toArray } from "rxjs";
import sinon from "sinon";
import { Id64 } from "@itwin/core-bentley";
import { createIModelHierarchyProvider } from "@itwin/presentation-hierarchies";
import {
  CLASS_NAME_Element,
  CLASS_NAME_GeometricElement3d,
  CLASS_NAME_Model,
  CLASS_NAME_Subject,
} from "../../../tree-widget-react/components/trees/common/internal/ClassNameDefinitions.js";
import { TreeWidgetIdsCache } from "../../../tree-widget-react/components/trees/common/internal/TreeWidgetIdsCache.js";
import { ModelsTreeIdsCache } from "../../../tree-widget-react/components/trees/models-tree/internal/ModelsTreeIdsCache.js";
import { defaultHierarchyConfiguration, ModelsTreeDefinition } from "../../../tree-widget-react/components/trees/models-tree/ModelsTreeDefinition.js";
import { createIModelAccess } from "../Common.js";

import type { ITreeWidgetIdsCache } from "../../../tree-widget-react/components/trees/common/internal/TreeWidgetIdsCache.js";
import type { Id64Arg, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type {
  ClassGroupingNodeKey,
  GroupingHierarchyNode,
  GroupingNodeKey,
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
}: CreateModelsTreeProviderProps): HierarchyProvider & Disposable {
  const config = { ...defaultHierarchyConfiguration, hideRootSubject: true, ...hierarchyConfig };
  const createdImodelAccess = imodelAccess ?? createIModelAccess(imodel);
  const treeWidgetIdsCache = new TreeWidgetIdsCache(createdImodelAccess);
  const createdIdsCache = idsCache ?? new ModelsTreeIdsCache(createdImodelAccess, config, treeWidgetIdsCache);
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
  return {
    hierarchyChanged: provider.hierarchyChanged,
    getNodes: (props) => provider.getNodes(props),
    getNodeInstanceKeys: (props) => provider.getNodeInstanceKeys(props),
    setFormatter: (formatter) => provider.setFormatter(formatter),
    setHierarchyFilter: (props) => provider.setHierarchyFilter(props),
    [Symbol.dispose]() {
      provider[Symbol.dispose]();
      treeWidgetIdsCache[Symbol.dispose]();
      if (!idsCache) {
        createdIdsCache[Symbol.dispose]();
      }
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
    getAllCategoriesThatContainElements: sinon.stub<[], Observable<{ drawingCategories?: Id64Set; spatialCategories?: Id64Set }>>().callsFake(() => {
      const result = new Set<Id64String>();
      props?.modelCategories?.forEach((categories) => categories.forEach((category) => result.add(category)));
      return of({ spatialCategories: result.size > 0 ? result : undefined });
    }),
    hasSubModel: sinon.stub<[Id64String], ReturnType<ITreeWidgetIdsCache["hasSubModel"]>>().callsFake((_modelId) => of(false)),
    getCategories: sinon
      .stub<[Parameters<ITreeWidgetIdsCache["getCategories"]>[0]], ReturnType<ITreeWidgetIdsCache["getCategories"]>>()
      .callsFake(({ modelIds }) => {
        return from(Id64.iterable(modelIds)).pipe(
          map((modelId) => {
            return { id: modelId, spatialCategories: props?.modelCategories?.get(modelId) };
          }),
        );
      }),
    getElementsCount: sinon
      .stub<[Parameters<ITreeWidgetIdsCache["getElementsCount"]>[0]], ReturnType<ITreeWidgetIdsCache["getElementsCount"]>>()
      .callsFake(({ categoryId }) => {
        return of(props?.categoryElements?.get(categoryId)?.length ?? 0);
      }),
    getModels: sinon.stub<[Parameters<ITreeWidgetIdsCache["getModels"]>[0]], ReturnType<ITreeWidgetIdsCache["getModels"]>>().callsFake(({ categoryIds }) => {
      return from(Id64.iterable(categoryIds)).pipe(
        map((categoryId) => {
          const models = new Array<Id64String>();
          props?.modelCategories?.forEach((categories, modelId) => {
            if (categories.includes(categoryId)) {
              models.push(modelId);
            }
          });
          return { id: categoryId, models: models.length > 0 ? models : undefined };
        }),
      );
    }),
    getSubCategories: sinon
      .stub<[Parameters<ITreeWidgetIdsCache["getSubCategories"]>[0]], ReturnType<ITreeWidgetIdsCache["getSubCategories"]>>()
      .callsFake(({ categoryIds }) => {
        return from(Id64.iterable(categoryIds)).pipe(
          map((categoryId) => {
            return { id: categoryId, subCategories: undefined };
          }),
        );
      }),
    getSubModels: sinon.stub<[Parameters<ITreeWidgetIdsCache["getSubModels"]>[0]], ReturnType<ITreeWidgetIdsCache["getSubModels"]>>().callsFake((fnProps) => {
      if ("modelIds" in fnProps) {
        return from(Id64.iterable(fnProps.modelIds)).pipe(
          map((modelId) => {
            return { id: modelId, subModels2d: undefined, subModels3d: undefined };
          }),
        );
      }
      return from(Id64.iterable(fnProps.categoryIds)).pipe(
        map((categoryId) => {
          return { id: categoryId, subModels2d: undefined, subModels3d: undefined };
        }),
      );
    }),
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

export function getNodeParentKeys(
  keys: (
    | GroupingNodeKey
    | {
        className: string;
        id: string;
      }
  )[],
): HierarchyNodeKey[] {
  return keys.map((key) => {
    if ("type" in key) {
      return key;
    }

    return {
      type: "instances",
      instanceKeys: [key],
    };
  });
}
