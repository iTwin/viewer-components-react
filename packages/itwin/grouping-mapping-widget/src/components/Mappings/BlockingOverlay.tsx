/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import classnames from "classnames";
import React from "react";
import { LoadingSpinner } from "../SharedComponents/LoadingSpinner";
import "./BlockingOverlay.scss";

export interface BlockingOverlayProps {
  isVisible: boolean;
}

export const BlockingOverlay = ({ isVisible }: BlockingOverlayProps) => {
  return (
    <div className={classnames("gmw-group-mapping-blocking-overlay", isVisible && "gmw-visible")}>
      <LoadingSpinner />
    </div>
  );
};
