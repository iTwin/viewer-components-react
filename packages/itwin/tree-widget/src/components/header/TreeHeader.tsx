/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React, { useMemo } from "react";
import {
  SvgVisibilityHalf,
  SvgVisibilityHide,
  SvgVisibilityShow,
} from "@itwin/itwinui-icons-react";
import { SearchBar } from "../search-bar/SearchBar";
import type { SearchOptions } from "../TreeFilteringState";
import { TreeWidget } from "../../TreeWidget";
import type { ButtonInfo } from "../search-bar/SearchBar";

export interface TreeHeaderComponentProps {
  showAll?: () => void;
  hideAll?: () => void;
  invert?: () => void;
  toggle2D?: () => void;
  toggle2DIcon?: JSX.Element;
  toggle3D?: () => void;
  toggle3DIcon?: JSX.Element;
  searchOptions: SearchOptions;
}

export function TreeHeaderComponent({
  searchOptions,
  showAll,
  hideAll,
  invert,
  toggle2D,
  toggle2DIcon,
  toggle3D,
  toggle3DIcon,
}: TreeHeaderComponentProps) {

  const tools = useMemo(() => {
    const toolsArray: ButtonInfo[] = [];

    if (showAll) {
      toolsArray.push({
        icon: <SvgVisibilityShow />,
        tooltip: TreeWidget.translate("showAll"),
        onClick: showAll,
      });
    }

    if (hideAll) {
      toolsArray.push({
        icon: <SvgVisibilityHide />,
        tooltip: TreeWidget.translate("hideAll"),
        onClick: hideAll,
      });
    }

    if (invert) {
      toolsArray.push({
        icon: <SvgVisibilityHalf />,
        tooltip: TreeWidget.translate("invert"),
        onClick: invert,
      });
    }

    if (toggle2D || toggle3D) {
      toolsArray.push({ isSeparator: true });
    }

    if (toggle2D && toggle2DIcon) {
      toolsArray.push({
        icon: toggle2DIcon,
        label: TreeWidget.translate("label2D"),
        tooltip: TreeWidget.translate("toggle2DViews"),
        onClick: toggle2D,
      });
    }

    if (toggle3D && toggle3DIcon) {
      toolsArray.push({
        icon: toggle3DIcon,
        label: TreeWidget.translate("label3D"),
        tooltip: TreeWidget.translate("toggle3DViews"),
        onClick: toggle3D,
      });
    }

    return toolsArray;
  }, [showAll, hideAll, invert, toggle2D, toggle2DIcon, toggle3D, toggle3DIcon]);

  return (
    <SearchBar
      value=""
      valueChangedDelay={500}
      placeholder={TreeWidget.translate("search")}
      title={TreeWidget.translate("searchForSomething")}
      filteringInProgress={searchOptions.isFiltering}
      onFilterStart={searchOptions.onFilterStart}
      onSelectedChanged={searchOptions.onResultSelectedChanged}
      resultCount={searchOptions.matchedResultCount ?? 0}
      buttons={tools}
      enableFiltering={true}
    />
  );
}
