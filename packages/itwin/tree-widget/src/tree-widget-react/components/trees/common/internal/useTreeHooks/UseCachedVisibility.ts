/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useMemo, useState } from "react";
import { defaultIfEmpty, EMPTY, filter, firstValueFrom, from, fromEventPattern, map, mergeMap, Subject, takeUntil, tap } from "rxjs";
import { HierarchyNode, HierarchyNodeKey } from "@itwin/presentation-hierarchies";
import { HierarchyVisibilityOverrideHandler } from "../../UseHierarchyVisibility.js";
import { BufferingViewport } from "../BufferingViewport.js";
import { AlwaysAndNeverDrawnElementInfoCache } from "../caches/AlwaysAndNeverDrawnElementInfoCache.js";
import { toVoidPromise } from "../Rxjs.js";
import { createVisibilityStatus } from "../Tooltip.js";
import { createVisibilityChangeEventListener } from "../VisibilityChangeEventListener.js";

import type { Observable } from "rxjs";
import type { GuidString } from "@itwin/core-bentley";
import type { ClassGroupingNodeKey, HierarchySearchTree, InstancesNodeKey } from "@itwin/presentation-hierarchies";
import type { ECClassHierarchyInspector } from "@itwin/presentation-shared";
import type { VisibilityTreeProps } from "../../components/VisibilityTree.js";
import type { TreeWidgetViewport } from "../../TreeWidgetViewport.js";
import type { HierarchyVisibilityHandler, VisibilityStatus } from "../../UseHierarchyVisibility.js";
import type { SearchResultsTree } from "../visibility/BaseSearchResultsTree.js";
import type { TreeSpecificVisibilityHandler } from "../visibility/BaseVisibilityHelper.js";
import type { IVisibilityChangeEventListener } from "../VisibilityChangeEventListener.js";

/** @internal */
export interface CreateSearchResultsTreeProps<TCache> {
  idsCache: TCache;
  imodelAccess: ECClassHierarchyInspector;
  searchPaths: HierarchySearchTree[];
}

/** @internal */
export interface CreateTreeSpecificVisibilityHandlerProps<TCache> {
  info: AlwaysAndNeverDrawnElementInfoCache;
  idsCache: TCache;
  viewport: TreeWidgetViewport;
  overrideHandler: HierarchyVisibilityOverrideHandler;
}

/** @internal */
export interface UseCachedVisibilityProps<TCache, TSearchTargets> {
  componentId: GuidString;
  activeView: TreeWidgetViewport;
  idsCache: TCache;
  createSearchResultsTree: (props: CreateSearchResultsTreeProps<TCache>) => Promise<SearchResultsTree<TSearchTargets>>;
  createTreeSpecificVisibilityHandler: (props: CreateTreeSpecificVisibilityHandlerProps<TCache>) => TreeSpecificVisibilityHandler<TSearchTargets> & Disposable;
}

/** @internal */
export function useCachedVisibility<TCache, TSearchTargets>(props: UseCachedVisibilityProps<TCache, TSearchTargets>) {
  const [searchPaths, setSearchPaths] = useState<HierarchySearchTree[] | undefined>(undefined);
  const { activeView, idsCache, createSearchResultsTree, createTreeSpecificVisibilityHandler, componentId } = props;

  const visibilityHandlerFactory = useMemo<VisibilityTreeProps["visibilityHandlerFactory"]>(
    () =>
      createVisibilityHandlerFactory({
        activeView,
        idsCache,
        createSearchResultsTree,
        createTreeSpecificVisibilityHandler,
        searchPaths,
        componentId,
      }),
    [activeView, idsCache, searchPaths, createSearchResultsTree, createTreeSpecificVisibilityHandler, componentId],
  );

  return {
    visibilityHandlerFactory,
    onSearchPathsChanged: useCallback((paths: HierarchySearchTree[] | undefined) => setSearchPaths(paths), []),
    searchPaths,
  };
}

