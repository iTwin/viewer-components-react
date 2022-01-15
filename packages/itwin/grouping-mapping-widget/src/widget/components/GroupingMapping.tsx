/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { Mappings } from "./Mapping";
import "./GroupingMapping.scss";

const GroupingMapping = () => {
  return (
    <div className='group-mapping-container'>
      <Mappings />
    </div>
  );
};

export default GroupingMapping;
