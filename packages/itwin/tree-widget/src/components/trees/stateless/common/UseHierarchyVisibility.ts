/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useEffect, useRef, useState } from "react";
import { defer, distinct, mergeMap, Subject, takeUntil } from "rxjs";

import type { MutableRefObject } from "react";
import type { BeEvent } from "@itwin/core-bentley";
import type { HierarchyNode } from "@itwin/presentation-hierarchies";
import type { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import type { VisibilityStatus } from "../../VisibilityTreeEventHandler";
import type { TreeNodeCheckboxState } from "./components/TreeNodeCheckbox";

/** @internal */
export interface HierarchyVisibilityHandler {
  getVisibilityStatus: (node: HierarchyNode) => Promise<VisibilityStatus>;
  changeVisibility: (node: HierarchyNode, on: boolean) => Promise<void>;
  onVisibilityChange: BeEvent<() => void>;
  dispose: () => void;
}

interface UseHierarchyVisibilityProps {
  visibilityHandlerFactory: () => HierarchyVisibilityHandler;
}

interface UseHierarchyVisibilityResult {
  onCheckboxClicked: (node: PresentationHierarchyNode, checked: boolean) => void;
  getCheckboxState: (node: PresentationHierarchyNode) => TreeNodeCheckboxState;
}

/** @internal */
export function useHierarchyVisibility({ visibilityHandlerFactory }: UseHierarchyVisibilityProps): UseHierarchyVisibilityResult {
  const nodesStateMap = useRef(new Map<string, { node: PresentationHierarchyNode; state: TreeNodeCheckboxState; needsRefresh: boolean }>());
  const [state, setState] = useState<UseHierarchyVisibilityResult>({
    getCheckboxState: () => ({ state: "off", isDisabled: true }),
    onCheckboxClicked: () => {},
  });

  useEffect(() => {
    nodesStateMap.current.clear();
    const handler = visibilityHandlerFactory();

    const visibilityChanged = new Subject<void>();
    const calculate = new Subject<PresentationHierarchyNode>();
    const calculateNodeStatus = (node: PresentationHierarchyNode) => {
      calculate.next(node);
    };

    const subscription = calculate
      .pipe(
        distinct(undefined, visibilityChanged),
        mergeMap((node) => defer(async () => ({ node, status: await handler.getVisibilityStatus(node.nodeData) })).pipe(takeUntil(visibilityChanged))),
      )
      .subscribe({
        next: ({ node, status }) => {
          nodesStateMap.current.set(node.id, {
            node,
            state: {
              state: status.state === "visible" ? "on" : status.state === "partial" ? "partial" : "off",
              tooltip: status.tooltip,
              isDisabled: status.isDisabled,
            },
            needsRefresh: false,
          });
          setState((prev) => ({
            ...prev,
            getCheckboxState: createStateGetter(nodesStateMap, calculateNodeStatus),
          }));
        },
      });

    const changeVisibility = (node: PresentationHierarchyNode, checked: boolean) => {
      void handler.changeVisibility(node.nodeData, checked);
      const entry = nodesStateMap.current.get(node.id);
      if (!entry) {
        return;
      }
      entry.state.state = checked ? "on" : "off";
      entry.state.tooltip = undefined;
      setState((prev) => ({ ...prev, getCheckboxState: createStateGetter(nodesStateMap, calculateNodeStatus) }));
    };

    setState({
      onCheckboxClicked: changeVisibility,
      getCheckboxState: createStateGetter(nodesStateMap, calculateNodeStatus),
    });

    const removeListener = handler.onVisibilityChange.addListener(() => {
      nodesStateMap.current.forEach((value) => {
        value.needsRefresh = true;
      });

      visibilityChanged.next();
      setState((prev) => ({
        ...prev,
        getCheckboxState: createStateGetter(nodesStateMap, calculateNodeStatus),
      }));
    });

    return () => {
      subscription.unsubscribe();
      removeListener();
      handler.dispose();
    };
  }, [visibilityHandlerFactory]);

  return state;
}

function createStateGetter(
  map: MutableRefObject<Map<string, { node: PresentationHierarchyNode; state: TreeNodeCheckboxState; needsRefresh: boolean }>>,
  calculateVisibility: (node: PresentationHierarchyNode) => void,
) {
  return (node: PresentationHierarchyNode): TreeNodeCheckboxState => {
    const entry = map.current.get(node.id);
    if (entry === undefined) {
      calculateVisibility(node);
      return { state: "off", isDisabled: true };
    }
    if (entry.needsRefresh) {
      calculateVisibility(node);
    }

    return entry.state;
  };
}
