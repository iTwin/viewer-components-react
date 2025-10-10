import React, { useCallback, useState } from "react";
import { UiFramework } from "@itwin/appui-react";
import { IModelApp } from "@itwin/core-frontend";
import { Button, Modal, ModalButtonBar, ModalContent } from "@itwin/itwinui-react";
import { PropertyGridContextMenuItem } from "@itwin/property-grid-react";
import { QuantityFormatPanel } from "@itwin/quantity-formatting-react";
import { FormatManager } from "./FormatManager";

import type { FormatDefinition } from "@itwin/core-quantity";
import type { DefaultContextMenuItemProps } from "@itwin/property-grid-react";
export function CustomizeFormatPropertyContextMenuItem({ record }: DefaultContextMenuItemProps): React.JSX.Element | null {
  const defaultAction = async (): Promise<void> => {
    if (!record.property.kindOfQuantityName) {
      return;
    }
    const formatDefinition = await IModelApp.formatsProvider.getFormat(record.property.kindOfQuantityName);

    formatDefinition && UiFramework.dialogs.modal.open(<QuantityFormatPanelDialogWithoutFormatSelector formatDefinition={formatDefinition} />);
  };
  if (!record.property.kindOfQuantityName) {
    return null;
  }

  return (
    <PropertyGridContextMenuItem
      id="customize-property-format"
      onSelect={async () => {
        await defaultAction();
      }}
    >
      {"Customize Property's Formatting"}
    </PropertyGridContextMenuItem>
  );
}

export function CustomizeFormatPropertyActionItem({ kindOfQuantityName }: { kindOfQuantityName: string }): React.JSX.Element {
  const handleClick = async (): Promise<void> => {
    const formatDefinition = await IModelApp.formatsProvider.getFormat(kindOfQuantityName);
    if (formatDefinition) {
      UiFramework.dialogs.modal.open(<QuantityFormatPanelDialogWithoutFormatSelector formatDefinition={formatDefinition} />);
    }
  };

  return <button style={{ width: "16px", height: "16px", backgroundColor: "red" }} title={"Customize Property's Formatting"} onClick={handleClick}></button>;
}

interface QuantityFormatPanelDialogWithoutFormatSelectorProps {
  readonly formatDefinition: FormatDefinition;
}

const QuantityFormatPanelDialogWithoutFormatSelector: React.FC<QuantityFormatPanelDialogWithoutFormatSelectorProps> = ({ formatDefinition }) => {
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [unitsProvider, setUnitsProvider] = useState(IModelApp.quantityFormatter.unitsProvider);

  const handleFormatChange = async (newFormat: FormatDefinition): Promise<void> => {
    await FormatManager.instance?.activeFormatSetFormatsProvider?.addFormat(newFormat.name ?? "", newFormat);
  };

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    UiFramework.dialogs.modal.close();
  }, []);

  React.useEffect(() => {
    return IModelApp.quantityFormatter.onUnitsProviderChanged.addListener(() => {
      setUnitsProvider(IModelApp.quantityFormatter.unitsProvider);
    });
  }, []);

  const title = `Format Selected: ${formatDefinition.label ?? formatDefinition.name}`;
  return (
    <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={title}>
      <ModalContent>
        <QuantityFormatPanel formatDefinition={formatDefinition} unitsProvider={unitsProvider} onFormatChange={handleFormatChange} />
      </ModalContent>

      <ModalButtonBar>
        <Button styleType="default" onClick={handleCloseModal}>
          Close
        </Button>
      </ModalButtonBar>
    </Modal>
  );
};
