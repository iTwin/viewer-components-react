/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { concat, defer, EMPTY, from, map, merge, mergeMap, of } from "rxjs";
import { assert, Id64 } from "@itwin/core-bentley";
import { HierarchyNode } from "@itwin/presentation-hierarchies";
import { createVisibilityStatus } from "../../../common/internal/Tooltip.js";
import { HierarchyVisibilityHandlerImpl } from "../../../common/internal/useTreeHooks/UseCachedVisibility.js";
import { getClassesByView, releaseMainThreadOnItemsCount } from "../../../common/internal/Utils.js";
import { mergeVisibilityStatuses } from "../../../common/internal/VisibilityUtils.js";
import { CategoriesTreeNode } from "../CategoriesTreeNode.js";
import { CategoriesTreeVisibilityHelper } from "./CategoriesTreeVisibilityHelper.js";
import { createFilteredCategoriesTree } from "./FilteredTree.js";

import type { Observable } from "rxjs";
import type { GroupingHierarchyNode, HierarchyFilteringPath } from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector } from "@itwin/presentation-shared";
import type { AlwaysAndNeverDrawnElementInfo } from "../../../common/internal/AlwaysAndNeverDrawnElementInfo.js";
import type { ElementId, ModelId } from "../../../common/internal/Types.js";
import type { FilteredTree } from "../../../common/internal/visibility/BaseFilteredTree.js";
import type { BaseIdsCache, TreeSpecificVisibilityHandler } from "../../../common/internal/visibility/BaseVisibilityHelper.js";
import type { TreeWidgetViewport } from "../../../common/TreeWidgetViewport.js";
import type { VisibilityStatus } from "../../../common/UseHierarchyVisibility.js";
import type { CategoriesTreeHierarchyConfiguration } from "../../CategoriesTreeDefinition.js";
import type { CategoriesTreeIdsCache } from "../CategoriesTreeIdsCache.js";
import type { CategoriesTreeFilterTargets } from "./FilteredTree.js";

/** @internal */
export interface CategoriesTreeVisibilityHandlerProps {
  idsCache: CategoriesTreeIdsCache;
  viewport: TreeWidgetViewport;
  alwaysAndNeverDrawnElementInfo: AlwaysAndNeverDrawnElementInfo;
  hierarchyConfig: CategoriesTreeHierarchyConfiguration;
}

/**
 * Handles visibility status of categories tree nodes.
 *
 * This handler knows how to get and change visibility status of nodes created by hierarchy definition.
 * @internal
 */
