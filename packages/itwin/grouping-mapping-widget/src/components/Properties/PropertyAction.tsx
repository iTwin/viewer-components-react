/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React, { useCallback, useEffect, useState } from "react";
import type { PropertyRecord } from "@itwin/appui-abstract";
import { PropertyValueFormat } from "@itwin/appui-abstract";
import { usePropertyGridWrapper } from "../context/PropertyGridWrapperContext";
import { Checkbox } from "@itwin/itwinui-react";
import "./PropertyAction.scss";
import type { QueryBuilder } from "../Groups/QueryBuilder/QueryBuilder";
import { useGroupingMappingApiConfig } from "../context/GroupingApiConfigContext";

export interface PropertyActionProps {
  property: PropertyRecord;
}

const usePropertySelection = (property: PropertyRecord, currentPropertyList: PropertyRecord[], queryBuilder: QueryBuilder | undefined) => {
  const [isCheckboxLoading, setIsCheckboxLoading] = useState(false);
  const { iModelConnection } = useGroupingMappingApiConfig();
  if (!iModelConnection) {
    throw new Error("This hook requires an active iModelConnection.");
  }

  const checkIfPropertyIsSelected = useCallback(
    (property: PropertyRecord): boolean => {
      if (property.value.valueFormat === PropertyValueFormat.Primitive) {
        return currentPropertyList.includes(property);
      }

      if (property.value.valueFormat === PropertyValueFormat.Array) {
        return property.value.items.length === 0 && currentPropertyList.includes(property);
      }
      return Object.values(property.value.members).every((subProp: PropertyRecord) => checkIfPropertyIsSelected(subProp));
    },
    [currentPropertyList],
  );

  const isPropertySelected = checkIfPropertyIsSelected(property);

  const addProperty = useCallback(
    async (prop: PropertyRecord) => {
      if (prop.value.valueFormat === PropertyValueFormat.Primitive && !currentPropertyList.includes(prop) && (await queryBuilder?.addProperty(prop))) {
        setIsCheckboxLoading(false);
        return true;
      }
      return false;
    },
    [currentPropertyList, queryBuilder],
  );

  const removeProperty = useCallback(
    async (prop: PropertyRecord) => {
      if (currentPropertyList.includes(prop)) {
        await queryBuilder?.removeProperty(prop);
        setIsCheckboxLoading(false);
      }
    },
    [currentPropertyList, queryBuilder],
  );

  return {
    isPropertySelected,
    addProperty,
    removeProperty,
    isCheckboxLoading,
    setIsCheckboxLoading,
  };
};

export const PropertyAction = ({ property }: PropertyActionProps) => {
  const { currentPropertyList, queryBuilder, setCurrentPropertyList, setQuery, isUpdating, resetView } = usePropertyGridWrapper();

  const { isPropertySelected, addProperty, removeProperty, isCheckboxLoading, setIsCheckboxLoading } = usePropertySelection(
    property,
    currentPropertyList,
    queryBuilder,
  );

  useEffect(() => {
    setIsCheckboxLoading(isPropertySelected && isUpdating);
  }, [isPropertySelected, isUpdating, setIsCheckboxLoading]);

  const onPropertySelectionChanged = useCallback(async () => {
    if (isPropertySelected) {
      await removeProperty(property);
      setCurrentPropertyList((prevList) => prevList.filter((x) => x !== property));
      const query = (await queryBuilder?.buildQueryString()) ?? "";
      setQuery(query);
      if (!query) {
        await resetView?.();
      }
    } else {
      if (await addProperty(property)) {
        setCurrentPropertyList((prevList) => prevList.concat(property));
        setQuery(await queryBuilder?.buildQueryString() ?? "");
      }
    }
  }, [addProperty, isPropertySelected, property, queryBuilder, removeProperty, resetView, setCurrentPropertyList, setQuery]);

  return (
    <div className="gmw-property-selection-checkbox">
      {property.value.valueFormat === PropertyValueFormat.Primitive && property.value.value !== undefined && (
        <Checkbox checked={isPropertySelected} onChange={onPropertySelectionChanged} disabled={isUpdating} isLoading={isCheckboxLoading} />
      )}
    </div>
  );
};
