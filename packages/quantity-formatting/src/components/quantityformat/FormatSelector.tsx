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
import { QuantityFormattingLoggerCategory } from "../../QuantityFormatting.js";

const logCategory = QuantityFormattingLoggerCategory;
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

  // Not memoized: format set providers (e.g. FormatSetFormatsProvider.addFormat) update `formats` in place, so the
  // object identity does not change after a format is applied.
  const formatEntries = Object.entries(activeFormatSet?.formats ?? {})
    .filter((entry): entry is [string, FormatDefinition] => typeof entry[1] === "object" && entry[1] !== null)
    .map(([key, formatDef]) => ({ key, formatDef, label: formatDef.label || key }));

  const lowerSearchTerm = searchTerm.trim().toLowerCase();
  const filteredFormats = lowerSearchTerm
    ? formatEntries.filter(({ label }) => label.toLowerCase().includes(lowerSearchTerm))
    : formatEntries;

  const handleFormatSelect = (key: string) => {
    // Read the definition at selection time rather than from render-time entries for the same reason.
    const formatDef = activeFormatSet?.formats[key];
    if (typeof formatDef === "object" && formatDef !== null) {
      onListItemChange(formatDef, key);
      return;
    }
    Logger.logWarning(logCategory, `Format entry not found for key: ${key}`, {
      key,
      availableKeys: formatEntries.map((e) => e.key),
      activeFormatSet: activeFormatSet?.name,
    });
  };

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
                  {translate("QuantityFormat:labels.noFormatsFound")} &quot;{searchTerm}&quot;
                </Text>
              </ListItem>
            )}
          </List>
        </>
      )}
    </Flex>
  );
};
