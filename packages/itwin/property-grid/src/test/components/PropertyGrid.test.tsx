/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { beforeEach, describe, it, vi } from "vitest";
import { PropertyRecord, PropertyValueFormat } from "@itwin/appui-abstract";
import { PresentationPropertyDataProvider } from "@itwin/presentation-components";
import { createStorage } from "@itwin/unified-selection";
import { PropertyGrid } from "../../property-grid-react/components/PropertyGrid.js";
import { PropertyGridManager } from "../../property-grid-react/PropertyGridManager.js";
import { createPropertyRecord, render, stubFavoriteProperties, stubPresentation, waitFor } from "../TestUtils.js";

import type { IModelConnection } from "@itwin/core-frontend";

describe("<PropertyGrid />", () => {
  const imodelKey = "test-imodel";
  const imodel = { key: imodelKey } as IModelConnection;
  const selectionStorage = createStorage();

  beforeEach(() => {
    vi.spyOn(PropertyGridManager, "translate").mockImplementation((key) => key);

    stubPresentation();
    stubFavoriteProperties();

    vi.spyOn(PresentationPropertyDataProvider.prototype, "getData").mockImplementation(async () => {
      return {
        categories: [{ expand: true, label: "Test Category", name: "test-category" }],
        label: PropertyRecord.fromString("Test Instance"),
        records: {
          ["test-category"]: [
            createPropertyRecord(
              { valueFormat: PropertyValueFormat.Primitive, value: "Prop Value", displayValue: "Prop Value" },
              { name: "test-prop", displayLabel: "Test Prop" },
            ),
          ],
        },
      };
    });

    selectionStorage.clearStorage({ imodelKey });
  });

  it("renders content", async () => {
    const { getByText } = render(<PropertyGrid imodel={imodel} selectionStorage={selectionStorage} />);

    await waitFor(() => getByText("Test Prop"));
  });

  it("renders info message when too many elements selected", async () => {
    const keys = Array(500)
      .fill(0)
      .map((_, i) => ({ id: `0x${i}`, className: "TestClass" }));
    selectionStorage.addToSelection({ imodelKey, selectables: keys, level: 0, source: "test" });

    const { getByText } = render(<PropertyGrid imodel={imodel} selectionStorage={selectionStorage} />);

    await waitFor(() => getByText("selection.too-many-elements-selected"));
  });

  it("renders header controls when too many elements selected", async () => {
    const keys = Array(500)
      .fill(0)
      .map((_, i) => ({ id: `0x${i}`, className: "TestClass" }));
    selectionStorage.addToSelection({ imodelKey, selectables: keys, level: 0, source: "test" });

    const { getByText } = render(<PropertyGrid imodel={imodel} selectionStorage={selectionStorage} headerControls={[<div key={1}>TestControl</div>]} />);

    await waitFor(() => getByText("TestControl"));
  });
});
