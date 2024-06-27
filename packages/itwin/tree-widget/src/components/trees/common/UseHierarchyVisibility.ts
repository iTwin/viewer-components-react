/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useEffect, useRef, useState } from "react";
import { defer, distinct, mergeMap, Subject, takeUntil } from "rxjs";

import type { HierarchyNode, PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import type { ComponentPropsWithoutRef, MutableRefObject } from "react";
import type { TreeNodeCheckbox } from "./components/TreeNodeCheckbox";
import type { BeEvent, IDisposable } from "@itwin/core-bentley";

type TreeNodeCheckboxProps = ComponentPropsWithoutRef<typeof TreeNodeCheckbox>;

/**
 * Data structure that describes instance visibility status.
 * @beta
 */
export interface VisibilityStatus {
  /** Instance visibility state. */
  state: "visible" | "partial" | "hidden";
  /** Specifies whether visibility changing is disabled or not. */
  isDisabled?: boolean;
  /** Tooltip that should be displayed when hovering over the visibility checkbox. */
  tooltip?: string;
}

/**
 * Handler that can be used to determine and change visibility of instances represented by tree nodes.
 * @beta
 */
export interface HierarchyVisibilityHandler extends IDisposable {
  /** Event used to notify tree about visibility changes from outside. */
  readonly onVisibilityChange: BeEvent<() => void>;
  /** Returns current visibility status for tree node. */
  getVisibilityStatus(node: HierarchyNode): Promise<VisibilityStatus> | VisibilityStatus;
  /** Changes visibility of the instance represented by tree node. */
  changeVisibility(node: HierarchyNode, on: boolean): Promise<void>;
}

interface UseHierarchyVisibilityProps {
  visibilityHandlerFactory: () => HierarchyVisibilityHandler;
  reportUsage?: (props: { featureId: "visibility-change"; reportInteraction: true }) => void;
}

interface UseHierarchyVisibilityResult {
  /** Checkbox click handler that uses `HierarchyVisibilityHandler` to change visibility of the instance represented by tree node. */
  onCheckboxClicked: TreeNodeCheckboxProps["onCheckboxClicked"];
  /** Getter that uses `HierarchyVisibilityHandler` to check current visibility status of the instance represented by tree node. */
  getCheckboxState: TreeNodeCheckboxProps["getCheckboxState"];
  triggerRefresh: () => void;
}

/** @internal */
export function useHierarchyVisibility({ visibilityHandlerFactory, reportUsage }: UseHierarchyVisibilityProps): UseHierarchyVisibilityResult {
  const visibilityStatusMap = useRef(new Map<string, { node: PresentationHierarchyNode; status: VisibilityStatus; needsRefresh: boolean }>());
  const [state, setState] = useState<UseHierarchyVisibilityResult>({
    getCheckboxState: () => ({ state: "off", isDisabled: true }),
    onCheckboxClicked: () => {},
    triggerRefresh: () => {},
  });

  useEffect(() => {
    visibilityStatusMap.current.clear();
    const handler = visibilityHandlerFactory();

    const visibilityChanged = new Subject<void>();
    const calculate = new Subject<PresentationHierarchyNode>();
    const calculateNodeStatus = (node: PresentationHierarchyNode) => {
      calculate.next(node);
    };

    const resetCache = () => {
      visibilityStatusMap.current.forEach((value) => {
        value.needsRefresh = true;
      });
      visibilityChanged.next();
    };

    const triggerCheckboxUpdate = () => {
      setState((prev) => ({
        ...prev,
        getCheckboxState: createStateGetter(visibilityStatusMap, calculateNodeStatus),
      }));
    };

    const subscription = calculate
      .pipe(
        distinct(undefined, visibilityChanged),
        mergeMap((node) => defer(async () => ({ node, status: await handler.getVisibilityStatus(node.nodeData) })).pipe(takeUntil(visibilityChanged))),
      )
      .subscribe({
        next: ({ node, status }) => {
          visibilityStatusMap.current.set(node.id, {
            node,
            status,
            needsRefresh: false,
          });
          triggerCheckboxUpdate();
        },
      });

    const changeVisibility = (node: PresentationHierarchyNode, checked: boolean) => {
      reportUsage?.({ featureId: "visibility-change", reportInteraction: true });
      void handler.changeVisibility(node.nodeData, checked);
      const entry = visibilityStatusMap.current.get(node.id);
      if (!entry) {
        return;
      }
      entry.status.state = checked ? "visible" : "hidden";
      entry.status.tooltip = undefined;
      triggerCheckboxUpdate();
    };

    setState({
      onCheckboxClicked: changeVisibility,
      getCheckboxState: createStateGetter(visibilityStatusMap, calculateNodeStatus),
      triggerRefresh: () => {
        resetCache();
        triggerCheckboxUpdate();
      },
    });

    const removeListener = handler.onVisibilityChange.addListener(() => {
      resetCache();
      triggerCheckboxUpdate();
    });

    return () => {
      subscription.unsubscribe();
      removeListener();
      handler.dispose();
    };
  }, [visibilityHandlerFactory, reportUsage]);

  return state;
}

function createStateGetter(
  map: MutableRefObject<Map<string, { node: PresentationHierarchyNode; status: VisibilityStatus; needsRefresh: boolean }>>,
  calculateVisibility: (node: PresentationHierarchyNode) => void,
): TreeNodeCheckboxProps["getCheckboxState"] {
  return (node) => {
    const entry = map.current.get(node.id);
    if (entry === undefined) {
      calculateVisibility(node);
      return { state: "off", isDisabled: true };
    }
    if (entry.needsRefresh) {
      calculateVisibility(node);
    }

    const status = entry.status;
    return {
      state: status.state === "visible" ? "on" : status.state === "hidden" ? "off" : "partial",
      tooltip: status.tooltip,
      isDisabled: status.isDisabled,
    };
  };
}
