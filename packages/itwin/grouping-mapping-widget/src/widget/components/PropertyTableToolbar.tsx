/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import { SvgAdd, SvgRefresh } from "@itwin/itwinui-icons-react";
import { Button, IconButton } from "@itwin/itwinui-react";
import "./PropertyTableToolbar.scss";

export const PropertyTableToolbar = ({
  propertyType,
  onClickAddProperty,
  refreshProperties,
  isLoadingProperties,
}: {
  propertyType: string;
  onClickAddProperty?: () => void;
  refreshProperties: () => void;
  isLoadingProperties: boolean;
}) => (
  <div className={`gmw-property-table-toolbar`}>
    {onClickAddProperty &&
      <Button
        startIcon={<SvgAdd />}
        styleType='high-visibility'
        onClick={onClickAddProperty}
      >
        Add {propertyType} Property
      </Button>
    }
    <IconButton
      title="Refresh"
      onClick={refreshProperties}
      disabled={isLoadingProperties}
      styleType='borderless'
    >
      <SvgRefresh />
    </IconButton>
  </div>
);
