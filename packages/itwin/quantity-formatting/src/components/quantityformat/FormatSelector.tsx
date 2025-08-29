/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import * as React from "react";

import type { FormatDefinition } from "@itwin/core-quantity";
import { ComboBox, Flex, Label, Text } from "@itwin/itwinui-react";

import { useTranslation } from "../../useTranslation.js";

import type { FormatSet } from "@itwin/ecschema-metadata";

/**
 * @internal
 */
interface FormatSelectorProps {
  activeFormatSet?: FormatSet;
  activeFormatDefinitionKey?: string;
  onListItemChange: (formatDefinition: FormatDefinition, key: string) => void;
}

/**
 * A React component that renders a format selector dropdown for choosing quantity formats.
 * @beta
 */
export const FormatSelector: React.FC<FormatSelectorProps> = ({
  activeFormatSet,
  activeFormatDefinitionKey,
  onListItemChange,
}) => {
  const { translate } = useTranslation();
  const formatListId = React.useId();

  // Prepare options for ComboBox
  const formatOptions = React.useMemo(() => {
    if (!activeFormatSet?.formats) {
      return [];
    }

    return Object.entries(activeFormatSet.formats).map(([key, formatDef]) => ({
      value: key,
      label: formatDef.label || key,
      sublabel: formatDef.description,
    }));
  }, [activeFormatSet?.formats]);

  const handleFormatChange = React.useCallback(
    (value: string) => {
      if (activeFormatSet?.formats && value) {
        const formatDef = activeFormatSet.formats[value];
        if (formatDef) {
          onListItemChange(formatDef, value);
        }
      }
    },
    [activeFormatSet?.formats, onListItemChange],
  );

  return (
    <Flex flexDirection="column" alignItems="flex-start">
      {activeFormatSet && (
        <>
          <Label htmlFor={formatListId} className="quantity-format-label">
            <Text variant="leading">
              {translate("QuantityFormat:labels.formatSetSectionLabel")}
            </Text>
          </Label>
          <ComboBox
            id={formatListId}
            className="format-selector-list"
            options={formatOptions}
            value={activeFormatDefinitionKey || ""}
            onChange={handleFormatChange}
            enableVirtualization
            dropdownMenuProps={{
              className: "quantityFormat--format-selector-menu",
            }}
          />
        </>
      )}
    </Flex>
  );
};
