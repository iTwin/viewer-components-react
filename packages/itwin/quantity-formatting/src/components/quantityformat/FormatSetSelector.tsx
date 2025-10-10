/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import React from "react";
import { Flex, Input, List, ListItem, Text } from "@itwin/itwinui-react";
import { useTranslation } from "../../useTranslation.js";

import type { FormatSet } from "@itwin/ecschema-metadata";

/**
 * Props for the FormatSetSelector component
 * @beta
 */
interface FormatSetSelectorProps {
  formatSets: FormatSet[];
  selectedFormatSetKey?: string;
  onFormatSetChange: (formatSet: FormatSet, key: string) => void;
}

/**
 * A React component that renders a format set selector with searchable list for choosing format sets.
 * @beta
*/
export const FormatSetSelector: React.FC<FormatSetSelectorProps> = ({
  formatSets,
  selectedFormatSetKey,
  onFormatSetChange,
}) => {
  const [searchTerm, setSearchTerm] = React.useState("");
  const { translate } = useTranslation();

  // Filter format sets based on search term
  const filteredFormatSets = React.useMemo(() => {
    if (!searchTerm.trim()) {
      return formatSets;
    }

    const lowerSearchTerm = searchTerm.toLowerCase();
    return formatSets.filter((formatSet) =>
      formatSet.label.toLowerCase().includes(lowerSearchTerm)
    );
  }, [formatSets, searchTerm]);

  const handleFormatSetSelect = React.useCallback(
    (formatSet: FormatSet) => {
      const key = formatSet.name || `formatSet-${formatSets.indexOf(formatSet)}`;
      onFormatSetChange(formatSet, key);
    },
    [onFormatSetChange, formatSets]
  );

  return (
    <Flex flexDirection="column" gap="none" alignItems="flex-start" className="quantityFormat--formatSetSelector-container">
      <Input
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.currentTarget.value)}
        placeholder={translate("QuantityFormat:labels.searchFormatSets")}
      />
      <List className="quantityFormat--formatSetSelector-list">
        {filteredFormatSets.map((formatSet, index) => {
          const key = formatSet.name || `formatSet-${index}`;
          return (
            <ListItem
              key={key}
              onClick={() => handleFormatSetSelect(formatSet)}
              active={selectedFormatSetKey === key}
              className="quantityFormat--formatSetSelector-listItem"
            >
              <Text variant="body">{formatSet.label}</Text>
            </ListItem>
          );
        })}
        {filteredFormatSets.length === 0 && searchTerm.trim() && (
          <ListItem disabled>
            <Text variant="body" isMuted>
              {translate("QuantityFormat:labels.noFormatSetsFound")} &quot;{searchTerm}&quot;
            </Text>
          </ListItem>
        )}
        {formatSets.length === 0 && (
          <ListItem disabled>
            <Text variant="body" isMuted>
              {translate("QuantityFormat:labels.noFormatSetsAvailable")}
            </Text>
          </ListItem>
        )}
      </List>
    </Flex>
  );
};
