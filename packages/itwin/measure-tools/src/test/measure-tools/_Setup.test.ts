/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as path from "path";
import { afterAll, beforeAll, vi } from "vitest";
import { EmptyLocalization } from "@itwin/core-common";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { SchemaXmlFileLocater } from "@itwin/ecschema-locaters";
import { SchemaContext, SchemaUnitProvider } from "@itwin/ecschema-metadata";
import { MeasureTools } from "../../MeasureTools.js";
import { TestUtils } from "../TestUtils.js";

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
  window.HTMLElement.prototype.scrollTo = vi.fn();
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterAll(async () => {
  await TestUtils.cleanup();
});
