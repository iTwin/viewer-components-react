/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { concat, concatAll, defer, distinct, EMPTY, firstValueFrom, forkJoin, from, map, merge, mergeMap, of, reduce } from "rxjs";
import { assert } from "@itwin/core-bentley";
import { IModelApp, PerModelCategoryVisibility } from "@itwin/core-frontend";
import { HierarchyNode, HierarchyNodeIdentifier, HierarchyNodeKey } from "@itwin/presentation-hierarchies";
import { toggleAllCategories } from "../../common/CategoriesVisibilityUtils";
import { reduceWhile, toVoidPromise } from "../../common/Rxjs";
import { AlwaysAndNeverDrawnElementInfo } from "./AlwaysAndNeverDrawnElementInfo";
import { ModelsTreeNode } from "./ModelsTreeNode";
import { createVisibilityStatus } from "./Tooltip";
import { createVisibilityChangeEventListener } from "./VisibilityChangeEventListener";

import type { Observable, OperatorFunction } from "rxjs";
import type { ModelsTreeIdsCache } from "./ModelsTreeIdsCache";
import type { Id64Arg, Id64Array, Id64Set, Id64String } from "@itwin/core-bentley";
import type { createHierarchyProvider, GroupingHierarchyNode, HierarchyNodeIdentifiersPath } from "@itwin/presentation-hierarchies";
import type { AlwaysOrNeverDrawnElementsQueryProps } from "./AlwaysAndNeverDrawnElementInfo";
import type { IVisibilityChangeEventListener } from "./VisibilityChangeEventListener";
import type { Viewport } from "@itwin/core-frontend";
import type { NonPartialVisibilityStatus, Visibility } from "./Tooltip";
import type { HierarchyVisibilityHandler, VisibilityStatus } from "../../common/UseHierarchyVisibility";
import type { ECClassHierarchyInspector, InstanceKey } from "@itwin/presentation-shared";

type HierarchyProviderProps = Parameters<typeof createHierarchyProvider>[0];
type HierarchyFilteringPaths = NonNullable<NonNullable<HierarchyProviderProps["filtering"]>["paths"]>;

/** @beta */
interface GetCategoryStatusProps {
  categoryId: Id64String;
  modelId: Id64String;
}

/** @beta */
interface ChangeCategoryStateProps extends GetCategoryStatusProps {
  on: boolean;
}

/** @beta */
interface GetElementStateProps {
  elementId: Id64String;
  modelId: Id64String;
  categoryId: Id64String;
}

/** @beta */
interface GetFilteredNodeVisibilityProps {
  parentKeys: HierarchyNodeKey[];
  filterPaths: HierarchyFilteringPaths;
}

/** @beta */
interface ChangeFilteredNodeVisibilityProps extends GetFilteredNodeVisibilityProps {
  on: boolean;
}

/** @beta */
interface ChangeElementStateProps extends GetElementStateProps {
  on: boolean;
}

/** @beta */
interface ChangeModelStateProps {
  ids: Id64Arg;
  on: boolean;
}

export const SUBJECT_CLASS_NAME = "BisCore.Subject" as const;
export const MODEL_CLASS_NAME = "BisCore.GeometricModel3d" as const;
export const CATEGORY_CLASS_NAME = "BisCore.SpatialCategory" as const;
export const ELEMENT_CLASS_NAME = "BisCore.GeometricElement3d" as const;

type CategoryKey = `${Id64String}-${Id64String}`;
type ElementKey = `${CategoryKey}-${Id64String}`;

function createCategoryKey(modelId: string, categoryId: string): CategoryKey {
  return `${modelId}-${categoryId}`;
}

function parseCategoryKey(key: CategoryKey) {
  const [modelId, categoryId] = key.split("-");
  return { modelId, categoryId };
}

function createElementKey(modelId: string, categoryId: string, elementId: string): ElementKey {
  return `${modelId}-${categoryId}-${elementId}`;
}

function parseElementKey(key: ElementKey) {
  const [modelId, categoryId, elementId] = key.split("-");
  return { modelId, categoryId, elementId };
}

interface FilterTargets {
  subjects?: Set<Id64String>;
  models?: Set<Id64String>;
  categories?: Set<CategoryKey>;
  elements?: Set<ElementKey>;
}

/**
 * Properties for a method of `ModelsTreeVisibilityHandler` that can be overridden.
 * @beta
 */
type OverridableMethodProps<TFunc> = TFunc extends (props: infer TProps) => infer TResult
  ? TProps & {
      /** A callback that produces the value from the original implementation. */
      readonly originalImplementation: () => TResult;
      /**
       * Reference to the hierarchy based handler.
       * @note Calling `getVisibility` or `changeVisibility` of this object invokes the overridden implementation as well.
       */
      readonly handler: ModelsTreeVisibilityHandler;
    }
  : never;

/**
 * Function type for an overridden method of `ModelsTreeVisibilityHandler`.
 * @beta
 */
type OverridableMethod<TFunc> = TFunc extends (...args: any[]) => infer TResult ? (props: OverridableMethodProps<TFunc>) => TResult : never;

/**
 * Functionality of `ModelsTreeVisibilityHandler` that can be overridden.
 * Each callback will be provided original implementation and reference to a `HierarchyVisibilityHandler`.
 * @beta
 */
