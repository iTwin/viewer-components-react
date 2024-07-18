/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import { SvgAdd, SvgRefresh } from "@itwin/itwinui-icons-react";
import { Button, IconButton } from "@itwin/itwinui-react";
import "./PropertyTableToolbar.scss";
import { ExtractionStates } from "../Extraction/ExtractionStatus";

export interface PropertyTableToolbarProps {
  onClickAddProperty?: () => void;
  refreshProperties: () => Promise<void>;
  isLoading: boolean;
  refreshExtractionStatus: () => Promise<void>;
  extractionState: ExtractionStates | undefined;
  setExtractionState: (state: ExtractionStates) => void;
}

export const PropertyTableToolbar = ({ onClickAddProperty, refreshProperties, isLoading, refreshExtractionStatus }: PropertyTableToolbarProps) => (
  <div className="gmw-property-table-toolbar">
    {onClickAddProperty && (
      <Button startIcon={<SvgAdd />} styleType="high-visibility" onClick={onClickAddProperty}>
        Add Validation Rule
      </Button>
    )}
    <IconButton
      title="Refresh"
      className="gmw-property-table-refresh-button"
      onClick={async () => {
        await refreshExtractionStatus();
        await refreshProperties();
      }}
      disabled={isLoading}
      styleType="borderless"
    >
      <SvgRefresh />
    </IconButton>
  </div>
);
