/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useEffect, useRef, useState } from "react";
import { UiFramework } from "@itwin/appui-react";
import { Guid, Id64 } from "@itwin/core-bentley";
import { KeySet } from "@itwin/presentation-common";
import { createECSqlQueryExecutor } from "@itwin/presentation-core-interop";
import { Presentation } from "@itwin/presentation-frontend";
import { computeSelection } from "@itwin/unified-selection";
import { useTelemetryContext } from "./UseTelemetryContext.js";

import type { InstanceKey } from "@itwin/presentation-common";
import type { IModelConnection } from "@itwin/core-frontend";
import type { SelectableInstanceKey } from "@itwin/unified-selection";
import type { ECSqlQueryExecutor } from "@itwin/presentation-shared";

const PropertyGridSelectionScope = "Property Grid";

/**
 * Props for `useInstanceSelection` hook.
 * @internal
 */
export interface InstanceSelectionProps {
  imodel: IModelConnection;
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
export function useInstanceSelection({ imodel }: InstanceSelectionProps) {
  const { state, updateStateAsync, updateStateImmediate } = useLatestState<InstanceSelectionInfo>({
    selectedKeys: [],
    previousKeys: [],
    canNavigateUp: false,
    focusedInstanceKey: undefined,
  });
  const { selectedKeys, previousKeys, canNavigateUp, focusedInstanceKey } = state;
  const { onFeatureUsed } = useTelemetryContext();

  const [queryExecutor, setQueryExecutor] = useState(() => createECSqlQueryExecutor(imodel));
  useEffect(() => {
    setQueryExecutor(createECSqlQueryExecutor(imodel));
  }, [imodel]);

  useEffect(() => {
    const onSelectionChange = async (eventSource?: string) => {
      // do not handle selection event that were caused by this hook.
      /* c8 ignore next 3 */
      if (eventSource === PropertyGridSelectionScope) {
        return;
      }

      await updateStateAsync(
        async () => {
          const selectionSet = Presentation.selection.getSelection(imodel);
          const selectedInstanceKeys = getInstanceKeys(selectionSet);
          // if only single instance is selected and navigation through ancestors is enabled determine if selected instance has single parent and we can navigate up
          const hasAncestor = selectedInstanceKeys.length === 1 && (await hasParent(queryExecutor, selectedInstanceKeys[0]));
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

    const removePresentationListener = Presentation.selection.selectionChange.addListener(async (args) => onSelectionChange(args.source));
    // if the frontstage changes and a selection set is already active we need to resync this widget's state with that selection
    /* c8 ignore next */
    const removeFrontstageReadyListener = UiFramework.frontstages.onFrontstageReadyEvent.addListener(async () => onSelectionChange());
    return () => {
      removePresentationListener();
      removeFrontstageReadyListener();
    };
  }, [imodel, queryExecutor, updateStateAsync]);

  const navigateUp = async () => {
    if (!canNavigateUp || selectedKeys.length !== 1) {
      return;
    }

    onFeatureUsed("ancestor-navigation");
    const selectedKey = selectedKeys[0];
    updateStateImmediate((prev) => ({ ...prev, canNavigateUp: false }));

    await updateStateAsync(
      async () => {
        let parentInstanceKeys: SelectableInstanceKey[] = [];
        for await (const key of computeSelection({
          queryExecutor,
          elementIds: [selectedKey.id],
          scope: { id: "element", ancestorLevel: 1 },
        })) {
          parentInstanceKeys.push(key);
        }
        parentInstanceKeys = omitTransientKeys(parentInstanceKeys);
        const hasGrandParent = parentInstanceKeys.length === 1 && (await hasParent(queryExecutor, parentInstanceKeys[0]));

        Presentation.selection.replaceSelection(PropertyGridSelectionScope, imodel, new KeySet(parentInstanceKeys));
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
    Presentation.selection.replaceSelection(PropertyGridSelectionScope, imodel, [currentKey]);

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

async function hasParent(queryExecutor: ECSqlQueryExecutor, key: InstanceKey): Promise<boolean> {
  const parentKeys = computeSelection({
    queryExecutor,
    elementIds: [key.id],
    scope: { id: "element", ancestorLevel: 1 },
  });
  for await (const parentKey of parentKeys) {
    // current instance key is returned from `computeSelection` if it does not have parent. Need to filter it out.
    if (parentKey.className !== key.className || parentKey.id !== key.id) {
      return true;
    }
  }
  return false;
}

function omitTransientKeys(keys: SelectableInstanceKey[]) {
  return (
    keys
      .filter((key) => !Id64.isTransient(key.id))
      // make sure all instance keys are in `SchemaName:ClassName` format
      .map((key) => ({ id: key.id, className: key.className.replace(".", ":") }))
  );
}

function getInstanceKeys(keys: Readonly<KeySet>) {
  const selectedInstanceKeys: InstanceKey[] = [];
  keys.instanceKeys.forEach((ids: Set<string>, className: string) => {
    ids.forEach((id: string) => {
      selectedInstanceKeys.push({ id, className });
    });
  });
  return omitTransientKeys(selectedInstanceKeys);
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