export interface ModelsTreeVisibilityHandlerOverrides {
  getSubjectNodeVisibility?: OverridableMethod<(props: { ids: Id64Array }) => Promise<VisibilityStatus>>;
  getModelDisplayStatus?: OverridableMethod<(props: { id: Id64String }) => Promise<VisibilityStatus>>;
  getCategoryDisplayStatus?: OverridableMethod<(props: GetCategoryStatusProps) => Promise<VisibilityStatus>>;
  getElementGroupingNodeDisplayStatus?: OverridableMethod<(props: { node: GroupingHierarchyNode }) => Promise<VisibilityStatus>>;
  getElementDisplayStatus?: OverridableMethod<(props: GetElementStateProps) => Promise<VisibilityStatus>>;

  changeSubjectNodeState?: OverridableMethod<(props: { ids: Id64Array; on: boolean }) => Promise<void>>;
  changeModelState?: OverridableMethod<(props: ChangeModelStateProps) => Promise<void>>;
  changeCategoryState?: OverridableMethod<(props: ChangeCategoryStateProps) => Promise<void>>;
  changeElementGroupingNodeState?: OverridableMethod<(props: { node: GroupingHierarchyNode; on: boolean }) => Promise<void>>;
  changeElementState?: OverridableMethod<(props: ChangeElementStateProps) => Promise<void>>;
}

/**
 * Properties for `ModelsTreeVisibilityHandler`.
 * @internal
 */
export interface ModelsTreeVisibilityHandlerProps {
  viewport: Viewport;
  idsCache: ModelsTreeIdsCache;
  imodelAccess: ECClassHierarchyInspector;
  overrides?: ModelsTreeVisibilityHandlerOverrides;
}

/**
 * Hierarchy based visibility handler.
 * When determining visibility for nodes, it should take into account the visibility of their children.
 * @beta
 */
export type ModelsTreeVisibilityHandler = HierarchyVisibilityHandler;

/**
 * Creates an instance if `ModelsTreeVisibilityHandler`.
 * @internal
 */
export function createModelsTreeVisibilityHandler(props: ModelsTreeVisibilityHandlerProps): ModelsTreeVisibilityHandler {
  return new ModelsTreeVisibilityHandlerImpl(props);
}

class ModelsTreeVisibilityHandlerImpl implements ModelsTreeVisibilityHandler {
  private readonly _eventListener: IVisibilityChangeEventListener;
  private readonly _alwaysAndNeverDrawnElements: AlwaysAndNeverDrawnElementInfo;
  private readonly _idsCache: ModelsTreeIdsCache;

  constructor(private readonly _props: ModelsTreeVisibilityHandlerProps) {
    this._eventListener = createVisibilityChangeEventListener(_props.viewport);
    this._alwaysAndNeverDrawnElements = new AlwaysAndNeverDrawnElementInfo(_props.viewport);
    this._idsCache = this._props.idsCache;
  }

  // istanbul ignore next
  public get onVisibilityChange() {
    return this._eventListener.onVisibilityChange;
  }

  public async getVisibilityStatus(node: HierarchyNode): Promise<VisibilityStatus> {
    return firstValueFrom(this.getVisibilityStatusObs(node));
  }

  public async changeVisibility(node: HierarchyNode, shouldDisplay: boolean): Promise<void> {
    return toVoidPromise(this.changeVisibilityObs(node, shouldDisplay));
  }

  public dispose(): void {
    this._eventListener.dispose();
    this._alwaysAndNeverDrawnElements.dispose();
  }

  private getVisibilityStatusObs(node: HierarchyNode): Observable<VisibilityStatus> {
    if (node.filtering?.filteredChildrenIdentifierPaths?.length && !node.filtering.isFilterTarget) {
      return this.getFilteredNodeVisibility({
        parentKeys: [...node.parentKeys, node.key],
        filterPaths: node.filtering.filteredChildrenIdentifierPaths,
      });
    }

    if (HierarchyNode.isClassGroupingNode(node)) {
      return this.getClassGroupingNodeDisplayStatus(node);
    }

    if (!HierarchyNode.isInstancesNode(node)) {
      return of(createVisibilityStatus("disabled"));
    }

    if (ModelsTreeNode.isSubjectNode(node)) {
      // note: subject nodes may be merged to represent multiple subject instances
      return this.getSubjectNodeVisibilityStatus(node.key.instanceKeys.map((key) => key.id));
    }

    if (ModelsTreeNode.isModelNode(node)) {
      return this.getModelVisibilityStatus(node.key.instanceKeys[0].id);
    }

    const modelId = ModelsTreeNode.getModelId(node);
    if (!modelId) {
      return of(createVisibilityStatus("disabled"));
    }

    if (ModelsTreeNode.isCategoryNode(node)) {
      return this.getCategoryDisplayStatus({
        categoryId: node.key.instanceKeys[0].id,
        modelId,
      });
    }

    const categoryId = ModelsTreeNode.getCategoryId(node);
    if (!categoryId) {
      return of(createVisibilityStatus("disabled"));
    }

    return this.getElementDisplayStatus({
      elementId: node.key.instanceKeys[0].id,
      modelId,
      categoryId,
    });
  }

