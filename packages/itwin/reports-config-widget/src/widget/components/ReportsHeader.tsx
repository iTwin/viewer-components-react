/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import type { Route } from "./ReportsContainer";
import { RouteStep } from "./ReportsContainer";
import { WidgetHeader } from "./utils";

export const ReportsHeader = ({ goBack, currentRoute }: { goBack: () => void; currentRoute: Route }) => {
  const shouldDisableReturnFn = currentRoute.step === RouteStep.ReportsList || currentRoute.step === RouteStep.ReportAction;

  return <WidgetHeader returnFn={shouldDisableReturnFn ? undefined : goBack} title={currentRoute.title} />;
};
