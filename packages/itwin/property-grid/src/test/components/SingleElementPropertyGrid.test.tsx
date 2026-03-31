/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { beforeEach, describe, it, vi } from "vitest";
import { PropertyRecord, PropertyValueFormat } from "@itwin/appui-abstract";
import { PresentationPropertyDataProvider } from "@itwin/presentation-components";
import { SingleElementPropertyGrid } from "../../property-grid-react/components/SingleElementPropertyGrid.js";
import { PropertyGridManager } from "../../property-grid-react/PropertyGridManager.js";
import { createPropertyRecord, render, stubFavoriteProperties, stubPresentation, waitFor } from "../TestUtils.js";

import type { IModelConnection } from "@itwin/core-frontend";
import type { InstanceKey } from "@itwin/presentation-common";

describe("<SingleElementPropertyGrid />", () => {
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
  });

  it("renders", async () => {
    const imodel = {} as IModelConnection;
    const instanceKey: InstanceKey = { id: "0x10", className: "TestClass" };

    const { getByText } = render(<SingleElementPropertyGrid imodel={imodel} instanceKey={instanceKey} />);

    await waitFor(() => getByText("Test Prop"));
  });
});
