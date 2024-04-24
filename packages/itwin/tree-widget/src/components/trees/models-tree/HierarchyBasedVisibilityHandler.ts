/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { concat, concatWith, defer, EMPTY, filter, firstValueFrom, forkJoin, from, map, merge, mergeMap, of, reduce } from "rxjs";
import { PerModelCategoryVisibility } from "@itwin/core-frontend";
import { NodeKey } from "@itwin/presentation-common";
import { isPresentationTreeNodeItem } from "@itwin/presentation-components";
import { reduceWhile, toSet, toVoidPromise } from "../common/Rxjs";
import { createSubjectModelIdsCache } from "./internal/SubjectModelIdsCache";
import { createVisibilityStatus } from "./internal/Tooltip";
import { createVisibilityChangeEventListener } from "./internal/VisibilityChangeEventListener";
import { NodeUtils } from "./NodeUtils";

import type { IVisibilityChangeEventListener } from "./internal/VisibilityChangeEventListener";
import type { Viewport } from "@itwin/core-frontend";
import type { SubjectModelIdsCache } from "./internal/SubjectModelIdsCache";
import type { Visibility } from "./internal/Tooltip";
import type { IQueryHandler as IQueryHandler } from "./internal/QueryHandler";
import type { IElementIdsCache } from "./internal/ElementIdsCache";
import type { Id64Arg, Id64Set, Id64String } from "@itwin/core-bentley";
import type { ECClassGroupingNodeKey } from "@itwin/presentation-common";
import type { IVisibilityHandler, VisibilityStatus } from "../VisibilityTreeEventHandler";
import type { TreeNodeItem } from "@itwin/components-react";
import type { Observable, OperatorFunction } from "rxjs";

interface GetCategoryStatusProps {
  categoryId: Id64String;
  modelId: Id64String | undefined;
  hasChildren?: boolean;
}

interface ChangeCategoryStateProps {
  categoryId: Id64String;
  modelId: Id64String | undefined;
  on: boolean;
}

interface ChangeElementStateProps {
  elementId: Id64String;
  categoryId: Id64String | undefined;
  modelId: Id64String | undefined;
  hasChildren?: boolean;
  on: boolean;
}

interface ChangeModelStateProps {
  ids: Id64Arg;
  on: boolean;
  categoriesFilter?: (id: Id64String) => boolean;
}

type OverriddenMethodProps<TFunc> = TFunc extends (props: infer TProps) => infer TResult ? (props: TProps, originalImpl: () => TResult) => TResult : never;

export interface VisibilityHandlerOverrides {
  getSubjectNodeVisibility?: OverriddenMethodProps<(props: { node: TreeNodeItem; ids: Id64Set }) => Promise<VisibilityStatus>>;
  getModelDisplayStatus?: OverriddenMethodProps<(props: { id: Id64String }) => Promise<VisibilityStatus>>;
  getCategoryDisplayStatus?: OverriddenMethodProps<(props: GetCategoryStatusProps) => Promise<VisibilityStatus>>;
  getElementGroupingNodeDisplayStatus?: OverriddenMethodProps<(props: { key: ECClassGroupingNodeKey }) => Promise<VisibilityStatus>>;
  getElementDisplayStatus?: OverriddenMethodProps<(props: { id: Id64String; hasChildren?: boolean }) => Promise<VisibilityStatus | undefined>>;

  changeSubjectNodeState?: OverriddenMethodProps<(props: { node: TreeNodeItem; ids: Id64Set; on: boolean }) => Promise<void>>;
  /**
   * Should change model visibility and also for all it's categories.
   * If categories filter is specified, then only those category IDs should be affected.
   */
  changeModelState?: OverriddenMethodProps<(props: ChangeModelStateProps) => Promise<void>>;
  changeCategoryState?: OverriddenMethodProps<(props: ChangeCategoryStateProps) => Promise<void>>;
  changeElementGroupingNodeState?: OverriddenMethodProps<(props: { key: ECClassGroupingNodeKey; on: boolean }) => Promise<void>>;
  changeElementState?: OverriddenMethodProps<(props: ChangeElementStateProps) => Promise<void>>;
}

export interface HierarchyBasedVisibilityHandlerProps {
  viewport: Viewport;
  elementIdsCache: IElementIdsCache;
  queryHandler: IQueryHandler;
  overrides?: VisibilityHandlerOverrides;
}