export class CategoriesTreeVisibilityHandler implements Disposable, TreeSpecificVisibilityHandler<CategoriesTreeFilterTargets> {
  readonly #props: CategoriesTreeVisibilityHandlerProps;
  #visibilityHelper: CategoriesTreeVisibilityHelper;
  #elementType: "GeometricElement3d" | "GeometricElement2d";
  #categoryType: "DrawingCategory" | "SpatialCategory";
  #modelType: "GeometricModel3d" | "GeometricModel2d";
  constructor(constructorProps: CategoriesTreeVisibilityHandlerProps) {
    this.#props = constructorProps;
    // Remove after https://github.com/iTwin/viewer-components-react/issues/1421.
    // We won't need to create a custom base ids cache.
    const baseIdsCache: BaseIdsCache = {
      getCategories: (props) => this.getCategories(props),
      getAllCategories: () => this.getAllCategories(),
      getElementsCount: (props) => this.getElementsCount(props),
      getModels: (props) => this.getModels(props),
      getSubCategories: (props) => this.getSubCategories(props),
      getSubModels: (props) => this.getSubModels(props),
      hasSubModel: (props) => this.#props.idsCache.hasSubModel(props),
    };
    this.#visibilityHelper = new CategoriesTreeVisibilityHelper({
      viewport: this.#props.viewport,
      idsCache: this.#props.idsCache,
      alwaysAndNeverDrawnElementInfo: this.#props.alwaysAndNeverDrawnElementInfo,
      baseIdsCache,
      hierarchyConfig: constructorProps.hierarchyConfig,
    });

    this.#elementType = this.#props.viewport.viewType === "2d" ? "GeometricElement2d" : "GeometricElement3d";
    this.#categoryType = this.#props.viewport.viewType === "2d" ? "DrawingCategory" : "SpatialCategory";
    this.#modelType = this.#props.viewport.viewType === "2d" ? "GeometricModel2d" : "GeometricModel3d";
  }

  public [Symbol.dispose]() {
    this.#visibilityHelper[Symbol.dispose]();
  }

  public changeFilterTargetsVisibilityStatus(targets: CategoriesTreeFilterTargets, on: boolean): Observable<void> {
    return defer(() => {
      const { definitionContainerIds, subCategories, modelIds, categories, elements } = targets;
      const observables = new Array<Observable<void>>();
      if (definitionContainerIds?.size) {
        observables.push(this.#visibilityHelper.changeDefinitionContainersVisibilityStatus({ definitionContainerIds, on }));
      }

      if (modelIds?.size) {
        observables.push(this.#visibilityHelper.changeModelsVisibilityStatus({ modelIds, on }));
      }

      if (categories?.length) {
        observables.push(
          from(categories).pipe(mergeMap(({ modelId, categoryIds }) => this.#visibilityHelper.changeCategoriesVisibilityStatus({ categoryIds, modelId, on }))),
        );
      }

      if (subCategories?.length) {
        observables.push(
          from(subCategories).pipe(
            mergeMap(({ categoryId, subCategoryIds }) => this.#visibilityHelper.changeSubCategoriesVisibilityStatus({ subCategoryIds, categoryId, on })),
          ),
        );
      }

      if (elements?.length) {
        observables.push(
          from(elements).pipe(
            releaseMainThreadOnItemsCount(50),
            mergeMap(({ modelId, elements: elementsMap, categoryId }) =>
              this.#visibilityHelper.changeElementsVisibilityStatus({ modelId, categoryId, elementIds: [...elementsMap.keys()], on }),
            ),
          ),
        );
      }

      return merge(...observables);
    });
  }

  public getVisibilityStatus(node: HierarchyNode): Observable<VisibilityStatus> {
    if (HierarchyNode.isClassGroupingNode(node)) {
      const nodeInfo = this.getGroupingNodeInfo(node);
      return this.#visibilityHelper.getGroupedElementsVisibilityStatus({ categoryId: nodeInfo.categoryId, modelElementsMap: nodeInfo.modelElementsMap });
    }

    if (!HierarchyNode.isInstancesNode(node)) {
      return of(createVisibilityStatus("disabled"));
    }

    if (CategoriesTreeNode.isDefinitionContainerNode(node)) {
      return this.#visibilityHelper.getDefinitionContainersVisibilityStatus({
        definitionContainerIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
      });
    }

    if (CategoriesTreeNode.isModelNode(node)) {
      return this.#visibilityHelper.getModelsVisibilityStatus({
        modelIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
        type: this.#modelType,
      });
    }

    if (CategoriesTreeNode.isCategoryNode(node)) {
      return this.#visibilityHelper.getCategoriesVisibilityStatus({
        categoryIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
        modelId: CategoriesTreeNode.getModelId(node),
        type: this.#categoryType,
      });
    }

    const categoryId = CategoriesTreeNode.getCategoryId(node);
    if (!categoryId) {
      return of(createVisibilityStatus("disabled"));
    }

    if (CategoriesTreeNode.isSubCategoryNode(node)) {
      return this.#visibilityHelper.getSubCategoriesVisibilityStatus({
        categoryId,
        subCategoryIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
      });
    }

    const modelId = CategoriesTreeNode.getModelId(node);
    if (!modelId) {
      return of(createVisibilityStatus("disabled"));
    }
    return this.#visibilityHelper.getElementsVisibilityStatus({
      elementIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
      modelId,
      categoryId,
      type: this.#elementType,
    });
  }

  /** Changes visibility of the items represented by the tree node. */
  public changeVisibilityStatus(node: HierarchyNode, on: boolean): Observable<void> {
    const changeObs = defer(() => {
      if (HierarchyNode.isClassGroupingNode(node)) {
        const nodeInfo = this.getGroupingNodeInfo(node);
        return this.#visibilityHelper.changeGroupedElementsVisibilityStatus({
          categoryId: nodeInfo.categoryId,
          modelElementsMap: nodeInfo.modelElementsMap,
          on,
        });
      }

      if (!HierarchyNode.isInstancesNode(node)) {
        return EMPTY;
      }

      if (CategoriesTreeNode.isDefinitionContainerNode(node)) {
        return this.#visibilityHelper.changeDefinitionContainersVisibilityStatus({
          definitionContainerIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
          on,
        });
      }

      if (CategoriesTreeNode.isModelNode(node)) {
        return this.#visibilityHelper.changeModelsVisibilityStatus({
          modelIds: node.key.instanceKeys.map(({ id }) => id),
          on,
        });
      }

      if (CategoriesTreeNode.isCategoryNode(node)) {
        return this.#visibilityHelper.changeCategoriesVisibilityStatus({
          categoryIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
          modelId: CategoriesTreeNode.getModelId(node),
          on,
        });
      }

      const categoryId = CategoriesTreeNode.getCategoryId(node);
      if (!categoryId) {
        return EMPTY;
      }

      if (CategoriesTreeNode.isSubCategoryNode(node)) {
        return this.#visibilityHelper.changeSubCategoriesVisibilityStatus({
          categoryId,
          subCategoryIds: node.key.instanceKeys.map((instanceKey) => instanceKey.id),
          on,
        });
      }

      const modelId = CategoriesTreeNode.getModelId(node);
      if (!modelId) {
        return EMPTY;
      }

      return this.#visibilityHelper.changeElementsVisibilityStatus({
        elementIds: node.key.instanceKeys.map(({ id }) => id),
        modelId,
        categoryId,
        on,
      });
    });

    if (this.#props.viewport.isAlwaysDrawnExclusive) {
      return concat(this.#visibilityHelper.removeAlwaysDrawnExclusive(), changeObs);
    }
    return changeObs;
  }

  public getFilterTargetsVisibilityStatus(targets: CategoriesTreeFilterTargets): Observable<VisibilityStatus> {
    return defer(() => {
      const { definitionContainerIds, subCategories, modelIds, categories, elements } = targets;
      const observables = new Array<Observable<VisibilityStatus>>();
      if (definitionContainerIds?.size) {
        observables.push(this.#visibilityHelper.getDefinitionContainersVisibilityStatus({ definitionContainerIds }));
      }

      if (modelIds?.size) {
        observables.push(this.#visibilityHelper.getModelsVisibilityStatus({ modelIds, type: this.#modelType }));
      }

      if (categories?.length) {
        observables.push(
          from(categories).pipe(
            mergeMap(({ modelId, categoryIds }) =>
              this.#visibilityHelper.getCategoriesVisibilityStatus({
                categoryIds,
                modelId,
                type: this.#categoryType,
              }),
            ),
          ),
        );
      }

      if (subCategories?.length) {
        observables.push(
          from(subCategories).pipe(
            mergeMap(({ categoryId, subCategoryIds }) => this.#visibilityHelper.getSubCategoriesVisibilityStatus({ subCategoryIds, categoryId })),
          ),
        );
      }

      if (elements?.length) {
        observables.push(
          from(elements).pipe(
            releaseMainThreadOnItemsCount(50),
            mergeMap(({ modelId, elements: elementsMap, categoryId }) =>
              this.#visibilityHelper.getElementsVisibilityStatus({ modelId, categoryId, elementIds: [...elementsMap.keys()], type: this.#elementType }),
            ),
          ),
        );
      }

      return merge(...observables);
    }).pipe(mergeVisibilityStatuses);
  }

  private getCategories(props: Parameters<BaseIdsCache["getCategories"]>[0]): ReturnType<BaseIdsCache["getCategories"]> {
    return from(Id64.iterable(props.modelIds)).pipe(
      mergeMap((modelId) =>
        this.#props.idsCache.getModelCategoryIds(modelId).pipe(
          map((categories) => ({
            id: modelId,
            ...(this.#props.viewport.viewType === "2d" ? { drawingCategories: categories } : { spatialCategories: categories }),
          })),
        ),
      ),
    );
  }

  private getAllCategories(): ReturnType<BaseIdsCache["getAllCategories"]> {
    return this.#props.idsCache.getAllCategories().pipe(
      map((categories) => {
        if (this.#props.viewport.viewType === "2d") {
          return { drawingCategories: categories };
        }
        return { spatialCategories: categories };
      }),
    );
  }

  private getElementsCount(props: Parameters<BaseIdsCache["getElementsCount"]>[0]): ReturnType<BaseIdsCache["getElementsCount"]> {
    return this.#props.idsCache.getCategoryElementsCount(props.modelId, props.categoryId);
  }

  private getModels(props: Parameters<BaseIdsCache["getModels"]>[0]): ReturnType<BaseIdsCache["getModels"]> {
    return from(Id64.iterable(props.categoryIds)).pipe(
      mergeMap((categoryId) =>
        this.#props.idsCache.getCategoriesElementModels(categoryId, true).pipe(
          mergeMap((categoryModelsMap) => (categoryModelsMap.size > 0 ? categoryModelsMap.values() : of(undefined))),
          map((categoryModels) => ({ id: categoryId, models: categoryModels })),
        ),
      ),
    );
  }

  private getSubCategories(props: Parameters<BaseIdsCache["getSubCategories"]>[0]): ReturnType<BaseIdsCache["getSubCategories"]> {
    return from(Id64.iterable(props.categoryIds)).pipe(
      mergeMap((categoryId) =>
        this.#props.idsCache.getSubCategories(categoryId).pipe(
          mergeMap((categorySubCategoriesMap) => (categorySubCategoriesMap.size > 0 ? categorySubCategoriesMap.values() : of(undefined))),
          map((subCategories) => ({ id: categoryId, subCategories })),
        ),
      ),
    );
  }

  private getSubModels(props: Parameters<BaseIdsCache["getSubModels"]>[0]): ReturnType<BaseIdsCache["getSubModels"]> {
    if ("modelIds" in props) {
      return from(Id64.iterable(props.modelIds)).pipe(
        mergeMap((modelId) => {
          if (props.categoryId) {
            return this.#props.idsCache.getCategoriesModeledElements(modelId, props.categoryId).pipe(map((subModels) => ({ id: modelId, subModels })));
          }
          return this.#props.idsCache.getModelCategoryIds(modelId).pipe(
            mergeMap((categoryIds) => this.#props.idsCache.getCategoriesModeledElements(modelId, categoryIds)),
            map((subModels) => ({ id: modelId, subModels })),
          );
        }),
      );
    }

    if (props.modelId) {
      return from(Id64.iterable(props.categoryIds)).pipe(
        mergeMap((categoryId) =>
          this.#props.idsCache.getCategoriesModeledElements(props.modelId!, categoryId).pipe(map((subModels) => ({ id: categoryId, subModels }))),
        ),
      );
    }

    return from(Id64.iterable(props.categoryIds)).pipe(
      mergeMap((categoryId) =>
        this.#props.idsCache.getCategoriesElementModels(categoryId).pipe(
          mergeMap((categoryModelsMap) => {
            const models = categoryModelsMap.get(categoryId);
            if (!models) {
              return of({ id: categoryId, subModels: undefined });
            }
            return from(models).pipe(
              mergeMap((modelId) => this.#props.idsCache.getCategoriesModeledElements(modelId, categoryId)),
              map((subModels) => ({ id: categoryId, subModels })),
            );
          }),
        ),
      ),
    );
  }

  private getGroupingNodeInfo(node: GroupingHierarchyNode) {
    const modelElementsMap: Map<ModelId, Set<ElementId>> = node.extendedData?.modelElementsMap;
    const categoryId = node.extendedData?.categoryId;
    assert(!!modelElementsMap && !!categoryId);

    return { modelElementsMap, categoryId };
  }
}