  private getFilteredNodeVisibility({ parentKeys, filterPaths }: GetFilteredNodeVisibilityProps) {
    return from(this.getFilterTargets({ parentKeys, filterPaths })).pipe(
      mergeMap(({ subjects, models, categories, elements }) => {
        const observables = new Array<Observable<VisibilityStatus>>();
        if (subjects?.size) {
          observables.push(this.getSubjectNodeVisibilityStatus([...subjects]));
        }

        if (models?.size) {
          observables.push(from(models).pipe(mergeMap((modelId) => this.getModelVisibilityStatus(modelId))));
        }

        if (categories?.size) {
          observables.push(
            from(categories).pipe(
              mergeMap((key) => {
                const { modelId, categoryId } = parseCategoryKey(key);
                return this.getCategoryDisplayStatus({ modelId, categoryId });
              }),
            ),
          );
        }

        if (elements?.size) {
          observables.push(
            from(elements).pipe(
              mergeMap((key) => {
                const { modelId, categoryId, elementId } = parseElementKey(key);
                return this.getElementDisplayStatus({ modelId, categoryId, elementId });
              }),
            ),
          );
        }

        return merge(...observables);
      }),
      map((x) => x.state),
      getVisibilityFromTreeNodeChildren,
      map((x) => {
        assert(x !== "empty");
        return createVisibilityStatus(x);
      }),
    );
  }

  private getSubjectNodeVisibilityStatus(subjectIds: Id64Array): Observable<VisibilityStatus> {
    const result = defer(() => {
      if (!this._props.viewport.view.isSpatialView()) {
        return of(createVisibilityStatus("disabled", "subject.nonSpatialView"));
      }

      return from(this._idsCache.getSubjectModelIds(subjectIds)).pipe(
        concatAll(),
        distinct(),
        mergeMap((modelId) => this.getModelVisibilityStatus(modelId)),
        map((x) => x.state),
        getVisibilityStatusFromTreeNodeChildren({
          visible: "subject.allModelsVisible",
          hidden: "subject.allModelsHidden",
          partial: "subject.someModelsHidden",
        }),
      );
    });

    const ovr = this._props.overrides?.getSubjectNodeVisibility;
    return ovr ? from(ovr(this.createOverrideProps({ ids: subjectIds }, result))) : result;
  }

  private getModelVisibilityStatus(modelId: Id64String): Observable<VisibilityStatus> {
    const result = defer(() => {
      const viewport = this._props.viewport;
      if (!viewport.view.isSpatialView()) {
        return of(createVisibilityStatus("disabled", "model.nonSpatialView"));
      }

      if (!viewport.view.viewsModel(modelId)) {
        return of(createVisibilityStatus("hidden", "model.hiddenThroughModelSelector"));
      }

      return from(this._idsCache.getModelCategories(modelId)).pipe(
        concatAll(),
        mergeMap((categoryId) => this.getCategoryDisplayStatus({ modelId, categoryId })),
        map((x) => x.state),
        getVisibilityFromTreeNodeChildren,
        map((visibilityByCategories) => {
          const state = visibilityByCategories === "empty" ? "visible" : visibilityByCategories;
          return createVisibilityStatus(state, state === "partial" ? "model.someCategoriesHidden" : `model.allCategories${state ? "Visible" : "Hidden"}`);
        }),
      );
    });

    const ovr = this._props.overrides?.getModelDisplayStatus;
    return ovr ? from(ovr(this.createOverrideProps({ id: modelId }, result))) : result;
  }

  private getDefaultCategoryVisibilityStatus({ modelId, categoryId }: { categoryId: Id64String; modelId: Id64String }): NonPartialVisibilityStatus {
    const viewport = this._props.viewport;

    if (!viewport.view.viewsModel(modelId)) {
      return createVisibilityStatus("hidden", "category.hiddenThroughModel");
    }

    switch (this._props.viewport.perModelCategoryVisibility.getOverride(modelId, categoryId)) {
      case PerModelCategoryVisibility.Override.Show:
        return createVisibilityStatus("visible", "category.displayedThroughPerModelOverride");
      case PerModelCategoryVisibility.Override.Hide:
        return createVisibilityStatus("hidden", "category.hiddenThroughPerModelOverride");
    }

    const isVisible = viewport.view.viewsCategory(categoryId);
    return isVisible
      ? createVisibilityStatus("visible", "category.displayedThroughCategorySelector")
      : createVisibilityStatus("hidden", "category.hiddenThroughCategorySelector");
  }

  private getCategoryDisplayStatus(props: GetCategoryStatusProps): Observable<VisibilityStatus> {
    const result = defer(() => {
      if (!this._props.viewport.view.viewsModel(props.modelId)) {
        return of(createVisibilityStatus("hidden", "category.hiddenThroughModel"));
      }

      return this.getVisibilityFromAlwaysAndNeverDrawnElements({
        queryProps: props,
        tooltips: {
          allElementsInAlwaysDrawnList: "category.allElementsVisible",
          allElementsInNeverDrawnList: "category.allElementsHidden",
          elementsInBothAlwaysAndNeverDrawn: "category.someElementsAreHidden",
          noElementsInExclusiveAlwaysDrawnList: "category.allElementsHidden",
        },
        defaultStatus: () => this.getDefaultCategoryVisibilityStatus(props),
      });
    });

    const ovr = this._props.overrides?.getCategoryDisplayStatus;
    return ovr ? from(ovr(this.createOverrideProps(props, result))) : result;
  }

