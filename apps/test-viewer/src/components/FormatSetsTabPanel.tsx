/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import React from "react";
import { Button, Flex, Text } from "@itwin/itwinui-react";
import { FormatManager } from "./FormatManager";
import { FormatSetPanel } from "./FormatSetPanel";
import { FormatSetSelector } from "./FormatSetSelector";

import type { FormatSet } from "@itwin/ecschema-metadata";

// Test format sets for development
const testFormatSets: FormatSet[] = [
  {
    name: "TestFormatSet1",
    label: "Arizona Highway Project (Civil)",
    formats: {},
  },
  {
    name: "TestFormatSet2",
    label: "Arizona Highway Project (Project Manager)",
    formats: {},
  },
  {
    name: "TestFormatSet3",
    label: "My personal format set",
    formats: {},
  },
];

/** Tab panel component for Format Sets management */
export const FormatSetsTabPanel: React.FC = () => {
  const [formatSets, setFormatSets] = React.useState<FormatSet[]>([]);
  const [activeFormatSetKey, setActiveFormatSetKey] = React.useState<string | undefined>();
  const [selectedFormatSetKey, setSelectedFormatSetKey] = React.useState<string | undefined>();
  const [selectedFormatSet, setSelectedFormatSet] = React.useState<FormatSet | undefined>();

  // Load format sets from FormatManager
  React.useEffect(() => {
    const formatManager = FormatManager.instance;
    if (formatManager) {
      console.log(formatManager.formatSets);
      // Combine FormatManager format sets with test format sets
      const combinedFormatSets = [...formatManager.formatSets, ...testFormatSets];
      setFormatSets(combinedFormatSets);

      // Set active format set if one exists
      if (formatManager.activeFormatSet) {
        const activeKey = formatManager.activeFormatSet.name;
        setActiveFormatSetKey(activeKey);
        setSelectedFormatSetKey(activeKey); // Initially select the active one
        setSelectedFormatSet(formatManager.activeFormatSet);
      }

      // Listen for active format set changes
      const removeListener = formatManager.onActiveFormatSetChanged.addListener((formatSet) => {
        if (formatSet) {
          setActiveFormatSetKey(formatSet.name);
        } else {
          setActiveFormatSetKey(undefined);
        }
      });

      return () => {
        removeListener();
      };
    } else {
      // If no FormatManager, just use test format sets
      setFormatSets(testFormatSets);
    }
  }, []);

  const handleFormatSetChange = React.useCallback((formatSet: FormatSet, key: string) => {
    setSelectedFormatSetKey(key);
    setSelectedFormatSet(formatSet);
  }, []);

  const handleApplyFormatSet = React.useCallback(() => {
    if (selectedFormatSet) {
      const formatManager = FormatManager.instance;
      if (formatManager) {
        formatManager.setActiveFormatSet(selectedFormatSet);
      }
    }
  }, [selectedFormatSet]);

  const handleCancelSelection = React.useCallback(() => {
    // Reset selection to the currently active format set
    setSelectedFormatSetKey(activeFormatSetKey);
    const formatManager = FormatManager.instance;
    if (formatManager && formatManager.activeFormatSet) {
      setSelectedFormatSet(formatManager.activeFormatSet);
    }
  }, [activeFormatSetKey]);

  const hasChanges = selectedFormatSetKey !== activeFormatSetKey;

  return (
    <Flex flexDirection="row" gap="l" className="format-tab-panel">
      <Flex.Item className="quantity-format-selector-item">
        <Flex flexDirection="column" alignItems="stretch" gap="m">
          <FormatSetSelector formatSets={formatSets} selectedFormatSetKey={selectedFormatSetKey} onFormatSetChange={handleFormatSetChange} />

          {selectedFormatSet && (
            <Flex flexDirection="column" alignItems="center" gap="xs">
              <Text variant="body">Selected: {selectedFormatSet.label}</Text>
              {activeFormatSetKey && (
                <Text variant="small" isMuted>
                  Active: {formatSets.find((fs) => fs.name === activeFormatSetKey)?.label || activeFormatSetKey}
                </Text>
              )}
            </Flex>
          )}

          <Flex flexDirection="row" gap="s" justifyContent="flex-end">
            <Button size="small" styleType="default" onClick={handleCancelSelection} disabled={!hasChanges}>
              Cancel
            </Button>
            <Button size="small" styleType="high-visibility" onClick={handleApplyFormatSet} disabled={!hasChanges || !selectedFormatSet}>
              Apply Format Set
            </Button>
          </Flex>
        </Flex>
      </Flex.Item>

      <Flex.Item className="quantity-format-panel-item">
        <FormatSetPanel formatSet={selectedFormatSet} />
      </Flex.Item>
    </Flex>
  );
};
