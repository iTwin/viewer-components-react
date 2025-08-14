/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import React, { useCallback, useState } from "react";
import { StagePanelLocation, StagePanelSection } from "@itwin/appui-react";
import { FormatSelector, QuantityFormatPanel } from "@itwin/quantity-formatting-react";
import { IModelApp } from "@itwin/core-frontend";
import type { FormatDefinition } from "@itwin/core-quantity";
import { Button, Modal, ModalButtonBar } from "@itwin/itwinui-react";
import { FormatManager } from "./FormatManager";

import type { UiItemsProvider, Widget } from "@itwin/appui-react";
import type { FormatSet } from "@itwin/ecschema-metadata";

/** Widget component that shows a button to open the Quantity Format Panel in a modal */
const QuantityFormatWidget: React.FC = () => {
  // Initial format definition with basic decimal format
  const [formatDefinition, setFormatDefinition] = useState<FormatDefinition>({
    precision: 4,
    type: "Decimal",
    composite: {
      units: [{ name: "Units.M", label: "m" }],
    },
  });

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


  // Memoize the unitsProvider to prevent unnecessary re-renders
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
      <div style={{ padding: "16px" }}>
        <Button onClick={handleOpenModal} styleType="high-visibility" size="large" style={{ width: "100%" }}>
          Configure Quantity Format
        </Button>


      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title="Quantity Format Settings" style={{ width: "600px", maxWidth: "90vw" }}>
        <div style={{ padding: "16px", height: "1200px", overflow: "auto" }}>
            <div style={{ padding: "16px 0" }}>
              <FormatSelector
                activeFormatSet={activeFormatSet}
                activeFormatDefinitionKey={activeFormatDefinitionKey}
                onListItemChange={handleFormatSelectorChange}
              />
            </div>

          <QuantityFormatPanel formatDefinition={formatDefinition} unitsProvider={unitsProvider} onFormatChange={handleFormatChange} />
        </div>

        <ModalButtonBar>
          <Button styleType="default" onClick={handleCloseModal}>
            Close
          </Button>
        </ModalButtonBar>
      </Modal>
    </>
  );
};

/** UiItemsProvider that adds a quantity format widget to the side panel */
export class QuantityFormatUiItemsProvider implements UiItemsProvider {
  public readonly id = "QuantityFormatUiItemsProvider";

  public provideWidgets(_stageId: string, stageUsage: string, location: StagePanelLocation, section?: StagePanelSection): ReadonlyArray<Widget> {
    const widgets: Widget[] = [];
    if (location === StagePanelLocation.Right && section === StagePanelSection.End && stageUsage === "General") {
      const quantityFormatWidget: Widget = {
        id: "quantity-format",
        label: "Quantity Format",
        content: <QuantityFormatWidget />,
      };

      widgets.push(quantityFormatWidget);
    }

    return widgets;
  }
}
