/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { MutableRefObject, useEffect, useRef, useState } from "react";
import { defer, distinct, mergeMap, Subject, takeUntil } from "rxjs";
import { BeEvent } from "@itwin/core-bentley";
import { HierarchyNode } from "@itwin/presentation-hierarchies";
import { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import { VisibilityStatus } from "../../VisibilityTreeEventHandler";

interface HierarchyVisibilityHandler {
  getVisibilityStatus: (node: HierarchyNode) => Promise<VisibilityStatus>;
  changeVisibility: (node: HierarchyNode, on: boolean) => Promise<void>;
  onVisibilityChange: BeEvent<() => void>;
  dispose: () => void;
}

interface UseNodesVisibilityProps {
  visibilityHandlerFactory: () => HierarchyVisibilityHandler;
}

interface UseHierarchyVisibilityResult {
  onCheckboxClicked: (node: PresentationHierarchyNode, checked: boolean) => void;
  getCheckboxStatus: (node: PresentationHierarchyNode) => VisibilityStatus;
}

/** @internal */
export function useHierarchyVisibility({ visibilityHandlerFactory }: UseNodesVisibilityProps): UseHierarchyVisibilityResult {
  const statusMap = useRef(new Map<string, { node: PresentationHierarchyNode; status: VisibilityStatus; needsRefresh: boolean }>());
  const [state, setState] = useState({
    getCheckboxStatus: (_node: PresentationHierarchyNode): VisibilityStatus => ({ state: "hidden", isDisabled: true }),
    onCheckboxClicked: (_node: PresentationHierarchyNode, _checked: boolean): void => {},
  });

  useEffect(() => {
    statusMap.current.clear();
    const handler = visibilityHandlerFactory();

    const visibilityChanged = new Subject<void>();
    const calculate = new Subject<PresentationHierarchyNode>();

    const subscription = calculate
      .pipe(
        distinct(undefined, visibilityChanged),
        mergeMap((node) => defer(async () => ({ node, status: await handler.getVisibilityStatus(node.nodeData) })).pipe(takeUntil(visibilityChanged))),
      )
      .subscribe({
        next: ({ node, status }) => {
          statusMap.current.set(node.id, { node, status, needsRefresh: false });
          setState((prev) => ({
            ...prev,
            getCheckboxStatus: createStatusGetter(statusMap, (node) => calculate.next(node)),
          }));
        },
      });

    const changeVisibility = (node: PresentationHierarchyNode, checked: boolean) => {
      void handler.changeVisibility(node.nodeData, checked);
      const status = statusMap.current.get(node.id);
      if (!status) {
        return;
      }
      status.status.state = checked ? "visible" : "hidden";
      status.status.tooltip = undefined;
      setState((prev) => ({ ...prev, getCheckboxStatus: createStatusGetter(statusMap, (node) => calculate.next(node)) }));
    };

    setState({
      onCheckboxClicked: changeVisibility,
      getCheckboxStatus: createStatusGetter(statusMap, (node) => calculate.next(node)),
    });

    const removeListener = handler.onVisibilityChange.addListener(() => {
      statusMap.current.forEach((value) => {
        value.needsRefresh = true;
      });

      visibilityChanged.next();
      setState((prev) => ({
        ...prev,
        getCheckboxStatus: createStatusGetter(statusMap, (node) => calculate.next(node)),
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

function createStatusGetter(
  map: MutableRefObject<Map<string, { node: PresentationHierarchyNode; status: VisibilityStatus; needsRefresh: boolean }>>,
  calculateVisibility: (node: PresentationHierarchyNode) => void,
) {
  return (node: PresentationHierarchyNode): VisibilityStatus => {
    const status = map.current.get(node.id);
    if (status === undefined) {
      calculateVisibility(node);
      return { state: "hidden", isDisabled: true };
    }
    if (status.needsRefresh) {
      calculateVisibility(node);
    }

    return status.status;
  };
}
