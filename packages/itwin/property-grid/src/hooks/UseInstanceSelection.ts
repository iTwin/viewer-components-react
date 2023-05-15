/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { useEffect, useState } from "react";
import { UiFramework } from "@itwin/appui-react";
import { Presentation } from "@itwin/presentation-frontend";

import type { IModelConnection } from "@itwin/core-frontend";
import type { InstanceKey, KeySet } from "@itwin/presentation-common";

const PropertyGridSelectionScope = "Property Grid";

/** Props for configuring ancestors navigation. */
export interface AncestorNavigationProps {
  enableAncestorNavigation?: boolean;
}

/** Props for `useInstanceSelection` hook. */
export interface InstanceSelectionProps extends AncestorNavigationProps {
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
 */
export function useInstanceSelection({ imodel, enableAncestorNavigation }: InstanceSelectionProps) {
  const [{ selectedKeys, previousKeys, canNavigateUp, focusedInstanceKey }, setInfo] = useState<InstanceSelectionInfo>({
    selectedKeys: [],
    previousKeys: [],
    canNavigateUp: false,
    focusedInstanceKey: undefined,
  });

  useEffect(() => {
    const onSelectionChange = async (eventSource?: string) => {
      // do not handle selection event that were caused by this hook.
      if (eventSource === PropertyGridSelectionScope) {
        return;
      }

      const selectionSet = Presentation.selection.getSelection(imodel);
      const selectedInstanceKeys = getInstanceKeys(selectionSet);

      // if only single instance is selected and navigation through ancestors is enabled determine if selected instance has single parent and we can navigate up
      const hasParent = !!enableAncestorNavigation && selectedInstanceKeys.length === 1 && (await getParentKey(imodel, selectedInstanceKeys[0])) !== undefined;

      setInfo({
        selectedKeys: selectedInstanceKeys,
        previousKeys: [],
        canNavigateUp: hasParent,
        focusedInstanceKey: undefined,
      });
    };

    // ensure this selection handling runs if component mounts after the selection event fires.
    void onSelectionChange();

    const removePresentationListener = Presentation.selection.selectionChange.addListener(async (args) => onSelectionChange(args.source));
    // if the frontstage changes and a selection set is already active we need to resync this widget's state with that selection
    const removeFrontstageReadyListener = UiFramework.frontstages.onFrontstageReadyEvent.addListener(async () => onSelectionChange());
    return () => {
      removePresentationListener();
      removeFrontstageReadyListener();
    };
  }, [imodel, enableAncestorNavigation]);

  const navigateUp = async () => {
    if (!enableAncestorNavigation || !canNavigateUp || selectedKeys.length !== 1) {
      return;
    }

    const selectedKey = selectedKeys[0];
    const parentKeys = await Presentation.selection.scopes.computeSelection(
      imodel,
      selectedKey.id,
      { id: "element", ancestorLevel: 1 }
    );

    const parentInstanceKeys = getInstanceKeys(parentKeys);
    const hasGrandParent = parentInstanceKeys.length === 1 && (await getParentKey(imodel, parentInstanceKeys[0])) !== undefined;

    Presentation.selection.replaceSelection(
      PropertyGridSelectionScope,
      imodel,
      parentKeys
    );

    setInfo((prev) => ({
      selectedKeys: parentInstanceKeys,
      previousKeys: [...prev.previousKeys, prev.selectedKeys[0]],
      canNavigateUp: hasGrandParent,
      focusedInstanceKey: undefined,
    }));
  };

  const navigateDown = async () => {
    if (!enableAncestorNavigation || previousKeys.length === 0) {
      return;
    }

    const newPreviousKeys = [...previousKeys];
    const currentKey = newPreviousKeys.pop() as InstanceKey;
    // select the current instance key
    Presentation.selection.replaceSelection(
      PropertyGridSelectionScope,
      imodel,
      [currentKey]
    );

    setInfo({
      selectedKeys: [currentKey],
      previousKeys: newPreviousKeys,
      canNavigateUp: true,
      focusedInstanceKey: undefined,
    });
  };

  const ancestorsNavigationProps = {
    navigationEnabled: !!enableAncestorNavigation,
    navigateDown,
    navigateUp,
    canNavigateUp,
    canNavigateDown: previousKeys.length > 0,
  };

  const focusInstance = (key: InstanceKey) => {
    setInfo((prev) => ({
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

async function getParentKey(imodel: IModelConnection, key: InstanceKey) {
  const parentKeys = await Presentation.selection.scopes.computeSelection(
    imodel,
    key.id,
    { id: "element", ancestorLevel: 1 }
  );

  // current instance key is returned from `computeSelection` if it does not have parent. Need to filter it out.
  const instanceKeys = getInstanceKeys(parentKeys).filter((parentKey) => parentKey.className !== key.className && parentKey.id !== key.id);
  if (instanceKeys.length !== 1) {
    return undefined;
  }

  return instanceKeys[0];
}

function getInstanceKeys(keys: Readonly<KeySet>) {
  const selectedInstanceKeys: InstanceKey[] = [];
  keys.instanceKeys.forEach(
    (ids: Set<string>, className: string) => {
      ids.forEach((id: string) => {
        selectedInstanceKeys.push({
          id,
          className,
        });
      });
    }
  );

  return selectedInstanceKeys;
}
