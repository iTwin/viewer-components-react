import { Property } from "@itwin/insights-client";
import { Button, InputGroup, Label, LabeledInput, LabeledSelect, SelectOption } from "@itwin/itwinui-react";
import { useCallback, useState } from "react";
import "./PropertiesValidationAction.scss";
import { ValidationRule } from "../PropertyTable/PropertyMenu";

export interface PropertyValidationActionProps {
  propertyName: string;
  properties: Property[];
  selectedProperty: Property | undefined;
  setSelectedProperty: (property: Property | undefined) => void;
  selectedFunction: FunctionType | undefined;
  setSelectedFunction: (functionType: FunctionType | undefined) => void;
  minValue: number | undefined;
  setMinValue: (minValue: number | undefined) => void;
  maxValue: number | undefined;
  setMaxValue: (maxValue: number | undefined) => void;
  setFormula: (formula: string | undefined) => void;
  ruleList: ValidationRule[];
}

export enum FunctionType {
  CountRange = "CountRange",
  CountAtLeast = "CountAtLeast",
  CountAtMost = "CountAtMost",
  AtLeast = "AtLeast",
  AtMost = "AtMost",
  Defined = "Defined",
  PercentAvailable = "PercentAvailable",
  Range = "Range",
  SumAtLeast = "SumAtLeast",
  SumAtMost = "SumAtMost",
  SumRange = "SumRange",
}

export const functionTypes: SelectOption<FunctionType>[] = [
  { value: FunctionType.CountRange, label: "Count Range" },
  { value: FunctionType.CountAtLeast, label: "Count At Least" },
  { value: FunctionType.CountAtMost, label: "Count At Most" },
  { value: FunctionType.AtLeast, label: "At Least" },
  { value: FunctionType.AtMost, label: "At Most" },
  { value: FunctionType.Defined, label: "Defined" },
  { value: FunctionType.PercentAvailable, label: "Percent Available" },
  { value: FunctionType.Range, label: "Range" },
  { value: FunctionType.SumAtLeast, label: "Sum At Least" },
  { value: FunctionType.SumAtMost, label: "Sum At Most" },
  { value: FunctionType.SumRange, label: "Sum Range" },
];