export type IHierarchyBasedVisibilityHandler = IVisibilityHandler;

export function createHierarchyBasedVisibilityHandler(props: HierarchyBasedVisibilityHandlerProps): IHierarchyBasedVisibilityHandler {
  return new VisibilityHandlerImplementation(props);
}

class VisibilityHandlerImplementation implements IVisibilityHandler {
  private readonly _subjectModelIdsCache: SubjectModelIdsCache;
  private readonly _eventListener: IVisibilityChangeEventListener;
  private _removePresentationHierarchyListener?: () => void;

  constructor(private readonly _props: HierarchyBasedVisibilityHandlerProps) {
    this._subjectModelIdsCache = createSubjectModelIdsCache(_props.queryHandler);
    this._eventListener = createVisibilityChangeEventListener(_props.viewport);
  }

  public get onVisibilityChange() {
    return this._eventListener.onVisibilityChange;
  }

  public async getVisibilityStatus(node: TreeNodeItem): Promise<VisibilityStatus> {
    return firstValueFrom(this.getVisibilityStatusObs(node));
  }

  public async changeVisibility(node: TreeNodeItem, shouldDisplay: boolean): Promise<void> {
    return toVoidPromise(this.changeVisibilityObs(node, shouldDisplay));
  }

  public dispose(): void {
    this._eventListener.dispose();
    this._removePresentationHierarchyListener?.();
  }

  private getVisibilityStatusObs(node: TreeNodeItem): Observable<VisibilityStatus> {
    if (!isPresentationTreeNodeItem(node)) {
      return createVisibilityStatusObs("disabled");
    }

    const nodeKey = node.key;
    if (NodeKey.isClassGroupingNodeKey(nodeKey)) {
      return from(this.getElementGroupingNodeDisplayStatus(nodeKey));
    }

    if (!NodeKey.isInstancesNodeKey(nodeKey)) {
      return createVisibilityStatusObs("disabled");
    }

    if (NodeUtils.isSubjectNode(node)) {
      // note: subject nodes may be merged to represent multiple subject instances
      return this.getSubjectNodeVisibilityStatus(node, from(nodeKey.instanceKeys).pipe(map((key) => key.id)));
    }

    if (NodeUtils.isModelNode(node)) {
      return this.getModelVisibilityStatus(nodeKey.instanceKeys[0].id);
    }

    if (NodeUtils.isCategoryNode(node)) {
      return this.getCategoryDisplayStatus({
        categoryId: nodeKey.instanceKeys[0].id,
        modelId: NodeUtils.getModelId(node),
      });
    }

    return this.getElementDisplayStatus(nodeKey.instanceKeys[0].id, node.hasChildren).pipe(
      map((status) => {
        if (status) {
          return status;
        }
        const categoryId = NodeUtils.getElementCategoryId(node);
        const modelId = NodeUtils.getModelId(node);
        if (!categoryId || !modelId) {
          return createVisibilityStatus("disabled");
        }
        return this.getDefaultCategoryVisibilityStatus(categoryId, modelId);
      }),
    );
  }

  private getSubjectNodeVisibilityStatus(node: TreeNodeItem, subjectIds: Observable<Id64String>): Observable<VisibilityStatus> {
    const result = defer(() => {
      if (!this._props.viewport.view.isSpatialView()) {
        return of(createVisibilityStatus("disabled", "subject.nonSpatialView"));
      }

      return subjectIds.pipe(
        mergeMap((id) => this._subjectModelIdsCache.getSubjectModelIdObs(id)),
        mergeMap((x) => this.getModelVisibilityStatus(x)),
        map((x) => x.state),
        getVisibilityStatusFromChildren({
          visible: "subject.allModelsVisible",
          hidden: "subject.allModelsHidden",
          partial: "subject.someModelsHidden",
        }),
      );
    });

    const ovr = this._props.overrides?.getSubjectNodeVisibility;
    return ovr
      ? subjectIds.pipe(
          toSet(),
          mergeMap(async (ids) => ovr({ node, ids }, async () => firstValueFrom(result))),
        )
      : result;
  }

