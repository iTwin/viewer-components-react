/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import { useEffect, useState } from "react";
import type { PropertyRecord } from "@itwin/appui-abstract";
import { PropertyValueFormat } from "@itwin/appui-abstract";
import { ElementSeparator, Orientation } from "@itwin/core-react";
import { ActionButtonList } from "@itwin/components-react";
import "./PropertyView.scss";
import type { SharedRendererProps } from "./PropertyRender";
import { useCallback } from "react";
import { PropertyGridColumnStyleProvider } from "@itwin/components-react/lib/cjs/components-react/properties/renderers/PropertyGridColumns";
import { Checkbox } from "@itwin/itwinui-react";
import { CommonPropertyRenderer } from "@itwin/components-react/lib/cjs/components-react/properties/renderers/CommonPropertyRenderer";
import { usePropertyGridWrapper } from "../context/PropertyGridWrapperContext";

/** Properties of [[PropertyView]] React component
 * @public
 */
export interface PropertyViewProps extends SharedRendererProps {
  /** Property label as a React element */
  labelElement: React.ReactNode;
  /** Property value as a React element */
  valueElement?: React.ReactNode;
  /** Render callback for property value. If specified, `valueElement` is ignored. */
  valueElementRenderer?: () => React.ReactNode;
  /** Multiplier of how much the property is indented to the right */
  indentation?: number;
}

/**
 * A React component that renders property as label/value pair
 * @public
 */
