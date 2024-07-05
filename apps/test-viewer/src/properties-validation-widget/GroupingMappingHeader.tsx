/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import type { Route } from "./GroupingMapping";
import { RouteStep } from "./GroupingMapping";
import { WidgetHeader } from "./WidgetHeader/WidgetHeader";

export const GroupingMappingHeader = ({ goBack, currentRoute }: { goBack: () => void; currentRoute: Route }) => {
  const shouldDisableReturnFn =
    currentRoute.step === RouteStep.Groups ||
    currentRoute.step === RouteStep.GroupAction ||
    currentRoute.step === RouteStep.PropertyAction ||
    currentRoute.step === RouteStep.CalculatedPropertyAction ||
    currentRoute.step === RouteStep.CustomCalculationPropertyAction;
  return <WidgetHeader returnFn={shouldDisableReturnFn ? undefined : goBack} title={currentRoute.title} />;
};