  private getClassGroupingNodeDisplayStatus(node: GroupingHierarchyNode): Observable<VisibilityStatus> {
    const result = defer(() => {
      const info = this.getGroupingNodeInfo(node);

      const { modelId, categoryId, elementIds } = info;
      if (!this._props.viewport.view.viewsModel(modelId)) {
        return of(createVisibilityStatus("hidden"));
      }

      return this.getVisibilityFromAlwaysAndNeverDrawnElements({
        elements: elementIds,
        defaultStatus: () => {
          const status = this.getDefaultCategoryVisibilityStatus({ categoryId, modelId });
          return createVisibilityStatus(status.state, `groupingNode.${status.state}ThroughCategory`);
        },
        tooltips: {
          allElementsInAlwaysDrawnList: "groupingNode.allElementsVisible",
          allElementsInNeverDrawnList: "groupingNode.allElementsHidden",
          elementsInBothAlwaysAndNeverDrawn: "groupingNode.someElementsAreHidden",
          noElementsInExclusiveAlwaysDrawnList: "groupingNode.allElementsHidden",
        },
      });
    });

    const ovr = this._props.overrides?.getElementGroupingNodeDisplayStatus;
    return ovr ? from(ovr(this.createOverrideProps({ node }, result))) : result;
  }

  private getElementOverriddenVisibility(elementId: string): NonPartialVisibilityStatus | undefined {
    const viewport = this._props.viewport;
    if (viewport.neverDrawn?.has(elementId)) {
      return createVisibilityStatus("hidden", "element.hiddenThroughNeverDrawnList");
    }

    if (viewport.alwaysDrawn?.size) {
      if (viewport.alwaysDrawn.has(elementId)) {
        return createVisibilityStatus("visible", "element.displayedThroughAlwaysDrawnList");
      }

      if (viewport.isAlwaysDrawnExclusive) {
        return createVisibilityStatus("hidden", "element.hiddenDueToOtherElementsExclusivelyAlwaysDrawn");
      }
    }

    return undefined;
  }

  private getElementDisplayStatus(props: GetElementStateProps): Observable<VisibilityStatus> {
    const result = defer(() => {
      const viewport = this._props.viewport;
      const { elementId, modelId, categoryId } = props;

      if (!viewport.view.viewsModel(modelId)) {
        return of(createVisibilityStatus("hidden", "element.hiddenThroughModel"));
      }

      let status = this.getElementOverriddenVisibility(elementId);
      if (status) {
        return of(status);
      }

      status = this.getDefaultCategoryVisibilityStatus({ categoryId, modelId });
      return of(createVisibilityStatus(status.state, status.state === "visible" ? undefined : "element.hiddenThroughCategory"));
    });

    const ovr = this._props.overrides?.getElementDisplayStatus;
    return ovr ? from(ovr(this.createOverrideProps(props, result))) : result;
  }

  /** Changes visibility of the items represented by the tree node. */
  private changeVisibilityObs(node: HierarchyNode, on: boolean): Observable<void> {
    if (node.filtering?.filteredChildrenIdentifierPaths?.length && !node.filtering.isFilterTarget) {
      return this.changeFilteredNodeVisibility({
        parentKeys: [...node.parentKeys, node.key],
        filterPaths: node.filtering.filteredChildrenIdentifierPaths,
        on,
      });
    }

    if (HierarchyNode.isClassGroupingNode(node)) {
      return this.changeElementGroupingNodeState(node, on);
    }

    // istanbul ignore if
    if (!HierarchyNode.isInstancesNode(node)) {
      return EMPTY;
    }

    if (ModelsTreeNode.isSubjectNode(node)) {
      return this.changeSubjectNodeState(
        node.key.instanceKeys.map((key) => key.id),
        on,
      );
    }

    if (ModelsTreeNode.isModelNode(node)) {
      return this.changeModelState({ ids: node.key.instanceKeys[0].id, on });
    }

    const modelId = ModelsTreeNode.getModelId(node);
    // istanbul ignore if
    if (!modelId) {
      return EMPTY;
    }

    if (ModelsTreeNode.isCategoryNode(node)) {
      return this.changeCategoryState({
        categoryId: node.key.instanceKeys[0].id,
        modelId,
        on,
      });
    }

    const categoryId = ModelsTreeNode.getCategoryId(node);
    // istanbul ignore if
    if (!categoryId) {
      // istanbul ignore next
      return EMPTY;
    }

    return this.changeElementState({
      elementId: node.key.instanceKeys[0].id,
      modelId,
      categoryId,
      on,
    });
  }