export const PropertyView = (props: PropertyViewProps) => {
  const [isCheckboxLoading, setIsCheckboxLoading] = useState(false);
  const {
    currentPropertyList,
    queryBuilder,
    setCurrentPropertyList,
    setQuery,
    isUpdating,
  } = usePropertyGridWrapper();

  const _validatePropertySelection = () => {
    if (currentPropertyList.includes(props.propertyRecord)) {
      return true;
    }
    // Check if all subproperties are selected
    if (!_validateNestedPropertiesSelection(props.propertyRecord)) {
      return false;
    }
    return true;
  };

  const _validateNestedPropertiesSelection = (prop: PropertyRecord) => {
    switch (prop.value.valueFormat) {
      case PropertyValueFormat.Primitive:
        if (!currentPropertyList.includes(prop)) {
          return false;
        }
        break;
      case PropertyValueFormat.Array:
        if (prop.value.items.length === 0) {
          if (!currentPropertyList.includes(prop)) {
            return false;
          }
        }
        break;
      case PropertyValueFormat.Struct:
        for (const subPropName in prop.value.members) {
          if (
            Object.prototype.hasOwnProperty.call(
              prop.value.members,
              subPropName
            )
          ) {
            if (
              !_validateNestedPropertiesSelection(
                prop.value.members[subPropName]
              )
            ) {
              return false;
            }
          }
        }
    }
    return true;
  };

  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isPropertySelected, setIsPropertySelected] = useState<boolean>(
    _validatePropertySelection()
  );

  const _addSelectedProperty = useCallback(
    async (prop: PropertyRecord) => {
      // TODO: roof selected item/category value is an object but format is primitive(needs further exploration)
      if (
        !currentPropertyList.includes(prop) &&
        prop.value.valueFormat === PropertyValueFormat.Primitive
      ) {
        if (!(await queryBuilder?.addProperty(prop))) {
          setIsCheckboxLoading(false);
          setIsPropertySelected(false);
          return;
        }
        setCurrentPropertyList(
          currentPropertyList.concat(prop)
        );
        setQuery(queryBuilder?.buildQueryString() ?? "");
      }
    },
    [currentPropertyList, queryBuilder, setCurrentPropertyList, setQuery]
  );

  const _addNestedProperties = useCallback(
    (prop: PropertyRecord) => {
      switch (prop.value.valueFormat) {
        case PropertyValueFormat.Primitive:
          void _addSelectedProperty(prop);
          break;
        case PropertyValueFormat.Array:
          if (prop.value.items.length === 0) {
            void _addSelectedProperty(prop);
          }
          break;
        case PropertyValueFormat.Struct:
          for (const subPropName in prop.value.members) {
            if (
              Object.prototype.hasOwnProperty.call(
                prop.value.members,
                subPropName
              )
            ) {
              _addNestedProperties(prop.value.members[subPropName]);
            }
          }
      }
    },
    [_addSelectedProperty]
  );

  const _removeSelectedProperty = useCallback(
    async (prop: PropertyRecord): Promise<void> => {
      if (currentPropertyList.includes(prop)) {
        setCurrentPropertyList(
          currentPropertyList.filter((x: PropertyRecord) => x !== prop)
        );
        await queryBuilder?.removeProperty(prop);
        setQuery(queryBuilder?.buildQueryString() ?? "");
      }
    },
    [currentPropertyList, queryBuilder, setCurrentPropertyList, setQuery]
  );

  const _removeNestedProperties = useCallback(
    (prop: PropertyRecord) => {
      switch (prop.value.valueFormat) {
        case PropertyValueFormat.Primitive:
          void _removeSelectedProperty(prop);
          break;
        case PropertyValueFormat.Array:
          if (prop.value.items.length === 0) {
            void _removeSelectedProperty(prop);
          }
          break;
        case PropertyValueFormat.Struct:
          for (const subPropName in prop.value.members) {
            if (
              Object.prototype.hasOwnProperty.call(
                prop.value.members,
                subPropName
              )
            ) {
              _removeNestedProperties(prop.value.members[subPropName]);
            }
          }
      }
    },
    [_removeSelectedProperty]
  );

  useEffect(() => {
    if (!currentPropertyList.includes(props.propertyRecord)) {
      setIsPropertySelected(false);
    }
  }, [currentPropertyList, props.propertyRecord]);

  useEffect(() => {
    if (props?.propertyRecord) {
      if (isPropertySelected) {
        if (isUpdating) {
          setIsCheckboxLoading(true);
        }
        _addNestedProperties(props.propertyRecord);
      } else {
        _removeNestedProperties(props.propertyRecord);
      }
    }
  }, [
    _addNestedProperties,
    _removeNestedProperties,
    isPropertySelected,
    props.propertyRecord,
    isUpdating,
  ]);

  useEffect(() => {
    if (!isUpdating) {
      setIsCheckboxLoading(false);
    }
  }, [isUpdating]);

  const _onPropertySelectionChanged = () => {
    setIsPropertySelected(!isPropertySelected);
  };

  const _onClick = () => {
    if (props.onClick) {
      props.onClick(props.propertyRecord, props.uniqueKey);
    }
  };

  const _onMouseEnter = () => {
    if (props.isHoverable) {
      setIsHovered(true);
    }
  };

  const _onMouseLeave = () => {
    if (props.isHoverable) {
      setIsHovered(false);
    }
  };

  const _onContextMenu = (e: React.MouseEvent) => {
    if (props.onContextMenu) {
      props.onContextMenu(props.propertyRecord, e);
    }
    if (props.onRightClick) {
      props.onRightClick(props.propertyRecord, props.uniqueKey);
    }
    e.preventDefault();
    return false;
  };

  const getClassName = (viewProps: PropertyViewProps) => {
    let propertyRecordClassName =
      viewProps.orientation === Orientation.Horizontal
        ? "gmw-components-property-record--horizontal"
        : "gmw-components-property-record--vertical";
    if (viewProps.isSelected) {
      propertyRecordClassName += " components--selected";
    }
    if (viewProps.onClick) {
      propertyRecordClassName += " components--clickable";
    }
    if (viewProps.isHoverable) {
      propertyRecordClassName += " components--hoverable";
    }
    return propertyRecordClassName;
  };

  const ratio = props.columnRatio ? props.columnRatio : 0.25;
  const needElementSeparator =
    props.orientation === Orientation.Horizontal &&
    !!props.onColumnRatioChanged;
  const needActionButtons = !!props.actionButtonRenderers;
  const columnsStyleProvider = new PropertyGridColumnStyleProvider(
    props.columnInfo
  );

  const offset = CommonPropertyRenderer.getLabelOffset(
    props.indentation,
    props.orientation,
    props.width,
    props.columnRatio,
    props.columnInfo?.minLabelWidth
  );

  return (
    <div
      style={columnsStyleProvider.getStyle(
        props.orientation,
        needActionButtons,
        ratio,
        needElementSeparator
      )}
      className={getClassName(props)}
      onClick={_onClick}
      onContextMenu={_onContextMenu}
      onMouseEnter={_onMouseEnter}
      onMouseLeave={_onMouseLeave}
      role="presentation"
    >
      <div className="gmw-components-property-record-label">
        {props.propertyRecord.value.valueFormat ===
          PropertyValueFormat.Primitive && (
          <Checkbox
            style={{ marginLeft: offset }}
            className="gmw-components-property-selection-checkbox"
            checked={isPropertySelected}
            onChange={_onPropertySelectionChanged}
            disabled={
              isUpdating ||
                props.propertyRecord.value.value === undefined
            }
            isLoading={isCheckboxLoading}
          />
        )}
        {props.labelElement}
      </div>
      {needElementSeparator ? (
        <ElementSeparator
          movableArea={props.width}
          onRatioChanged={props.onColumnRatioChanged}
          ratio={ratio}
          orientation={props.orientation}
          isResizeHandleHovered={props.isResizeHandleHovered}
          onResizeHandleHoverChanged={props.onResizeHandleHoverChanged}
          isResizeHandleBeingDragged={props.isResizeHandleBeingDragged}
          onResizeHandleDragChanged={props.onResizeHandleDragChanged}
        />
      ) : undefined}
      {props.propertyRecord.value.valueFormat ===
        PropertyValueFormat.Primitive ? (
          <div className="gmw-components-property-record-value">
            <span>
              {props.valueElementRenderer
                ? props.valueElementRenderer()
                : props.valueElement}
            </span>
          </div>
        ) : undefined}
      {props.actionButtonRenderers ? (
        <ActionButtonList
          orientation={props.orientation}
          property={props.propertyRecord}
          isPropertyHovered={isHovered}
          actionButtonRenderers={props.actionButtonRenderers}
        />
      ) : undefined}
    </div>
  );
};
