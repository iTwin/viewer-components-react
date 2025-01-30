/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable import/no-duplicates */

import sinon from "sinon";
import { UiFramework } from "@itwin/appui-react";
// __PUBLISH_EXTRACT_START__ PropertyGrid.ExampleSettingsMenuItemImports
import { PropertyGridSettingsMenuItem } from "@itwin/property-grid-react";
// __PUBLISH_EXTRACT_END__
// __PUBLISH_EXTRACT_START__ PropertyGrid.PropertyGridWithSettingsMenuItemImports
import { PropertyGridComponent } from "@itwin/property-grid-react";
// __PUBLISH_EXTRACT_END__
import { render, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { buildIModel, insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory } from "../../utils/IModelUtils.js";
import { initializeLearningSnippetsTests, terminateLearningSnippetsTests } from "../../utils/InitializationUtils.js";
import { PropertyGridTestUtils } from "../../utils/PropertyGridTestUtils.js";

describe("Property grid", () => {
  describe("Learning snippets", () => {
    describe("Settings menu item", () => {
      before(async function () {
        await initializeLearningSnippetsTests();
        await PropertyGridTestUtils.initialize();
      });

      after(async function () {
        await terminateLearningSnippetsTests();
        await PropertyGridTestUtils.terminate();
      });

      afterEach(async () => {
        sinon.restore();
      });

      it("renders settings menu item", async function () {
        const imodel = (
          await buildIModel(this, async (builder) => {
            const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
            const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
            insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
            return { category };
          })
        ).imodel;
        const user = userEvent.setup();
        sinon.stub(UiFramework, "getIModelConnection").returns(imodel);

        // __PUBLISH_EXTRACT_START__ PropertyGrid.ExampleSettingsMenuItem
        function ExampleSettingsMenuItem() {
          return (
            // render using `PropertyGridSettingsMenuItem` to get consistent style
            <PropertyGridSettingsMenuItem
              id="example"
              onClick={() => {
                // handle settings item clicked
              }}
            >
              Click me!
            </PropertyGridSettingsMenuItem>
          );
        }
        // __PUBLISH_EXTRACT_END__

        // __PUBLISH_EXTRACT_START__ PropertyGrid.PropertyGridWithSettingsMenuItem
        function MyPropertyGrid() {
          return <PropertyGridComponent settingsMenuItems={[() => <ExampleSettingsMenuItem />]} />;
        }
        // __PUBLISH_EXTRACT_END__

        const { getByText } = render(<MyPropertyGrid />);
        await waitFor(async () => {
          await user.click(getByText("settings.label"));
          getByText("Click me!");
        });
      });
    });
  });
});
