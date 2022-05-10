/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelApp } from "@itwin/core-frontend";
import type {
  SelectOption,
} from "@itwin/itwinui-react";
import {
  Fieldset,
  LabeledInput,
  LabeledSelect,
  MenuItem,
  Small,
} from "@itwin/itwinui-react";
import React, { useContext, useEffect, useState } from "react";
import ActionPanel from "./ActionPanel";
import {
  BboxDimension,
  BboxDimensionsDecorator,
} from "../../decorators/BboxDimensionsDecorator";
import useValidator, { NAME_REQUIREMENTS } from "../hooks/useValidator";
import { handleError, WidgetHeader } from "./utils";
import { visualizeElements, zoomToElements } from "./viewerUtils";
import "./CalculatedPropertyAction.scss";
import type { CalculatedPropertyType } from "./CalculatedPropertyTable";
import { ReportingClient } from "@itwin/insights-client";
import { ApiContext } from "./GroupingMapping";

interface CalculatedPropertyActionProps {
  iModelId: string;
  mappingId: string;
  groupId: string;
  property?: CalculatedPropertyType;
  ids: string[];
  returnFn: () => Promise<void>;
}

const CalculatedPropertyAction = ({
  iModelId,
  mappingId,
  groupId,
  property,
  ids,
  returnFn,
}: CalculatedPropertyActionProps) => {
  const apiContext = useContext(ApiContext);
  const [propertyName, setPropertyName] = useState<string>(
    property?.propertyName ?? "",
  );
  const [type, setType] = useState<string>(property?.type ?? "");
  const [bboxDecorator, setBboxDecorator] = useState<
  BboxDimensionsDecorator | undefined
  >();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [inferredSpatialData, setInferredSpatialData] = useState<
  Map<BboxDimension, number> | undefined
  >();
  const [validator, showValidationMessage] = useValidator();

  useEffect(() => {
    const decorator = new BboxDimensionsDecorator();
    IModelApp.viewManager.addDecorator(decorator);
    setBboxDecorator(decorator);
    return () => {
      IModelApp.viewManager.dropDecorator(decorator);
    };
  }, []);

  useEffect(() => {
    if (ids.length === 0) {
      return;
    }
    visualizeElements([ids[0]], "red");
    void zoomToElements([ids[0]]);
  }, [ids]);

  useEffect(() => {
    if (ids.length === 0) {
      return;
    }
    const setContext = async () => {
      if (bboxDecorator) {
        await bboxDecorator.setContext(ids[0]);
        setInferredSpatialData(bboxDecorator.getInferredSpatialData());
      }
    };
    void setContext();
  }, [bboxDecorator, ids]);

  useEffect(() => {
    if (bboxDecorator && type && inferredSpatialData) {
      inferredSpatialData.has(BboxDimension[type as keyof typeof BboxDimension])
        ? bboxDecorator.drawContext(
          BboxDimension[type as keyof typeof BboxDimension],
        )
        : bboxDecorator.clearContext();
    }
  }, [bboxDecorator, inferredSpatialData, type]);

  const onSave = async () => {
    if (!validator.allValid()) {
      showValidationMessage(true);
      return;
    }
    try {
      setIsLoading(true);

      const reportingClientApi = new ReportingClient(apiContext.prefix);

      property
        ? await reportingClientApi.updateCalculatedProperty(
          apiContext.accessToken,
          iModelId,
          mappingId,
          groupId,
          property.id ?? "",
          {
            propertyName,
            type,
          },
        )
        : await reportingClientApi.createCalculatedProperty(
          apiContext.accessToken,
          iModelId,
          mappingId,
          groupId,
          {
            propertyName,
            type,
          },
        );
      await returnFn();
    } catch (error: any) {
      handleError(error.status);
      setIsLoading(false);
    }
  };

  const getSpatialData = (value: string) =>
    inferredSpatialData?.has(
      BboxDimension[value as keyof typeof BboxDimension],
    ) && (
      <div>
        {`${inferredSpatialData
          ?.get(BboxDimension[value as keyof typeof BboxDimension])
          ?.toPrecision(4)}m`}
      </div>
    );

  return (
    <>
      <WidgetHeader
        title={
          property
            ? `${property?.propertyName ?? ""}`
            : "Create Calculated Property"
        }
        returnFn={returnFn}
      />
      <div className='calculated-properties-action-container'>
        <Fieldset legend='Calculated Property Details' className='details-form'>
          <Small className='field-legend'>
            Asterisk * indicates mandatory fields.
          </Small>
          <LabeledInput
            value={propertyName}
            required
            name='name'
            label='Name'
            onChange={(event) => {
              setPropertyName(event.target.value);
              validator.showMessageFor("name");
            }}
            message={validator.message("name", propertyName, NAME_REQUIREMENTS)}
            status={
              validator.message("name", propertyName, NAME_REQUIREMENTS)
                ? "negative"
                : undefined
            }
            onBlur={() => {
              validator.showMessageFor("name");
            }}
            onBlurCapture={(event) => {
              setPropertyName(event.target.value);
              validator.showMessageFor("name");
            }}
          />
          <LabeledSelect<string>
            label='Quantity Type'
            required
            options={[
              { value: "Length", label: "Length" },
              { value: "Area", label: "Area" },
              { value: "Volume", label: "Volume" },
              {
                value: "BoundingBoxLongestEdgeLength",
                label: "Longest Edge Length",
              },
              {
                value: "BoundingBoxIntermediateEdgeLength",
                label: "Intermediate Edge Length",
              },
              {
                value: "BoundingBoxShortestEdgeLength",
                label: "Shortest Edge Length",
              },
              {
                value: "BoundingBoxDiagonalLength",
                label: "Diagonal Length",
              },
              {
                value: "BoundingBoxLongestFaceDiagonalLength",
                label: "Longest Face Diagonal Length",
              },
              {
                value: "BoundingBoxIntermediateFaceDiagonalLength",
                label: "Intermediate Face Diagonal Length",
              },
              {
                value: "BoundingBoxShortestFaceDiagonalLength",
                label: "Shortest Face Diagonal Length",
              },
            ]}
            value={type}
            onChange={setType}
            itemRenderer={(option: SelectOption<string>) => (
              <MenuItem>
                <div className='gr-cp-menu-item'>
                  <div>{option.label}</div>
                  {getSpatialData(option.value)}
                </div>
              </MenuItem>
            )}
            selectedItemRenderer={(option: SelectOption<string>) => (
              <div className='select-item'>
                <div>{option.label}</div>
                {getSpatialData(option.value)}
              </div>
            )}
            onShow={() => { }}
            onHide={() => { }}
          />
        </Fieldset>
      </div>
      <ActionPanel
        onSave={onSave}
        onCancel={returnFn}
        isSavingDisabled={!(type && propertyName)}
        isLoading={isLoading}
      />
    </>
  );
};

export default CalculatedPropertyAction;
