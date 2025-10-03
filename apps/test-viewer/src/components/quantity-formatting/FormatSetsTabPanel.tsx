/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import React from "react";
import { Button, Flex, Text } from "@itwin/itwinui-react";
import { FormatSetPanel, FormatSetSelector } from "@itwin/quantity-formatting-react";
import { FormatManager } from "./FormatManager";

import type { FormatSet } from "@itwin/ecschema-metadata";

// Test format sets for development
const testFormatSets: FormatSet[] = [
  {
    name: "TestFormatSet1",
    label: "Arizona Highway Project (Civil)",
    unitSystem: "imperial",
    description:
      "This format set contains all the formatting standards used by civil engineers on the Arizona Highway Project. Includes units for measurements, coordinates, and construction materials.",
    formats: {},
  },
  {
    name: "TestFormatSet2",
    label: "Arizona Highway Project (Project Manager)",
    unitSystem: "imperial",
    description: "This format set contains all the formatting standards used by project managers on the Arizona Highway Project.",
    formats: {},
  },
  {
    name: "TestFormatSet3",
    label: "My personal format set",
    unitSystem: "metric",
    description: "Custom formatting preferences for individual use. Combines metric and imperial units based on personal workflow requirements.",
    formats: {},
  },
];

/** Tab panel component for Format Sets management */
export const FormatSetsTabPanel: React.FC = () => {
  const [formatSets, setFormatSets] = React.useState<FormatSet[]>([]);
  const [activeFormatSetKey, setActiveFormatSetKey] = React.useState<string | undefined>();
  const [selectedFormatSetKey, setSelectedFormatSetKey] = React.useState<string | undefined>();
  const [selectedFormatSet, setSelectedFormatSet] = React.useState<FormatSet | undefined>();
  const [clonedSelectedFormatSet, setClonedSelectedFormatSet] = React.useState<FormatSet | undefined>();
  const [saveEnabled, setSaveEnabled] = React.useState(false);

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
        setClonedSelectedFormatSet({ ...formatManager.activeFormatSet });
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
    setClonedSelectedFormatSet({ ...formatSet });
    setSaveEnabled(false);
  }, []);

  const handleApplyFormatSet = React.useCallback(() => {
    if (selectedFormatSet) {
      const formatManager = FormatManager.instance;
      if (formatManager) {
        formatManager.setActiveFormatSet(selectedFormatSet);
      }
    }
  }, [selectedFormatSet]);

  const handleFormatSetChanged = React.useCallback((updatedFormatSet: FormatSet) => {
    setClonedSelectedFormatSet(updatedFormatSet);
    setSaveEnabled(true);
  }, []);

  const handleSaveFormatSet = React.useCallback(() => {
    if (clonedSelectedFormatSet && selectedFormatSetKey) {
      // Update the format set in the formatSets array
      const updatedFormatSets = formatSets.map((formatSet) => (formatSet.name === selectedFormatSetKey ? clonedSelectedFormatSet : formatSet));
      setFormatSets(updatedFormatSets);
      setSelectedFormatSet(clonedSelectedFormatSet);
      setSaveEnabled(false);
      // Update FormatManager with the new format sets
      const formatManager = FormatManager.instance;
      if (formatManager) {
        // Update the format sets in FormatManager
        formatManager.formatSets = updatedFormatSets;

        // If the cloned format set is the active one, replace the active format set
        if (formatManager.activeFormatSet && clonedSelectedFormatSet.name === formatManager.activeFormatSet.name) {
          formatManager.setActiveFormatSet(clonedSelectedFormatSet);
        }
      }
    }
  }, [clonedSelectedFormatSet, selectedFormatSetKey, formatSets]);

  const handleClearFormatSet = React.useCallback(() => {
    if (selectedFormatSet) {
      setClonedSelectedFormatSet({ ...selectedFormatSet });
      setSaveEnabled(false);
    }
  }, [selectedFormatSet]);

  const handleCancelSelection = React.useCallback(() => {
    // Reset selection to the currently active format set
    setSelectedFormatSetKey(activeFormatSetKey);
    const formatManager = FormatManager.instance;
    if (formatManager && formatManager.activeFormatSet) {
      setSelectedFormatSet(formatManager.activeFormatSet);
      setClonedSelectedFormatSet({ ...formatManager.activeFormatSet });
    }
    setSaveEnabled(false);
  }, [activeFormatSetKey]);

  const hasChanges = selectedFormatSetKey !== activeFormatSetKey;

  return (
    <Flex flexDirection="row" gap="l" className="format-tab-panel">
      <Flex.Item className="quantity-format-selector-item">
        <Flex flexDirection="column" alignItems="flex-start" gap="m">
          {activeFormatSetKey && (
            <Text variant="leading" style={{ marginTop: "0.25rem" }}>
              Active: {formatSets.find((fs) => fs.name === activeFormatSetKey)?.label || activeFormatSetKey}
            </Text>
          )}
          <div style={{ height: "30rem" }}>
            <FormatSetSelector formatSets={formatSets} selectedFormatSetKey={selectedFormatSetKey} onFormatSetChange={handleFormatSetChange} />
          </div>
          <Flex flexDirection="row" gap="xs" justifyContent="flex-end">
            <Button size="small" styleType="default" onClick={handleCancelSelection} disabled={!hasChanges}>
              Cancel
            </Button>
            <Button size="small" styleType="high-visibility" onClick={handleApplyFormatSet} disabled={!hasChanges || !selectedFormatSet}>
              Set as Active
            </Button>
          </Flex>
        </Flex>
      </Flex.Item>

      <Flex.Item className="quantity-format-panel-item">
        <Flex flexDirection="column" gap="xs">
          <FormatSetPanel formatSet={clonedSelectedFormatSet} editable={true} onFormatSetChange={handleFormatSetChanged} />
          <Flex.Item alignSelf="flex-end">
            <Flex gap="xs">
              <Button size="small" styleType="default" onClick={handleClearFormatSet} disabled={!saveEnabled}>
                Clear
              </Button>
              <Button size="small" styleType="high-visibility" onClick={handleSaveFormatSet} disabled={!saveEnabled}>
                Save
              </Button>
            </Flex>
          </Flex.Item>
        </Flex>
      </Flex.Item>
    </Flex>
  );
};
