/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import React, { useCallback, useState } from "react";
import { StagePanelLocation, StagePanelSection } from "@itwin/appui-react";
import { QuantityFormatPanel } from "@itwin/quantity-formatting-react";
import { IModelApp } from "@itwin/core-frontend";
import type { FormatProps } from "@itwin/core-quantity";
import { Button, Modal, ModalButtonBar } from "@itwin/itwinui-react";

import type { UiItemsProvider, Widget } from "@itwin/appui-react";

/** Widget component that shows a button to open the Quantity Format Panel in a modal */
const QuantityFormatWidget: React.FC = () => {
  // Initial format definition with basic decimal format
  const [formatDefinition, setFormatDefinition] = useState<FormatProps>({
    precision: 4,
    type: "Decimal",
    composite: {
      units: [{ name: "Units.M", label: "m" }],
    },
  });

  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleFormatChange = useCallback((newFormat: FormatProps) => {
    setFormatDefinition(newFormat);
  }, []);

  const handleOpenModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const handleApply = useCallback(() => {
    // Here you could apply the format changes to the active iModel
    console.log("Applied format changes:", formatDefinition);
    setIsModalOpen(false);
  }, [formatDefinition]);

  // Memoize the unitsProvider to prevent unnecessary re-renders
  const memoizedUnitsProvider = React.useMemo(() => IModelApp.quantityFormatter.unitsProvider, []);

  return (
    <>
      <div style={{ padding: "16px" }}>
        <Button
          onClick={handleOpenModal}
          styleType="high-visibility"
          size="large"
          style={{ width: "100%" }}
        >
          Configure Quantity Format
        </Button>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title="Quantity Format Settings"
        style={{ width: "600px", maxWidth: "90vw" }}
      >
        <div style={{ padding: "16px", height: "400px", overflow: "auto" }}>
          <QuantityFormatPanel
            formatDefinition={formatDefinition}
            unitsProvider={memoizedUnitsProvider}
            onFormatChange={handleFormatChange}
          />
        </div>

        <ModalButtonBar>
          <Button styleType="default" onClick={handleCloseModal}>
            Cancel
          </Button>
          <Button styleType="high-visibility" onClick={handleApply}>
            Apply
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