  private getModelVisibilityStatus(modelId: Id64String): Observable<VisibilityStatus> {
    const result = defer(() => this.getModelVisibilityStatusImpl(modelId));
    const ovr = this._props.overrides?.getModelDisplayStatus;
    return ovr ? from(ovr({ id: modelId }, async () => firstValueFrom(result))) : result;
  }

  private getModelVisibilityStatusImpl(modelId: Id64String): Observable<VisibilityStatus> {
    const viewport = this._props.viewport;
    if (!viewport.view.isSpatialView()) {
      return of(createVisibilityStatus("disabled", "model.nonSpatialView"));
    }

    return this._props.queryHandler.queryModelCategories(modelId).pipe(
      map((categoryId) => this.getDefaultCategoryVisibilityStatus(categoryId, modelId)),
      map((x) => x.state),
      getVisibilityFromChildren,
      mergeMap((visibilityByCategories) => {
        const modelVisible = viewport.view.viewsModel(modelId);

        // istanbul ignore if
        if (visibilityByCategories === "empty") {
          // TODO: Is this possible?
          return createVisibilityStatusObs(modelVisible ? "visible" : "hidden");
        }

        // If different categories have different visibilities,
        // then there's no need to check for children.
        if (visibilityByCategories === "partial") {
          return createVisibilityStatusObs(visibilityByCategories);
        }

        // We need to check if model's state is partially visible.
        // Instead of recursively checking each element of each category,
        // we only have to look at the always and never drawn lists.

        const alwaysDrawn = viewport.alwaysDrawn;
        const neverDrawn = viewport.neverDrawn;
        if (!alwaysDrawn && !neverDrawn) {
          return createVisibilityStatusObs(visibilityByCategories);
        }

        if (!modelVisible) {
          return this.getAlwaysDrawnChildren(modelId).pipe(
            mergeMap((ad) => {
              // Model is hidden and there are no always drawn children => model is fully hidden.
              if (!ad.size) {
                return createVisibilityStatusObs(visibilityByCategories);
              }

              return this._props.queryHandler
                .queryModelElementsCount(modelId)
                .pipe(map((count) => createVisibilityStatus(ad.size === count ? "visible" : "partial")));
            }),
          );
        }

        return forkJoin({
          neverDrawnChildren: this.getNeverDrawnChildren(modelId),
          totalCount: this._props.queryHandler.queryModelElementsCount(modelId),
        }).pipe(
          mergeMap(({ neverDrawnChildren, totalCount }) => {
            // Model is visible but all children are in the never drawn list.
            if (neverDrawnChildren.size === totalCount) {
              return createVisibilityStatusObs("hidden");
            }

            // Some children are in the never drawn list.
            if (neverDrawnChildren.size) {
              return createVisibilityStatusObs("partial");
            }

            if (!this._props.viewport.isAlwaysDrawnExclusive || !alwaysDrawn?.size) {
              return createVisibilityStatusObs(visibilityByCategories);
            }

            return this.getAlwaysDrawnChildren(modelId).pipe(
              map((alwaysDrawnChildren) => {
                // No children in exclusive always drawn set => model is hidden
                if (alwaysDrawnChildren.size === 0) {
                  return createVisibilityStatus("hidden");
                }

                // All children in exclusive always drawn set => model is visible
                if (alwaysDrawnChildren.size === totalCount) {
                  return createVisibilityStatus(visibilityByCategories);
                }

                return createVisibilityStatus("partial");
              }),
            );
          }),
        );
      }),
    );
  }

  private getCategoryViewportVisibilityStatus(categoryId: Id64String) {
    const isVisible = this._props.viewport.view.viewsCategory(categoryId);
    return isVisible
      ? createVisibilityStatus("visible", "category.visibleThroughCategorySelector")
      : createVisibilityStatus("hidden", "category.hiddenThroughCategorySelector");
  }

  private getDefaultCategoryVisibilityStatus(categoryId: Id64String, modelId: Id64String | undefined): VisibilityStatus {
    if (!modelId) {
      return this.getCategoryViewportVisibilityStatus(categoryId);
    }

    switch (this._props.viewport.perModelCategoryVisibility.getOverride(modelId, categoryId)) {
      case PerModelCategoryVisibility.Override.Show:
        return createVisibilityStatus("visible");
      case PerModelCategoryVisibility.Override.Hide:
        return createVisibilityStatus("hidden");
    }

    return this.getCategoryViewportVisibilityStatus(categoryId);
  }

