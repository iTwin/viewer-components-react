/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { renderToStaticMarkup } from "react-dom/server";
import type { KeySet } from "@itwin/presentation-common";
import { PropertyValueFormat } from "@itwin/presentation-common";
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
import { DataType, QuantityType } from "@itwin/insights-client";
import type {
  GroupProperty,
  GroupPropertyCreate,
} from "@itwin/insights-client";
import {
  SvgClose,
  SvgDragHandleVertical,
  SvgMoreVerticalSmall,
  SvgRemove,
  SvgSearch,
} from "@itwin/itwinui-icons-react";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
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
import Split from "react-split";
import "./GroupPropertyAction.scss";
import type { PropertyMetaData } from "./GroupPropertyUtils";
import {
  convertPresentationFields,
  convertToECProperties,
  fetchPresentationDescriptor,
  findProperties,
} from "./GroupPropertyUtils";

interface GroupPropertyActionProps {
  iModelId: string;
  mappingId: string;
  groupId: string;
  groupPropertyId?: string;
  groupPropertyName?: string;
  keySet: KeySet;
  returnFn: (modified: boolean) => Promise<void>;
}

export const quantityTypesSelectionOptions: SelectOption<QuantityType>[] = [
  { value: QuantityType.Area, label: "Area" },
  { value: QuantityType.Distance, label: "Distance" },
  { value: QuantityType.Force, label: "Force" },
  { value: QuantityType.Mass, label: "Mass" },
  { value: QuantityType.Monetary, label: "Monetary" },
  { value: QuantityType.Time, label: "Time" },
  { value: QuantityType.Volume, label: "Volume" },
  { value: QuantityType.Undefined, label: "No Quantity Type" },
];

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
  const [dataType, setDataType] = useState<DataType>(DataType.Undefined);
  const [quantityType, setQuantityType] = useState<QuantityType>(QuantityType.Undefined);
  const [selectedProperties, setSelectedProperties] = useState<PropertyMetaData[]>([]);
  const [propertiesMetaData, setPropertiesMetaData] = useState<PropertyMetaData[]>([]);
  const [propertiesNotFoundAlert, setPropertiesNotFoundAlert] = useState<boolean>(false);
  const [validator, showValidationMessage] = useValidator();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchInput, setSearchInput] = useState<string>("");
  const [activeSearchInput, setActiveSearchInput] = useState<string>("");
  const [searched, setSearched] = useState<boolean>(false);
  const [activeDragProperty, setActiveDragProperty] = useState<PropertyMetaData | undefined>();
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const [showModal, setShowModal] = useState<boolean>(false);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const activeProperty = selectedProperties.find((p) => active.id === p.key);
    setActiveDragProperty(activeProperty);
  }, [selectedProperties]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && (active.id !== over.id)) {
      setSelectedProperties((items) => {
        const oldIndex = selectedProperties.findIndex((p) => active.id === p.key);
        const newIndex = selectedProperties.findIndex((p) => over.id === p.key);

        return arrayMove(items, oldIndex, newIndex);
      });
    }

    setActiveDragProperty(undefined);
  }, [selectedProperties]);

  const filteredProperties = useMemo(
    () =>
      propertiesMetaData.filter((p) =>
        [p.displayLabel, p.categoryLabel, p.actualECClassName]
          .map((l) => l.toLowerCase())
          .some((l) => l.includes(activeSearchInput.toLowerCase()))
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

      const propertiesMetaData = convertPresentationFields(propertyFields);

      setPropertiesMetaData(propertiesMetaData);

      if (groupPropertyId) {
        const accessToken = await getAccessToken();
        let response: GroupProperty | undefined;
        try {
          response = await mappingClient.getGroupProperty(
            accessToken,
            iModelId,
            mappingId,
            groupId,
            groupPropertyId
          );

          setPropertyName(response.propertyName);
          setDataType(response.dataType);
          setQuantityType(response.quantityType);
          const properties = findProperties(response.ecProperties, propertiesMetaData);
          if (properties.length === 0) {
            setPropertiesNotFoundAlert(true);
          }

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
          <Small className='gmw-field-legend'>
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
          <LabeledSelect<DataType>
            label={"Data Type"}
            id='dataType'
            options={[
              { value: DataType.Boolean, label: "Boolean" },
              { value: DataType.Number, label: "Number" },
              { value: DataType.String, label: "String" },
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
          <LabeledSelect<QuantityType>
            label='Quantity Type'
            options={quantityTypesSelectionOptions}
            value={quantityType}
            onChange={setQuantityType}
            onShow={() => { }}
            onHide={() => { }}
          />
        </Fieldset>
        {propertiesNotFoundAlert &&
          <Alert type="warning">
            Warning: Could not match saved properties from the current generated list. It does not confirm or deny validity. Overwriting will occur if a new selection is made and saved.
          </Alert>
        }
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
                  title={`${property.displayLabel} (${property.propertyType})`}
                  titleTooltip={`${property.actualECClassName}`}
                  subText={property.categoryLabel}
                  actionGroup={null}
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
          gutter={() => {
            // Expects HTMLElement
            const dragHangle = renderToStaticMarkup(<div className="gmw-gutter-drag-icon"><SvgMoreVerticalSmall /></div>);
            const gutter = document.createElement("div");
            gutter.className = `gmw-gutter`;
            gutter.innerHTML = dragHangle;
            return gutter;
          }}
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
                      title={`${property.displayLabel} (${property.propertyType})`}
                      titleTooltip={`${property.actualECClassName}`}
                      subText={property.categoryLabel}
                      actionGroup={null}
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
                      title={`${property.displayLabel} (${property.propertyType})`}
                      titleTooltip={`${property.actualECClassName}`}
                      subText={property.categoryLabel}
                      actionGroup={
                        <div>
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
              </div>}
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
            title={`${activeDragProperty.displayLabel} (${activeDragProperty.propertyType})`}
            titleTooltip={`${activeDragProperty.actualECClassName}`}
            subText={activeDragProperty.categoryLabel}
            actionGroup={
              <IconButton
                styleType="borderless">
                <SvgRemove />
              </IconButton>}
            dragHandle={<div className="gmw-drag-icon" ><SvgDragHandleVertical /></div>}
          /> : null}
      </DragOverlay>
    </DndContext>
  );
};

export default GroupPropertyAction;

