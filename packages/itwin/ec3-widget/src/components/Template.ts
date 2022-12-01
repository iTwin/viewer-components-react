/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { EC3ConfigurationCreate, EC3ConfigurationUpdate } from "@itwin/insights-client";

export interface Configuration {
  displayName: string;
  description: string;
  id?: string;
  reportId?: string;
  labels: Label[];
  changedReportId?: boolean;
}

export interface Label {
  reportTable: string;
  name: string;
  elementNameColumn: string;
  elementQuantityColumn: string;
  materials: Material[];
}

export interface Material {
  nameColumn: string | undefined;
}

export function convertConfigurationCreate(childTemplate: Configuration): EC3ConfigurationCreate {
  return {
    reportId: childTemplate.reportId!,
    displayName: childTemplate.displayName,
    description: childTemplate.description,
    labels: childTemplate.labels.map((x) => {
      return {
        name: x.name,
        reportTable: x.reportTable,
        elementNameColumn: x.elementNameColumn,
        elementQuantityColumn: x.elementQuantityColumn,
        materials: x.materials.map((m) => {
          return {
            nameColumn: m.nameColumn ?? "",
          };
        }),
      };
    }),
  };
}

export function convertConfigurationUpdate(childTemplate: Configuration): EC3ConfigurationUpdate {
  return {
    displayName: childTemplate.displayName,
    description: childTemplate.description,
    labels: childTemplate.labels.map((x) => {
      return {
        name: x.name,
        reportTable: x.reportTable,
        elementNameColumn: x.elementNameColumn,
        elementQuantityColumn: x.elementQuantityColumn,
        materials: x.materials.map((m) => {
          return {
            nameColumn: m.nameColumn ?? "",
          };
        }),
      };
    }),
  };
}
