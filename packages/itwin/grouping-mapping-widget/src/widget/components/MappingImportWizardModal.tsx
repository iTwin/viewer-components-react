/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { useRef, useState } from "react";
import { Modal, StepProperties, Wizard } from "@itwin/itwinui-react";
import SelectProject from "./SelectProject";
import "./MappingImportWizardModal.scss";
import SelectIModel from "./SelectIModel";
import SelectMappings from "./SelectMappings";
import { Mapping } from "./Mapping";
import ConfirmMappingImport from "./ConfirmMappingsImport";

interface MappingImportWizardModalProps {
  show: boolean;
  setShow: React.Dispatch<React.SetStateAction<boolean>>;
  onFinish: () => Promise<void>;
}

export const MappingImportWizardModal = ({
  show,
  setShow,
  onFinish,
}: MappingImportWizardModalProps) => {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedIModelId, setSelectedIModelId] = useState<string>("");
  const [selectedMappings, setSelectedMappings] = useState<Mapping[]>([]);
  const [importing, setImporting] = useState<boolean>(false);

  const steps = useRef<StepProperties[]>([
    {
      name: "Select source project",
      description: "Select the source project to bring your mappings from.",
    },
    {
      name: "Select iModel",
      description: "Select an iModel within the project you have selected.",
    },
    {
      name: "Select Mapping",
      description: "Select one or more mappings to import.",
    },
    {
      name: "Rename & Confirm",
      description:
        "Rename and confirm your selections. Click import when finished.",
    },
  ]);

  const onClose = async () => {
    setShow(false);
    await onFinish();
  };

  return (
    <Modal
      title='Import Mappings'
      modalRootId='grouping-mapping-widget'
      isOpen={show}
      closeOnEsc={false}
      closeOnExternalClick={false}
      isDismissible={!importing}
      onClose={() => {
        void onClose();
      }}
    >
      <div className='import-wizard-body-container'>
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
                <SelectProject
                  onSelect={(project) => {
                    setSelectedProjectId(project.id);
                    setCurrentStep(1);
                  }}
                />
              );
            case 1:
              return (
                <SelectIModel
                  projectId={selectedProjectId}
                  onSelect={(iModel) => {
                    setSelectedIModelId(iModel.id);
                    setCurrentStep(2);
                  }}
                  backFn={() => setCurrentStep(currentStep - 1)}
                />
              );
            case 2:
              return (
                <SelectMappings
                  iModelId={selectedIModelId}
                  onSelect={(selectedMappings) => {
                    setSelectedMappings(selectedMappings);
                    setCurrentStep(3);
                  }}
                  backFn={() => setCurrentStep(currentStep - 1)}
                />
              );
            case 3:
              return (
                <ConfirmMappingImport
                  sourceiModelId={selectedIModelId}
                  selectedMappings={selectedMappings}
                  importing={importing}
                  setImporting={setImporting}
                  setSelectedMappings={setSelectedMappings}
                  backFn={() => setCurrentStep(currentStep - 1)}
                  onFinish={async () => {
                    await onClose();
                    setCurrentStep(0);
                    setImporting(false);
                  }}
                />
              );
            default:
              return null;
          }
        })()}
      </div>
    </Modal>
  );
};
