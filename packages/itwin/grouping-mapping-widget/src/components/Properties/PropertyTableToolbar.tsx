/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import { SvgAdd, SvgRefresh } from "@itwin/itwinui-icons-react";
import { Button, IconButton } from "@itwin/itwinui-react";
import "./PropertyTableToolbar.scss";

export interface PropertyTableToolbarProps {
  propertyType: string;
  onClickAddProperty?: () => void;
  refreshProperties: () => void;
  isLoading: boolean;
}

export const PropertyTableToolbar = ({ propertyType, onClickAddProperty, refreshProperties, isLoading }: PropertyTableToolbarProps) => (
  <div className="gmw-property-table-toolbar">
    {onClickAddProperty && (
      <Button startIcon={<SvgAdd />} styleType="high-visibility" onClick={onClickAddProperty}>
        Add {propertyType} Property
      </Button>
    )}
    <IconButton title="Refresh" className="gmw-property-table-refresh-button" onClick={refreshProperties} disabled={isLoading} styleType="borderless">
      <SvgRefresh />
    </IconButton>
  </div>
);
