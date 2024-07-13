/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import { SvgAdd, SvgRefresh } from "@itwin/itwinui-icons-react";
import { Button, IconButton } from "@itwin/itwinui-react";
import "./PropertyTableToolbar.scss";
import { ExtractionStates, ExtractionStatus } from "../Extraction/ExtractionStatus";
import { ExtractionState } from "@itwin/insights-client";

type IconStatus = "negative" | "positive" | "warning" | undefined;

export interface PropertyTableToolbarProps {
  onClickAddProperty?: () => void;
  refreshProperties: () => Promise<void>;
  isLoading: boolean;
  refreshExtractionStatus: () => Promise<void>;
  extractionState: ExtractionStates | undefined;
  setExtractionState: (state: ExtractionStates) => void;
}

export const PropertyTableToolbar = ({
  onClickAddProperty,
  refreshProperties,
  isLoading,
  refreshExtractionStatus,
  extractionState,
  setExtractionState,
}: PropertyTableToolbarProps) => (
  <div className="gmw-property-table-toolbar">
    {onClickAddProperty && (
      <Button startIcon={<SvgAdd />} styleType="high-visibility" onClick={onClickAddProperty}>
        Add Validation Property
      </Button>
    )}
    <ExtractionStatus
      state={extractionState}
      clearExtractionState={() => {
        setExtractionState(ExtractionStates.None);
      }}
    ></ExtractionStatus>
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
