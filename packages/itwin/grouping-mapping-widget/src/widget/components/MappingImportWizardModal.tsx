/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { IModelsClient } from "@itwin/imodels-client-management";
import type { ITwinsAccessClient } from "@itwin/itwins-client";
import type { StepProperties } from "@itwin/itwinui-react";
import { Modal, Wizard } from "@itwin/itwinui-react";
import React, { useEffect, useRef, useState } from "react";
import ConfirmMappingImport from "./ConfirmMappingsImport";
import type { IMappingTyped } from "./Mapping";
import "./MappingImportWizardModal.scss";
import SelectIModel from "./SelectIModel";
import SelectITwin from "./SelectITwin";
import SelectMappings from "./SelectMappings";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";
import { createIModelsClient, IModelsClientContext } from "./context/IModelsClientContext";
import { createITwinsClient, ITwinsClientContext } from "./context/ITwinsClientContext";

const defaultDisplayStrings = {
  mappings: "Mappings",
  itwins: "iTwins",
  itwinNumber: "Number",
  itwinName: "Name",
  itwinStatus: "Status",
  imodels: "iModels",
  imodelName: "Name",
  imodelDescription: "Description",
};
interface MappingImportWizardModalProps {
  show: boolean;
  setShow: React.Dispatch<React.SetStateAction<boolean>>;
  onFinish: () => Promise<void>;
  displayStrings?: Partial<typeof defaultDisplayStrings>;
}

export const MappingImportWizardModal = ({
  show,
  setShow,
  onFinish,
  displayStrings: userDisplayStrings,
}: MappingImportWizardModalProps) => {
  const { prefix } = useGroupingMappingApiConfig();
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [itwinType, setITwinType] = useState<number>(0);
  const [selectedITwinId, setSelectedITwinId] = useState<string>("");
  const [selectedIModelId, setSelectedIModelId] = useState<string>("");
  const [selectedMappings, setSelectedMappings] = useState<IMappingTyped[]>([]);
  const [importing, setImporting] = useState<boolean>(false);
  const [itwinsClient, setITwinsClient] = useState<ITwinsAccessClient>(createITwinsClient(prefix));
  const [imodelsClient, setIModelsClient] = useState<IModelsClient>(createIModelsClient(prefix));

  useEffect(() => {
    setITwinsClient(createITwinsClient(prefix));
    setIModelsClient(createIModelsClient(prefix));
  }, [prefix]);

  const displayStrings = React.useMemo(
    () => ({ ...defaultDisplayStrings, ...userDisplayStrings }),
    [userDisplayStrings]
  );

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
      description:
        "Rename and confirm your selections. Click import when finished.",
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
      modalRootId='grouping-mapping-widget'
      isOpen={show}
      closeOnEsc={false}
      closeOnExternalClick={false}
      isDismissible={!importing}
      styleType='fullPage'
      onClose={async () => {
        await onClose();
      }}
    >
      <div className='gmw-import-wizard-body-container'>
        <Wizard
          currentStep={currentStep}
          steps={steps.current}
          onStepClick={
            importing ? undefined : (index: number) => setCurrentStep(index)
          }
        />

        {(() => {
          switch (currentStep) {
            case 0:
              return (
                <ITwinsClientContext.Provider value={itwinsClient}>
                  <div className="gmw-table-container">
                    <SelectITwin
                      onSelect={(itwinId) => {
                        setSelectedITwinId(itwinId);
                        setCurrentStep(1);
                      }}
                      onCancel={onClose}
                      onChangeITwinType={setITwinType}
                      displayStrings={displayStrings}
                      defaultITwinType={itwinType}
                    />
                  </div>
                </ITwinsClientContext.Provider>
              );
            case 1:
              return (
                <IModelsClientContext.Provider value={imodelsClient}>
                  <div className="gmw-table-container">
                    <SelectIModel
                      itwinId={selectedITwinId}
                      onSelect={(imodelId) => {
                        setSelectedIModelId(imodelId);
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
                  <div
                    style={{ display: currentStep === 2 ? "flex" : "none" }}
                    className="gmw-mapping-container"
                  >
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
                      sourceiModelId={selectedIModelId}
                      selectedMappings={selectedMappings}
                      importing={importing}
                      setImporting={setImporting}
                      setSelectedMappings={setSelectedMappings}
                      backFn={() => setCurrentStep(currentStep - 1)}
                      onCancel={onClose}
                      onFinish={async () => {
                        await onClose();
                        setImporting(false);
                      }}
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
