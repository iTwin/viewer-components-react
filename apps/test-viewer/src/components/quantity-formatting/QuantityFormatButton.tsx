/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import React, { useCallback, useState } from "react";
import { IModelApp } from "@itwin/core-frontend";
import { Button, Modal, Tabs } from "@itwin/itwinui-react";
import { FormatManager } from "./FormatManager";
import { FormatSetsTabPanel } from "./FormatSetsTabPanel";
import { FormatTabPanel } from "./FormatTabPanel";

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

  const formatManager = FormatManager.instance;

  const handleFormatChange = useCallback(
    async (newFormat: FormatDefinition) => {
      setFormatDefinition(newFormat);
      await formatManager?.activeFormatSetFormatsProvider?.addFormat(newFormat.name ?? "", newFormat);
    },
    [formatManager],
  );

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
    return IModelApp.quantityFormatter.onUnitsProviderChanged.addListener(() => {
      // Handle units provider changes if needed
      setUnitsProvider(IModelApp.quantityFormatter.unitsProvider);
    });
  }, []);

  // Listen for active format set changes
  React.useEffect(() => {
    formatManager?.onActiveFormatSetChanged.addListener((formatSet) => {
      setActiveFormatSet(formatSet);
      setActiveFormatDefinitionKey(undefined); // Reset selection when format set changes
      setFormatDefinition(undefined); // Reset format definition when format set changes
    });
  }, [formatManager]);

  // Don't render if FormatManager is not initialized
  if (!formatManager) {
    return null;
  }

  return (
    <>
      <Button onClick={handleOpenModal} styleType="borderless">
        Customize Formatting
      </Button>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title="Quantity Format Settings" className="quantity-format-modal">
        <Tabs.Wrapper type="borderless">
          <Tabs.TabList>
            <Tabs.Tab value="formats" label="Formats" key="formats" />
            <Tabs.Tab value="format-sets" label="Format Sets" key="format-sets" />
          </Tabs.TabList>
          <Tabs.Panel value="formats" key="formats">
            <FormatTabPanel
              activeFormatSet={activeFormatSet}
              activeFormatDefinitionKey={activeFormatDefinitionKey}
              formatDefinition={formatDefinition}
              unitsProvider={unitsProvider}
              onListItemChange={handleFormatSelectorChange}
              onFormatChange={handleFormatChange}
            />
          </Tabs.Panel>
          <Tabs.Panel value="format-sets" key="format-sets">
            <FormatSetsTabPanel formatManager={formatManager} />
          </Tabs.Panel>
        </Tabs.Wrapper>
      </Modal>
    </>
  );
};