  private async getFilterTargets({ parentKeys, filterPaths }: GetFilteredNodeVisibilityProps) {
    const filterTargets: FilterTargets = {};

    function addFilterTarget(targetType: "subjects" | "models", value: Id64String): void;
    function addFilterTarget(targetType: "categories", value: CategoryKey): void;
    function addFilterTarget(targetType: "elements", value: ElementKey): void;
    function addFilterTarget(targetType: keyof FilterTargets, value: string) {
      ((filterTargets as Record<keyof FilterTargets, Set<string>>)[targetType] ??= new Set()).add(value);
    }

    const imodelAccess = this._props.imodelAccess;

    // Remove all paths such that there are paths to any of the ancestors of the filter target.
    const paths = reduceFilterPaths(filterPaths);

    await Promise.all(
      paths.map(async (path) => {
        const target = path[path.length - 1];
        if (!HierarchyNodeIdentifier.isInstanceNodeIdentifier(target)) {
          return;
        }

        const previousPath = path.slice(0, path.length - 1);

        if (await imodelAccess.classDerivesFrom(target.className, SUBJECT_CLASS_NAME)) {
          addFilterTarget("subjects", target.id);
          return;
        }

        if (await imodelAccess.classDerivesFrom(target.className, MODEL_CLASS_NAME)) {
          addFilterTarget("models", target.id);
          return;
        }

        if (await imodelAccess.classDerivesFrom(target.className, CATEGORY_CLASS_NAME)) {
          // eslint-disable-next-line @typescript-eslint/no-shadow
          const modelId = await this.findClassIdInFilterPath(previousPath, parentKeys, MODEL_CLASS_NAME);
          addFilterTarget("categories", createCategoryKey(modelId, target.id));
          return;
        }

        const [modelId, categoryId] = await Promise.all([
          this.findClassIdInFilterPath(previousPath, parentKeys, MODEL_CLASS_NAME),
          this.findClassIdInFilterPath(previousPath, parentKeys, CATEGORY_CLASS_NAME),
        ]);
        addFilterTarget("elements", createElementKey(modelId, categoryId, target.id));

        // Add parent elements to the filter targets as well
        for (let idx = path.length - 1; idx >= 0; --idx) {
          const pathIdentifier = path[idx];
          if (!HierarchyNodeIdentifier.isInstanceNodeIdentifier(pathIdentifier)) {
            continue;
          }

          if (!(await imodelAccess.classDerivesFrom(pathIdentifier.className, ELEMENT_CLASS_NAME))) {
            break;
          }
          addFilterTarget("elements", createElementKey(modelId, categoryId, pathIdentifier.id));
        }
      }),
    );

    return filterTargets;
  }

  private changeFilteredNodeVisibility({ on, ...props }: ChangeFilteredNodeVisibilityProps) {
    return from(this.getFilterTargets(props)).pipe(
      mergeMap(({ subjects, models, categories, elements }) => {
        const observables = new Array<Observable<void>>();
        if (subjects?.size) {
          observables.push(this.changeSubjectNodeState([...subjects], on));
        }

        if (models?.size) {
          observables.push(this.changeModelState({ ids: models, on }));
        }

        if (categories?.size) {
          observables.push(
            from(categories).pipe(
              mergeMap((key) => {
                const { modelId, categoryId } = parseCategoryKey(key);
                return this.changeCategoryState({ modelId, categoryId, on });
              }),
            ),
          );
        }

        if (elements?.size) {
          observables.push(
            from(elements).pipe(
              mergeMap((key) => {
                const { modelId, categoryId, elementId } = parseElementKey(key);
                return this.changeElementState({ modelId, categoryId, elementId, on });
              }),
            ),
          );
        }

        return merge(...observables);
      }),
    );
  }

  private changeSubjectNodeState(ids: Id64Array, on: boolean): Observable<void> {
    const result = defer(() => {
      // istanbul ignore if
      if (!this._props.viewport.view.isSpatialView()) {
        return EMPTY;
      }

      return from(this._idsCache.getSubjectModelIds(ids)).pipe(mergeMap((modelIds) => this.changeModelState({ ids: modelIds, on })));
    });

    const ovr = this._props.overrides?.changeSubjectNodeState;
    return ovr ? from(ovr(this.createVoidOverrideProps({ ids, on }, result))) : result;
  }

  private changeModelState(props: ChangeModelStateProps): Observable<void> {
    const result = defer(() => {
      const viewport = this._props.viewport;
      // istanbul ignore if
      if (!viewport.view.isSpatialView()) {
        return EMPTY;
      }

      const { ids, on } = props;
      if (!on) {
        viewport.changeModelDisplay(ids, false);
        return EMPTY;
      }

      return concat(
        defer(() => {
          viewport.perModelCategoryVisibility.clearOverrides(ids);
          return from(viewport.addViewedModels(ids));
        }),
        (typeof ids === "string" ? of(ids) : from(ids)).pipe(
          mergeMap((modelId) => {
            return from(this._idsCache.getModelCategories(modelId)).pipe(
              concatAll(),
              mergeMap((categoryId) => this.changeCategoryState({ categoryId, modelId, on: true })),
            );
          }),
        ),
      );
    });
    const ovr = this._props.overrides?.changeModelState;
    return ovr ? from(ovr(this.createVoidOverrideProps(props, result))) : result;
  }

  private showModelWithoutAnyCategoriesOrElements(modelId: Id64String) {
    const viewport = this._props.viewport;
    return forkJoin({
      categories: this._idsCache.getModelCategories(modelId),
      alwaysDrawnElements: this.getAlwaysDrawnElements({ modelId }),
    }).pipe(
      mergeMap(async ({ categories, alwaysDrawnElements }) => {
        const alwaysDrawn = this._props.viewport.alwaysDrawn;
        if (alwaysDrawn && alwaysDrawnElements) {
          viewport.setAlwaysDrawn(setDifference(alwaysDrawn, alwaysDrawnElements));
        }
        categories.forEach((categoryId) => {
          this.changeCategoryStateInViewportAccordingToModelVisibility(modelId, categoryId, false);
        });
        await viewport.addViewedModels(modelId);
      }),
    );
  }

  private changeCategoryStateInViewportAccordingToModelVisibility(modelId: string, categoryId: string, on: boolean) {
    const viewport = this._props.viewport;
    const isDisplayedInSelector = viewport.view.viewsCategory(categoryId);
    const override =
      on === isDisplayedInSelector
        ? PerModelCategoryVisibility.Override.None
        : on
          ? PerModelCategoryVisibility.Override.Show
          : PerModelCategoryVisibility.Override.Hide;
    viewport.perModelCategoryVisibility.setOverride(modelId, categoryId, override);
    if (override === PerModelCategoryVisibility.Override.None && on) {
      // we took off the override which means the category is displayed in selector, but
      // doesn't mean all its subcategories are displayed - this call ensures that
      viewport.changeCategoryDisplay(categoryId, true, true);
    }
  }

