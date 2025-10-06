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
import type { HierarchyFilteringPath, HierarchyNode } from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector } from "@itwin/presentation-shared";
import type { VisibilityTreeProps } from "../../components/VisibilityTree.js";
import type { TreeWidgetViewport } from "../../TreeWidgetViewport.js";
import type { HierarchyVisibilityHandler, VisibilityStatus } from "../../UseHierarchyVisibility.js";
import type { FilteredTree } from "../visibility/BaseFilteredTree.js";
import type { TreeSpecificVisibilityHandler } from "../visibility/BaseVisibilityHelper.js";
import type { IVisibilityChangeEventListener } from "../VisibilityChangeEventListener.js";

/** @internal */
export interface CreateFilteredTreeProps<TCache> {
  getCache: () => TCache;
  imodelAccess: ECClassHierarchyInspector;
  filteringPaths: HierarchyFilteringPath[];
}

/** @internal */
export interface CreateTreeSpecificVisibilityHandlerProps<TCache> {
  info: AlwaysAndNeverDrawnElementInfo;
  getCache: () => TCache;
  viewport: TreeWidgetViewport;
  overrideHandler: HierarchyVisibilityOverrideHandler;
}

/** @internal */
export interface UseCachedVisibilityProps<TCache, TFilterTargets> {
  activeView: TreeWidgetViewport;
  getCache: () => TCache;
  createFilteredTree: (props: CreateFilteredTreeProps<TCache>) => Promise<FilteredTree<TFilterTargets>>;
  createTreeSpecificVisibilityHandler: (props: CreateTreeSpecificVisibilityHandlerProps<TCache>) => TreeSpecificVisibilityHandler<TFilterTargets> & Disposable;
}

/** @internal */
export function useCachedVisibility<TCache, TFilterTargets>(props: UseCachedVisibilityProps<TCache, TFilterTargets>) {
  const [filteredPaths, setFilteredPaths] = useState<HierarchyFilteringPath[] | undefined>(undefined);
  const { activeView, getCache, createFilteredTree, createTreeSpecificVisibilityHandler } = props;

  const [visibilityHandlerFactory, setVisibilityHandlerFactory] = useState<VisibilityTreeProps["visibilityHandlerFactory"]>(() =>
    createVisibilityHandlerFactory({
      activeView,
      getCache,
      createFilteredTree,
      createTreeSpecificVisibilityHandler,
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
        filteringPaths: filteredPaths,
      }),
    );
  }, [activeView, getCache, filteredPaths, createFilteredTree, createTreeSpecificVisibilityHandler]);

  return {
    visibilityHandlerFactory,
    onFilteredPathsChanged: useCallback((paths: HierarchyFilteringPath[] | undefined) => setFilteredPaths(paths), []),
    filteredPaths,
  };
}

function createVisibilityHandlerFactory<TCache, TFilterTargets>(
  props: UseCachedVisibilityProps<TCache, TFilterTargets> & {
    filteringPaths: HierarchyFilteringPath[] | undefined;
  },
): VisibilityTreeProps["visibilityHandlerFactory"] {
  const { activeView, createFilteredTree, createTreeSpecificVisibilityHandler, getCache, filteringPaths } = props;
  return ({ imodelAccess }) =>
    new HierarchyVisibilityHandlerImpl<TFilterTargets>({
      viewport: activeView,
      getFilteredTree: (): Promise<FilteredTree<TFilterTargets>> | undefined => {
        if (filteringPaths) {
          return createFilteredTree({ imodelAccess, filteringPaths, getCache });
        }
        return undefined;
      },
      getTreeSpecificVisibilityHandler: (info, overrideHandler) =>
        createTreeSpecificVisibilityHandler({
          info,
          getCache,
          viewport: activeView,
          overrideHandler,
        }),
    });
}

/** @internal */
export interface HierarchyVisibilityHandlerImplProps<TFilterTargets> {
  viewport: TreeWidgetViewport;
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
  readonly #props: HierarchyVisibilityHandlerImplProps<TFilterTargets>;
  readonly #eventListener: IVisibilityChangeEventListener;
  readonly #alwaysAndNeverDrawnElements: AlwaysAndNeverDrawnElementInfo;
  #treeSpecificVisibilityHandler: TreeSpecificVisibilityHandler<TFilterTargets> & Disposable;
  #changeRequest = new Subject<{ key: HierarchyNodeKey; depth: number }>();
  #filteredTree: Promise<FilteredTree<TFilterTargets>> | undefined;

