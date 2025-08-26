/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useState } from "react";
import { defaultIfEmpty, EMPTY, filter, firstValueFrom, from, fromEventPattern, map, mergeMap, of, Subject, takeUntil, tap } from "rxjs";
import { HierarchyNodeKey } from "@itwin/presentation-hierarchies";
import { HierarchyVisibilityOverrideHandler } from "../../UseHierarchyVisibility.js";
import { AlwaysAndNeverDrawnElementInfo } from "../AlwaysAndNeverDrawnElementInfo.js";
import { toVoidPromise } from "../Rxjs.js";
import { createVisibilityStatus } from "../Tooltip.js";
import { createVisibilityChangeEventListener } from "../VisibilityChangeEventListener.js";

import type { Observable } from "rxjs";
import type { Viewport } from "@itwin/core-frontend";
import type { HierarchyFilteringPath, HierarchyNode } from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector } from "@itwin/presentation-shared";
import type { VisibilityTreeProps } from "../../components/VisibilityTree.js";
import type { HierarchyVisibilityHandler, VisibilityStatus } from "../../UseHierarchyVisibility.js";
import type { FilteredTree } from "../visibility/BaseFilteredTree.js";
import type { TreeSpecificVisibilityHandler } from "../visibility/BaseVisibilityHelper.js";
import type { IVisibilityChangeEventListener } from "../VisibilityChangeEventListener.js";

/** @internal */
export interface CreateFilteredTreeProps<TCache, TFilteredTreeSpecificProps> {
  getCache: () => TCache;
  imodelAccess: ECClassHierarchyInspector;
  filteringPaths: HierarchyFilteringPath[];
  filteredTreeProps: TFilteredTreeSpecificProps;
}

/** @internal */
export interface CreateTreeSpecificVisibilityHandlerProps<TCache, TTreeSpecificVisibilityHandlerProps> {
  info: AlwaysAndNeverDrawnElementInfo;
  getCache: () => TCache;
  viewport: Viewport;
  overrideHandler: HierarchyVisibilityOverrideHandler;
  treeSpecificVisibilityHandlerProps: TTreeSpecificVisibilityHandlerProps;
}

/** @internal */
export interface UseCachedVisibilityProps<TCache, TFilterTargets, TFilteredTreeSpecificProps, TTreeSpecificVisibilityHandlerProps> {
  activeView: Viewport;
  getCache: () => TCache;
  filteredTreeProps: TFilteredTreeSpecificProps;
  treeSpecificVisibilityHandlerProps: TTreeSpecificVisibilityHandlerProps;
  createFilteredTree: (props: CreateFilteredTreeProps<TCache, TFilteredTreeSpecificProps>) => Promise<FilteredTree<TFilterTargets>>;
  createTreeSpecificVisibilityHandler: (
    props: CreateTreeSpecificVisibilityHandlerProps<TCache, TTreeSpecificVisibilityHandlerProps>,
  ) => TreeSpecificVisibilityHandler<TFilterTargets> & Disposable;
}

/** @internal */
export function useCachedVisibility<
  TCache,
  TFilterTargets,
  TFilteredTreeSpecificProps extends object | undefined,
  TTreeSpecificVisibilityHandlerProps extends object | undefined,
>(props: UseCachedVisibilityProps<TCache, TFilterTargets, TFilteredTreeSpecificProps, TTreeSpecificVisibilityHandlerProps>) {
  const [filteredPaths, setFilteredPaths] = useState<HierarchyFilteringPath[] | undefined>(undefined);
  const { activeView, getCache, createFilteredTree, createTreeSpecificVisibilityHandler, filteredTreeProps, treeSpecificVisibilityHandlerProps } = props;

  const [visibilityHandlerFactory, setVisibilityHandlerFactory] = useState<VisibilityTreeProps["visibilityHandlerFactory"]>(() =>
    createVisibilityHandlerFactory({
      activeView,
      getCache,
      createFilteredTree,
      createTreeSpecificVisibilityHandler,
      filteredTreeProps,
      treeSpecificVisibilityHandlerProps,
      filteringPaths: filteredPaths,
    }),
  );

  useEffect(() => {
    setVisibilityHandlerFactory(() =>
      createVisibilityHandlerFactory({
        activeView,
        getCache,
        createFilteredTree,
        createTreeSpecificVisibilityHandler,
        filteredTreeProps,
        treeSpecificVisibilityHandlerProps,
        filteringPaths: filteredPaths,
      }),
    );
  }, [activeView, getCache, filteredPaths, createFilteredTree, createTreeSpecificVisibilityHandler, filteredTreeProps, treeSpecificVisibilityHandlerProps]);

  return {
    visibilityHandlerFactory,
    onFilteredPathsChanged: useCallback((paths: HierarchyFilteringPath[] | undefined) => setFilteredPaths(paths), []),
    filteredPaths,
  };
}

