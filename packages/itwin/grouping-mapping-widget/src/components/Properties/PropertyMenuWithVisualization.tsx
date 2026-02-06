/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React, { useState } from "react";
import type { PropertyMenuProps } from "./PropertyMenu";
import { PropertyMenu } from "./PropertyMenu";
import { GroupColorToggle } from "./GroupColorToggle";
import { IconButton, InformationPanelWrapper } from "@itwin/itwinui-react";
import { GroupInformationPanel } from "./GroupInformationPanel";
import { SvgProperties } from "@itwin/itwinui-icons-react";
import "./PropertyMenuWithVisualization.scss";
import { GroupingMappingWidget } from "../../GroupingMappingWidget";

/**
 * Properties for the {@link PropertyMenuWithVisualization} component.
 * @public
 */
export interface PropertyMenuWithVisualizationProps extends PropertyMenuProps {
  color: string;
  disableZoom?: boolean;
  onGroupPropertyDelete?: () => void;
}

/**
 * Component to display a property menu with visualization.
 * @public
 */
export const PropertyMenuWithVisualization = ({ group, color, hideRefreshIcon, disableZoom, ...rest }: PropertyMenuWithVisualizationProps) => {
  const [isInformationPanelOpen, setIsInformationPanelOpen] = useState<boolean>(false);

  return (
    <InformationPanelWrapper className="gmw-property-menu-vis-wrapper">
      <div className="gmw-property-menu-vis-toolbar">
        <GroupColorToggle group={group} color={color} labelPosition="left" disableZoom={disableZoom} />
        <IconButton styleType="borderless" onClick={() => setIsInformationPanelOpen(true)} title={GroupingMappingWidget.translate("properties.groupInformation")}>
          <SvgProperties />
        </IconButton>
      </div>
      <PropertyMenu group={group} hideRefreshIcon={hideRefreshIcon} {...rest} />
      <GroupInformationPanel isOpen={isInformationPanelOpen} onClose={() => setIsInformationPanelOpen(false)} query={group.query} groupName={group.groupName} />
    </InformationPanelWrapper>
  );
};
