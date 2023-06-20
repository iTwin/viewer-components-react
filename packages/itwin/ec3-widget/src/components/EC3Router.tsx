/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import type { Route } from "./EC3Widget";
import { RouteStep } from "./EC3Widget";
import { TemplateMenu } from "./TemplateMenu";
import { Templates } from "./Templates";

export const EC3Router = ({
  currentRoute,
  navigateTo,
  goBack,
}: {
  currentRoute: Route;
  navigateTo: (toRoute: (prev: Route | undefined) => Route) => void;
  goBack: () => void;
}) => {
  goBack;
  const { template } = currentRoute.ec3RoutingFields;
  switch (currentRoute.step) {
    case RouteStep.Templates:
      return (
        <Templates
          onClickCreate={() =>
            navigateTo(() => ({
              step: RouteStep.TemplateMenu,
              title: "Create Template",
              ec3RoutingFields: {},
            }))}
          onClickTemplateTitle={(t) =>
            navigateTo(() => ({
              step: RouteStep.TemplateMenu,
              title: t.displayName,
              ec3RoutingFields: { template: t },
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
