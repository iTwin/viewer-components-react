/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { Flex, Input, List, ListItem, Text } from "@itwin/itwinui-react";
import { useTranslation } from "../../useTranslation.js";

import type { FormatDefinition } from "@itwin/core-quantity";
import type { FormatSet } from "@itwin/ecschema-metadata";
import { Logger } from "@itwin/core-bentley";


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

  // Prepare format entries
  const formatEntries = React.useMemo(() => {
    if (!activeFormatSet?.formats) {
      return [];
    }

    return Object.entries(activeFormatSet.formats)
      .filter(([, formatDef]) => typeof formatDef === "object" && formatDef !== null)
      .map(([key, formatDef]) => ({
        key,
        formatDef: formatDef as FormatDefinition,
        label: (formatDef as FormatDefinition).label || key,
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
      const formatEntry = formatEntries.find(entry => entry.key === key);
      if (formatEntry) {
        onListItemChange(formatEntry.formatDef, key);
      } else {
        Logger.logWarning(`QuantityFormatting.FormatSelector`,`Format entry not found for key: ${key}`, {
          key,
          availableKeys: formatEntries.map(e => e.key),
          activeFormatSet: activeFormatSet?.name
        });
      }
    },
    [onListItemChange, formatEntries]
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
            {filteredFormats.map(({ key, label }) => (
              <ListItem
                key={key}
                onClick={() => handleFormatSelect(key)}
                active={activeFormatDefinitionKey === key}
                className={`quantityFormat--formatSelector-listItem`}
              >
                <Text variant="body">{label}</Text>
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
