/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable import/no-duplicates */
import { join } from "path";
/* eslint-disable no-console */
import sinon from "sinon";
import { UiFramework, UiItemsManager } from "@itwin/appui-react";
import { IModelReadRpcInterface, SnapshotIModelRpcInterface } from "@itwin/core-common";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting } from "@itwin/presentation-testing";
// __PUBLISH_EXTRACT_START__ PropertyGrid.ExampleSettingsMenuItemImports
import { PropertyGridSettingsMenuItem } from "@itwin/property-grid-react";
// __PUBLISH_EXTRACT_END__
// __PUBLISH_EXTRACT_START__ PropertyGrid.ExampleSettingsMenuItemRegisterImports
import { PropertyGridComponent } from "@itwin/property-grid-react";
// __PUBLISH_EXTRACT_END__
import { render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildIModel, insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory } from "../../utils/IModelUtils";
import { PropertyGridTestUtils } from "../../utils/PropertyGridTestUtils";

describe("Property grid", () => {
  describe("Learning snippets", () => {
    describe("Settings menu item", () => {
      const user = userEvent.setup();

      before(async function () {
        await initializePresentationTesting({
          backendProps: {
            caching: {
              hierarchies: {
                mode: HierarchyCacheMode.Memory,
              },
            },
          },
          testOutputDir: join(__dirname, "output"),
          backendHostProps: {
            cacheDir: join(__dirname, "cache"),
          },
          rpcs: [SnapshotIModelRpcInterface, IModelReadRpcInterface, PresentationRpcInterface, ECSchemaRpcInterface],
        });
        // eslint-disable-next-line @itwin/no-internal
        ECSchemaRpcImpl.register();
      });

      after(async function () {
        await terminatePresentationTesting();
      });

      beforeEach(async () => {
        await PropertyGridTestUtils.initialize();
      });

      afterEach(async () => {
        await PropertyGridTestUtils.terminate();
        sinon.restore();
        // eslint-disable-next-line @itwin/no-internal
        UiItemsManager.clearAllProviders();
      });

      it("Renders settings menu item", async function () {
        const imodel = (
          await buildIModel(this, async (builder) => {
            const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
            const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
            insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
            return { category };
          })
        ).imodel;
        sinon.stub(UiFramework, "getIModelConnection").returns(imodel);
        // __PUBLISH_EXTRACT_START__ PropertyGrid.ExampleSettingsMenuItem
        function ExampleSettingsMenuItem() {
          return (
            // render using `PropertyGridSettingsMenuItem` to get consistent style
            <PropertyGridSettingsMenuItem
              id="example"
              onClick={() => {
                console.log("Settings menu clicked!");
              }}
            >
              Click me!
            </PropertyGridSettingsMenuItem>
          );
        }
        // __PUBLISH_EXTRACT_END__

        // __PUBLISH_EXTRACT_START__ PropertyGrid.ExampleSettingsMenuItemRegister
        const MyPropertyGrid = () => {
          return <PropertyGridComponent settingsMenuItems={[() => <ExampleSettingsMenuItem />]}/>
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