  constructor(props: HierarchyVisibilityHandlerImplProps<TFilterTargets>) {
    this.#props = props;
    this.#eventListener = createVisibilityChangeEventListener({
      viewport: this.#props.viewport,
      listeners: {
        models: true,
        categories: true,
        elements: true,
        displayStyle: true,
      },
    });
    this.#alwaysAndNeverDrawnElements = new AlwaysAndNeverDrawnElementInfo(this.#props.viewport);
    this.#treeSpecificVisibilityHandler = this.#props.getTreeSpecificVisibilityHandler(
      this.#alwaysAndNeverDrawnElements,
      new HierarchyVisibilityOverrideHandler(this),
    );
    this.#filteredTree = this.#props.getFilteredTree();
  }

  public get onVisibilityChange() {
    return this.#eventListener.onVisibilityChange;
  }

  public async getVisibilityStatus(node: HierarchyNode): Promise<VisibilityStatus> {
    return firstValueFrom(
      this.getVisibilityStatusInternal(node).pipe(
        // unsubscribe from the observable if the change request for this node is received
        takeUntil(this.#changeRequest.pipe(filter(({ key, depth }) => depth === node.parentKeys.length && HierarchyNodeKey.equals(node.key, key)))),
        // unsubscribe if visibility changes
        takeUntil(
          fromEventPattern(
            (handler) => {
              this.#eventListener.onVisibilityChange.addListener(handler);
            },
            (handler) => {
              this.#eventListener.onVisibilityChange.removeListener(handler);
            },
          ),
        ),
        defaultIfEmpty(createVisibilityStatus("hidden")),
      ),
    );
  }

  public async changeVisibility(node: HierarchyNode, shouldDisplay: boolean): Promise<void> {
    // notify about new change request
    this.#changeRequest.next({ key: node.key, depth: node.parentKeys.length });

    const changeObservable = this.changeVisibilityStatusInternal(node, shouldDisplay).pipe(
      // unsubscribe from the observable if the change request for this node is received
      takeUntil(this.#changeRequest.pipe(filter(({ key, depth }) => depth === node.parentKeys.length && HierarchyNodeKey.equals(node.key, key)))),
      tap({
        subscribe: () => {
          this.#eventListener.suppressChangeEvents();
          this.#alwaysAndNeverDrawnElements.suppressChangeEvents();
        },
        finalize: () => {
          this.#eventListener.resumeChangeEvents();
          this.#alwaysAndNeverDrawnElements.resumeChangeEvents();
        },
      }),
    );

    return toVoidPromise(changeObservable);
  }

  public [Symbol.dispose]() {
    this.#eventListener[Symbol.dispose]();
    this.#alwaysAndNeverDrawnElements[Symbol.dispose]();
    this.#treeSpecificVisibilityHandler[Symbol.dispose]();
  }

  private getVisibilityStatusInternal(node: HierarchyNode) {
    if (node.filtering?.filteredChildrenIdentifierPaths?.length && !node.filtering.isFilterTarget) {
      return this.getFilteredNodeVisibility({ node });
    }
    return this.#treeSpecificVisibilityHandler.getVisibilityStatus(node);
  }

  private changeVisibilityStatusInternal(node: HierarchyNode, on: boolean): Observable<void> {
    if (node.filtering?.filteredChildrenIdentifierPaths?.length && !node.filtering.isFilterTarget) {
      return this.changeFilteredNodeVisibility({ node, on });
    }
    return this.#treeSpecificVisibilityHandler.changeVisibilityStatus(node, on);
  }

  private getFilteredNodeVisibility(props: { node: HierarchyNode }) {
    return this.getFilteredTreeTargets(props).pipe(
      mergeMap((targets) => {
        if (!targets) {
          return EMPTY;
        }
        return this.#treeSpecificVisibilityHandler.getFilterTargetsVisibilityStatus(targets);
      }),
    );
  }

  private getFilteredTreeTargets({ node }: { node: HierarchyNode }): Observable<TFilterTargets | undefined> {
    if (!this.#filteredTree) {
      return of(undefined);
    }
    return from(this.#filteredTree).pipe(map((filteredTree) => filteredTree.getFilterTargets(node)));
  }

  private changeFilteredNodeVisibility({ on, node }: { on: boolean; node: HierarchyNode }) {
    return this.getFilteredTreeTargets({ node }).pipe(
      mergeMap((targets) => {
        if (!targets) {
          return EMPTY;
        }
        return this.#treeSpecificVisibilityHandler.changeFilterTargetsVisibilityStatus(targets, on);
      }),
    );
  }
}