  private getCategoryDisplayStatus(props: GetCategoryStatusProps): Observable<VisibilityStatus> {
    const result = defer(() => {
      const defaultStatus = this.getDefaultCategoryVisibilityStatus(props.categoryId, props.modelId);
      if (props.hasChildren === false) {
        return of(defaultStatus);
      }

      return this._props.queryHandler.queryCategoryElements(props.categoryId, props.modelId).pipe(
        mergeMap((x) => this.getElementDisplayStatus(x.id, x.hasChildren)),
        map((x) => x?.state ?? defaultStatus.state),
        getVisibilityStatusFromChildren({
          visible: undefined,
          hidden: "category.allChildrenAreHidden",
          partial: "category.someChildrenAreHidden",
          empty: () => defaultStatus,
        }),
      );
    });

    const ovr = this._props.overrides?.getCategoryDisplayStatus;
    return ovr ? from(ovr(props, async () => firstValueFrom(result))) : result;
  }

  private getElementGroupingNodeDisplayStatus(key: ECClassGroupingNodeKey): Observable<VisibilityStatus> {
    const result = defer(() =>
      this._props.elementIdsCache.getGroupedElementIds(key).pipe(
        mergeMap(({ elementIds }) => elementIds),
        mergeMap((x) => this.getElementDisplayStatus(x)),
        map((x) => x?.state ?? "visible"),
        getVisibilityStatusFromChildren({
          visible: undefined,
          hidden: "element.allChildrenAreHidden",
          partial: "element.someChildrenAreHidden",
        }),
      ),
    );

    const ovr = this._props.overrides?.getElementGroupingNodeDisplayStatus;
    return ovr ? from(ovr({ key }, async () => firstValueFrom(result))) : result;
  }

  /**
   * Returns element visibility status if it can affect parent's visibility.
   */
  private getElementOverriddenVisibility(id: Id64String): VisibilityStatus | undefined {
    const viewport = this._props.viewport;
    if (viewport.neverDrawn?.has(id)) {
      return createVisibilityStatus("hidden", "element.hiddenThroughNeverDrawnList");
    }

    if (viewport.alwaysDrawn?.size) {
      if (viewport.alwaysDrawn.has(id)) {
        return createVisibilityStatus("visible", "element.displayedThroughAlwaysDrawnList");
      }

      if (viewport.isAlwaysDrawnExclusive) {
        return createVisibilityStatus("hidden", "element.hiddenDueToOtherElementsExclusivelyAlwaysDrawn");
      }
    }

    return undefined;
  }

  private getElementDisplayStatus(id: Id64String, hasChildren?: boolean): Observable<VisibilityStatus | undefined> {
    const result = defer(() => {
      if (hasChildren === false) {
        return of(this.getElementOverriddenVisibility(id));
      }

      return this._props.elementIdsCache.getAssemblyElementIds(id).pipe(
        map((x) => this.getElementOverriddenVisibility(x)?.state),
        filter((x): x is Exclude<typeof x, undefined> => !!x),
        getVisibilityStatusFromChildren({
          visible: undefined,
          hidden: "element.allChildrenAreHidden",
          partial: "element.someChildrenAreHidden",
          empty: () => this.getElementOverriddenVisibility(id),
        }),
      );
    });

    const ovr = this._props.overrides?.getElementDisplayStatus;
    return ovr ? from(ovr({ id, hasChildren }, async () => firstValueFrom(result))) : result;
  }

  /** Changes visibility of the items represented by the tree node. */
  private changeVisibilityObs(node: TreeNodeItem, on: boolean): Observable<void> {
    if (!isPresentationTreeNodeItem(node)) {
      return EMPTY;
    }
    const nodeKey = node.key;

    if (NodeKey.isClassGroupingNodeKey(nodeKey)) {
      return this.changeElementGroupingNodeState(nodeKey, on);
    }

    if (!NodeKey.isInstancesNodeKey(nodeKey)) {
      return EMPTY;
    }

    if (NodeUtils.isSubjectNode(node)) {
      return this.changeSubjectNodeState(from(nodeKey.instanceKeys).pipe(map((key) => key.id)), node, on);
    }

    if (NodeUtils.isModelNode(node)) {
      return this.changeModelState({ ids: nodeKey.instanceKeys[0].id, on });
    }

    if (NodeUtils.isCategoryNode(node)) {
      return this.changeCategoryState({
        categoryId: nodeKey.instanceKeys[0].id,
        modelId: NodeUtils.getModelId(node),
        on,
      });
    }

    return this.changeElementState({
      elementId: nodeKey.instanceKeys[0].id,
      modelId: NodeUtils.getModelId(node),
      categoryId: NodeUtils.getElementCategoryId(node),
      hasChildren: node.hasChildren,
      on,
    });
  }