/**
 * Creates categories tree visibility handler. Is used by integration and performance tests.
 * @internal
 */
export function createCategoriesTreeVisibilityHandler(props: {
  viewport: TreeWidgetViewport;
  idsCache: CategoriesTreeIdsCache;
  imodelAccess: ECClassHierarchyInspector;
  filteredPaths?: HierarchyFilteringPath[];
  hierarchyConfig: CategoriesTreeHierarchyConfiguration;
}) {
  return new HierarchyVisibilityHandlerImpl<CategoriesTreeFilterTargets>({
    getFilteredTree: (): undefined | Promise<FilteredTree<CategoriesTreeFilterTargets>> => {
      if (!props.filteredPaths) {
        return undefined;
      }
      const { categoryClass, elementClass, modelClass } = getClassesByView(props.viewport.viewType === "2d" ? "2d" : "3d");
      return createFilteredCategoriesTree({
        idsCache: props.idsCache,
        filteringPaths: props.filteredPaths,
        imodelAccess: props.imodelAccess,
        categoryClassName: categoryClass,
        categoryElementClassName: elementClass,
        categoryModelClassName: modelClass,
      });
    },
    getTreeSpecificVisibilityHandler: (info) => {
      return new CategoriesTreeVisibilityHandler({
        alwaysAndNeverDrawnElementInfo: info,
        idsCache: props.idsCache,
        viewport: props.viewport,
        hierarchyConfig: props.hierarchyConfig,
      });
    },
    viewport: props.viewport,
    componentId: "Test",
  });
}
