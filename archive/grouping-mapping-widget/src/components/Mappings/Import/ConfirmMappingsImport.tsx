/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { Button, LabeledInput, MiddleTextTruncation, ProgressLinear, Text } from "@itwin/itwinui-react";
import React, { useEffect, useState } from "react";
import { GroupingMappingWidget } from "../../../GroupingMappingWidget";
import type { IMappingTyped } from "../Mappings";
import "./ConfirmMappingsImport.scss";
import { SvgStatusSuccessHollow } from "@itwin/itwinui-icons-react";
import useValidator, { NAME_REQUIREMENTS } from "../../Properties/hooks/useValidator";
import { useMappingClient } from "../../context/MappingClientContext";
import { useGroupingMappingApiConfig } from "../../context/GroupingApiConfigContext";
import { useMutation } from "@tanstack/react-query";

const getDefaultDisplayStrings = () => ({
  mappings: GroupingMappingWidget.translate("mappings.mappings"),
});

interface ConfirmMappingImportProps {
  selectedMappings: IMappingTyped[];
  importing: boolean;
  setImporting: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedMappings: React.Dispatch<React.SetStateAction<IMappingTyped[]>>;
  backFn: () => void;
  onCancel: () => void;
  onFinish: () => void;
  displayStrings?: Partial<ReturnType<typeof getDefaultDisplayStrings>>;
}

const ConfirmMappingImport = ({
  selectedMappings,
  importing,
  setImporting,
  setSelectedMappings,
  backFn,
  onCancel,
  onFinish,
  displayStrings: userDisplayStrings,
}: ConfirmMappingImportProps) => {
  const { getAccessToken, iModelId } = useGroupingMappingApiConfig();
  const mappingClient = useMappingClient();
  const [importCount, setImportCount] = useState<number>(0);
  const [currentlyImporting, setCurrentlyImporting] = useState<string>("");
  const [validator, showValidationMessage] = useValidator();
  const [errored, setErrored] = useState<boolean>(false);

  const displayStrings = React.useMemo(() => ({ ...getDefaultDisplayStrings(), ...userDisplayStrings }), [userDisplayStrings]);

  useEffect(() => {
    setSelectedMappings((selectedMappings) =>
      selectedMappings.map((mapping) => ({
        ...mapping,
        mappingName: GroupingMappingWidget.translate("import.copySuffix", { name: mapping.mappingName }),
      })),
    );
  }, [setSelectedMappings]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const newState = [...selectedMappings];
    newState[index] = {
      ...newState[index],
      mappingName: e.target.value,
    };
    setSelectedMappings(newState);
  };

  const importMutation = useMutation({
    mutationFn: async (selectedMapping: IMappingTyped) => {
      const accessToken = await getAccessToken();
      await mappingClient.createMapping(accessToken, {
        iModelId,
        mappingName: selectedMapping.mappingName,
        sourceMappingId: selectedMapping.id,
      });
    },
    onMutate: async (selectedMapping: IMappingTyped) => {
      setCurrentlyImporting(selectedMapping.mappingName);
    },
    onSuccess: () => {
      setImportCount((count) => count + 1);
    },
    onError: () => {
      setErrored(true);
    },
  });

  const onImport = async () => {
    if (!validator.allValid()) {
      showValidationMessage(true);
      return;
    }
    setImporting(true);
    setImportCount(0);
    for (const mapping of selectedMappings) {
      await importMutation.mutateAsync(mapping);
    }
  };

  return (
    <>
      {importing ? (
        <div className="gmw-import-progress-container">
          <div className="gmw-import-progress-bar">
            <div className="gmw-import-progress-bar-description">
              {!errored ? (
                importCount !== selectedMappings.length ? (
                  <>
                    <Text variant="title">{GroupingMappingWidget.translate("import.importing")}</Text>
                    <Text>{GroupingMappingWidget.translate("import.currentlyImporting", { mappings: displayStrings.mappings.toLocaleLowerCase() })}</Text>
                  </>
                ) : (
                  <>
                    <Text variant="title">{GroupingMappingWidget.translate("import.done")}</Text>
                    <Text>{GroupingMappingWidget.translate("import.importedReady", { mappings: displayStrings.mappings.toLocaleLowerCase() })}</Text>
                  </>
                )
              ) : (
                <>
                  <Text variant="title">{GroupingMappingWidget.translate("import.error")}</Text>
                  <Text>{GroupingMappingWidget.translate("import.importError", { mappings: displayStrings.mappings })}</Text>
                </>
              )}
            </div>
            <ProgressLinear
              value={(importCount / selectedMappings.length) * 100}
              labels={
                importCount === selectedMappings.length
                  ? [GroupingMappingWidget.translate("import.importDone"), <SvgStatusSuccessHollow key="0" />]
                  : [
                      <>
                        <Text>{GroupingMappingWidget.translate("import.copying")}</Text>
                        <MiddleTextTruncation text={currentlyImporting} />
                      </>,
                      `${importCount}/${selectedMappings.length}`,
                    ]
              }
              status={!errored ? (importCount === selectedMappings.length ? "positive" : undefined) : "negative"}
            />
          </div>
          <div className="gmw-import-action-panel">
            <Button
              disabled={!errored && importCount === selectedMappings.length}
              onClick={() => {
                setImporting(false);
                setImportCount(0);
                setCurrentlyImporting("");
                setErrored(false);
              }}
            >
              {GroupingMappingWidget.translate("common.back")}
            </Button>
            <Button styleType="high-visibility" disabled={!errored && importCount !== selectedMappings.length} onClick={onFinish}>
              {GroupingMappingWidget.translate("common.close")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="gmw-rename-confirm-container ">
          <div className="gmw-mapping-rename-container">
            <div className="gmw-mapping-row-header-container">
              <div className="gmw-mapping-row">
                <Text variant="leading">{displayStrings.mappings}</Text>
                <Text variant="leading">{GroupingMappingWidget.translate("common.description")}</Text>
              </div>
            </div>
            <div className="gmw-mapping-row-body">
              {selectedMappings.map((mapping, index) => (
                <div className="gmw-mapping-row-container" key={mapping.id}>
                  <div className="gmw-mapping-row">
                    <LabeledInput
                      value={mapping.mappingName}
                      name={`mapping_${mapping.id}`}
                      required
                      onChange={(event) => {
                        handleChange(event, index);
                        validator.showMessageFor(`mapping_${mapping.id}`);
                      }}
                      message={validator.message(`mapping_${mapping.id}`, mapping.mappingName, NAME_REQUIREMENTS)}
                      status={validator.message(`mapping_${mapping.id}`, mapping.mappingName, NAME_REQUIREMENTS) ? "negative" : undefined}
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
                  <div className="gmw-border-div" />
                </div>
              ))}
            </div>
          </div>
          <div className="gmw-import-action-panel">
            <Button onClick={backFn}>{GroupingMappingWidget.translate("common.back")}</Button>
            <Button styleType="high-visibility" onClick={async () => onImport()}>
              {GroupingMappingWidget.translate("common.import")}
            </Button>
            <Button onClick={onCancel}>{GroupingMappingWidget.translate("common.cancel")}</Button>
          </div>
        </div>
      )}
    </>
  );
};

export default ConfirmMappingImport;