  private changeSubjectNodeState(ids: Observable<Id64String>, node: TreeNodeItem, on: boolean): Observable<void> {
    const result = defer(() => {
      if (!this._props.viewport.view.isSpatialView()) {
        return EMPTY;
      }
      return ids.pipe(
        mergeMap((x) => this._subjectModelIdsCache.getSubjectModelIdObs(x)),
        toSet(),
        mergeMap((modelId) => this.changeModelState({ ids: modelId, on })),
      );
    });

    const ovr = this._props.overrides?.changeSubjectNodeState;
    return ovr
      ? ids.pipe(
          toSet(),
          mergeMap(async (idSet) => ovr({ ids: idSet, node, on }, async () => firstValueFrom(result))),
        )
      : result;
  }

  private changeModelState(props: ChangeModelStateProps): Observable<void> {
    const result = this.changeModelStateImpl(props);
    const ovr = this._props.overrides?.changeModelState;
    return ovr ? from(ovr(props, async () => toVoidPromise(result))) : result;
  }

  private changeModelStateImpl({ ids: ids, on: visible, categoriesFilter }: ChangeModelStateProps): Observable<void> {
    const viewport = this._props.viewport;
    if (!viewport.view.isSpatialView()) {
      return EMPTY;
    }

    return concat(
      defer(() => {
        viewport.perModelCategoryVisibility.clearOverrides(ids);
        if (visible) {
          return from(viewport.addViewedModels(ids));
        }

        viewport.changeModelDisplay(ids, false);
        return EMPTY;
      }),
      (typeof ids === "string" ? of(ids) : from(ids)).pipe(
        mergeMap((modelId) => {
          const observables = new Array<Observable<void>>();

          if (viewport.alwaysDrawn?.size) {
            observables.push(this.clearAlwaysDrawnChildren(modelId));
          }

          if (viewport.neverDrawn?.size) {
            observables.push(this.clearNeverDrawnChildren(modelId));
          }

          observables.push(
            this._props.queryHandler.queryModelCategories(modelId).pipe(
              filter((id) => !categoriesFilter || categoriesFilter(id)),
              toSet(),
              map((categories) => viewport.changeCategoryDisplay(categories, visible, true)),
            ),
          );
          return observables.length ? merge(...observables) : EMPTY;
        }),
      ),
    );
  }

  private changeCategoryState(props: ChangeCategoryStateProps): Observable<void> {
    const result = defer(() => {
      const viewport = this._props.viewport;
      const { modelId, categoryId, on } = props;
      if (!modelId) {
        viewport.changeCategoryDisplay(categoryId, on, on);
        return EMPTY;
      }

      const isDisplayedInSelector = this._props.viewport.view.viewsCategory(categoryId);
      const override =
        on === isDisplayedInSelector
          ? PerModelCategoryVisibility.Override.None
          : on
            ? PerModelCategoryVisibility.Override.Show
            : PerModelCategoryVisibility.Override.Hide;
      this._props.viewport.perModelCategoryVisibility.setOverride(modelId, categoryId, override);
      if (override === PerModelCategoryVisibility.Override.None && on) {
        // we took off the override which means the category is displayed in selector, but
        // doesn't mean all its subcategories are displayed - this call ensures that
        this._props.viewport.changeCategoryDisplay(categoryId, true, true);
      }
      return EMPTY;
    });

    const ovr = this._props.overrides?.changeCategoryState;
    return ovr ? from(ovr(props, async () => toVoidPromise(result))) : result;
  }

  private changeElementGroupingNodeState(key: ECClassGroupingNodeKey, on: boolean): Observable<void> {
    const result = defer(() => {
      return this._props.elementIdsCache.getGroupedElementIds(key).pipe(
        mergeMap(({ modelId, categoryId, elementIds }) => {
          return elementIds.pipe(mergeMap((elementId) => this.changeElementState({ elementId, on, modelId, categoryId })));
        }),
      );
    });

    const ovr = this._props.overrides?.changeElementGroupingNodeState;
    return ovr ? from(ovr({ key, on }, async () => toVoidPromise(result))) : result;
  }

