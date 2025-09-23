/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import React from "react";
import { Flex, Text } from "@itwin/itwinui-react";
import { FormatSelector, QuantityFormatPanel } from "@itwin/quantity-formatting-react";

import type { FormatDefinition, UnitsProvider } from "@itwin/core-quantity";
import type { FormatSet } from "@itwin/ecschema-metadata";

export interface FormatTabPanelProps {
  activeFormatSet: FormatSet | undefined;
  activeFormatDefinitionKey: string | undefined;
  formatDefinition: FormatDefinition | undefined;
  unitsProvider: UnitsProvider;
  onListItemChange: (formatDef: FormatDefinition, key: string) => void;
  onFormatChange: (newFormat: FormatDefinition) => Promise<void>;
}

/** Tab panel component that contains the FormatSelector and QuantityFormatPanel */
export const FormatTabPanel: React.FC<FormatTabPanelProps> = ({
  activeFormatSet,
  activeFormatDefinitionKey,
  formatDefinition,
  unitsProvider,
  onListItemChange,
  onFormatChange,
}) => {
  return (
    <Flex flexDirection="row" gap="l" className="format-tab-panel">
      <Flex.Item className="quantity-format-selector-item">
        <FormatSelector
          activeFormatSet={activeFormatSet}
          activeFormatDefinitionKey={activeFormatDefinitionKey}
          onListItemChange={onListItemChange}
        />
      </Flex.Item>

      <Flex.Item className="quantity-format-panel-item">
        {formatDefinition ? (
          <QuantityFormatPanel formatDefinition={formatDefinition} unitsProvider={unitsProvider} onFormatChange={onFormatChange} />
        ) : (
          <Flex flexDirection="column" justifyContent="center" alignItems="center" className="quantity-format-empty-state">
            <Text variant="leading" isMuted>
              Select a format in the list to edit
            </Text>
          </Flex>
        )}
      </Flex.Item>
    </Flex>
  );
};
