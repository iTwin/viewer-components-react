/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable unused-imports/no-unused-vars */
/* eslint-disable import/no-duplicates */
/* eslint-disable @typescript-eslint/no-deprecated */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { UiFramework } from "@itwin/appui-react";
import { Presentation } from "@itwin/presentation-frontend";
// __PUBLISH_EXTRACT_START__ PropertyGrid.ExampleContextMenuItemImports
import { PropertyGridContextMenuItem } from "@itwin/property-grid-react";
import type { ContextMenuItemProps } from "@itwin/property-grid-react";
// __PUBLISH_EXTRACT_END__
// __PUBLISH_EXTRACT_START__ PropertyGrid.PropertyGridWithContextMenuItemImports
import { PropertyGridComponent } from "@itwin/property-grid-react";
// __PUBLISH_EXTRACT_END__
import { cleanup, queryByText, render, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { buildIModel, insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory } from "../../utils/IModelUtils.js";
import { initializeLearningSnippetsTests, terminateLearningSnippetsTests } from "../../utils/InitializationUtils.js";
import { PropertyGridTestUtils } from "../../utils/PropertyGridTestUtils.js";

describe("Property grid", () => {
  describe("Learning snippets", () => {
    describe("Context menu item", () => {
      beforeAll(async () => {
        await initializeLearningSnippetsTests();
        await PropertyGridTestUtils.initialize();
      });

      afterAll(async () => {
        await terminateLearningSnippetsTests();
        await PropertyGridTestUtils.terminate();
      });

      it("renders context menu item", async () => {
        const imodel = await buildIModel(async (builder) => {
          const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
          const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
          insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
          return { category };
        });
        const user = userEvent.setup();
        vi.spyOn(UiFramework, "getIModelConnection").mockReturnValue(imodel.imodel);

        // __PUBLISH_EXTRACT_START__ PropertyGrid.ExampleContextMenuItem
        function ExampleContextMenuItem(props: ContextMenuItemProps) {
          return (
            // render using `PropertyGridContextMenuItem` to get consistent style
            <PropertyGridContextMenuItem
              id="example"
              title="example"
              onSelect={async () => {
                // access selected property using `props.record.property`
              }}
            >
              Click me!
            </PropertyGridContextMenuItem>
          );
        }
        // __PUBLISH_EXTRACT_END__

        // __PUBLISH_EXTRACT_START__ PropertyGrid.PropertyGridWithContextMenuItem
        function MyPropertyGrid() {
          return <PropertyGridComponent contextMenuItems={[(props) => <ExampleContextMenuItem {...props} />]} />;
        }
        // __PUBLISH_EXTRACT_END__

        Presentation.selection.addToSelection("", imodel.imodel, [imodel.category]);

        using _ = { [Symbol.dispose]: cleanup };
        const { baseElement, getAllByText } = render(<MyPropertyGrid />);

        // Wait for property grid to render with the category text and get the elements
        const categoryElements = await waitFor(() => {
          const elements = getAllByText("Test SpatialCategory");
          expect(elements.length).toBeGreaterThan(1);
          return elements;
        });

        // Right-click on the second occurrence (the property value)
        await user.pointer({ keys: "[MouseRight>]", target: categoryElements[1] });

        // Wait for context menu to appear
        await waitFor(() => {
          expect(queryByText(baseElement, "Click me!")).not.toBeNull();
        });
      });
    });
  });
});
