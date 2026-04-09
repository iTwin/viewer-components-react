/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable import/no-duplicates */
/* eslint-disable @typescript-eslint/no-deprecated */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UiFramework } from "@itwin/appui-react";
import { Presentation } from "@itwin/presentation-frontend";
// __PUBLISH_EXTRACT_START__ PropertyGrid.ComponentWithTelemetryImports
import { PropertyGridComponent } from "@itwin/property-grid-react";
// __PUBLISH_EXTRACT_END__
// __PUBLISH_EXTRACT_START__ PropertyGrid.ComponentWithTelemetryWrapperImports
import { PropertyGrid, TelemetryContextProvider } from "@itwin/property-grid-react";
// __PUBLISH_EXTRACT_END__
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { buildIModel, insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory } from "../../utils/IModelUtils.js";
import { initializeLearningSnippetsTests, terminateLearningSnippetsTests } from "../../utils/InitializationUtils.js";
import { PropertyGridTestUtils } from "../../utils/PropertyGridTestUtils.js";

describe("Property grid", () => {
  describe("Learning snippets", () => {
    describe("Telemetry", () => {
      beforeEach(async () => {
        await initializeLearningSnippetsTests();
        await PropertyGridTestUtils.initialize();
      });

      afterEach(async () => {
        await terminateLearningSnippetsTests();
        await PropertyGridTestUtils.terminate();
      });

      it("renders component with feature usage and performance tracking", async () => {
        const { imodel, ...keys } = await buildIModel(async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
          return { category };
        });
        vi.spyOn(UiFramework, "getIModelConnection").mockReturnValue(imodel);
        const logPerformance = vi.fn();
        const logUsage = vi.fn();

        // __PUBLISH_EXTRACT_START__ PropertyGrid.ComponentWithTelemetry
        function MyPropertyGrid() {
          return (
            <PropertyGridComponent
              onPerformanceMeasured={(feature, elapsedTime) => {
                // user-defined function to handle performance logging.
                logPerformance(feature, elapsedTime);
              }}
              onFeatureUsed={(feature) => {
                // user-defined function to handle usage logging.
                logUsage(feature);
              }}
            />
          );
        }
        // __PUBLISH_EXTRACT_END__

        using _ = { [Symbol.dispose]: cleanup };
        render(<MyPropertyGrid />);
        act(() => {
          Presentation.selection.addToSelection("", imodel, [keys.category]);
        });
        await waitFor(() => {
          expect(logUsage).toHaveBeenCalledTimes(3);
          expect(logUsage).toHaveBeenCalledWith("hide-empty-values-disabled");
          expect(logUsage).toHaveBeenCalledWith("single-element");
          expect(logPerformance).toHaveBeenCalledExactlyOnceWith("properties-load", expect.any(Number));
        });
      });

      it("renders property grid with telemetry context", async () => {
        const { imodel, ...keys } = await buildIModel(async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
          return { category };
        });
        vi.spyOn(UiFramework, "getIModelConnection").mockReturnValue(imodel);
        const logPerformance = vi.fn();
        const logUsage = vi.fn();

        // __PUBLISH_EXTRACT_START__ PropertyGrid.ComponentWithTelemetryWrapper
        function ExampleComponent() {
          return (
            <TelemetryContextProvider
              onPerformanceMeasured={(feature, elapsedTime) => {
                // user-defined function to handle performance logging.
                logPerformance(feature, elapsedTime);
              }}
              onFeatureUsed={(feature) => {
                // user-defined function to handle usage logging.
                logUsage(feature);
              }}
            >
              <PropertyGrid imodel={imodel} />
            </TelemetryContextProvider>
          );
        }
        // __PUBLISH_EXTRACT_END__

        Presentation.selection.addToSelection("", imodel, [keys.category]);

        using _ = { [Symbol.dispose]: cleanup };
        const user = userEvent.setup();
        const { getByRole, getByText, queryByText } = render(<ExampleComponent />);

        // trigger a feature
        const button = await waitFor(() => getByText("search-bar.open"));
        await user.click(button);
        await user.type(getByRole("searchbox"), "Test SpatialCategory");

        await waitFor(async () => {
          expect(logUsage).toHaveBeenCalledExactlyOnceWith("filter-properties");
          expect(logPerformance).toHaveBeenCalledExactlyOnceWith("properties-load", expect.any(Number));
          expect(queryByText("User Label")).toBeNull(); // all properties except Code should be filtered-out
        });
      });
    });
  });
});
