/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import React from "react";
import { Flex, Input, List, ListItem, Text } from "@itwin/itwinui-react";

import type { FormatSet } from "@itwin/ecschema-metadata";

/**
 * Props for the FormatSetSelector component
 */
interface FormatSetSelectorProps {
  formatSets?: FormatSet[];
  selectedFormatSetKey?: string;
  onFormatSetChange: (formatSet: FormatSet, key: string) => void;
}

/**
 * A React component that renders a format set selector with searchable list for choosing format sets.
 */
export const FormatSetSelector: React.FC<FormatSetSelectorProps> = ({
  formatSets = [],
  selectedFormatSetKey,
  onFormatSetChange,
}) => {
  const [searchTerm, setSearchTerm] = React.useState("");

  // Prepare format set entries
  const formatSetEntries = React.useMemo(() => {
    return formatSets.map((formatSet, index) => ({
      key: formatSet.name || `formatSet-${index}`,
      formatSet,
      label: formatSet.label,
      description: "", // FormatSet doesn't have description property
    }));
  }, [formatSets]);

  // Filter format sets based on search term
  const filteredFormatSets = React.useMemo(() => {
    if (!searchTerm.trim()) {
      return formatSetEntries;
    }

    const lowerSearchTerm = searchTerm.toLowerCase();
    return formatSetEntries.filter(({ label }) =>
      label.toLowerCase().includes(lowerSearchTerm)
    );
  }, [formatSetEntries, searchTerm]);

  const handleFormatSetSelect = React.useCallback(
    (key: string) => {
      const selectedEntry = formatSetEntries.find(entry => entry.key === key);
      if (selectedEntry) {
        onFormatSetChange(selectedEntry.formatSet, key);
      }
    },
    [onFormatSetChange, formatSetEntries]
  );

  const handleSearchChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setSearchTerm(event.target.value);
    },
    []
  );

  return (
    <Flex flexDirection="column" alignItems="flex-start" className="format-set-selector-container">
      <Input
        value={searchTerm}
        onChange={handleSearchChange}
        placeholder="Search format sets..."
      />
      <List className="format-set-selector-list">
        {filteredFormatSets.map(({ key, label }) => (
          <ListItem
            key={key}
            onClick={() => handleFormatSetSelect(key)}
            active={selectedFormatSetKey === key}
            className="format-set-selector-listItem"
          >
            <Text variant="body">{label}</Text>
          </ListItem>
        ))}
        {filteredFormatSets.length === 0 && searchTerm.trim() && (
          <ListItem disabled>
            <Text variant="body" isMuted>
              No format sets found matching &quot;{searchTerm}&quot;
            </Text>
          </ListItem>
        )}
        {formatSets.length === 0 && (
          <ListItem disabled>
            <Text variant="body" isMuted>
              No format sets available
            </Text>
          </ListItem>
        )}
      </List>
    </Flex>
  );
};
