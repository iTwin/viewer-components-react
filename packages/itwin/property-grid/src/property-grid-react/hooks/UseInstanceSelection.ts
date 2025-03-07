/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useRef, useState } from "react";
import { UiFramework } from "@itwin/appui-react";
import { Guid, Id64 } from "@itwin/core-bentley";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { normalizeFullClassName } from "@itwin/presentation-shared";
import { computeSelection, Selectables } from "@itwin/unified-selection";
import { useTelemetryContext } from "./UseTelemetryContext.js";
import { useSelectionHandler } from "./UseUnifiedSelectionHandler.js";

import type { SelectionStorage } from "./UseUnifiedSelectionHandler.js";
import type { ECSqlQueryExecutor } from "@itwin/presentation-shared";
import type { InstanceKey } from "@itwin/presentation-common";
import type { IModelConnection } from "@itwin/core-frontend";
import type { SelectableInstanceKey } from "@itwin/unified-selection";

const PropertyGridSelectionScope = "Property Grid";

/**
 * Props for `useInstanceSelection` hook.
 * @internal
 */
export interface InstanceSelectionProps {
  imodel: IModelConnection;
  selectionStorage?: SelectionStorage;
  getParentInstanceKey?: (key: InstanceKey) => Promise<InstanceKey | undefined>;
}

/** Data structure that contains information about instances selection. */
interface InstanceSelectionInfo {
  /** Currently selected instance keys */
  selectedKeys: InstanceKey[];
  /**
   * Instance keys path that represents path from some instance to current selected instance that was reached
   * while navigating through ancestors upwards.
   */
  previousKeys: InstanceKey[];
  /** Specifies if it is possible to navigate from currently selected instance upwards */
  canNavigateUp: boolean;
  /** Currently focused instance. */
  focusedInstanceKey: InstanceKey | undefined;
}

/**
 * Custom hook that tracks instances selected in `UnifiedSelection`. Additionally it implements these features:
 * - If single instance is selected `ancestorsNavigationProps` returned from this hook can be used to navigate through ancestors.
 *   It allows to navigate to the top most parent and navigate back to the starting instance. Navigating up and downs updates `UnifiedSelection`.
 * - Focus single instance until `UnifiedSelection` is changed.
 * @internal
 */
