/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { NoRenderApp } from "@itwin/core-frontend";
import { MeasureTools } from "../../MeasureTools";
import { ITwinLocalization } from "@itwin/core-i18n";
import { TestUtils } from "../TestUtils";

function supplyI18NOptions() { return { urlTemplate: `${window.location.origin}/locales/{{lng}}/{{ns}}.json` }; }
// Before all tests, initialize any global services
before(async () => {
  const local: ITwinLocalization = new ITwinLocalization(supplyI18NOptions());
  await NoRenderApp.startup({ localization: local });
  await MeasureTools.startup({ localization: local });
});

after(async () => {
  await TestUtils.cleanup();
});
