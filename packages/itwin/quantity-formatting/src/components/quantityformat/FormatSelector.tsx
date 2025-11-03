/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { Flex, Input, List, ListItem, Text } from "@itwin/itwinui-react";
import { useTranslation } from "../../useTranslation.js";

import type { FormatDefinition } from "@itwin/core-quantity";
import type { FormatSet } from "@itwin/ecschema-metadata";

/**
 * @beta
 */
interface FormatSelectorProps {
  activeFormatSet?: FormatSet;
  activeFormatDefinitionKey?: string;
  onListItemChange: (formatDefinition: FormatDefinition, key: string) => void;
}

/**
 * A React component that renders a format selector with searchable list for choosing quantity formats.
 * @beta
 */
export const FormatSelector: React.FC<FormatSelectorProps> = ({
  activeFormatSet,
  activeFormatDefinitionKey,
  onListItemChange,
}) => {
  const { translate } = useTranslation();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [hoveredKey, setHoveredKey] = React.useState<string | undefined>();

  // Prepare format entries
  const formatEntries = React.useMemo(() => {
    if (!activeFormatSet?.formats) {
      return [];
    }

    return Object.entries(activeFormatSet.formats).map(([key, formatDef]) => ({
      key,
      formatDef,
      label: formatDef.label || key,
      description: formatDef.description || "",
    }));
  }, [activeFormatSet?.formats]);

  // Filter formats based on search term
  const filteredFormats = React.useMemo(() => {
    if (!searchTerm.trim()) {
      return formatEntries;
    }

    const lowerSearchTerm = searchTerm.toLowerCase();
    return formatEntries.filter(({ label }) =>
      label.toLowerCase().includes(lowerSearchTerm)
    );
  }, [formatEntries, searchTerm]);

  const handleFormatSelect = React.useCallback(
    (key: string) => {
      if (activeFormatSet?.formats) {
        const formatDef = activeFormatSet.formats[key];
        onListItemChange(formatDef, key);
      }
    },
    [onListItemChange, activeFormatSet]
  );

  const handleSearchChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setSearchTerm(event.target.value);
    },
    []
  );

  return (
    <Flex flexDirection="column" alignItems="flex-start" gap="none" className="quantityFormat--formatSelector-container">
      {activeFormatSet && (
        <>
          <Input
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder={translate("QuantityFormat:labels.searchFormats")}
          />
          <List
            className="quantityFormat--formatSelector-list"
          >
            {filteredFormats.map(({ key, label, description }) => (
              <ListItem
                key={key}
                onClick={() => handleFormatSelect(key)}
                onMouseEnter={() => setHoveredKey(key)}
                onMouseLeave={() => setHoveredKey(undefined)}
                active={activeFormatDefinitionKey === key}
                className={`quantityFormat--formatSelector-listItem`}
              >
                <Flex flexDirection="column" alignItems="flex-start">
                  <Text variant="body">{label}</Text>
                  {description && (hoveredKey === key || activeFormatDefinitionKey === key) && (
                    <Text
                      variant="small"
                      isMuted
                      className="quantityFormat--formatSelector-description"
                    >
                      {description}
                    </Text>
                  )}
                </Flex>
              </ListItem>
            ))}
            {filteredFormats.length === 0 && searchTerm.trim() && (
              <ListItem disabled>
                <Text variant="body" isMuted>
                  No formats found matching "{searchTerm}"
                </Text>
              </ListItem>
            )}
          </List>
        </>
      )}
    </Flex>
  );
};
