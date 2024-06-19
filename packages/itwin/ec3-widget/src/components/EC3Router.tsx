/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import type { Route } from "./EC3Widget";
import { RouteStep } from "./EC3Widget";
import { TemplateMenu } from "./TemplateMenu";
import { Templates } from "./Templates";
import type { useEC3WidgetLocalizationResult } from "../common/UseEC3WidgetLocalization";
import { useEC3WidgetLocalization } from "../common/UseEC3WidgetLocalization";

export interface EC3RouterProps {
  currentRoute: Route;
  navigateTo: (getNextRoute: (prev: Route | undefined) => Route) => void;
  goBack: () => void;
  localizedStrings?: useEC3WidgetLocalizationResult;
}

export const EC3Router = ({ currentRoute, navigateTo, goBack, localizedStrings }: EC3RouterProps) => {
  const { template } = currentRoute.routingFields;
  const widgetLocalizedStrings = useEC3WidgetLocalization(localizedStrings);
  switch (currentRoute.step) {
    case RouteStep.Templates:
      return (
        <Templates
          onClickCreate={() =>
            navigateTo(() => ({
              step: RouteStep.TemplateMenu,
              title: widgetLocalizedStrings.createTemplate,
              routingFields: {},
            }))
          }
          onClickTemplateTitle={(t) =>
            navigateTo(() => ({
              step: RouteStep.TemplateMenu,
              title: t.displayName,
              routingFields: { template: t },
            }))
          }
          localizedStrings={localizedStrings}
        />
      );
    case RouteStep.TemplateMenu:
      return <TemplateMenu template={template} onClickCancel={goBack} onSaveSuccess={goBack} localizedStrings={localizedStrings} />;
    default:
      return null;
  }
};
