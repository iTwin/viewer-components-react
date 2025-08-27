/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useEffect, useRef, useState } from "react";
import {
  asyncScheduler,
  defer,
  distinct,
  EMPTY,
  from,
  lastValueFrom,
  mergeMap,
  observeOn,
  onErrorResumeNextWith,
  Subject,
  takeUntil,
  tap,
  throttleTime,
} from "rxjs";
import { createTooltip } from "./internal/Tooltip.js";
import { useTelemetryContext } from "./UseTelemetryContext.js";

import type { Observable } from "rxjs";
import type { MutableRefObject } from "react";
import type { BeEvent } from "@itwin/core-bentley";
import type { HierarchyNode, PresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import type { TreeItemVisibilityButtonState, VisibilityContext } from "./components/TreeNodeVisibilityButton.js";

/**
 * Data structure that describes instance visibility status.
 * @beta
 */
export interface VisibilityStatus {
  /** Instance visibility state. */
  state: "visible" | "partial" | "hidden";
  /** Specifies whether visibility changing is disabled or not. */
  isDisabled?: boolean;
}

/**
 * Handler that can be used to determine and change visibility of instances represented by tree nodes.
 * @beta
 */
export interface HierarchyVisibilityHandler extends Disposable {
  /** Event used to notify tree about visibility changes from outside. */
  readonly onVisibilityChange: BeEvent<() => void>;
  /** Returns current visibility status for tree node. */
  getVisibilityStatus(node: HierarchyNode): Promise<VisibilityStatus> | VisibilityStatus;
  /** Changes visibility of the instance represented by tree node. */
  changeVisibility(node: HierarchyNode, on: boolean): Promise<void>;
}

interface UseHierarchyVisibilityProps {
  visibilityHandlerFactory: () => HierarchyVisibilityHandler;
}

/** @internal */
export function useHierarchyVisibility({ visibilityHandlerFactory }: UseHierarchyVisibilityProps): VisibilityContext & { triggerRefresh: () => void } {
  const visibilityStatusMap = useRef(new Map<string, { node: PresentationHierarchyNode; status: TreeItemVisibilityButtonState; needsRefresh: boolean }>());
  const [state, setState] = useState<VisibilityContext & { triggerRefresh: () => void }>({
    getVisibilityButtonState: () => ({ state: "visible", isDisabled: true }),
    onVisibilityButtonClick: () => {},
    triggerRefresh: () => {},
  });
  const { onFeatureUsed } = useTelemetryContext();

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
        getVisibilityButtonState: createStateGetter(visibilityStatusMap, calculateNodeStatus),
      }));
    };

    const subscription = calculate
      .pipe(
        distinct(undefined, visibilityChanged),
        observeOn(asyncScheduler),
        mergeMap((node) =>
          defer(async () => handler.getVisibilityStatus(node.nodeData)).pipe(
            tap({
              next: (status) => {
                visibilityStatusMap.current.set(node.id, {
                  node,
                  status: {
                    ...status,
                    tooltip: createTooltip(status.state),
                  },
                  needsRefresh: false,
                });
              },
            }),
            takeUntil(visibilityChanged),
            onErrorResumeNextWith(EMPTY),
          ),
        ),
        throttleTime(100, undefined, { leading: false, trailing: true }),
      )
      .subscribe({
        next: () => {
          triggerCheckboxUpdate();
        },
      });

    const changeVisibility: VisibilityContext["onVisibilityButtonClick"] = (node, visibilityState) => {
      onFeatureUsed({ featureId: "visibility-change", reportInteraction: true });
      // visible should become hidden, partial and hidden should become visible TODO: redo for clarity
      const on = visibilityState === "visible" ? false : true;
      void handler.changeVisibility(node.nodeData, on);
      const entry = visibilityStatusMap.current.get(node.id);
      if (!entry) {
        return;
      }
      entry.status.state = visibilityState;
      entry.status.tooltip = createTooltip("determining");
      triggerCheckboxUpdate();
    };

    setState({
      onVisibilityButtonClick: changeVisibility,
      getVisibilityButtonState: createStateGetter(visibilityStatusMap, calculateNodeStatus),
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
      handler[Symbol.dispose]();
    };
  }, [visibilityHandlerFactory, onFeatureUsed]);

  return state;
}

function createStateGetter(
  map: MutableRefObject<Map<string, { node: PresentationHierarchyNode; status: TreeItemVisibilityButtonState; needsRefresh: boolean }>>,
  calculateVisibility: (node: PresentationHierarchyNode) => void,
): VisibilityContext["getVisibilityButtonState"] {
  return (node) => {
    const entry = map.current.get(node.id);
    if (entry === undefined) {
      calculateVisibility(node);
      return { state: "visible", isDisabled: true, tooltip: createTooltip("determining") };
    }
    if (entry.needsRefresh) {
      calculateVisibility(node);
    }

    const status = entry.status;
    return {
      state: status.state,
      tooltip: status.tooltip,
      isDisabled: status.isDisabled,
    };
  };
}

/**
 * Properties for an overridden method of a `HierarchyVisibilityHandler` implementation.
 * @beta
 */
export type HierarchyVisibilityHandlerOverridableMethodProps<TFunc> = TFunc extends (props: infer TProps) => infer TResult
  ? TProps & {
      /** A callback that produces the value from the original implementation. */
      readonly originalImplementation: () => TResult;
      /**
       * Reference to the hierarchy based handler.
       * @note Calling `getVisibility` or `changeVisibility` of this object invokes the overridden implementation as well.
       */
      readonly handler: HierarchyVisibilityHandler;
    }
  : never;

/**
 * Function type for an overridden method of `HierarchyVisibilityHandler`.
 * @beta
 */
export type HierarchyVisibilityHandlerOverridableMethod<TFunc> = TFunc extends (...args: any[]) => infer TResult
  ? (props: HierarchyVisibilityHandlerOverridableMethodProps<TFunc>) => TResult
  : never;

/** @internal */
export class HierarchyVisibilityOverrideHandler {
  #baseHandler: HierarchyVisibilityHandler;
  constructor(baseHandler: HierarchyVisibilityHandler) {
    this.#baseHandler = baseHandler;
  }
  public createVisibilityHandlerResult<TResult, TOverrideProps>(props: {
    nonOverridenResult: Observable<TResult>;
    override: HierarchyVisibilityHandlerOverridableMethod<(props: TOverrideProps) => Promise<TResult>> | undefined;
    overrideProps: TOverrideProps;
  }): Observable<TResult> {
    const { nonOverridenResult, override, overrideProps } = props;
    return override
      ? from(
          override({
            ...overrideProps,
            originalImplementation: async () => lastValueFrom(nonOverridenResult, { defaultValue: undefined as TResult }),
            handler: this.#baseHandler,
          }),
        )
      : nonOverridenResult;
  }
}
