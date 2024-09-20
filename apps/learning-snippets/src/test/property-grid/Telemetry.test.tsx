/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable import/no-duplicates */
/* eslint-disable no-console */
import { expect } from "chai";
import { join } from "path";
import sinon from "sinon";
import { UiFramework } from "@itwin/appui-react";
import { IModelReadRpcInterface, SnapshotIModelRpcInterface } from "@itwin/core-common";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting } from "@itwin/presentation-testing";
// __PUBLISH_EXTRACT_START__ PropertyGrid.ComponentWithTelemetryImports
import { PropertyGridComponent } from "@itwin/property-grid-react";
// __PUBLISH_EXTRACT_END__
// __PUBLISH_EXTRACT_START__ PropertyGrid.ComponentWithTelemetryWrapperImports
import {  PropertyGrid, TelemetryContextProvider } from "@itwin/property-grid-react";
// __PUBLISH_EXTRACT_END__
import { cleanup, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildIModel, insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory } from "../../utils/IModelUtils";
import { PropertyGridTestUtils } from "../../utils/PropertyGridTestUtils";
import { Presentation } from "@itwin/presentation-frontend";

describe("Property grid", () => {
  describe("Learning snippets", () => {
    describe("Telemetry", () => {
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
      });

      it("Renders component with feature usage and performance tracking", async function () {
        const imodel = (
          await buildIModel(this, async (builder) => {
            const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
            const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
            insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
            return { category };
          })
        );
        sinon.stub(UiFramework, "getIModelConnection").returns(imodel.imodel);
        const onPerformanceMeasured = sinon.spy();
        const onFeatureUsed = sinon.spy();
        // __PUBLISH_EXTRACT_START__ PropertyGrid.ComponentWithTelemetry
        const MyPropertyGrid = () => {
          return (
            <PropertyGridComponent
              onPerformanceMeasured={(feature, elapsedTime) => {
                onPerformanceMeasured(feature, elapsedTime)
              }}
              onFeatureUsed={(feature) => {
                onFeatureUsed(feature);
              }}
            />
          );
        };
        // __PUBLISH_EXTRACT_END__
        render(<MyPropertyGrid />);
        Presentation.selection.addToSelection("", imodel.imodel, [imodel.category]);
        await waitFor(() => {
          expect(onFeatureUsed).to.be.calledTwice;
          expect(onPerformanceMeasured).to.be.calledOnce;
        });
        Presentation.selection.clearSelection("", imodel.imodel);
        cleanup();
      });

      it("Renders property grid with telemetry context", async function () {
        const imodel = (
          await buildIModel(this, async (builder) => {
            const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
            const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
            insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
            return { category };
          })
        );
        const imodelConnection = imodel.imodel;
        sinon.stub(UiFramework, "getIModelConnection").returns(imodelConnection);
        const onPerformanceMeasured = sinon.spy();
        const onFeatureUsed = sinon.spy();
        // __PUBLISH_EXTRACT_START__ PropertyGrid.ComponentWithTelemetryWrapper
        function ExampleContextMenuItem() {
          return (
            <TelemetryContextProvider
              onPerformanceMeasured={(feature, elapsedTime) => {
                onPerformanceMeasured(feature, elapsedTime)
              }}
              onFeatureUsed={(feature) => {
                onFeatureUsed(feature);
              }}
            >
              <PropertyGrid imodel={imodelConnection} />
            </TelemetryContextProvider>
          );
        }
        // __PUBLISH_EXTRACT_END__
        const user = userEvent.setup();
        const { queryByText, getByRole } = render(<ExampleContextMenuItem />);
        Presentation.selection.addToSelection("", imodel.imodel, [imodel.category]);
        await waitFor(async () => {
          expect(onPerformanceMeasured).to.be.calledOnce;
          // trigger a feature
          const button = queryByText("search-bar.open");
          expect(button).to.not.be.undefined;
          await user.click(button!);
          await user.type(getByRole("searchbox"), "A");
          // telemetry logs
          expect(onFeatureUsed).to.be.calledOnce;
        });
        Presentation.selection.clearSelection("", imodel.imodel);
        cleanup();
      });
    });
  });
});
