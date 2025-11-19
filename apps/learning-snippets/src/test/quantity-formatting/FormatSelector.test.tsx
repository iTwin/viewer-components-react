/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { render, screen } from "@testing-library/react";
// __PUBLISH_EXTRACT_START__ QuantityFormat.FormatSelectorExampleImports
import { FormatSelector } from "@itwin/quantity-formatting-react";
import type { FormatDefinition } from "@itwin/core-quantity";
import type { FormatSet } from "@itwin/ecschema-metadata";
// __PUBLISH_EXTRACT_END__
import { QuantityFormattingTestUtils } from "../../utils/QuantityFormattingTestUtils.js";

describe("Quantity formatting", () => {
  describe("Learning snippets", () => {
    describe("FormatSelector", () => {
      before(async function () {
        await QuantityFormattingTestUtils.initialize();
      });

      after(async function () {
        await QuantityFormattingTestUtils.terminate();
      });

      it("renders FormatSelector", async function () {
        // __PUBLISH_EXTRACT_START__ QuantityFormat.FormatSelectorExample
        const formatSet: FormatSet = {
          name: "TestSet",
          label: "Test Format Set",
          unitSystem: "metric",
          formats: {
            "test-format": {
              name: "test-format",
              label: "Test Format",
              type: "Decimal",
              precision: 2,
              composite: { units: [{ name: "Units.M", label: "m" }] },
            },
          },
        } as FormatSet;

        const handleFormatSelection = (_formatDef: FormatDefinition, _key: string) => {
          // Handle format selection
        };

        render(<FormatSelector activeFormatSet={formatSet} activeFormatDefinitionKey={undefined} onListItemChange={handleFormatSelection} />);
        // __PUBLISH_EXTRACT_END__

        expect(screen.getByPlaceholderText("labels.searchFormats")).to.exist;
      });
    });
  });
});
