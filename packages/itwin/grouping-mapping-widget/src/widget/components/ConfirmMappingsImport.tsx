/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  Button,
  LabeledInput,
  ProgressLinear,
  Text,
} from "@itwin/itwinui-react";
import React, { useEffect, useState } from "react";
import { Mapping } from "./Mapping";
import "./ConfirmMappingsImport.scss";
import { reportingClientApi } from "../../api/reportingClient";
import { useActiveIModelConnection } from "@bentley/ui-framework";
import { SvgStatusSuccessHollow } from "@itwin/itwinui-icons-react";
import useValidator, { NAME_REQUIREMENTS } from "../hooks/useValidator";

interface ConfirmMappingImportProps {
  sourceiModelId: string;
  selectedMappings: Mapping[];
  importing: boolean;
  setImporting: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedMappings: React.Dispatch<React.SetStateAction<Mapping[]>>;
  backFn: () => void;
  onFinish: () => void;
}

const ConfirmMappingImport = ({
  sourceiModelId,
  selectedMappings,
  importing,
  setImporting,
  setSelectedMappings,
  backFn,
  onFinish,
}: ConfirmMappingImportProps) => {
  const iModelId = useActiveIModelConnection()?.iModelId as string;

  const [importCount, setImportCount] = useState<number>(0);
  const [validator, showValidationMessage] = useValidator();

  useEffect(() => {
    setSelectedMappings((selectedMappings) =>
      selectedMappings.map((mapping) => ({
        ...mapping,
        mappingName: `${mapping.mappingName}_Copy`,
      })),
    );
  }, [setSelectedMappings]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number,
  ) => {
    const newState = [...selectedMappings];
    newState[index] = {
      ...newState[index],
      mappingName: e.target.value,
    };
    setSelectedMappings(newState);
  };

  const onImport = async () => {
    if (!validator.allValid()) {
      showValidationMessage(true);
      return;
    }
    setImporting(true);
    for (const selectedMapping of selectedMappings) {
      await reportingClientApi.copyMapping(
        sourceiModelId,
        selectedMapping.id ?? "",
        {
          targetIModelId: iModelId,
          mappingName: selectedMapping.mappingName ?? "",
        },
      );
      setImportCount((importCount) => importCount + 1);
    }
  };

  return (
    <>
      {importing ? (
        <div className='import-progress-container'>
          <ProgressLinear
            className='import-progress-bar'
            value={(importCount / selectedMappings.length) * 100}
            labels={
              importCount === selectedMappings.length
                ? ["Import done!", <SvgStatusSuccessHollow key='0' />]
                : [
                  "Importing mappings into this iModel...",
                  `${importCount}/${selectedMappings.length}`,
                ]
            }
            status={
              importCount === selectedMappings.length ? "positive" : undefined
            }
          />
          <div className='finish-bar'>
            <Button
              styleType='high-visibility'
              disabled={importCount !== selectedMappings.length}
              onClick={() => onFinish()}
            >
              Close
            </Button>
          </div>
        </div>
      ) : (
        <div className='rename-confirm-container '>
          <div className='mapping-rename-container'>
            <div className='mapping-row-header-container'>
              <div className='mapping-row'>
                <Text variant='leading'>Mapping </Text>
                <Text variant='leading'>Description</Text>
              </div>
            </div>
            <div className='mapping-row-body'>
              {selectedMappings.map((mapping, index) => (
                <div className='mapping-row-container' key={mapping.id}>
                  <div className='mapping-row'>
                    <LabeledInput
                      value={mapping.mappingName}
                      name={`mapping_${mapping.id}`}
                      required
                      onChange={(event) => {
                        handleChange(event, index);
                        validator.showMessageFor(`mapping_${mapping.id}`);
                      }}
                      message={validator.message(
                        `mapping_${mapping.id}`,
                        mapping.mappingName,
                        NAME_REQUIREMENTS,
                      )}
                      status={
                        validator.message(
                          `mapping_${mapping.id}`,
                          mapping.mappingName,
                          NAME_REQUIREMENTS,
                        )
                          ? "negative"
                          : undefined
                      }
                      onBlur={() => {
                        validator.showMessageFor(`mapping_${mapping.id}`);
                      }}
                      onBlurCapture={(event) => {
                        handleChange(event, index);
                        validator.showMessageFor(`mapping_${mapping.id}`);
                      }}
                    />
                    <div>{mapping.description}</div>
                  </div>
                  <div className='border-div' />
                </div>
              ))}
            </div>
          </div>
          <div className='import-action-panel'>
            <Button onClick={backFn}>Back</Button>
            <Button styleType='high-visibility' onClick={async () => onImport()}>
              Import
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

export default ConfirmMappingImport;