export function useInstanceSelection(props: InstanceSelectionProps) {
  const { imodel, selectionStorage } = props;
  const { state, updateStateAsync, updateStateImmediate } = useLatestState<InstanceSelectionInfo>({
    selectedKeys: [],
    previousKeys: [],
    canNavigateUp: false,
    focusedInstanceKey: undefined,
  });
  const { selectedKeys, previousKeys, canNavigateUp, focusedInstanceKey } = state;
  const { onFeatureUsed } = useTelemetryContext();
  const { selectionChange, getSelection, replaceSelection } = useSelectionHandler({ selectionStorage });

  const [queryExecutor, setQueryExecutor] = useState(createECSqlQueryExecutor(imodel));
  useEffect(() => {
    setQueryExecutor(createECSqlQueryExecutor(imodel));
  }, [imodel]);

  const getParentInstanceKey = useCallback(
    async (key: InstanceKey) => {
      const impl = props.getParentInstanceKey ?? createDefaultGetParentInstanceKey(queryExecutor);
      return impl(key);
    },
    [props.getParentInstanceKey, queryExecutor],
  );

  useEffect(() => {
    const onSelectionChange = async (eventSource?: string) => {
      // do not handle selection event that were caused by this hook.
      /* c8 ignore next 3 */
      if (eventSource === PropertyGridSelectionScope) {
        return;
      }

      await updateStateAsync(
        async () => {
          const allInstanceKeys = [];
          for await (const key of Selectables.load(getSelection({ imodel, level: 0 }))) {
            allInstanceKeys.push(key);
          }
          const selectedInstanceKeys = omitTransientKeys(allInstanceKeys);
          // if only single instance is selected and navigation through ancestors is enabled determine if selected instance has single parent and we can navigate up
          const hasAncestor = selectedInstanceKeys.length === 1 && (await getParentInstanceKey(selectedInstanceKeys[0])) !== undefined;
          return {
            selectedInstanceKeys,
            hasAncestor,
          };
        },
        (_, { selectedInstanceKeys, hasAncestor }) => {
          return {
            selectedKeys: selectedInstanceKeys,
            previousKeys: [],
            canNavigateUp: hasAncestor,
            focusedInstanceKey: undefined,
          };
        },
      );
    };

    // ensure this selection handling runs if component mounts after the selection event fires.
    void onSelectionChange();

    const removePresentationListener = selectionChange.addListener(async (args) => onSelectionChange(args.source));
    // if the frontstage changes and a selection set is already active we need to resync this widget's state with that selection
    /* c8 ignore next */
    const removeFrontstageReadyListener = UiFramework.frontstages.onFrontstageReadyEvent.addListener(async () => onSelectionChange());
    return () => {
      removePresentationListener();
      removeFrontstageReadyListener();
    };
  }, [imodel, queryExecutor, selectionChange, getSelection, updateStateAsync, getParentInstanceKey]);

  const navigateUp = async () => {
    if (!canNavigateUp || selectedKeys.length !== 1) {
      return;
    }

    onFeatureUsed("ancestor-navigation");
    const selectedKey = selectedKeys[0];
    updateStateImmediate((prev) => ({ ...prev, canNavigateUp: false }));

    await updateStateAsync(
      async () => {
        const parentInstanceKey = await getParentInstanceKey(selectedKey);
        const parentInstanceKeys = parentInstanceKey ? omitTransientKeys([parentInstanceKey]) : [];
        const hasGrandParent = parentInstanceKeys.length === 1 && (await getParentInstanceKey(parentInstanceKeys[0])) !== undefined;

        replaceSelection({ source: PropertyGridSelectionScope, imodel, selectables: parentInstanceKeys, level: 0 });
        return {
          parentInstanceKeys,
          hasGrandParent,
        };
      },
      (prevState, { parentInstanceKeys, hasGrandParent }) => ({
        selectedKeys: parentInstanceKeys,
        previousKeys: [...prevState.previousKeys, prevState.selectedKeys[0]],
        canNavigateUp: hasGrandParent,
        focusedInstanceKey: undefined,
      }),
    );
  };

  const navigateDown = () => {
    if (previousKeys.length === 0) {
      return;
    }

    const newPreviousKeys = [...previousKeys];
    const currentKey = newPreviousKeys.pop() as InstanceKey;
    // select the current instance key
    replaceSelection({ source: PropertyGridSelectionScope, imodel, selectables: [currentKey], level: 0 });

    onFeatureUsed("ancestor-navigation");
    updateStateImmediate(() => ({
      selectedKeys: [currentKey],
      previousKeys: newPreviousKeys,
      canNavigateUp: true,
      focusedInstanceKey: undefined,
    }));
  };

  const ancestorsNavigationProps = {
    navigateDown,
    navigateUp,
    canNavigateUp,
    canNavigateDown: previousKeys.length > 0,
  };

  const focusInstance = (key: InstanceKey) => {
    updateStateImmediate((prev) => ({
      ...prev,
      focusedInstanceKey: key,
    }));
  };

  return {
    selectedKeys,
    focusedInstanceKey,
    focusInstance,
    ancestorsNavigationProps,
  };
}

function omitTransientKeys(keys: SelectableInstanceKey[]) {
  return keys.filter((key) => !Id64.isTransient(key.id));
}

/**
 * Custom hook that handles async state changes. State matches the one produced by the last `update` call.
 * If there are any ongoing async operations computing payload needed to update state and `update` is invoked again, all ongoing operations are ignored.
 */
function useLatestState<TState>(initialValue: TState) {
  const [state, setState] = useState<TState>(initialValue);
  const inProgressId = useRef<string>();

  /** Immediately updates state and makes sure all ongoing operations are ignored. */
  const updateStateImmediate = useRef((produceNewState: (prev: TState) => TState) => {
    inProgressId.current = Guid.createValue();
    setState(produceNewState);
  });

  /** Starts async operation that computes payload for new state and makes sure all ongoing operations are ignored. */
  const updateStateAsync = useRef(async <T>(generatePayload: () => Promise<T>, produceNewState: (prevState: TState, payload: T) => TState) => {
    const currentId = Guid.createValue();
    inProgressId.current = currentId;

    const payload = await generatePayload();
    if (inProgressId.current === currentId) {
      setState((prev) => produceNewState(prev, payload));
    }
  });

  return {
    state,
    updateStateImmediate: updateStateImmediate.current,
    updateStateAsync: updateStateAsync.current,
  };
}

function createDefaultGetParentInstanceKey(queryExecutor: ECSqlQueryExecutor) {
  return async (key: InstanceKey): Promise<InstanceKey | undefined> => {
    const parentKeys = computeSelection({
      queryExecutor,
      elementIds: [key.id],
      scope: { id: "element", ancestorLevel: 1 },
    });
    for await (const parentKey of parentKeys) {
      // current instance key is returned from `computeSelection` if it does not have parent. Need to filter it out.
      if (normalizeFullClassName(parentKey.className) !== normalizeFullClassName(key.className) || parentKey.id !== key.id) {
        return parentKey;
      }
    }
    return undefined;
  };
}
