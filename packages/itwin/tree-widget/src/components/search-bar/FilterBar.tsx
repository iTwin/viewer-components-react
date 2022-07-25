/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import { SvgClose } from "@itwin/itwinui-icons-react";
import { IconButton } from "@itwin/itwinui-react";
import { TreeWidget } from "../../TreeWidget";
import "./FilterBar.scss";

interface FilterBarProps {
  /** Filter text */
  text: string;
  /** Callback when the filter (or text) is clicked */
  onClick?: () => void;
  /** Callback when the close button is clicked */
  onClose?: () => void;
}

const FilterBar = (props: FilterBarProps) => {
  const { onClick, onClose, text } = props;

  const _onCloseClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    onClose?.();
  };

  const searchText = `${TreeWidget.translate("searchFor")} \`${text}\``;
  return (
    <div role="button" tabIndex={0} className="search-bar-filter-bar" onClick={onClick} onKeyPress={onClick}>
      <span>{searchText}</span>
      <IconButton
        id="search-bar-filter-close"
        size="small"
        styleType="borderless"
        onClick={_onCloseClick}
        title={TreeWidget.translate("clear")}
      >
        <SvgClose />
      </IconButton>
    </div>
  );
};

export default FilterBar;
