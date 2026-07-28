/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { Fieldset } from "@itwin/itwinui-react";
import React from "react";
import "./GroupAction.scss";
import type { GroupDetailsProps } from "./GroupDetails";
import { GroupDetails } from "./GroupDetails";
import "./GroupDetailsStep.scss";
import { GroupingMappingWidget } from "../../../GroupingMappingWidget";

const getDefaultDisplayStrings = () => ({
  groupDetails: GroupingMappingWidget.translate("groups.groupDetails"),
});

export interface GroupDetailsStepProps extends GroupDetailsProps {
  displayStrings?: Partial<ReturnType<typeof getDefaultDisplayStrings>>;
}

export const GroupDetailsStep = ({ displayStrings: userDisplayStrings, ...rest }: GroupDetailsStepProps) => {
  const displayStrings = React.useMemo(() => ({ ...getDefaultDisplayStrings(), ...userDisplayStrings }), [userDisplayStrings]);

  return (
    <Fieldset legend={displayStrings.groupDetails} className="gmw-group-details">
      <GroupDetails {...rest} />
    </Fieldset>
  );
};