  private changeCategoryState(props: ChangeCategoryStateProps): Observable<void> {
    const result = defer(() => {
      const viewport = this._props.viewport;
      const { modelId, categoryId, on } = props;
      return concat(
        props.on && !viewport.view.viewsModel(modelId) ? this.showModelWithoutAnyCategoriesOrElements(modelId) : EMPTY,
        defer(() => {
          this.changeCategoryStateInViewportAccordingToModelVisibility(modelId, categoryId, on);
          return this.clearAlwaysAndNeverDrawnElements(props);
        }),
      );
    });

    const ovr = this._props.overrides?.changeCategoryState;
    return ovr ? from(ovr(this.createVoidOverrideProps(props, result))) : result;
  }

  /**
   * Updates visibility of all grouping node's elements.
   * @see `changeElementState`
   */
  private changeElementGroupingNodeState(node: GroupingHierarchyNode, on: boolean): Observable<void> {
    const result = defer(() => {
      const info = this.getGroupingNodeInfo(node);

      const { modelId, categoryId, elementIds } = info;
      const viewport = this._props.viewport;
      return concat(
        on && !viewport.view.viewsModel(modelId) ? this.showModelWithoutAnyCategoriesOrElements(modelId) : EMPTY,
        defer(() => {
          const categoryVisibility = this.getDefaultCategoryVisibilityStatus({ categoryId, modelId });
          const isDisplayedByDefault = categoryVisibility.state === "visible";
          return from(elementIds).pipe(this.changeElementStateNoChildrenOperator({ on, isDisplayedByDefault }));
        }),
      );
    });

    const ovr = this._props.overrides?.changeElementGroupingNodeState;
    return ovr ? from(ovr(this.createVoidOverrideProps({ node, on }, result))) : result;
  }

  /**
   * Updates visibility of an element and all its child elements by adding them to the always/never drawn list.
   * @note If element is to be enabled and model is hidden, it will be enabled.
   */
  private changeElementState(props: ChangeElementStateProps): Observable<void> {
    const result = defer(() => {
      const { elementId, on, modelId, categoryId } = props;
      const viewport = this._props.viewport;
      return concat(
        props.on && !viewport.view.viewsModel(modelId) ? this.showModelWithoutAnyCategoriesOrElements(modelId) : EMPTY,
        defer(() => {
          const categoryVisibility = this.getDefaultCategoryVisibilityStatus({ categoryId, modelId });
          const isDisplayedByDefault = categoryVisibility.state === "visible";
          return of(elementId).pipe(this.changeElementStateNoChildrenOperator({ on, isDisplayedByDefault }));
        }),
      );
    });

    const ovr = this._props.overrides?.changeElementState;
    return ovr ? from(ovr(this.createVoidOverrideProps(props, result))) : result;
  }

  private changeElementStateNoChildrenOperator(props: { on: boolean; isDisplayedByDefault: boolean }): OperatorFunction<string, void> {
    return (elementIds: Observable<Id64String>) => {
      const { on, isDisplayedByDefault } = props;
      const isAlwaysDrawnExclusive = this._props.viewport.isAlwaysDrawnExclusive;
      return elementIds.pipe(
        reduce(
          (acc, elementId) => {
            if (on) {
              const wasRemoved = acc.neverDrawn.delete(elementId);
              acc.changedNeverDrawn ||= wasRemoved;
              // If exclusive mode is enabled, we must add the element to the always drawn list.
              if ((!isDisplayedByDefault || isAlwaysDrawnExclusive) && !acc.alwaysDrawn.has(elementId)) {
                acc.alwaysDrawn.add(elementId);
                acc.changedAlwaysDrawn = true;
              }
            } else {
              const wasRemoved = acc.alwaysDrawn.delete(elementId);
              acc.changedAlwaysDrawn ||= wasRemoved;
              // If exclusive mode is not enabled, we have to add the element to the never drawn list.
              if (isDisplayedByDefault && !isAlwaysDrawnExclusive && !acc.neverDrawn.has(elementId)) {
                acc.neverDrawn.add(elementId);
                acc.changedNeverDrawn = true;
              }
            }
            return acc;
          },
          {
            changedNeverDrawn: false,
            changedAlwaysDrawn: false,
            neverDrawn: new Set(this._props.viewport.neverDrawn || []),
            alwaysDrawn: new Set(this._props.viewport.alwaysDrawn || []),
          },
        ),
        map((state) => {
          state.changedNeverDrawn && this._props.viewport.setNeverDrawn(state.neverDrawn);
          state.changedAlwaysDrawn && this._props.viewport.setAlwaysDrawn(state.alwaysDrawn, this._props.viewport.isAlwaysDrawnExclusive);
        }),
      );
    };
  }

