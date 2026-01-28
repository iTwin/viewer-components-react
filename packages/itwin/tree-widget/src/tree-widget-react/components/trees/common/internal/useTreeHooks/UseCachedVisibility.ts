/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useState } from "react";
import { defaultIfEmpty, EMPTY, filter, firstValueFrom, from, fromEventPattern, map, mergeMap, Subject, takeUntil, tap } from "rxjs";
import { assert } from "@itwin/core-bentley";
import { HierarchyNode, HierarchyNodeKey } from "@itwin/presentation-hierarchies";
import { HierarchyVisibilityOverrideHandler } from "../../UseHierarchyVisibility.js";
import { AlwaysAndNeverDrawnElementInfo } from "../AlwaysAndNeverDrawnElementInfo.js";
import { toVoidPromise } from "../Rxjs.js";
import { createVisibilityStatus } from "../Tooltip.js";
import { createVisibilityChangeEventListener } from "../VisibilityChangeEventListener.js";

import type { Observable } from "rxjs";
import type { GuidString } from "@itwin/core-bentley";
import type { ClassGroupingNodeKey, HierarchySearchPath, InstancesNodeKey } from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector } from "@itwin/presentation-shared";
import type { VisibilityTreeProps } from "../../components/VisibilityTree.js";
import type { TreeWidgetViewport } from "../../TreeWidgetViewport.js";
import type { HierarchyVisibilityHandler, VisibilityStatus } from "../../UseHierarchyVisibility.js";
import type { SearchResultsTree } from "../visibility/BaseSearchResultsTree.js";
import type { TreeSpecificVisibilityHandler } from "../visibility/BaseVisibilityHelper.js";
import type { IVisibilityChangeEventListener } from "../VisibilityChangeEventListener.js";

/** @internal */
export interface CreateSearchResultsTreeProps<TCache> {
  getCache: () => TCache;
  imodelAccess: ECClassHierarchyInspector;
  searchPaths: HierarchySearchPath[];
}

/** @internal */
export interface CreateTreeSpecificVisibilityHandlerProps<TCache> {
  info: AlwaysAndNeverDrawnElementInfo;
  getCache: () => TCache;
  viewport: TreeWidgetViewport;
  overrideHandler: HierarchyVisibilityOverrideHandler;
}

/** @internal */
export interface UseCachedVisibilityProps<TCache, TSearchTargets> {
  componentId: GuidString;
  activeView: TreeWidgetViewport;
  getCache: () => TCache;
  createSearchResultsTree: (props: CreateSearchResultsTreeProps<TCache>) => Promise<SearchResultsTree<TSearchTargets>>;
  createTreeSpecificVisibilityHandler: (props: CreateTreeSpecificVisibilityHandlerProps<TCache>) => TreeSpecificVisibilityHandler<TSearchTargets> & Disposable;
}

/** @internal */
export function useCachedVisibility<TCache, TSearchTargets>(props: UseCachedVisibilityProps<TCache, TSearchTargets>) {
  const [searchPaths, setSearchPaths] = useState<HierarchySearchPath[] | undefined>(undefined);
  const { activeView, getCache, createSearchResultsTree, createTreeSpecificVisibilityHandler, componentId } = props;

  const [visibilityHandlerFactory, setVisibilityHandlerFactory] = useState<VisibilityTreeProps["visibilityHandlerFactory"]>(() =>
    createVisibilityHandlerFactory({
      activeView,
      getCache,
      createSearchResultsTree,
      createTreeSpecificVisibilityHandler,
      searchPaths,
      componentId,
    }),
  );

  useEffect(() => {
    setVisibilityHandlerFactory(() =>
      createVisibilityHandlerFactory({
        activeView,
        getCache,
        createSearchResultsTree,
        createTreeSpecificVisibilityHandler,
        searchPaths,
        componentId,
      }),
    );
  }, [activeView, getCache, searchPaths, createSearchResultsTree, createTreeSpecificVisibilityHandler, componentId]);

  return {
    visibilityHandlerFactory,
    onSearchPathsChanged: useCallback((paths: HierarchySearchPath[] | undefined) => setSearchPaths(paths), []),
    searchPaths,
  };
}

