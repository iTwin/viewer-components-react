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

const defaultDisplayStrings = {
  groupDetails: "Group Details",
};

export interface GroupDetailsStepProps extends GroupDetailsProps {
  displayStrings?: Partial<typeof defaultDisplayStrings>;
}

export const GroupDetailsStep = ({
  displayStrings: userDisplayStrings,
  ...rest
}: GroupDetailsStepProps) => {
  const displayStrings = React.useMemo(
    () => ({ ...defaultDisplayStrings, ...userDisplayStrings }),
    [userDisplayStrings]
  );

  return (
    <Fieldset
      legend={displayStrings.groupDetails}
      className='gmw-group-details'
    >
      <GroupDetails
        {...rest}
      />
    </Fieldset>
  );
};