  private getVisibilityFromAlwaysAndNeverDrawnElementsImpl(
    props: {
      alwaysDrawn: Id64Set | undefined;
      neverDrawn: Id64Set | undefined;
      totalCount: number;
    } & GetVisibilityFromAlwaysAndNeverDrawnElementsProps,
  ): VisibilityStatus {
    const { alwaysDrawn, neverDrawn, totalCount } = props;

    if (neverDrawn?.size === totalCount) {
      return createVisibilityStatus("hidden", props.tooltips.allElementsInNeverDrawnList);
    }

    if (alwaysDrawn?.size === totalCount) {
      return createVisibilityStatus("visible", props.tooltips.allElementsInAlwaysDrawnList);
    }

    const viewport = this._props.viewport;
    if (viewport.isAlwaysDrawnExclusive && viewport.alwaysDrawn?.size) {
      return alwaysDrawn?.size
        ? createVisibilityStatus("partial", props.tooltips.elementsInBothAlwaysAndNeverDrawn)
        : createVisibilityStatus("hidden", props.tooltips.noElementsInExclusiveAlwaysDrawnList);
    }

    const status = props.defaultStatus();
    if ((status.state === "visible" && neverDrawn?.size) || (status.state === "hidden" && alwaysDrawn?.size)) {
      return createVisibilityStatus("partial");
    }
    return status;
  }

  private getVisibilityFromAlwaysAndNeverDrawnElements(
    props: GetVisibilityFromAlwaysAndNeverDrawnElementsProps & ({ elements: Id64Set } | { queryProps: AlwaysOrNeverDrawnElementsQueryProps }),
  ): Observable<VisibilityStatus> {
    const viewport = this._props.viewport;
    if (viewport.isAlwaysDrawnExclusive) {
      if (!viewport?.alwaysDrawn?.size) {
        return of(createVisibilityStatus("hidden", props.tooltips.noElementsInExclusiveAlwaysDrawnList));
      }
    } else if (!viewport?.neverDrawn?.size && !viewport?.alwaysDrawn?.size) {
      return of(props.defaultStatus());
    }

    if ("elements" in props) {
      return of(
        this.getVisibilityFromAlwaysAndNeverDrawnElementsImpl({
          ...props,
          alwaysDrawn: viewport.alwaysDrawn?.size ? setIntersection(props.elements, viewport.alwaysDrawn) : undefined,
          neverDrawn: viewport.neverDrawn?.size ? setIntersection(props.elements, viewport.neverDrawn) : undefined,
          totalCount: props.elements.size,
        }),
      );
    }

    const { modelId, categoryId } = props.queryProps;
    const totalCount = categoryId ? this._idsCache.getCategoryElementsCount(modelId, categoryId) : this._idsCache.getModelElementCount(modelId);
    return forkJoin({
      totalCount,
      alwaysDrawn: this.getAlwaysDrawnElements(props.queryProps),
      neverDrawn: this.getNeverDrawnElements(props.queryProps),
    }).pipe(
      map((state) => {
        return this.getVisibilityFromAlwaysAndNeverDrawnElementsImpl({
          ...props,
          ...state,
        });
      }),
    );
  }

  private getAlwaysDrawnElements(props: AlwaysOrNeverDrawnElementsQueryProps) {
    return this._alwaysAndNeverDrawnElements.getElements({ ...props, setType: "always" });
  }

  private getNeverDrawnElements(props: AlwaysOrNeverDrawnElementsQueryProps) {
    return this._alwaysAndNeverDrawnElements.getElements({ ...props, setType: "never" });
  }

  private clearAlwaysAndNeverDrawnElements(props: Omit<AlwaysOrNeverDrawnElementsQueryProps, "setType">) {
    return forkJoin({
      alwaysDrawn: this.getAlwaysDrawnElements(props),
      neverDrawn: this.getNeverDrawnElements(props),
    }).pipe(
      map(({ alwaysDrawn, neverDrawn }) => {
        const viewport = this._props.viewport;
        if (viewport.alwaysDrawn?.size && alwaysDrawn.size) {
          viewport.setAlwaysDrawn(setDifference(viewport.alwaysDrawn, alwaysDrawn));
        }
        if (viewport.neverDrawn?.size && neverDrawn.size) {
          viewport.setNeverDrawn(setDifference(viewport.neverDrawn, neverDrawn));
        }
      }),
    );
  }

  private createVoidOverrideProps<TProps>(props: TProps, obs: Observable<void>): OverridableMethodProps<(props: TProps) => Promise<void>> {
    return {
      ...props,
      originalImplementation: async () => toVoidPromise(obs),
      handler: this,
    };
  }

  private createOverrideProps<TProps, TObservable extends Observable<any>>(
    props: TProps,
    obs: TObservable,
  ): TObservable extends Observable<infer T> ? OverridableMethodProps<(props: TProps) => Promise<T>> : never;
  private createOverrideProps<TProps, TObservable extends Observable<unknown>>(
    props: TProps,
    obs: TObservable,
  ): OverridableMethodProps<(props: TProps) => Promise<unknown>> {
    return {
      ...props,
      originalImplementation: async () => firstValueFrom(obs),
      handler: this,
    };
  }

  private getGroupingNodeInfo(node: GroupingHierarchyNode) {
    const modelId = ModelsTreeNode.getModelId(node);
    const categoryId = ModelsTreeNode.getCategoryId(node);
    assert(!!modelId && !!categoryId);

    const elementIds = new Set(node.groupedInstanceKeys.map((key) => key.id));
    return { modelId, categoryId, elementIds };
  }

