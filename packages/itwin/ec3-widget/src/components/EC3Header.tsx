/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import type { Route } from "./EC3Widget";
import { WidgetHeader } from "./utils";

export const EC3Header = ({
  currentRoute,
}: {
  goBack: () => void;
  currentRoute: Route;
}) => <WidgetHeader title={currentRoute.title} />;
