/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import type { Route } from "./EC3Widget";
import { RouteStep } from "./EC3Widget";
import { TemplateMenu } from "./TemplateMenu";
import { Templates } from "./Templates";
export interface EC3RouterProps {
  currentRoute: Route;
  navigateTo: (getNextRoute: (prev: Route | undefined) => Route) => void;
  goBack: () => void;
}

export const EC3Router = ({
  currentRoute,
  navigateTo,
  goBack,
}: EC3RouterProps) => {
  const { template } = currentRoute.routingFields;
  switch (currentRoute.step) {
    case RouteStep.Templates:
      return (
        <Templates
          onClickCreate={() =>
            navigateTo(() => ({
              step: RouteStep.TemplateMenu,
              title: "Create Template",
              routingFields: {},
            }))}
          onClickTemplateTitle={(t) =>
            navigateTo(() => ({
              step: RouteStep.TemplateMenu,
              title: t.displayName,
              routingFields: { template: t },
            }))
          }
        />
      );
    case RouteStep.TemplateMenu:
      return (
        <TemplateMenu template={template} onClickCancel={goBack} onSaveSuccess={goBack} />
      );
    default:
      return null;
  }
};
