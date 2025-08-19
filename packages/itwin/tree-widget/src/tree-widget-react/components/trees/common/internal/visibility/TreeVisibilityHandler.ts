/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defaultIfEmpty, EMPTY, filter, firstValueFrom, from, fromEventPattern, map, mergeMap, of, Subject, takeUntil, tap } from "rxjs";
import { HierarchyNodeKey } from "@itwin/presentation-hierarchies";
import { AlwaysAndNeverDrawnElementInfo } from "../AlwaysAndNeverDrawnElementInfo.js";
import { toVoidPromise } from "../Rxjs.js";
import { createVisibilityStatus } from "../Tooltip.js";
import { createVisibilityChangeEventListener } from "../VisibilityChangeEventListener.js";

import type { Observable } from "rxjs";
import type { Id64Arg, Id64String } from "@itwin/core-bentley";
import type { Viewport } from "@itwin/core-frontend";
import type { HierarchyNode } from "@itwin/presentation-hierarchies";
import type { HierarchyVisibilityHandler, HierarchyVisibilityHandlerOverridableMethod, VisibilityStatus } from "../../UseHierarchyVisibility.js";
import type { IVisibilityChangeEventListener } from "../VisibilityChangeEventListener.js";
import type { FilteredTree } from "./BaseFilteredTree.js";

/** @internal */
export interface VisibilityStatusHelper {
  hasSubModel: (elementId: Id64String) => Promise<boolean>;
  getElementsCount: (props: { modelId: Id64String; categoryId: Id64String }) => Observable<number>;
  getSubCategories: (props: { categoryIds: Id64Arg }) => Observable<{ id: Id64String; subCategories: Id64Arg | undefined }>;
  getModels: (props: { categoryIds: Id64Arg }) => Observable<{ id: Id64String; models: Id64Arg | undefined }>;
  getCategories: (props: { modelIds: Id64Arg }) => Observable<{ id: Id64String; drawingCategories?: Id64Arg; spatialCategories?: Id64Arg }>;
  getSubModels: (
    props: { modelIds: Id64Arg } | { categoryIds: Id64Arg; modelId: Id64String | undefined },
  ) => Observable<{ id: Id64String; subModels: Id64Arg | undefined }>;
}

/**
 * Functionality of tree visibility handler methods that can be overridden.
 * Each callback is provided original implementation and reference to a `HierarchyVisibilityHandler`.
 * @internal
 */
export interface BaseTreeVisibilityHandlerOverrides {
  getModelsVisibilityStatus?: HierarchyVisibilityHandlerOverridableMethod<(props: { modelIds: Id64Arg }) => Promise<VisibilityStatus>>;
  getCategoriesVisibilityStatus?: HierarchyVisibilityHandlerOverridableMethod<
    (props: { categoryIds: Id64Arg; modelId?: Id64String }) => Promise<VisibilityStatus>
  >;
  getElementsVisibilityStatus?: HierarchyVisibilityHandlerOverridableMethod<
    (props: { elementIds: Id64Arg; modelId: Id64String; categoryId: Id64String }) => Promise<VisibilityStatus>
  >;

  changeModelsVisibilityStatus?: HierarchyVisibilityHandlerOverridableMethod<(props: { modelIds: Id64Arg; on: boolean }) => Promise<void>>;
  changeCategoriesVisibilityStatus?: HierarchyVisibilityHandlerOverridableMethod<
    (props: { categoryIds: Id64Arg; modelId?: Id64String; on: boolean }) => Promise<void>
  >;
  changeElementsVisibilityStatus?: HierarchyVisibilityHandlerOverridableMethod<
    (props: { elementIds: Id64Arg; modelId: Id64String; categoryId: Id64String; on: boolean }) => Promise<void>
  >;
}

/**
 * Interface for a tree visibility handler that provides methods to get and change visibility status of hierarchy nodes.
 * @internal
 */
export interface TreeNodesVisibilityStatusHandler<TFilterTargets> {
  getVisibilityStatusObs: (node: HierarchyNode) => Observable<VisibilityStatus>;
  changeVisibilityStatusObs: (node: HierarchyNode, on: boolean) => Observable<void>;
  getFilterTargetsVisibilityStatusObs: (targets: TFilterTargets) => Observable<VisibilityStatus>;
  changeFilterTargetsVisibilityStatusObs: (targets: TFilterTargets, on: boolean) => Observable<void>;
}

/**
 * @internal
 */
export interface TreeVisibilityHandlerProps<TFilterTargets> {
  viewport: Viewport;
  getTreeNodesVisibilityStatusHandler: (
    info: AlwaysAndNeverDrawnElementInfo,
    visibilityHandler: HierarchyVisibilityHandler,
  ) => TreeNodesVisibilityStatusHandler<TFilterTargets> & Disposable;
  getFilteredTree: () => Promise<FilteredTree<TFilterTargets>> | undefined;
}

/**
 * Class that handles visibility of hierarchy nodes in a tree.
 *
 * - It provides methods to get and change visibility status of nodes.
 * - Also handles filtered tree nodes visibility.
 * - Listens to visibility change events and updates visibility status accordingly.
 * @internal
 */
