/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { IModelConnection } from "@itwin/core-frontend";
import type {
  ContentDescriptorRequestOptions,
  Field,
  KeySet,
  NestedContentField,
  PropertiesField,
  Ruleset,
  RulesetVariable,
  StructFieldMemberDescription,
} from "@itwin/presentation-common";
import {
  ContentSpecificationTypes,
  DefaultContentDisplayTypes,
  PropertyValueFormat,
  RelationshipMeaning,
  RuleTypes,
} from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { useActiveIModelConnection } from "@itwin/appui-react";
import type { SelectOption } from "@itwin/itwinui-react";
import {
  Alert,
  Button,
  Fieldset,
  IconButton,
  Label,
  LabeledInput,
  LabeledSelect,
  Modal,
  ModalButtonBar,
  Small,
  Surface,
  Text,
} from "@itwin/itwinui-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import ActionPanel from "./ActionPanel";
import useValidator, { NAME_REQUIREMENTS } from "../hooks/useValidator";
import { handleError, WidgetHeader } from "./utils";
import { useMappingClient } from "./context/MappingClientContext";
import { useGroupingMappingApiConfig } from "./context/GroupingApiConfigContext";
import { HorizontalTile } from "./HorizontalTile";
import type { ECProperty, GroupPropertyCreate, GroupPropertySingle } from "@itwin/insights-client";
import { SvgClose, SvgDragHandleVertical, SvgRemove, SvgSearch } from "@itwin/itwinui-icons-react";
import type {
  DragEndEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import SortableHorizontalTile from "./SortableHorizontalTile";
import { deepEqual } from "fast-equals";
import Split from "react-split";
import "./GroupPropertyAction.scss";

interface GroupPropertyActionProps {
  iModelId: string;
  mappingId: string;
  groupId: string;
  groupPropertyId?: string;
  groupPropertyName?: string;
  keySet: KeySet;
  returnFn: (modified: boolean) => Promise<void>;
}

export const quantityTypesSelectionOptions: SelectOption<string>[] = [
  { value: "Area", label: "Area" },
  { value: "Distance", label: "Distance" },
  { value: "Force", label: "Force" },
  { value: "Mass", label: "Mass" },
  { value: "Monetary", label: "Monetary" },
  { value: "Time", label: "Time" },
  { value: "Volume", label: "Volume" },
  { value: "Undefined", label: "No Quantity Type" },
];

interface PropertyMetaData {
  // Display label
  label: string;
  // ECProperty source schema:class
  schema: string;
  className: string;
  categoryLabel: string;
  // Property Type
  type: string;
  // The parent class of the property
  parentPropertyClassName: string;
  // ECProperty type traversal
  propertyTraversal: Array<string>;
  // The type of primitive navigation from Presentation
  primitiveNavigationClass: string;
  key: string;
}

const convertType = (type: string) => {
  switch (type) {
    case "int":
    case "enum":
    case "long":
      return "Integer";
    default:
      // Capitilize first letter to match backend capitalization
      return `${type[0].toUpperCase()}${type.slice(1).toLowerCase()}`;
  }
};

const extractPrimitive = (
  propertyTraversal: Array<string>,
  propertyField: PropertiesField
): PropertyMetaData => {
  const propertyName = propertyField.properties[0].property.name;
  const label = propertyField.label;
  //  It belongs to this parent class
  const parentPropertyClassName = propertyField.parent?.contentClassInfo.name ?? "No Parent";
  const primitiveNavigationClass = propertyField.properties[0].property.navigationPropertyInfo?.classInfo.name ?? "";
  const type = primitiveNavigationClass ? "String" : convertType(propertyField.properties[0].property.type);

  propertyTraversal.push(propertyName);

  return {
    label,
    schema: "*",
    className: "*",
    propertyTraversal,
    type,
    primitiveNavigationClass,
    parentPropertyClassName,
    key: propertyField.name,
    categoryLabel: propertyField.category.label,
  };
};

const extractPrimitiveStructProperties = (
  propertyTraversal: Array<string>,
  members: StructFieldMemberDescription[],
  categoryLabel: string,
  parentPropertyClassName: string = "*",
) => {
  const ecPropertyMetaDetaList = new Array<PropertyMetaData>();
  for (const member of members) {
    if (member.type.valueFormat === PropertyValueFormat.Primitive) {

      const propertyName = member.name;
      const label = member.label;
      const type = convertType(member.type.typeName);

      ecPropertyMetaDetaList.push({
        label,
        schema: "*",
        className: "*",
        propertyTraversal: [...propertyTraversal, propertyName],
        type,
        primitiveNavigationClass: "",
        parentPropertyClassName,
        key: member.name,
        categoryLabel,
      });

    } else if (member.type.valueFormat === PropertyValueFormat.Struct) {
      ecPropertyMetaDetaList.push(...extractPrimitiveStructProperties(
        propertyTraversal,
        member.type.members,
        parentPropertyClassName
      ));
    }
  }

  return ecPropertyMetaDetaList;
};

const extractNested = (propertyTraversal: Array<string>, propertyFields: Field[]) => {
  const ecPropertyMetaDetaList = new Array<PropertyMetaData>();
  for (const property of propertyFields) {

    // Generate base ECProperty
    switch (property.type.valueFormat) {
      case PropertyValueFormat.Primitive: {
        ecPropertyMetaDetaList.push(extractPrimitive([...propertyTraversal], property as PropertiesField));
        break;
      }
      // Get structs
      case PropertyValueFormat.Struct: {
        const nestedContentField = property as NestedContentField;
        // Only handling single path and not handling nested content fields within navigations
        if (
          nestedContentField.pathToPrimaryClass &&
          nestedContentField.pathToPrimaryClass.length > 1
        ) {
          break;
        }

        switch (nestedContentField.relationshipMeaning) {
          // Aspects are not looked at again. Extraction does not support aspects within navigations.
          // Navigation properties
          case RelationshipMeaning.RelatedInstance: {
            if (
              // Deal with a TypeDefinition
              nestedContentField.pathToPrimaryClass[0].relationshipInfo.name ===
              "BisCore:GeometricElement3dHasTypeDefinition"
            ) {
              ecPropertyMetaDetaList.push(...extractNested([...propertyTraversal, "TypeDefinition"], nestedContentField.nestedFields));
            }
            break;
          }
          default: {
            // Some elements don't have a path to primary class or relationship meaning..
            // Most likely a simple struct property
            if (!nestedContentField.pathToPrimaryClass) {
              const columnName = (property as PropertiesField).properties[0]
                .property.name;
              ecPropertyMetaDetaList.push(...extractPrimitiveStructProperties(
                [...propertyTraversal, columnName],
                property.type.members,
                property.category.label,
                // It belongs to this parent class
                property.parent?.contentClassInfo.name
              ));
            }
          }
        }
      }
    }
  }

  return ecPropertyMetaDetaList;

};

const convertPresentationFields = async (propertyFields: Field[]) => {
  const ecPropertyMetaDetaList = new Array<PropertyMetaData>();
  for (const property of propertyFields) {
    // Generate base ECProperty
    switch (property.type.valueFormat) {
      case PropertyValueFormat.Primitive: {

        const extractedPrimitive = extractPrimitive([], property as PropertiesField);
        extractedPrimitive.schema = "*";
        extractedPrimitive.className = "*";
        ecPropertyMetaDetaList.push(extractedPrimitive);
        break;
      }
      // Get structs
      case PropertyValueFormat.Struct: {
        const nestedContentField = property as NestedContentField;
        // Only handling single path and not handling nested content fields within navigations
        if (
          nestedContentField.pathToPrimaryClass &&
          nestedContentField.pathToPrimaryClass.length > 1
        ) {
          break;
        }
        switch (nestedContentField.relationshipMeaning) {
          case RelationshipMeaning.SameInstance: {
            // Check for aspects.
            if (
              (nestedContentField.pathToPrimaryClass[0].relationshipInfo
                .name === "BisCore:ElementOwnsUniqueAspect" ||
                nestedContentField.pathToPrimaryClass[0].relationshipInfo
                  .name === "BisCore:ElementOwnsMultiAspects")
            ) {
              const fullClassName = nestedContentField.contentClassInfo.name;
              const schema = fullClassName.split(":")[0];
              const className = fullClassName.split(":")[1];
              const extractedNested = extractNested([], nestedContentField.nestedFields);
              const aspectExtractedNested = extractedNested.map((ecProperty) => ({ ...ecProperty, schema, className }));
              ecPropertyMetaDetaList.push(...aspectExtractedNested);
            }
            break;
          }
          // Navigation properties
          case RelationshipMeaning.RelatedInstance: {
            if (
              // Deal with a TypeDefinition
              nestedContentField.pathToPrimaryClass[0].relationshipInfo.name ===
              "BisCore:GeometricElement3dHasTypeDefinition"
            ) {
              ecPropertyMetaDetaList.push(...extractNested(["TypeDefinition"], nestedContentField.nestedFields));
            }
            break;
          }
          default: {
            // Some elements don't have a path to primary class or relationship meaning..
            // Most likely a simple struct property
            if (!nestedContentField.pathToPrimaryClass) {
              const columnName = (property as PropertiesField).properties[0]
                .property.name;
              ecPropertyMetaDetaList.push(...extractPrimitiveStructProperties(
                [columnName],
                property.type.members,
                property.category.label,
              ));
            }
          }
        }
      }
    }
  }
  return ecPropertyMetaDetaList;
};

const convertToECProperties = (property: PropertyMetaData): Array<ECProperty> => {
  const ecProperty: ECProperty = {
    ecSchemaName: property.schema,
    ecClassName: property.className,
    ecPropertyType: property.type,
  };
  switch (property.primitiveNavigationClass) {
    // Hardcode Models navigation path and label behavior
    case "BisCore:ModelContainsElements": {
      return [
        {
          ...ecProperty,
          ecPropertyName: [
            ...property.propertyTraversal,
            "ModeledElement",
            "UserLabel",
          ].join("."),
        },
        {
          ...ecProperty,
          ecPropertyName: [
            ...property.propertyTraversal,
            "ModeledElement",
            "CodeValue",
          ].join("."),
        },
      ];
    }
    // Hardcode Category navigation path and label behavior
    case "BisCore:GeometricElement3dIsInCategory":
      return [
        {
          ...ecProperty,
          ecPropertyName: [...property.propertyTraversal, "UserLabel"].join("."),
        },
        {
          ...ecProperty,
          ecPropertyName: [...property.propertyTraversal, "CodeValue"].join("."),
        },
      ];
    // Hardcode Material path and label behavior
    case "BisCore:PhysicalElementIsOfPhysicalMaterial": {
      return [
        {
          ...ecProperty,
          ecPropertyName: [...property.propertyTraversal.slice(0, -1), "Material", "UserLabel"].join("."),
        },
        {
          ...ecProperty,
          ecPropertyName: [...property.propertyTraversal.slice(0, -1), "Material", "CodeValue"].join("."),
        },
      ];
    }
    default: {
      return [
        {
          ...ecProperty,
          ecPropertyName: property.propertyTraversal.join("."),
        },
      ];
    }
  }
};

const findProperties = (ecProperties: ECProperty[], propertiesMetaData: PropertyMetaData[]) => {
  let ecPropertiesCopy = [...ecProperties];
  const propertiesMetaDataResult: PropertyMetaData[] = new Array<PropertyMetaData>();
  let notFound = false;
  while (ecPropertiesCopy.length !== 0) {
    for (let i = 0; i < propertiesMetaData.length; i++) {
      const generatedProperty = convertToECProperties(propertiesMetaData[i]);
      const slicedEcProperties = ecPropertiesCopy.slice(0, generatedProperty.length);
      if (deepEqual(generatedProperty, slicedEcProperties)) {
        propertiesMetaDataResult.push(propertiesMetaData[i]);
        ecPropertiesCopy = ecPropertiesCopy.slice(generatedProperty.length);
        break;
      }
      if (i === propertiesMetaData.length - 1) {
        notFound = true;
      }
    }
    if (notFound)
      break;
  }
  return notFound ? [] : propertiesMetaDataResult;
};

const fetchPresentationDescriptor = async (iModelConnection: IModelConnection, keySet: KeySet) => {
  const ruleSet: Ruleset = {
    id: "gmw-element-properties",
    rules: [
      {
        ruleType: RuleTypes.Content,
        specifications: [
          {
            specType: ContentSpecificationTypes.SelectedNodeInstances,
          },
        ],
      }],
  };
  const requestOptions: ContentDescriptorRequestOptions<IModelConnection, KeySet, RulesetVariable> = {
    imodel: iModelConnection,
    keys: keySet,
    rulesetOrId: ruleSet,
    displayType: DefaultContentDisplayTypes.PropertyPane,
  };
  const descriptor = await Presentation.presentation.getContentDescriptor(
    requestOptions
  );
  return descriptor;
};

const GroupPropertyAction = ({
  iModelId,
  mappingId,
  groupId,
  groupPropertyId,
  groupPropertyName,
  keySet,
  returnFn,
}: GroupPropertyActionProps) => {
  const iModelConnection = useActiveIModelConnection();
  const { getAccessToken } = useGroupingMappingApiConfig();
  const mappingClient = useMappingClient();
  const [propertyName, setPropertyName] = useState<string>("");
  const [dataType, setDataType] = useState<string | undefined>();
  const [quantityType, setQuantityType] = useState<string>("Undefined");
  const [selectedProperties, setSelectedProperties] = useState<PropertyMetaData[]>([]);
  const [propertiesMetaData, setPropertiesMetaData] = useState<PropertyMetaData[]>(
    []
  );
  const [validator, showValidationMessage] = useValidator();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchInput, setSearchInput] = useState<string>("");
  const [activeSearchInput, setActiveSearchInput] = useState<string>("");
  const [searched, setSearched] = useState<boolean>(false);
  const [activeDragProperty, setActiveDragProperty] = useState<PropertyMetaData>();
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const [showModal, setShowModal] = useState<boolean>(false);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const activeProperty = selectedProperties.find((p) => active.id === p.key);
    setActiveDragProperty(activeProperty);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && (active.id !== over.id)) {
      setSelectedProperties((items) => {
        const oldIndex = selectedProperties.findIndex((p) => active.id === p.key);
        const newIndex = selectedProperties.findIndex((p) => over.id === p.key);

        return arrayMove(items, oldIndex, newIndex);
      });
    }

    setActiveDragProperty(undefined);
  };

  const filteredProperties = useMemo(
    () =>
      propertiesMetaData.filter((p) =>
        [p.label, p.categoryLabel]
          .join(" ")
          .toLowerCase()
          .includes(activeSearchInput.toLowerCase())
      ),
    [activeSearchInput, propertiesMetaData]
  );

  useEffect(() => {
    const generateProperties = async () => {
      setIsLoading(true);

      if (!iModelConnection) return;

      const descriptor = await fetchPresentationDescriptor(iModelConnection, keySet);

      // Only allow primitives and structs
      const propertyFields =
        descriptor?.fields.filter(
          (field) =>
            field.type.valueFormat === PropertyValueFormat.Primitive ||
            field.type.valueFormat === PropertyValueFormat.Struct
        ) ?? [];

      const propertiesMetaData = await convertPresentationFields(propertyFields);

      setPropertiesMetaData(propertiesMetaData);

      if (groupPropertyId) {
        const accessToken = await getAccessToken();
        let response: GroupPropertySingle | undefined;
        try {
          response = await mappingClient.getGroupProperty(
            accessToken,
            iModelId,
            mappingId,
            groupId,
            groupPropertyId
          );

          setPropertyName(response.property?.propertyName ?? "");
          setDataType(response.property?.dataType ?? "");
          setQuantityType(response.property?.quantityType ?? "");
          const properties = findProperties(response.property?.ecProperties ?? [], propertiesMetaData);
          setSelectedProperties(properties);
        } catch (error: any) {
          handleError(error.status);
        }
      }

      setIsLoading(false);
    };
    void generateProperties();
  }, [getAccessToken, mappingClient, groupId, groupPropertyId, iModelConnection, iModelId, keySet, mappingId]);

  const onSave = async () => {
    if (!validator.allValid()) {
      showValidationMessage(true);
      return;
    }
    try {
      setIsLoading(true);
      const accessToken = await getAccessToken();
      const groupProperty: GroupPropertyCreate = {
        propertyName,
        dataType,
        quantityType,
        ecProperties: selectedProperties.map((p) => convertToECProperties(p)).flat(),
      };
      groupPropertyId
        ? await mappingClient.updateGroupProperty(
          accessToken,
          iModelId,
          mappingId,
          groupId,
          groupPropertyId,
          groupProperty
        )
        : await mappingClient.createGroupProperty(
          accessToken,
          iModelId,
          mappingId,
          groupId,
          groupProperty
        );
      await returnFn(true);
    } catch (error: any) {
      handleError(error.status);
      setIsLoading(false);
    }
  };

  const startSearch = useCallback(() => {
    if (!searchInput) return;
    setActiveSearchInput(searchInput);
    setSearched(true);
  }, [searchInput]);

  const clearSearch = useCallback(() => {
    setSearchInput("");
    setActiveSearchInput("");
    setSearched(false);
  }, []);

  useEffect(() => {
    if (searchInput.length === 0) {
      setSearched(false);
      clearSearch();
    }
  }, [searchInput, setSearched, clearSearch]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <WidgetHeader
        title={groupPropertyName ?? "Add Property"}
        returnFn={async () => returnFn(false)}
      />
      <div className='gmw-group-property-action-container'>
        <Fieldset disabled={isLoading} className='gmw-property-options' legend='Property Details'>
          <Small className='field-legend'>
            Asterisk * indicates mandatory fields.
          </Small>
          <LabeledInput
            id='propertyName'
            label='Property Name'
            value={propertyName}
            required
            onChange={(event) => {
              setPropertyName(event.target.value);
              validator.showMessageFor("propertyName");
            }}
            message={validator.message(
              "propertyName",
              propertyName,
              NAME_REQUIREMENTS
            )}
            status={
              validator.message("propertyName", propertyName, NAME_REQUIREMENTS)
                ? "negative"
                : undefined
            }
            onBlur={() => {
              validator.showMessageFor("propertyName");
            }}
          />
          <LabeledSelect<string>
            label={"Data Type"}
            id='dataType'
            options={[
              { value: "Boolean", label: "Boolean" },
              { value: "Number", label: "Number" },
              { value: "String", label: "String" },
            ]}
            required
            value={dataType}
            onChange={(value) => {
              validator.showMessageFor("dataType");
              setDataType(value);
            }}
            message={validator.message("dataType", propertyName, "required")}
            status={
              validator.message("dataType", propertyName, "required")
                ? "negative"
                : undefined
            }
            onBlur={() => {
              validator.showMessageFor("dataType");
            }}
            onShow={() => { }}
            onHide={() => { }}
          />
          <LabeledSelect<string>
            label='Quantity Type'
            options={quantityTypesSelectionOptions}
            value={quantityType}
            onChange={setQuantityType}
            onShow={() => { }}
            onHide={() => { }}
          />
        </Fieldset>
        {groupPropertyId && !isLoading && selectedProperties.length === 0 && <Alert type="warning">Warning: Properties could not be found. Overwriting will occur if a selection is made.</Alert>}
        <Fieldset className='gmw-property-view-container' legend="Mapped Properties">
          <div className="gmw-property-view-button">
            <Button
              onClick={async () => setShowModal(true)}
              disabled={isLoading}
            >
              Select Properties
            </Button>
          </div>
          <div className="gmw-properties-list">
            {selectedProperties.length === 0 && !isLoading ?
              <div className="gmw-empty-selection">
                <Text>No properties selected.</Text>
                <Text>Press the &quot;Select Properties&quot; button for options.</Text>
              </div> :
              selectedProperties.map((property) => (
                <HorizontalTile
                  key={property.key}
                  title={property.label}
                  titleTooltip={`Parent: ${property.parentPropertyClassName}`}
                  subText={`${property.type}`}
                  actionGroup={`${property.categoryLabel}`}
                />
              ))}
          </div>
        </Fieldset>
      </div>
      <ActionPanel
        onSave={onSave}
        onCancel={async () => returnFn(false)}
        isLoading={isLoading}
        isSavingDisabled={
          selectedProperties.length === 0 || !propertyName || !dataType
        }
      />
      <Modal
        title="Properties Selection"
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          clearSearch();
        }}
        closeOnExternalClick={false}
      >
        <Split
          expandToMin={false}
          className="gmw-property-selection-container"
          gutterAlign="center"
          gutterSize={2}
          direction="horizontal">
          <Surface className="gmw-available-properties" elevation={1}>
            <div className="gmw-available-properties-header">
              <Label as="span">Available Properties</Label>
              <LabeledInput
                displayStyle="inline"
                iconDisplayStyle="inline"
                className="gmw-available-prop-search"
                value={searchInput}
                size="small"
                placeholder="Search...."
                onChange={(event) => {
                  const {
                    target: { value },
                  } = event;
                  setSearchInput(value);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    startSearch();
                  }
                }}
                svgIcon={
                  searched ? (
                    <IconButton onClick={clearSearch} styleType="borderless">
                      <SvgClose />
                    </IconButton>
                  ) : (
                    <IconButton onClick={startSearch} styleType="borderless">
                      <SvgSearch />
                    </IconButton>
                  )
                }
              />
            </div>
            {filteredProperties.length === 0 ?
              <div className="gmw-empty-selection">
                <Text>No properties available. </Text>
              </div> :
              <div className="gmw-properties-list">
                {
                  filteredProperties.map((property) => (
                    <HorizontalTile
                      key={property.key}
                      title={property.label}
                      titleTooltip={`Parent: ${property.parentPropertyClassName}`}
                      subText={`${property.type}`}
                      actionGroup={`${property.categoryLabel}`}
                      selected={selectedProperties.some((p) => property.key === p.key)}
                      onClick={() =>
                        setSelectedProperties((sp) =>
                          sp.some((p) => property.key === p.key)
                            ? sp.filter(
                              (p) => property.key !== p.key
                            )
                            : [...sp, property]
                        )
                      }
                    />
                  ))}
              </div>}
          </Surface>
          <Surface className="gmw-selected-properties" elevation={1}>
            <Label as="span">Selected Properties</Label>
            {selectedProperties.length === 0 ?
              <div className="gmw-empty-selection">
                <Text>No properties selected.</Text>
                <Text>Add some by clicking on the properties shown left.</Text>
              </div> :
              <div className="gmw-properties-list" >
                <SortableContext
                  items={selectedProperties.map((p) => p.key)}
                  strategy={verticalListSortingStrategy}
                >
                  {selectedProperties.map((property) =>
                    <SortableHorizontalTile
                      key={property.key}
                      id={property.key}
                      title={property.label}
                      titleTooltip={`Parent: ${property.parentPropertyClassName}`}
                      subText={property.type}
                      actionGroup={
                        <div>
                          {property.categoryLabel}
                          <IconButton
                            styleType="borderless"
                            title="Remove"
                            onClick={() => {
                              setSelectedProperties((sp) => sp.filter(
                                (p) => property.key !== p.key
                              ));
                            }
                            }>
                            <SvgRemove />
                          </IconButton>
                        </div>
                      }
                    />)}
                </SortableContext>
              </div>
            }
          </Surface>
        </Split>
        <ModalButtonBar>
          <Button
            onClick={() => {
              setShowModal(false);
              clearSearch();
            }}
            styleType="high-visibility"
          >
            Close
          </Button>
        </ModalButtonBar>
      </Modal>
      <DragOverlay zIndex={9999}>
        {activeDragProperty ?
          <HorizontalTile
            title={activeDragProperty.label}
            titleTooltip={`Parent: ${activeDragProperty.parentPropertyClassName}`}
            subText={activeDragProperty.type}
            actionGroup={activeDragProperty.categoryLabel}
            dragHandle={<div className="gmw-drag-icon" ><SvgDragHandleVertical /></div>}
          /> : null}
      </DragOverlay>
    </DndContext>
  );
};

export default GroupPropertyAction;
