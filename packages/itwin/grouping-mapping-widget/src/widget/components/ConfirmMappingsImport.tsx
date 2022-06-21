/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  Button,
  LabeledInput,
  MiddleTextTruncation,
  ProgressLinear,
  Text,
} from "@itwin/itwinui-react";
import React, { useEffect, useState } from "react";
import type { MappingType } from "./Mapping";
import "./ConfirmMappingsImport.scss";
import { useActiveIModelConnection } from "@itwin/appui-react";
import { SvgStatusSuccessHollow } from "@itwin/itwinui-icons-react";
import useValidator, { NAME_REQUIREMENTS } from "../hooks/useValidator";
import { handleError } from "./utils";
import { useMappingClient } from "./context/MappingClientContext";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";

interface ConfirmMappingImportProps {
  sourceiModelId: string;
  selectedMappings: MappingType[];
  importing: boolean;
  setImporting: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedMappings: React.Dispatch<React.SetStateAction<MappingType[]>>;
  backFn: () => void;
  onCancel: () => void;
  onFinish: () => void;
}

const ConfirmMappingImport = ({
  sourceiModelId,
  selectedMappings,
  importing,
  setImporting,
  setSelectedMappings,
  backFn,
  onCancel,
  onFinish,
}: ConfirmMappingImportProps) => {
  const iModelId = useActiveIModelConnection()?.iModelId;
  const apiContext = useGroupingMappingApiConfig();
  const mappingClient = useMappingClient();

  const [importCount, setImportCount] = useState<number>(0);
  const [currentlyImporting, setCurrentlyImporting] = useState<string>("");
  const [validator, showValidationMessage] = useValidator();
  const [errored, setErrored] = useState<boolean>(false);

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
    try {
      for (const selectedMapping of selectedMappings) {
        setCurrentlyImporting(selectedMapping.mappingName ?? "");
        const accessToken = await apiContext.getAccessToken();
        await mappingClient.copyMapping(
          accessToken,
          sourceiModelId,
          selectedMapping.id ?? "",
          {
            targetIModelId: iModelId ?? "",
            mappingName: selectedMapping.mappingName ?? "",
          },
        );
        setImportCount((importCount) => importCount + 1);
      }
    } catch (error: any) {
      handleError(error);
      setErrored(true);
    }
  };

  return (
    <>
      {importing ? (
        <div className='import-progress-container'>
          <div className='import-progress-bar'>
            <div className='import-progress-bar-description'>
              {
                !errored ? importCount !== selectedMappings.length ? (
                  <>
                    <Text variant='title'>Importing</Text>
                    <Text>We are currently importing the mappings.</Text>
                  </>
                ) : (
                  <>
                    <Text variant='title'>Done!</Text>
                    <Text>Your mapping(s) are ready.</Text>
                  </>
                ) :
                  <>
                    <Text variant='title'>Error!</Text>
                    <Text>Sorry, there was an error importing some or all mappings.</Text>
                  </>}
            </div>
            <ProgressLinear
              value={(importCount / selectedMappings.length) * 100}
              labels={
                importCount === selectedMappings.length
                  ? ["Import done!", <SvgStatusSuccessHollow key='0' />]
                  : [
                    <>
                      <Text>Copying</Text>
                      <MiddleTextTruncation text={currentlyImporting} />
                    </>,
                    `${importCount}/${selectedMappings.length}`,
                  ]
              }
              status={
                !errored ?
                  importCount === selectedMappings.length ? "positive" : undefined : "negative"
              }
            />
          </div>
          <div className='import-action-panel'>
            <Button
              disabled={!errored && importCount !== selectedMappings.length}
              onClick={() => {
                setImporting(false);
                setImportCount(0);
                setCurrentlyImporting("");
                setErrored(false);
              }}
            >
              Back
            </Button>
            <Button
              styleType='high-visibility'
              disabled={!errored && importCount !== selectedMappings.length}
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
            <Button onClick={onCancel}>Cancel</Button>
          </div>
        </div>
      )}
    </>
  );
};

export default ConfirmMappingImport;
