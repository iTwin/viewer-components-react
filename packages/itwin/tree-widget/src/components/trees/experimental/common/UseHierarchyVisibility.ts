/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { HierarchyNode } from "@itwin/presentation-hierarchies";
import { VisibilityStatus } from "../../VisibilityTreeEventHandler";
import { BeEvent } from "@itwin/core-bentley";
import { PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import { MutableRefObject, useEffect, useRef, useState } from "react";
import { Subject, defer, distinct, from, map, merge, mergeMap, takeUntil } from "rxjs";

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
  const statusMap = useRef(new Map<string, { node: PresentationHierarchyNode; status: VisibilityStatus }>());
  const [state, setState] = useState({
    getCheckboxStatus: (_node: PresentationHierarchyNode): VisibilityStatus => ({ state: "hidden", isDisabled: true }),
    onCheckboxClicked: (_node: PresentationHierarchyNode, _checked: boolean): void => {},
  });

  useEffect(() => {
    statusMap.current.clear();
    const handler = visibilityHandlerFactory();

    const visibilityChanged = new Subject<void>();
    const calculate = new Subject<PresentationHierarchyNode>();
    const recalculate = new Subject<PresentationHierarchyNode[]>();

    const subscription = merge(
      calculate.pipe(
        distinct(),
        map((nodes) => ({ nodes: [nodes] })),
      ),
      recalculate.pipe(map((nodes) => ({ nodes }))),
    )
      .pipe(
        mergeMap(({ nodes }) =>
          from(nodes).pipe(
            takeUntil(visibilityChanged),
            mergeMap((node) => defer(async () => ({ node, status: await handler.getVisibilityStatus(node.nodeData) }))),
          ),
        ),
      )
      .subscribe({
        next: ({ node, status }) => {
          statusMap.current.set(node.id, { node, status });
          setState((prev) => ({
            ...prev,
            getCheckboxStatus: createStatusGetter(statusMap, (node) => calculate.next(node)),
          }));
        },
      });

    setState({
      onCheckboxClicked: (node, checked) => {
        void handler.changeVisibility(node.nodeData, checked).then(() => calculate.next(node));
      },
      getCheckboxStatus: createStatusGetter(statusMap, (node) => calculate.next(node)),
    });

    const removeListener = handler.onVisibilityChange.addListener(() => {
      const nodes: PresentationHierarchyNode[] = [];
      statusMap.current.forEach((value) => {
        nodes.push(value.node);
      });

      visibilityChanged.next();
      recalculate.next(nodes);
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
  map: MutableRefObject<Map<string, { node: PresentationHierarchyNode; status: VisibilityStatus }>>,
  calculateVisibility: (node: PresentationHierarchyNode) => void,
) {
  return (node: PresentationHierarchyNode): VisibilityStatus => {
    const status = map.current.get(node.id);
    if (status === undefined) {
      calculateVisibility(node);
      return { state: "hidden", isDisabled: true };
    }

    return status.status;
  };
}
