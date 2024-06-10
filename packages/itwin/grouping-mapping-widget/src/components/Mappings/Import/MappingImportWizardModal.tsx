/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { IModelsClient } from "@itwin/imodels-client-management";
import type { ITwinsAccessClient } from "@itwin/itwins-client";
import type { StepProperties } from "@itwin/itwinui-react";
import { Stepper } from "@itwin/itwinui-react";
import { Modal } from "@itwin/itwinui-react";
import React, { useEffect, useRef, useState } from "react";
import ConfirmMappingImport from "./ConfirmMappingsImport";
import type { IMappingTyped } from "../Mappings";
import "./MappingImportWizardModal.scss";
import SelectIModel from "./SelectIModel";
import SelectITwin, { ITwinType } from "./SelectITwin";
import SelectMappings from "./SelectMappings";
import { useGroupingMappingApiConfig } from "../../context/GroupingApiConfigContext";
import { createIModelsClient, IModelsClientContext } from "../../context/IModelsClientContext";
import { createITwinsClient, ITwinsClientContext } from "../../context/ITwinsClientContext";

const defaultDisplayStrings = {
  mappings: "Mappings",
  iTwins: "iTwins",
  iTwinNumber: "Number",
  iTwinName: "Name",
  iTwinStatus: "Status",
  iModels: "iModels",
  iModelName: "Name",
  iModelDescription: "Description",
};
interface MappingImportWizardModalProps {
  show: boolean;
  setShow: (show: boolean) => void;
  onFinish: () => Promise<void>;
  displayStrings?: Partial<typeof defaultDisplayStrings>;
}

export const MappingImportWizardModal = ({ show, setShow, onFinish, displayStrings: userDisplayStrings }: MappingImportWizardModalProps) => {
  const { prefix } = useGroupingMappingApiConfig();
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [iTwinType, setITwinType] = useState<ITwinType>(ITwinType.Favorite);
  const [selectedITwinId, setSelectedITwinId] = useState<string>("");
  const [selectedIModelId, setSelectedIModelId] = useState<string>("");
  const [selectedMappings, setSelectedMappings] = useState<IMappingTyped[]>([]);
  const [importing, setImporting] = useState<boolean>(false);
  const [iTwinsClient, setITwinsClient] = useState<ITwinsAccessClient>(createITwinsClient(prefix));
  const [iModelsClient, setIModelsClient] = useState<IModelsClient>(createIModelsClient(prefix));

  useEffect(() => {
    setITwinsClient(createITwinsClient(prefix));
    setIModelsClient(createIModelsClient(prefix));
  }, [prefix]);

  const displayStrings = React.useMemo(() => ({ ...defaultDisplayStrings, ...userDisplayStrings }), [userDisplayStrings]);

  const steps = useRef<StepProperties[]>([
    {
      name: "Select iTwin",
      description: `Select the source iTwin to bring your ${displayStrings.mappings} from.`,
    },
    {
      name: "Select iModel",
      description: "Select an iModel within the iTwin you have selected.",
    },
    {
      name: `Select ${displayStrings.mappings}`,
      description: `Select one or more ${displayStrings.mappings} to import.`,
    },
    {
      name: "Rename & Confirm",
      description: "Rename and confirm your selections. Click import when finished.",
    },
  ]);

  const onClose = async () => {
    setShow(false);
    setCurrentStep(0);
    await onFinish();
  };

  return (
    <Modal
      title={`Import ${displayStrings.mappings}`}
      modalRootId="grouping-mapping-widget"
      isOpen={show}
      closeOnEsc={false}
      closeOnExternalClick={false}
      isDismissible={!importing}
      styleType="fullPage"
      onClose={async () => {
        await onClose();
      }}
    >
      <div className="gmw-import-wizard-body-container">
        <Stepper currentStep={currentStep} steps={steps.current} onStepClick={importing ? undefined : (index: number) => setCurrentStep(index)} />

        {(() => {
          switch (currentStep) {
            case 0:
              return (
                <ITwinsClientContext.Provider value={iTwinsClient}>
                  <div className="gmw-table-container">
                    <SelectITwin
                      onSelect={(iTwinId) => {
                        setSelectedITwinId(iTwinId);
                        setCurrentStep(1);
                      }}
                      onCancel={onClose}
                      onChangeITwinType={setITwinType}
                      displayStrings={displayStrings}
                      defaultITwinType={iTwinType}
                    />
                  </div>
                </ITwinsClientContext.Provider>
              );
            case 1:
              return (
                <IModelsClientContext.Provider value={iModelsClient}>
                  <div className="gmw-table-container">
                    <SelectIModel
                      iTwinId={selectedITwinId}
                      onSelect={(iModelId) => {
                        setSelectedIModelId(iModelId);
                        setCurrentStep(2);
                      }}
                      backFn={() => setCurrentStep(currentStep - 1)}
                      onCancel={onClose}
                    />
                  </div>
                </IModelsClientContext.Provider>
              );
            case 2:
            case 3:
              // Preserve table state within Select Mappings
              return (
                <>
                  <div style={{ display: currentStep === 2 ? "flex" : "none" }} className="gmw-mapping-container">
                    <SelectMappings
                      iModelId={selectedIModelId}
                      onSelect={(selectedMappings) => {
                        setSelectedMappings(selectedMappings);
                        setCurrentStep(3);
                      }}
                      onCancel={onClose}
                      backFn={() => setCurrentStep(currentStep - 1)}
                      displayStrings={displayStrings}
                    />
                  </div>
                  {currentStep === 3 && (
                    <ConfirmMappingImport
                      selectedMappings={selectedMappings}
                      importing={importing}
                      setImporting={setImporting}
                      setSelectedMappings={setSelectedMappings}
                      backFn={() => setCurrentStep(currentStep - 1)}
                      onCancel={onClose}
                      onFinish={onClose}
                      displayStrings={displayStrings}
                    />
                  )}
                </>
              );
            default:
              return null;
          }
        })()}
      </div>
    </Modal>
  );
};