export const PropertiesValidationAction = ({
  propertyName,
  properties,
  selectedProperty,
  selectedFunction,
  minValue,
  maxValue,
  setFormula,
  setMaxValue,
  setMinValue,
  setSelectedFunction,
  setSelectedProperty,
  ruleList,
}: PropertyValidationActionProps) => {
  const [minValueErrorMessage, setMinValueErrorMessage] = useState<string | undefined>(undefined);
  const [maxValueErrorMessage, setMaxValueErrorMessage] = useState<string | undefined>(undefined);
  const [generateErrorMessage, setGenerateErrorMessage] = useState<string | undefined>(undefined);

  const MinFunctionList = [
    FunctionType.AtLeast,
    FunctionType.CountAtLeast,
    FunctionType.CountRange,
    FunctionType.SumAtLeast,
    FunctionType.SumRange,
    FunctionType.Range,
    FunctionType.PercentAvailable,
  ];
  const MaxFunctionList = [
    FunctionType.AtMost,
    FunctionType.CountAtMost,
    FunctionType.CountRange,
    FunctionType.SumAtMost,
    FunctionType.SumRange,
    FunctionType.Range,
  ];

  const propertiesSelectionOptions: SelectOption<Property>[] = properties
    .filter((p) => p.propertyName != propertyName && !ruleList.some((r) => r.property.propertyName === p.propertyName))
    .map((property) => ({
      value: property,
      label: property.propertyName,
    }));

  const checkMax = useCallback(() => {
    if (selectedFunction && MaxFunctionList.includes(selectedFunction) && maxValue === undefined) {
      setMaxValueErrorMessage("Max value empty or invalid");
      return false;
    }
    setMaxValueErrorMessage(undefined);
    return true;
  }, [maxValue, selectedFunction]);

  const checkMin = useCallback(() => {
    if (selectedFunction && MinFunctionList.includes(selectedFunction) && minValue === undefined) {
      setMinValueErrorMessage("Min value empty or invalid");
      return false;
    }
    setMinValueErrorMessage(undefined);
    return true;
  }, [minValue, selectedFunction]);

  const checkRange = () => {
    if (selectedFunction === FunctionType.CountRange || selectedFunction === FunctionType.Range || selectedFunction === FunctionType.SumRange) {
      if (minValue !== undefined && maxValue !== undefined && minValue > maxValue) {
        setGenerateErrorMessage("Min value greater than max value");
        return false;
      }
    }
    return true;
  };

  const GenerateFormula = () => {
    setGenerateErrorMessage(undefined);
    if (selectedProperty !== undefined && selectedFunction !== undefined && checkMin() && checkMax() && checkRange()) {
      switch (selectedFunction) {
        // Aggregations are carried out after extraction, so only the property values are fetched to be calculated later
        case FunctionType.CountRange:
          setFormula(selectedProperty.propertyName);
          break;
        case FunctionType.CountAtLeast:
          setFormula(selectedProperty.propertyName);
          break;
        case FunctionType.CountAtMost:
          setFormula(selectedProperty.propertyName);
          break;
        case FunctionType.AtLeast:
          setFormula(`${selectedProperty.propertyName} >= ${minValue}`);
          break;
        case FunctionType.AtMost:
          setFormula(`${selectedProperty.propertyName} <= ${maxValue}`);
          break;
        case FunctionType.Defined:
          setFormula(`if((${selectedProperty.propertyName} != null), true, false)`);
          break;
        case FunctionType.PercentAvailable:
          setFormula(selectedProperty.propertyName);
          break;
        case FunctionType.Range:
          setFormula(`${selectedProperty.propertyName} >= ${minValue} && ${selectedProperty.propertyName} <= ${maxValue}`);
          break;
        case FunctionType.SumAtLeast:
          setFormula(selectedProperty.propertyName);
          break;
        case FunctionType.SumAtMost:
          setFormula(selectedProperty.propertyName);
          break;
        case FunctionType.SumRange:
          setFormula(selectedProperty.propertyName);
          break;
        default:
          setGenerateErrorMessage("Invalid function type");
          break;
      }
    }
  };

  return (
    <InputGroup className="gmw-properties-validation-action-container">
      <LabeledSelect<Property>
        label="Property"
        options={propertiesSelectionOptions}
        value={selectedProperty}
        placeholder={"Choose property"}
        onChange={(p) => setSelectedProperty(p)}
      />
      <LabeledSelect<FunctionType>
        label="Function"
        options={functionTypes}
        value={selectedFunction}
        placeholder={"Choose validation function"}
        onChange={(f) => setSelectedFunction(f)}
      />
      {(selectedFunction === FunctionType.AtLeast ||
        selectedFunction === FunctionType.CountAtLeast ||
        selectedFunction === FunctionType.CountRange ||
        selectedFunction === FunctionType.SumAtLeast ||
        selectedFunction === FunctionType.SumRange ||
        selectedFunction === FunctionType.PercentAvailable ||
        selectedFunction === FunctionType.Range) && (
        <LabeledInput
          type="number"
          placeholder="Enter value"
          step={0.01}
          label={"Min"}
          value={minValue}
          status={minValueErrorMessage ? "negative" : undefined}
          message={minValueErrorMessage}
          onChange={(e) => {
            const stringToFloat = parseFloat(e.target.value);
            if (!isNaN(stringToFloat)) {
              setMinValue(stringToFloat);
            }
          }}
        />
      )}
      {(selectedFunction === FunctionType.AtMost ||
        selectedFunction === FunctionType.CountAtMost ||
        selectedFunction === FunctionType.CountRange ||
        selectedFunction === FunctionType.SumAtMost ||
        selectedFunction === FunctionType.SumRange ||
        selectedFunction === FunctionType.Range) && (
        <LabeledInput
          type="number"
          placeholder="Enter value"
          step={0.01}
          label={"Max"}
          value={maxValue}
          status={maxValueErrorMessage ? "negative" : undefined}
          message={maxValueErrorMessage}
          onChange={(e) => {
            const stringToFloat = parseFloat(e.target.value);
            if (!isNaN(stringToFloat)) {
              setMaxValue(stringToFloat);
            }
          }}
        />
      )}
      <Button
        className={"gmw-generate-formula-button"}
        onClick={() => GenerateFormula()}
        disabled={selectedProperty === undefined || selectedFunction === undefined}
      >
        Generate
      </Button>
      <Label className="gmw-generate-error-message">{generateErrorMessage}</Label>
    </InputGroup>
  );
};
