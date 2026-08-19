/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { IModelApp } from "@itwin/core-frontend";
// __PUBLISH_EXTRACT_START__ TreeWidget.TreeWidgetInitializeImports
import { TreeWidgetContextProvider } from "@itwin/tree-widget-react";
// __PUBLISH_EXTRACT_END__
import { render } from "./TestUtils.js";

describe("Tree widget", () => {
  describe("Learning snippets", () => {
    it("provides required tree widget context", () => {
      // __PUBLISH_EXTRACT_START__ TreeWidget.TreeWidgetInitialize
      function MyTreeWidget() {
        return <TreeWidgetContextProvider localization={IModelApp.localization}>{/* tree components */}</TreeWidgetContextProvider>;
      }
      // __PUBLISH_EXTRACT_END__

      expect(() => render(<MyTreeWidget />)).not.toThrow();
    });
  });
});
