/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable no-console */
/* eslint-disable import/no-duplicates */
import { expect } from "chai";
import { join } from "path";
import sinon from "sinon";
import { UiFramework, UiItemsManager } from "@itwin/appui-react";
import { IModelReadRpcInterface, SnapshotIModelRpcInterface } from "@itwin/core-common";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting } from "@itwin/presentation-testing";
// __PUBLISH_EXTRACT_START__ PropertyGrid.ExampleContextMenuItemImports
import { PropertyGridContextMenuItem } from "@itwin/property-grid-react";
import type { ContextMenuItemProps } from "@itwin/property-grid-react";
// __PUBLISH_EXTRACT_START__ PropertyGrid.ExampleContextMenuItemRegisterImports
import { PropertyGridComponent } from "@itwin/property-grid-react";
// __PUBLISH_EXTRACT_END__
import { queryByText, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildIModel, insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory } from "../../utils/IModelUtils";
import { PropertyGridTestUtils } from "../../utils/PropertyGridTestUtils";

describe("Property grid", () => {
  describe("Learning snippets", () => {
    describe("Context menu item", () => {
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

      it("Renders context menu item", async function () {
        const imodel = await buildIModel(this, async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
          return { category };
        });
        sinon.stub(UiFramework, "getIModelConnection").returns(imodel.imodel);

        // __PUBLISH_EXTRACT_START__ PropertyGrid.ExampleContextMenuItem
        function ExampleContextMenuItem(props: ContextMenuItemProps) {
          return (
            // render using `PropertyGridContextMenuItem` to get consistent style
            <PropertyGridContextMenuItem
              id="example"
              title="example"
              onSelect={async () => {
                console.log(`Selected property: ${props.record.property.displayLabel}`);
              }}
            >
              Click me!
            </PropertyGridContextMenuItem>
          );
        }
        // __PUBLISH_EXTRACT_END__

        // __PUBLISH_EXTRACT_START__ PropertyGrid.ExampleContextMenuItemRegister
        const MyPropertyGrid = () => {
          return <PropertyGridComponent contextMenuItems={[(props) => <ExampleContextMenuItem {...props} />]}/>
        }
        // __PUBLISH_EXTRACT_END__
        Presentation.selection.addToSelection("", imodel.imodel, [imodel.category]);
        const { baseElement, getAllByText } = render(<MyPropertyGrid />);
        await waitFor(async () => {
          await user.pointer({ keys: "[MouseRight>]", target: getAllByText("Test SpatialCategory")[1] });
          expect(queryByText(baseElement, "Click me!")).to.not.be.null;
        });
      });
    });
  });
});
