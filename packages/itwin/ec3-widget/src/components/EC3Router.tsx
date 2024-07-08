/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import { RouteStep } from "./EC3WidgetComponent";
import { TemplateMenu } from "./TemplateMenu";
import { Templates } from "./Templates";
import { EC3Widget } from "../EC3Widget";
import type { EC3RouterProps } from "./EC3RouterProps";

export const EC3Router = ({ currentRoute, navigateTo, goBack, onExportResult }: EC3RouterProps) => {
  const { template } = currentRoute.routingFields;
  switch (currentRoute.step) {
    case RouteStep.Templates:
      return (
        <Templates
          onClickCreate={() =>
            navigateTo(() => ({
              step: RouteStep.TemplateMenu,
              title: EC3Widget.translate("createTemplate"),
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
          onExportResult={onExportResult}
        />
      );
    case RouteStep.TemplateMenu:
      return <TemplateMenu template={template} onClickCancel={goBack} onSaveSuccess={goBack} />;
    default:
      return null;
  }
};
