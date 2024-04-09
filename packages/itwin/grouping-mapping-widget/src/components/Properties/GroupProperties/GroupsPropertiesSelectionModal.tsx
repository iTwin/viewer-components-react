/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { renderToStaticMarkup } from "react-dom/server";
import {
  Button,
  Icon,
  IconButton,
  Label,
  LabeledInput,
  Modal,
  ModalButtonBar,
  Surface,
  Text,
} from "@itwin/itwinui-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  SvgClose,
  SvgDragHandleVertical,
  SvgMoreVerticalSmall,
  SvgRemove,
  SvgSearch,
} from "@itwin/itwinui-icons-react";
import {
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SortableHorizontalTile } from "./SortableHorizontalTile";
import Split from "react-split";
import "./GroupsPropertiesSelectionModal.scss";
import type { PropertyMetaData } from "./GroupPropertyUtils";
import { getLocalizedStringPresentation } from "../../../common/utils";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { GroupPropertyListItem } from "./GroupPropertyListItem";

export interface GroupPropertiesSelectionModalProps {
  showModal: boolean;
  setShowModal: (showModal: boolean) => void;
  selectedProperties: PropertyMetaData[];
  setSelectedProperties: (selectedProperties: (selectedProperties: PropertyMetaData[]) => PropertyMetaData[]) => void;
  propertiesMetaData: PropertyMetaData[];
}

export const GroupsPropertiesSelectionModal = (
  {
    showModal,
    setShowModal,
    selectedProperties,
    setSelectedProperties,
    propertiesMetaData,
  }: GroupPropertiesSelectionModalProps
) => {
  const [searchInput, setSearchInput] = useState<string>("");
  const [activeSearchInput, setActiveSearchInput] = useState<string>("");
  const [searched, setSearched] = useState<boolean>(false);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const [activeDragProperty, setActiveDragProperty] = useState<PropertyMetaData | undefined>();

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
  }, [selectedProperties, setSelectedProperties]);

  const clearSearch = useCallback(() => {
    setSearchInput("");
    setActiveSearchInput("");
    setSearched(false);
  }, []);

  const startSearch = useCallback(() => {
    if (!searchInput) return;
    setActiveSearchInput(searchInput);
    setSearched(true);
  }, [searchInput]);

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
            const dragHangle = renderToStaticMarkup(
              <Icon className="gmw-gutter-drag-icon" size="large">
                <SvgMoreVerticalSmall />
              </Icon>
            );
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
                    <IconButton onClick={clearSearch} styleType="borderless" title='Clear Search'>
                      <SvgClose />
                    </IconButton>
                  ) : (
                    <IconButton onClick={startSearch} styleType="borderless" title='Search'>
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
                    <GroupPropertyListItem
                      key={property.key}
                      name={`${property.displayLabel} (${property.propertyType})`}
                      titleTooltip={`${property.actualECClassName}`}
                      subText={getLocalizedStringPresentation(property.categoryLabel)}
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
                      name={`${property.displayLabel} (${property.propertyType})`}
                      titleTooltip={`${property.actualECClassName}`}
                      subText={getLocalizedStringPresentation(property.categoryLabel)}
                      action={
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
          <GroupPropertyListItem
            name={`${activeDragProperty.displayLabel} (${activeDragProperty.propertyType})`}
            titleTooltip={`${activeDragProperty.actualECClassName}`}
            subText={getLocalizedStringPresentation(activeDragProperty.categoryLabel)}
            action={
              <IconButton
                styleType="borderless">
                <SvgRemove />
              </IconButton>}
            dragHandle={
              <Icon className="gmw-drag-icon" size="large">
                <SvgDragHandleVertical />
              </Icon>
            }
          /> : null}
      </DragOverlay>
    </DndContext>
  );
};