function createVisibilityHandlerFactory<TCache, TFilterTargets, TFilteredTreeSpecificProps, TTreeSpecificVisibilityHandlerProps>(
  props: UseCachedVisibilityProps<TCache, TFilterTargets, TFilteredTreeSpecificProps, TTreeSpecificVisibilityHandlerProps> & {
    filteringPaths: HierarchyFilteringPath[] | undefined;
  },
): VisibilityTreeProps["visibilityHandlerFactory"] {
  const {
    activeView,
    createFilteredTree,
    createTreeSpecificVisibilityHandler,
    filteredTreeProps,
    getCache,
    treeSpecificVisibilityHandlerProps,
    filteringPaths,
  } = props;
  return ({ imodelAccess }) =>
    new HierarchyVisibilityHandlerImpl<TFilterTargets>({
      viewport: activeView,
      getFilteredTree: (): Promise<FilteredTree<TFilterTargets>> | undefined => {
        if (filteringPaths) {
          return createFilteredTree({ imodelAccess, filteringPaths, filteredTreeProps, getCache });
        }
        return undefined;
      },
      getTreeSpecificVisibilityHandler: (info, overrideHandler) =>
        createTreeSpecificVisibilityHandler({
          info,
          getCache,
          viewport: activeView,
          overrideHandler,
          treeSpecificVisibilityHandlerProps,
        }),
    });
}

/** @internal */
export interface HierarchyVisibilityHandlerImplProps<TFilterTargets> {
  viewport: Viewport;
  getTreeSpecificVisibilityHandler: (
    info: AlwaysAndNeverDrawnElementInfo,
    overrideHandler: HierarchyVisibilityOverrideHandler,
  ) => TreeSpecificVisibilityHandler<TFilterTargets> & Disposable;
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
export class HierarchyVisibilityHandlerImpl<TFilterTargets> implements HierarchyVisibilityHandler, Disposable {
  private readonly _eventListener: IVisibilityChangeEventListener;
  private readonly _alwaysAndNeverDrawnElements: AlwaysAndNeverDrawnElementInfo;
  private _treeSpecificVisibilityHandler: TreeSpecificVisibilityHandler<TFilterTargets> & Disposable;
  private _changeRequest = new Subject<{ key: HierarchyNodeKey; depth: number }>();
  private _filteredTree: Promise<FilteredTree<TFilterTargets>> | undefined;

  constructor(private readonly _props: HierarchyVisibilityHandlerImplProps<TFilterTargets>) {
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
    this._treeSpecificVisibilityHandler = this._props.getTreeSpecificVisibilityHandler(
      this._alwaysAndNeverDrawnElements,
      new HierarchyVisibilityOverrideHandler(this),
    );
    this._filteredTree = this._props.getFilteredTree();
  }

  public get onVisibilityChange() {
    return this._eventListener.onVisibilityChange;
  }

  public async getVisibilityStatus(node: HierarchyNode): Promise<VisibilityStatus> {
    return firstValueFrom(
      this.getVisibilityStatusInternal(node).pipe(
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

    const changeObservable = this.changeVisibilityStatusInternal(node, shouldDisplay).pipe(
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
    this._treeSpecificVisibilityHandler[Symbol.dispose]();
  }

  private getVisibilityStatusInternal(node: HierarchyNode) {
    if (node.filtering?.filteredChildrenIdentifierPaths?.length && !node.filtering.isFilterTarget) {
      return this.getFilteredNodeVisibility({ node });
    }
    return this._treeSpecificVisibilityHandler.getVisibilityStatus(node);
  }

  private changeVisibilityStatusInternal(node: HierarchyNode, on: boolean): Observable<void> {
    if (node.filtering?.filteredChildrenIdentifierPaths?.length && !node.filtering.isFilterTarget) {
      return this.changeFilteredNodeVisibility({ node, on });
    }
    return this._treeSpecificVisibilityHandler.changeVisibilityStatus(node, on);
  }

  private getFilteredNodeVisibility(props: { node: HierarchyNode }) {
    return this.getFilteredTreeTargets(props).pipe(
      mergeMap((targets) => {
        if (!targets) {
          return EMPTY;
        }
        return this._treeSpecificVisibilityHandler.getFilterTargetsVisibilityStatus(targets);
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
        return this._treeSpecificVisibilityHandler.changeFilterTargetsVisibilityStatus(targets, on);
      }),
    );
  }
}