function createVisibilityHandlerFactory<TCache, TSearchTargets>(
  props: UseCachedVisibilityProps<TCache, TSearchTargets> & {
    searchPaths: HierarchySearchTree[] | undefined;
  },
): VisibilityTreeProps["visibilityHandlerFactory"] {
  const { activeView, createSearchResultsTree, createTreeSpecificVisibilityHandler, idsCache, searchPaths, componentId } = props;
  return ({ imodelAccess }) =>
    new HierarchyVisibilityHandlerImpl<TSearchTargets>({
      componentId,
      viewport: activeView,
      getSearchResultsTree: (): Promise<SearchResultsTree<TSearchTargets>> | undefined => {
        if (searchPaths) {
          return createSearchResultsTree({ imodelAccess, searchPaths, idsCache });
        }
        return undefined;
      },
      getTreeSpecificVisibilityHandler: ({ info, overrideHandler, viewport }) =>
        createTreeSpecificVisibilityHandler({
          info,
          idsCache,
          viewport,
          overrideHandler,
        }),
    });
}

/** @internal */
export interface HierarchyVisibilityHandlerImplProps<TSearchTargets> {
  viewport: TreeWidgetViewport;
  getTreeSpecificVisibilityHandler: (props: {
    info: AlwaysAndNeverDrawnElementInfoCache;
    overrideHandler: HierarchyVisibilityOverrideHandler;
    viewport: TreeWidgetViewport;
  }) => TreeSpecificVisibilityHandler<TSearchTargets> & Disposable;
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
  readonly #alwaysAndNeverDrawnElements: AlwaysAndNeverDrawnElementInfoCache;
  #overrideHandler: HierarchyVisibilityOverrideHandler;
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
    this.#alwaysAndNeverDrawnElements = new AlwaysAndNeverDrawnElementInfoCache({
      viewport: this.#props.viewport,
      componentId: props.componentId,
    });
    this.#overrideHandler = new HierarchyVisibilityOverrideHandler(this);
  }

  public get onVisibilityChange() {
    return this.#eventListener.onVisibilityChange;
  }

  public async getVisibilityStatus(node: HierarchyNode): Promise<VisibilityStatus> {
    const treeSpecificVisibilityHandler = this.#props.getTreeSpecificVisibilityHandler({
      info: this.#alwaysAndNeverDrawnElements,
      overrideHandler: this.#overrideHandler,
      viewport: this.#props.viewport,
    });
    return firstValueFrom(
      this.getVisibilityStatusInternal({ node, treeSpecificVisibilityHandler }).pipe(
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
        defaultIfEmpty(createVisibilityStatus("disabled")),
        tap({
          finalize: () => {
            treeSpecificVisibilityHandler[Symbol.dispose]();
          },
        }),
      ),
    );
  }

  public async changeVisibility(node: HierarchyNode, shouldDisplay: boolean): Promise<void> {
    // notify about new change request
    this.#changeRequest.next({ key: node.key, depth: node.parentKeys.length });

    const bufferingViewport = new BufferingViewport(this.#props.viewport);
    const treeSpecificVisibilityHandler = this.#props.getTreeSpecificVisibilityHandler({
      info: this.#alwaysAndNeverDrawnElements,
      overrideHandler: this.#overrideHandler,
      viewport: bufferingViewport,
    });
    const changeObservable = this.changeVisibilityStatusInternal({ node, on: shouldDisplay, treeSpecificVisibilityHandler }).pipe(
      tap({
        subscribe: () => {
          this.#eventListener.suppressChangeEvents();
          this.#alwaysAndNeverDrawnElements.suppressChangeEvents();
        },
        // Apply all changes that were made at once.
        // This only fires on natural changeVisibilityStatusInternal completion:
        // takeUntil below does not trigger complete.
        complete: () => {
          bufferingViewport.commit();
        },
      }),
      // unsubscribe from the observable if the change request for this node is received
      takeUntil(this.#changeRequest.pipe(filter(({ key, depth }) => depth === node.parentKeys.length && HierarchyNodeKey.equals(node.key, key)))),
      tap({
        finalize: () => {
          // Discard any changes that were made. If commit was called, then this will have no effect
          bufferingViewport.discard();
          this.#eventListener.resumeChangeEvents();
          this.#alwaysAndNeverDrawnElements.resumeChangeEvents();
          treeSpecificVisibilityHandler[Symbol.dispose]();
        },
      }),
    );

    return toVoidPromise(changeObservable);
  }

  public [Symbol.dispose]() {
    this.#eventListener[Symbol.dispose]();
    this.#alwaysAndNeverDrawnElements[Symbol.dispose]();
  }

  private getVisibilityStatusInternal({
    node,
    treeSpecificVisibilityHandler,
  }: {
    node: HierarchyNode;
    treeSpecificVisibilityHandler: TreeSpecificVisibilityHandler<TSearchTargets>;
  }): Observable<VisibilityStatus> {
    if (HierarchyNode.isClassGroupingNode(node)) {
      if (node.extendedData?.hasDirectNonSearchTargets && !node.extendedData?.hasSearchTargetAncestor) {
        return this.getSearchResultsNodeVisibility({ node, treeSpecificVisibilityHandler });
      }
    }

    if (
      HierarchyNode.isInstancesNode(node) &&
      node.search?.childrenTargetPaths?.length &&
      !node.search.isSearchTarget &&
      !node.search.hasSearchTargetAncestor
    ) {
      return this.getSearchResultsNodeVisibility({ node, treeSpecificVisibilityHandler });
    }
    return treeSpecificVisibilityHandler.getVisibilityStatus(node);
  }

  private changeVisibilityStatusInternal({
    node,
    on,
    treeSpecificVisibilityHandler,
  }: {
    node: HierarchyNode;
    on: boolean;
    treeSpecificVisibilityHandler: TreeSpecificVisibilityHandler<TSearchTargets>;
  }): Observable<void> {
    if (HierarchyNode.isClassGroupingNode(node)) {
      if (node.extendedData?.hasDirectNonSearchTargets && !node.extendedData?.hasSearchTargetAncestor) {
        return this.changeSearchResultsNodeVisibility({ node, on, treeSpecificVisibilityHandler });
      }
    }
    if (
      HierarchyNode.isInstancesNode(node) &&
      node.search?.childrenTargetPaths?.length &&
      !node.search.isSearchTarget &&
      !node.search.hasSearchTargetAncestor
    ) {
      return this.changeSearchResultsNodeVisibility({ node, on, treeSpecificVisibilityHandler });
    }
    return treeSpecificVisibilityHandler.changeVisibilityStatus(node, on);
  }

  private getSearchResultsNodeVisibility({
    node,
    treeSpecificVisibilityHandler,
  }: {
    node: HierarchyNode & {
      key: ClassGroupingNodeKey | InstancesNodeKey;
    };
    treeSpecificVisibilityHandler: TreeSpecificVisibilityHandler<TSearchTargets>;
  }) {
    return this.getSearchResultsTreeTargets({ node }).pipe(
      mergeMap((targets) => {
        if (!targets) {
          return EMPTY;
        }
        return treeSpecificVisibilityHandler.getSearchTargetsVisibilityStatus(targets, node);
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
    // There can be cases where search paths used to exist and are removed, search results tree becomes undefined,
    // but visibility is re-requested for old nodes (have search paths).
    // In such cases return EMPTY.
    return this.#searchResultsTree ? from(this.#searchResultsTree).pipe(map((searchResultsTree) => searchResultsTree.getSearchTargets(node))) : EMPTY;
  }

  private changeSearchResultsNodeVisibility({
    on,
    node,
    treeSpecificVisibilityHandler,
  }: {
    on: boolean;
    node: HierarchyNode & {
      key: ClassGroupingNodeKey | InstancesNodeKey;
    };
    treeSpecificVisibilityHandler: TreeSpecificVisibilityHandler<TSearchTargets>;
  }) {
    return this.getSearchResultsTreeTargets({ node }).pipe(
      mergeMap((targets) => {
        if (!targets) {
          return EMPTY;
        }
        return treeSpecificVisibilityHandler.changeSearchTargetsVisibilityStatus(targets, on);
      }),
    );
  }
}
