/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import React from "react";
import { Button, Flex, Text } from "@itwin/itwinui-react";
import { FormatSetPanel, FormatSetSelector } from "@itwin/quantity-formatting-react";

import type { FormatSet } from "@itwin/ecschema-metadata";
import type { FormatManager } from "./FormatManager";

interface FormatSetsTabPanelProps {
  formatManager: FormatManager;
}

/** Tab panel component for Format Sets management */
export const FormatSetsTabPanel: React.FC<FormatSetsTabPanelProps> = ({ formatManager }) => {
  const [formatSets, setFormatSets] = React.useState<FormatSet[]>([]);
  const [activeFormatSetKey, setActiveFormatSetKey] = React.useState<string | undefined>();
  const [selectedFormatSet, setSelectedFormatSet] = React.useState<FormatSet | undefined>();
  const [clonedSelectedFormatSet, setClonedSelectedFormatSet] = React.useState<FormatSet | undefined>();
  const [saveEnabled, setSaveEnabled] = React.useState(false);

  // Load format sets from FormatManager (includes test format sets added at startup)
  React.useEffect(() => {
    setFormatSets(formatManager.formatSets);

    // Set active format set if one exists
    if (formatManager.activeFormatSet) {
      const activeKey = formatManager.activeFormatSet.name;
      setActiveFormatSetKey(activeKey);
      setSelectedFormatSet(formatManager.activeFormatSet);
      setClonedSelectedFormatSet({ ...formatManager.activeFormatSet });
    }

    return formatManager.onActiveFormatSetChanged.addListener((formatSet) => {
      if (formatSet) {
        setActiveFormatSetKey(formatSet.name);
      } else {
        setActiveFormatSetKey(undefined);
      }
    });
  }, [formatManager]);

  const handleFormatSetChange = React.useCallback((formatSet: FormatSet, _key: string) => {
    setSelectedFormatSet(formatSet);
    setClonedSelectedFormatSet({ ...formatSet });
    setSaveEnabled(false);
  }, []);

  const handleApplyFormatSet = React.useCallback(() => {
    if (selectedFormatSet) {
      formatManager.setActiveFormatSet(selectedFormatSet);
    }
  }, [selectedFormatSet, formatManager]);

  const handleSelectedFormatSetChange = React.useCallback((updatedFormatSet: FormatSet) => {
    setClonedSelectedFormatSet(updatedFormatSet);
    setSaveEnabled(true);
  }, []);

  const handleSaveFormatSet = React.useCallback(() => {
    if (clonedSelectedFormatSet) {
      // Update the format set in FormatManager
      const updatedFormatSets = formatManager.formatSets.map((formatSet) =>
        formatSet.name === clonedSelectedFormatSet.name ? clonedSelectedFormatSet : formatSet,
      );
      formatManager.formatSets = updatedFormatSets;
      setFormatSets(updatedFormatSets);

      // If the cloned format set is the active one, replace the active format set
      if (formatManager.activeFormatSet && clonedSelectedFormatSet.name === formatManager.activeFormatSet.name) {
        formatManager.setActiveFormatSet(clonedSelectedFormatSet);
      }

      setSelectedFormatSet(clonedSelectedFormatSet);
      setSaveEnabled(false);
    }
  }, [clonedSelectedFormatSet, formatManager]);

  const handleClearFormatSet = React.useCallback(() => {
    if (selectedFormatSet) {
      setClonedSelectedFormatSet({ ...selectedFormatSet });
      setSaveEnabled(false);
    }
  }, [selectedFormatSet]);

  return (
    <Flex flexDirection="row" gap="l" className="format-tab-panel">
      <Flex.Item className="quantity-format-selector-item">
        <Flex flexDirection="column" gap="m" alignItems="none">
          <div style={{ height: "36rem" }}>
            <FormatSetSelector
              formatSets={formatSets}
              selectedFormatSetKey={selectedFormatSet?.name}
              activeFormatSetKey={activeFormatSetKey}
              onFormatSetChange={handleFormatSetChange}
            />
          </div>
        </Flex>
      </Flex.Item>

      <Flex.Item className="quantity-format-panel-item">
        <Flex flexDirection="column" gap="xs" alignItems="stretch">
          {clonedSelectedFormatSet ? (
            <FormatSetPanel formatSet={clonedSelectedFormatSet} editable={true} onFormatSetChange={handleSelectedFormatSetChange} />
          ) : (
            <Flex className="quantityFormat--formatSetPanel-emptyState">
              <Text variant="leading" isMuted>
                Select a format set to view details
              </Text>
            </Flex>
          )}
          <Flex.Item alignSelf="flex-end">
            <Flex gap="xs">
              <Button size="small" styleType="default" onClick={handleClearFormatSet} disabled={!saveEnabled}>
                Clear
              </Button>
              <Button size="small" styleType="high-visibility" onClick={handleSaveFormatSet} disabled={!saveEnabled}>
                Save
              </Button>
              <Button
                size="small"
                styleType="default"
                onClick={handleApplyFormatSet}
                disabled={activeFormatSetKey === selectedFormatSet?.name || !selectedFormatSet}
              >
                Set as Active
              </Button>
            </Flex>
          </Flex.Item>
        </Flex>
      </Flex.Item>
    </Flex>
  );
};