  /**
   * Update visibility of an element and all its child elements by adding them to the always/never drawn list.
   */
  private changeElementState(props: ChangeElementStateProps): Observable<void> {
    const result = defer(() => {
      const { elementId, on, hasChildren, modelId, categoryId } = props;
      if (!modelId || !categoryId) {
        // TODO: Is this possible?
        return EMPTY;
      }

      const viewport = this._props.viewport;
      const modelVisible = viewport.view.viewsModel(modelId);
      const categoryVisible = viewport.view.viewsCategory(categoryId);
      return of(elementId).pipe(
        concatWith(hasChildren === false ? EMPTY : from(this._props.elementIdsCache.getAssemblyElementIds(elementId))),
        this.changeElementStateNoChildrenOperator({ on, isDisplayedByDefault: modelVisible && categoryVisible }),
      );
    });

    const ovr = this._props.overrides?.changeElementState;
    return ovr ? from(ovr(props, async () => toVoidPromise(result))) : result;
  }

  private changeElementStateNoChildrenOperator(props: { on: boolean; isDisplayedByDefault: boolean }): OperatorFunction<string, void> {
    return (elementIds: Observable<string>) => {
      const { on, isDisplayedByDefault } = props;
      const isAlwaysDrawnExclusive = this._props.viewport.isAlwaysDrawnExclusive;
      return elementIds.pipe(
        reduce(
          (acc, elementId) => {
            if (on) {
              acc.changedNeverDrawn ||= acc.neverDrawn.delete(elementId);
              // If exclusive mode is enabled, we must add the element to the always drawn list.
              if ((!isDisplayedByDefault || isAlwaysDrawnExclusive) && !acc.alwaysDrawn.has(elementId)) {
                acc.alwaysDrawn.add(elementId);
                acc.changedAlwaysDrawn = true;
              }
            } else {
              acc.changedAlwaysDrawn ||= acc.alwaysDrawn.delete(elementId);
              // If exclusive mode is enabled, we don't have to add the element to the never drawn list.
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

  private getAlwaysDrawnChildren(modelId: string): Observable<Id64Set> {
    const alwaysDrawn = this._props.viewport.alwaysDrawn;
    return (alwaysDrawn?.size ? this._props.queryHandler.queryModelElements(modelId, alwaysDrawn) : EMPTY).pipe(toSet());
  }

  private clearAlwaysDrawnChildren(modelId: string): Observable<void> {
    return this.getAlwaysDrawnChildren(modelId).pipe(
      map((children) => {
        if (children.size) {
          const viewport = this._props.viewport;
          viewport.setAlwaysDrawn(setDifference(viewport.alwaysDrawn!, children));
        }
      }),
    );
  }

  private getNeverDrawnChildren(modelId: string) {
    const neverDrawn = this._props.viewport.neverDrawn;
    return (neverDrawn?.size ? this._props.queryHandler.queryModelElements(modelId, neverDrawn) : EMPTY).pipe(toSet());
  }

  private clearNeverDrawnChildren(modelId: string): Observable<void> {
    return this.getNeverDrawnChildren(modelId).pipe(
      map((children) => {
        if (children.size) {
          const viewport = this._props.viewport;
          viewport.setNeverDrawn(setDifference(viewport.neverDrawn!, children));
        }
      }),
    );
  }
}

const createVisibilityStatusObs = (status: Visibility | "disabled", tooltipStringId?: string) => of(createVisibilityStatus(status, tooltipStringId));

function getVisibilityFromChildren(obs: Observable<Visibility>): Observable<Visibility | "empty"> {
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

function getVisibilityStatusFromChildren<TEmpty = never>(
  tooltipMap: { [key in Visibility]: string | undefined } & {
    empty?: () => TEmpty;
  },
): OperatorFunction<Visibility, VisibilityStatus | TEmpty> {
  return (obs) => {
    return getVisibilityFromChildren(obs).pipe(
      map((visibility) => {
        if (visibility === "empty") {
          const res = tooltipMap.empty;
          if (res) {
            return res();
          }
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
