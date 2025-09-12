/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import React, { useCallback, useState } from "react";
import { IModelApp } from "@itwin/core-frontend";
import { Button, Flex, Modal, Text } from "@itwin/itwinui-react";
import { FormatSelector, QuantityFormatPanel } from "@itwin/quantity-formatting-react";
import { FormatManager } from "./FormatManager";

import type { FormatDefinition } from "@itwin/core-quantity";
import type { FormatSet } from "@itwin/ecschema-metadata";

/** Button component that shows a button to open the Quantity Format Panel in a modal */
export const QuantityFormatButton: React.FC = () => {
  // Initial format definition is undefined until a format is selected
  const [formatDefinition, setFormatDefinition] = useState<FormatDefinition | undefined>(undefined);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [unitsProvider, setUnitsProvider] = useState(() => IModelApp.quantityFormatter.unitsProvider);
  const [activeFormatSet, setActiveFormatSet] = useState<FormatSet | undefined>(FormatManager.instance?.activeFormatSet);
  const [activeFormatDefinitionKey, setActiveFormatDefinitionKey] = useState<string | undefined>();

  const handleFormatChange = useCallback(async (newFormat: FormatDefinition) => {
    setFormatDefinition(newFormat);
    await FormatManager.instance?.activeFormatSetFormatsProvider?.addFormat(newFormat.name ?? "", newFormat);
  }, []);

  const handleFormatSelectorChange = useCallback((formatDef: FormatDefinition, key: string) => {
    setFormatDefinition(formatDef);
    setActiveFormatDefinitionKey(key);
  }, []);

  const handleOpenModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  React.useEffect(() => {
    const _removeListener = IModelApp.quantityFormatter.onUnitsProviderChanged.addListener(() => {
      // Handle units provider changes if needed
      setUnitsProvider(IModelApp.quantityFormatter.unitsProvider);
    });
    return () => {
      _removeListener();
    };
  }, []);

  // Listen for active format set changes
  React.useEffect(() => {
    const removeFormatSetListener = FormatManager.instance?.onActiveFormatSetChanged.addListener((formatSet) => {
      setActiveFormatSet(formatSet);
      setActiveFormatDefinitionKey(undefined); // Reset selection when format set changes
    });
    return () => {
      if (removeFormatSetListener) removeFormatSetListener();
    };
  }, []);

  return (
    <>
      <Button onClick={handleOpenModal} styleType="borderless">
        Customize Formatting
      </Button>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title="Quantity Format Settings" className="quantity-format-modal">
        <Flex flexDirection="row" gap="l" className="format-selector-container">
          <Flex.Item className="quantity-format-selector-item">
            <FormatSelector
              activeFormatSet={activeFormatSet}
              activeFormatDefinitionKey={activeFormatDefinitionKey}
              onListItemChange={handleFormatSelectorChange}
            />
          </Flex.Item>

          <Flex.Item className="quantity-format-panel-item">
            {formatDefinition ? (
              <QuantityFormatPanel formatDefinition={formatDefinition} unitsProvider={unitsProvider} onFormatChange={handleFormatChange} />
            ) : (
              <Flex flexDirection="column" justifyContent="center" alignItems="center" className="quantity-format-empty-state">
                <Text variant="leading" isMuted>
                  Select a format in the list to edit
                </Text>
              </Flex>
            )}
          </Flex.Item>
        </Flex>
      </Modal>
    </>
  );
};