function createVisibilityHandlerFactory<TCache, TSearchTargets>(
  props: UseCachedVisibilityProps<TCache, TSearchTargets> & {
    searchPaths: HierarchySearchPath[] | undefined;
  },
): VisibilityTreeProps["visibilityHandlerFactory"] {
  const { activeView, createSearchResultsTree, createTreeSpecificVisibilityHandler, getCache, searchPaths, componentId } = props;
  return ({ imodelAccess }) =>
    new HierarchyVisibilityHandlerImpl<TSearchTargets>({
      componentId,
      viewport: activeView,
      getSearchResultsTree: (): Promise<SearchResultsTree<TSearchTargets>> | undefined => {
        if (searchPaths) {
          return createSearchResultsTree({ imodelAccess, searchPaths, getCache });
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
export interface HierarchyVisibilityHandlerImplProps<TSearchTargets> {
  viewport: TreeWidgetViewport;
  getTreeSpecificVisibilityHandler: (
    info: AlwaysAndNeverDrawnElementInfo,
    overrideHandler: HierarchyVisibilityOverrideHandler,
  ) => TreeSpecificVisibilityHandler<TSearchTargets> & Disposable;
  getSearchResultsTree: () => Promise<SearchResultsTree<TSearchTargets>> | undefined;
  componentId?: GuidString;
}

/**
 * Class that handles visibility of hierarchy nodes in a tree.
 *
 * - It provides methods to get and change visibility status of nodes.
 * - Also handles filtered tree nodes visibility.
 * - Listens to visibility change events and updates visibility status accordingly.
 * @internal
 */
export class HierarchyVisibilityHandlerImpl<TSearchTargets> implements HierarchyVisibilityHandler, Disposable {
  readonly #props: HierarchyVisibilityHandlerImplProps<TSearchTargets>;
  readonly #eventListener: IVisibilityChangeEventListener;
  readonly #alwaysAndNeverDrawnElements: AlwaysAndNeverDrawnElementInfo;
  #treeSpecificVisibilityHandler: TreeSpecificVisibilityHandler<TSearchTargets> & Disposable;
  #changeRequest = new Subject<{ key: HierarchyNodeKey; depth: number }>();
  #searchResultsTree: Promise<SearchResultsTree<TSearchTargets>> | undefined;

  constructor(props: HierarchyVisibilityHandlerImplProps<TSearchTargets>) {
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
    this.#searchResultsTree = this.#props.getSearchResultsTree();
    this.#alwaysAndNeverDrawnElements = new AlwaysAndNeverDrawnElementInfo({
      viewport: this.#props.viewport,
      componentId: props.componentId,
    });
    this.#treeSpecificVisibilityHandler = this.#props.getTreeSpecificVisibilityHandler(
      this.#alwaysAndNeverDrawnElements,
      new HierarchyVisibilityOverrideHandler(this),
    );
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
    if (HierarchyNode.isClassGroupingNode(node)) {
      if (node.extendedData?.hasDirectNonSearchTargets && !node.extendedData?.hasSearchTargetAncestor) {
        return this.getSearchResultsNodeVisibility({ node });
      }
    }

    if (
      HierarchyNode.isInstancesNode(node) &&
      node.search?.childrenTargetPaths?.length &&
      !node.search.isSearchTarget &&
      !node.search.hasSearchTargetAncestor
    ) {
      return this.getSearchResultsNodeVisibility({ node });
    }
    return this.#treeSpecificVisibilityHandler.getVisibilityStatus(node);
  }

  private changeVisibilityStatusInternal(node: HierarchyNode, on: boolean): Observable<void> {
    if (HierarchyNode.isClassGroupingNode(node)) {
      if (node.extendedData?.hasDirectNonSearchTargets && !node.extendedData?.hasSearchTargetAncestor) {
        return this.changeSearchResultsNodeVisibility({ node, on });
      }
    }
    if (
      HierarchyNode.isInstancesNode(node) &&
      node.search?.childrenTargetPaths?.length &&
      !node.search.isSearchTarget &&
      !node.search.hasSearchTargetAncestor
    ) {
      return this.changeSearchResultsNodeVisibility({ node, on });
    }
    return this.#treeSpecificVisibilityHandler.changeVisibilityStatus(node, on);
  }

  private getSearchResultsNodeVisibility(props: {
    node: HierarchyNode & {
      key: ClassGroupingNodeKey | InstancesNodeKey;
    };
  }) {
    return this.getSearchResultsTreeTargets(props).pipe(
      mergeMap((targets) => {
        if (!targets) {
          return EMPTY;
        }
        return this.#treeSpecificVisibilityHandler.getSearchTargetsVisibilityStatus(targets, props.node);
      }),
    );
  }

  private getSearchResultsTreeTargets({
    node,
  }: {
    node: HierarchyNode & {
      key: ClassGroupingNodeKey | InstancesNodeKey;
    };
  }): Observable<TSearchTargets | undefined> {
    assert(this.#searchResultsTree !== undefined);
    return from(this.#searchResultsTree).pipe(map((searchResultsTree) => searchResultsTree.getSearchTargets(node)));
  }

  private changeSearchResultsNodeVisibility({
    on,
    node,
  }: {
    on: boolean;
    node: HierarchyNode & {
      key: ClassGroupingNodeKey | InstancesNodeKey;
    };
  }) {
    return this.getSearchResultsTreeTargets({ node }).pipe(
      mergeMap((targets) => {
        if (!targets) {
          return EMPTY;
        }
        return this.#treeSpecificVisibilityHandler.changeSearchTargetsVisibilityStatus(targets, on);
      }),
    );
  }
}
