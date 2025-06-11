/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { afterAll, beforeAll } from "vitest";

import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { MeasureTools } from "../../MeasureTools.js";
import { TestUtils } from "../TestUtils.js";
import { EmptyLocalization } from "@itwin/core-common";
import { SchemaContext, SchemaUnitProvider } from "@itwin/ecschema-metadata";
import { SchemaXmlFileLocater } from "@itwin/ecschema-locaters";

import * as path from "path";

// Before all tests, initialize any global services
beforeAll(async () => {
  const localization = new EmptyLocalization();
  await NoRenderApp.startup({ localization });
  await MeasureTools.startup({ localization });

  const schemaContext = new SchemaContext();
  const unitSchemaFilePath = path.dirname(require.resolve("@bentley/units-schema/package.json"));
  const locUnits = new SchemaXmlFileLocater();
  locUnits.addSchemaSearchPath(unitSchemaFilePath)
  schemaContext.addLocater(locUnits);
  IModelApp.quantityFormatter.setUnitsProvider(new SchemaUnitProvider(schemaContext));
});

afterAll(async () => {
  await TestUtils.cleanup();
});
