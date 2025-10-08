/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import React from "react";
import { SvgHelpCircularHollow } from "@itwin/itwinui-icons-react";
import { ComboBox, Flex, IconButton, Input, Label, Text, Textarea } from "@itwin/itwinui-react";
import { useTranslation } from "../../useTranslation.js";

import type { UnitSystemKey } from "@itwin/core-quantity";
import type { FormatSet } from "@itwin/ecschema-metadata";
/**
 * Props for the FormatSetPanel component
 * @beta
 */
type FormatSetPanelProps = {
  formatSet: FormatSet;
} & ({
  editable: true,
  onFormatSetChange: (formatSet: FormatSet) => void
} | {
  editable?: false,
  onFormatSetChange?: undefined
})

/**
 * A React component that displays and allows editing of format set properties.
 * @beta
 */
export const FormatSetPanel: React.FC<FormatSetPanelProps> = ({ formatSet, editable = false, onFormatSetChange }) => {
  const [label, setLabel] = React.useState(formatSet.label || "");
  const [description, setDescription] = React.useState("");
  const [unitSystem, setUnitSystem] = React.useState<string>("metric");
  const { translate } = useTranslation();

  // Generate unique IDs for form elements
  const labelInputId = React.useId();
  const descriptionInputId = React.useId();
  const unitSystemSelectId = React.useId();

  // Unit system options
  const unitSystemOptions = [
    { value: "metric", label: translate("QuantityFormat:labels.unitSystemMetric") },
    { value: "imperial", label: translate("QuantityFormat:labels.unitSystemImperial") },
    { value: "usCustomary", label: translate("QuantityFormat:labels.unitSystemUsCustomary") },
    { value: "usSurvey", label: translate("QuantityFormat:labels.unitSystemUsSurvey") },
  ];

  // Update local state when formatSet prop changes
  React.useEffect(() => {
    setLabel(formatSet.label || "");
    setDescription(formatSet.description || "");
    setUnitSystem(formatSet.unitSystem || "metric");
  }, [formatSet]);

  const handleLabelChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newLabel = event.target.value;
      setLabel(newLabel);

      if (editable && onFormatSetChange) {
        const updatedFormatSet: FormatSet = {
          ...formatSet,
          label: newLabel,
        };
        onFormatSetChange(updatedFormatSet);
      }
    },
    [editable, formatSet, onFormatSetChange],
  );

  const handleDescriptionChange = React.useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newDescription = event.target.value;
    setDescription(newDescription);

    if (editable && onFormatSetChange) {
        const updatedFormatSet: FormatSet = {
          ...formatSet,
          description: newDescription,
        };
        onFormatSetChange(updatedFormatSet);
    }
  }, [editable, formatSet, onFormatSetChange]);

  const handleUnitSystemChange = React.useCallback((value: string) => {
    setUnitSystem(value);

    if (editable && onFormatSetChange) {
        const updatedFormatSet: FormatSet = {
          ...formatSet,
          unitSystem: value as UnitSystemKey,
        };
        onFormatSetChange(updatedFormatSet);
    }
  }, [editable, formatSet, onFormatSetChange]);

  return (
    <Flex className="quantityFormat--formatSetPanel-container">
      <Text variant="subheading">{translate("QuantityFormat:labels.formatSetDetails")}</Text>

      <Flex className="quantityFormat--formatSetPanel-inputRow">
        <Label htmlFor={labelInputId}>{translate("QuantityFormat:labels.label")}</Label>
        <Input
          id={labelInputId}
          value={label}
          size="small"
          onChange={handleLabelChange}
          disabled={!editable}
          placeholder={translate("QuantityFormat:labels.formatSetDisplayLabel")}
          className="quantityFormat--formatSetPanel-input"
        />
      </Flex>

      <Flex className="quantityFormat--formatSetPanel-inputRow">
        <Label htmlFor={unitSystemSelectId} displayStyle="inline">
          {translate("QuantityFormat:labels.unitSystem")}
          <IconButton
            className="quantityFormat--formatHelpTooltip"
            styleType="borderless"
            size="small"
            label={translate("QuantityFormat:labels.unitSystemTooltip")}
          >
            <SvgHelpCircularHollow />
          </IconButton>
        </Label>
        <ComboBox
          value={unitSystem}
          onChange={handleUnitSystemChange}
          options={unitSystemOptions}
          inputProps={{
            disabled: !editable,
            placeholder: translate("QuantityFormat:labels.selectUnitSystem"),
            id: unitSystemSelectId,
            style: {
              backgroundColor: !editable ? "var(--iui-color-background-zebra)" : undefined,
            },
            size: "small",
          }}
          className="quantityFormat--formatSetPanel-inputRow"
        />
      </Flex>

      <Flex className="quantityFormat--formatSetPanel-inputColumn">
        <Label htmlFor={descriptionInputId}>{translate("QuantityFormat:labels.description")}</Label>
        <Textarea
          id={descriptionInputId}
          value={description}
          onChange={handleDescriptionChange}
          disabled={!editable}
          placeholder={translate("QuantityFormat:labels.formatSetDescription")}
          className="quantityFormat--formatSetPanel-input"
          rows={4}
        />
      </Flex>
    </Flex>
  );
};
