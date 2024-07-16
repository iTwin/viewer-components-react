/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import type { Route } from "./EC3WidgetComponent";
import { WidgetHeader } from "./utils";

export interface EC3HeaderProps {
  currentRoute: Route;
}
export const EC3Header = ({ currentRoute }: EC3HeaderProps) => <WidgetHeader title={currentRoute.title} />;
