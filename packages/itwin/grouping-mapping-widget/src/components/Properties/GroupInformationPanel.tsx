/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import { InformationPanel, InformationPanelBody, InformationPanelHeader, LabeledTextarea, Text } from "@itwin/itwinui-react";
import "./GroupInformationPanel.scss";

export interface GroupInformationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  groupName: string;
  query: string;
}

export const GroupInformationPanel = ({ isOpen, onClose, groupName, query }: GroupInformationPanelProps) => {
  return (
    <InformationPanel isOpen={isOpen}>
      <InformationPanelHeader onClose={onClose}>
        <Text variant="subheading">{`${groupName} Information`}</Text>
      </InformationPanelHeader>
      <InformationPanelBody>
        <div className="gmw-group-information-body">
          <LabeledTextarea label="Query" rows={15} readOnly defaultValue={query} />
        </div>
      </InformationPanelBody>
    </InformationPanel>
  );
};