  private async findClassIdInFilterPath(path: HierarchyNodeIdentifiersPath, parentKeys: HierarchyNodeKey[], className: string) {
    function* keysToCheck(): Iterable<InstanceKey> {
      for (let i = path.length - 1; i >= 0; --i) {
        const id = path[i];
        if (HierarchyNodeIdentifier.isInstanceNodeIdentifier(id)) {
          yield id;
        }
      }

      for (let i = parentKeys.length - 1; i >= 0; --i) {
        const key = parentKeys[i];
        if (HierarchyNodeKey.isInstances(key)) {
          yield* key.instanceKeys;
        }
      }
    }

    for (const parentKey of keysToCheck()) {
      if (await this._props.imodelAccess.classDerivesFrom(parentKey.className, className)) {
        return parentKey.id;
      }
    }

    assert(false, () => `Cannot find an instance of ${className} in instance keys: ${JSON.stringify([...keysToCheck()], undefined, 2)}`);
  }
}

interface GetVisibilityFromAlwaysAndNeverDrawnElementsProps {
  tooltips: {
    allElementsInNeverDrawnList: string;
    allElementsInAlwaysDrawnList: string;
    elementsInBothAlwaysAndNeverDrawn: string;
    noElementsInExclusiveAlwaysDrawnList: string;
  };
  /** Status when always/never lists are empty and exclusive mode is off */
  defaultStatus: () => VisibilityStatus;
}

function getVisibilityFromTreeNodeChildren(obs: Observable<Visibility>): Observable<Visibility | "empty"> {
  return obs.pipe(
    reduceWhile(
      (x) => x.allVisible || x.allHidden,
      (acc, val) => {
        acc.allVisible &&= val === "visible";
        acc.allHidden &&= val === "hidden";
        return acc;
      },
      { allVisible: true, allHidden: true },
    ),
    map((x) => {
      if (!x) {
        return "empty";
      }
      return x.allVisible ? "visible" : x.allHidden ? "hidden" : "partial";
    }),
  );
}

function getVisibilityStatusFromTreeNodeChildren(tooltipMap: { [key in Visibility]: string | undefined }): OperatorFunction<Visibility, VisibilityStatus> {
  return (obs) => {
    return getVisibilityFromTreeNodeChildren(obs).pipe(
      map((visibility) => {
        if (visibility === "empty") {
          visibility = "visible";
        }

        return createVisibilityStatus(visibility, tooltipMap[visibility]);
      }),
    );
  };
}

function setDifference<T>(lhs: Set<T>, rhs: Set<T>): Set<T> {
  const result = new Set<T>();
  lhs.forEach((x) => !rhs.has(x) && result.add(x));
  return result;
}

function setIntersection<T>(lhs: Set<T>, rhs: Set<T>): Set<T> {
  const result = new Set<T>();
  lhs.forEach((x) => rhs.has(x) && result.add(x));
  return result;
}

function reduceFilterPaths(filteringPaths: HierarchyFilteringPaths) {
  let paths = filteringPaths.map((filteringPath) => ("path" in filteringPath ? filteringPath.path : filteringPath));
  const sorted = [...paths].sort((a, b) => a.length - b.length);
  paths = [];
  for (const path of sorted) {
    if (!arraySortedByLengthContainsPrefix(paths, path)) {
      paths.push(path);
    }
  }
  return paths;
}

function arraySortedByLengthContainsPrefix(targetArray: HierarchyNodeIdentifiersPath[], source: HierarchyNodeIdentifiersPath) {
  for (const targetVal of targetArray) {
    if (targetVal.length >= source.length) {
      break;
    }

    let isPrefix = true;
    for (let i = 0; i < targetVal.length; ++i) {
      if (!HierarchyNodeIdentifier.equal(targetVal[i], source[i])) {
        isPrefix = false;
        break;
      }
    }

    if (isPrefix) {
      return true;
    }
  }
  return false;
}

/**
 * Enables display of all given models. Also enables display of all categories and clears always and
 * never drawn lists in the viewport.
 * @public
 */
export async function showAllModels(models: string[], viewport: Viewport) {
  await viewport.addViewedModels(models);
  viewport.clearNeverDrawn();
  viewport.clearAlwaysDrawn();
  await toggleAllCategories(IModelApp.viewManager, viewport.iModel, true, viewport, false);
}

/**
 * Disables display of all given models.
 * @public
 */
export async function hideAllModels(models: string[], viewport: Viewport) {
  viewport.changeModelDisplay(models, false);
}

/**
 * Inverts display of all given models.
 * @public
 */
export async function invertAllModels(models: string[], viewport: Viewport) {
  const notViewedModels: string[] = [];
  const viewedModels: string[] = [];
  models.forEach((modelId) => {
    if (viewport.viewsModel(modelId)) {
      viewedModels.push(modelId);
    } else {
      notViewedModels.push(modelId);
    }
  });
  await viewport.addViewedModels(notViewedModels);
  viewport.changeModelDisplay(viewedModels, false);
}

/**
 * Based on the value of `enable` argument, either enables or disables display of given models.
 * @public
 */
export async function toggleModels(models: string[], enable: boolean, viewport: Viewport) {
  // istanbul ignore if
  if (!models) {
    return;
  }
  if (enable) {
    viewport.changeModelDisplay(models, false);
  } else {
    await viewport.addViewedModels(models);
  }
}

/**
 * Checks if all given models are displayed in given viewport.
 * @public
 */
export function areAllModelsVisible(models: string[], viewport: Viewport) {
  return models.length !== 0 ? models.every((id) => viewport.viewsModel(id)) : false;
}