export class TreeVisibilityHandler<TFilterTargets> implements HierarchyVisibilityHandler, Disposable {
  private readonly _eventListener: IVisibilityChangeEventListener;
  private readonly _alwaysAndNeverDrawnElements;
  private _nodesVisibilityStatusHandler: TreeNodesVisibilityStatusHandler<TFilterTargets> & Disposable;
  private _changeRequest = new Subject<{ key: HierarchyNodeKey; depth: number }>();
  private _filteredTree: Promise<FilteredTree<TFilterTargets>> | undefined;

  constructor(private readonly _props: TreeVisibilityHandlerProps<TFilterTargets>) {
    this._eventListener = createVisibilityChangeEventListener({
      viewport: _props.viewport,
      listeners: {
        models: true,
        categories: true,
        elements: true,
        displayStyle: true,
      },
    });
    this._alwaysAndNeverDrawnElements = new AlwaysAndNeverDrawnElementInfo(_props.viewport);
    this._nodesVisibilityStatusHandler = this._props.getTreeNodesVisibilityStatusHandler(this._alwaysAndNeverDrawnElements, this);
    this._filteredTree = this._props.getFilteredTree();
  }

  public get onVisibilityChange() {
    return this._eventListener.onVisibilityChange;
  }

  public async getVisibilityStatus(node: HierarchyNode): Promise<VisibilityStatus> {
    return firstValueFrom(
      this.getVisibilityStatusObs(node).pipe(
        // unsubscribe from the observable if the change request for this node is received
        takeUntil(this._changeRequest.pipe(filter(({ key, depth }) => depth === node.parentKeys.length && HierarchyNodeKey.equals(node.key, key)))),
        // unsubscribe if visibility changes
        takeUntil(
          fromEventPattern(
            (handler) => {
              this._eventListener.onVisibilityChange.addListener(handler);
            },
            (handler) => {
              this._eventListener.onVisibilityChange.removeListener(handler);
            },
          ),
        ),
        defaultIfEmpty(createVisibilityStatus("hidden")),
      ),
    );
  }

  public async changeVisibility(node: HierarchyNode, shouldDisplay: boolean): Promise<void> {
    // notify about new change request
    this._changeRequest.next({ key: node.key, depth: node.parentKeys.length });

    const changeObservable = this.changeVisibilityStatusObs(node, shouldDisplay).pipe(
      // unsubscribe from the observable if the change request for this node is received
      takeUntil(this._changeRequest.pipe(filter(({ key, depth }) => depth === node.parentKeys.length && HierarchyNodeKey.equals(node.key, key)))),
      tap({
        subscribe: () => {
          this._eventListener.suppressChangeEvents();
          this._alwaysAndNeverDrawnElements.suppressChangeEvents();
        },
        finalize: () => {
          this._eventListener.resumeChangeEvents();
          this._alwaysAndNeverDrawnElements.resumeChangeEvents();
        },
      }),
    );

    return toVoidPromise(changeObservable);
  }

  public [Symbol.dispose]() {
    this._eventListener[Symbol.dispose]();
    this._alwaysAndNeverDrawnElements[Symbol.dispose]();
    this._nodesVisibilityStatusHandler[Symbol.dispose]();
  }

  private getVisibilityStatusObs(node: HierarchyNode) {
    if (node.filtering?.filteredChildrenIdentifierPaths?.length && !node.filtering.isFilterTarget) {
      return this.getFilteredNodeVisibility({ node });
    }
    return this._nodesVisibilityStatusHandler.getVisibilityStatusObs(node);
  }

  private changeVisibilityStatusObs(node: HierarchyNode, on: boolean): Observable<void> {
    if (node.filtering?.filteredChildrenIdentifierPaths?.length && !node.filtering.isFilterTarget) {
      return this.changeFilteredNodeVisibility({ node, on });
    }
    return this._nodesVisibilityStatusHandler.changeVisibilityStatusObs(node, on);
  }

  private getFilteredNodeVisibility(props: { node: HierarchyNode }) {
    return this.getFilteredTreeTargets(props).pipe(
      mergeMap((targets) => {
        if (!targets) {
          return EMPTY;
        }
        return this._nodesVisibilityStatusHandler.getFilterTargetsVisibilityStatusObs(targets);
      }),
    );
  }

  private getFilteredTreeTargets({ node }: { node: HierarchyNode }): Observable<TFilterTargets | undefined> {
    if (!this._filteredTree) {
      return of(undefined);
    }
    return from(this._filteredTree).pipe(map((filteredTree) => filteredTree.getFilterTargets(node)));
  }

  private changeFilteredNodeVisibility({ on, node }: { on: boolean; node: HierarchyNode }) {
    return this.getFilteredTreeTargets({ node }).pipe(
      mergeMap((targets) => {
        if (!targets) {
          return EMPTY;
        }
        return this._nodesVisibilityStatusHandler.changeFilterTargetsVisibilityStatusObs(targets, on);
      }),
    );
  }
}
