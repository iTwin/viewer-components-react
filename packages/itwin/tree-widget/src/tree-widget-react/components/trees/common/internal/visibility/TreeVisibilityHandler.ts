/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { Observable } from "rxjs";
import { defaultIfEmpty, EMPTY, filter, firstValueFrom, from, fromEventPattern, map, mergeMap, of, Subject, takeUntil, tap } from "rxjs";
import { HierarchyNodeKey } from "@itwin/presentation-hierarchies";
import { AlwaysAndNeverDrawnElementInfo } from "../AlwaysAndNeverDrawnElementInfo.js";
import { toVoidPromise } from "../Rxjs.js";
import { createVisibilityStatus } from "../Tooltip.js";
import { createVisibilityChangeEventListener } from "../VisibilityChangeEventListener.js";

import type { HierarchyNode } from "@itwin/presentation-hierarchies";
import type { HierarchyVisibilityHandler, VisibilityStatus } from "../../UseHierarchyVisibility.js";
import type { IVisibilityChangeEventListener } from "../VisibilityChangeEventListener.js";
import type { Viewport } from "@itwin/core-frontend";

export interface NodesVisibilityStatusHandler<TFilterTargets> {
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
  getNodesVisibilityStatusHandler: (info: AlwaysAndNeverDrawnElementInfo) => NodesVisibilityStatusHandler<TFilterTargets> & Disposable;
  getFilteredTree: () => Promise<FilteredTree<TFilterTargets>> | undefined;
}

/** @internal */
export interface FilteredVisibilityTargets<TFilterTargets> {
  targets?: TFilterTargets;
}

/** @internal */
export interface FilteredTree<TFilterTargets> {
  getFilterTargets(node: HierarchyNode): FilteredVisibilityTargets<TFilterTargets>;
}

export class TreeVisibilityHandler<TFilterTargets> implements HierarchyVisibilityHandler, Disposable {
  private readonly _eventListener: IVisibilityChangeEventListener;
  private readonly _alwaysAndNeverDrawnElements;
  private _nodesVisibilityStatusHandler: NodesVisibilityStatusHandler<TFilterTargets> & Disposable;
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
    this._nodesVisibilityStatusHandler = this._props.getNodesVisibilityStatusHandler(this._alwaysAndNeverDrawnElements);
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
      mergeMap(({ targets }) => {
        if (!targets) {
          return EMPTY;
        }
        return this._nodesVisibilityStatusHandler.getFilterTargetsVisibilityStatusObs(targets);
      }),
    );
  }

  private getFilteredTreeTargets({ node }: { node: HierarchyNode }): Observable<FilteredVisibilityTargets<TFilterTargets>> {
    if (!this._filteredTree) {
      return of({});
    }
    return from(this._filteredTree).pipe(map((filteredTree) => filteredTree.getFilterTargets(node)));
  }

  private changeFilteredNodeVisibility({ on, node }: { on: boolean; node: HierarchyNode }) {
    return this.getFilteredTreeTargets({ node }).pipe(
      mergeMap(({ targets }) => {
        if (!targets) {
          return EMPTY;
        }
        return this._nodesVisibilityStatusHandler.changeFilterTargetsVisibilityStatusObs(targets, on);
      }),
    );
  }
}
