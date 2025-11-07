/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { render, screen } from "@testing-library/react";
// __PUBLISH_EXTRACT_START__ QuantityFormat.FormatSetSelectorExampleImports
import { FormatSetSelector } from "@itwin/quantity-formatting-react";
import type { FormatSet } from "@itwin/ecschema-metadata";
// __PUBLISH_EXTRACT_END__
import { QuantityFormattingTestUtils } from "../../utils/QuantityFormattingTestUtils.js";

describe("Quantity formatting", () => {
  describe("Learning snippets", () => {
    describe("FormatSetSelector", () => {
      before(async function () {
        await QuantityFormattingTestUtils.initialize();
      });

      after(async function () {
        await QuantityFormattingTestUtils.terminate();
      });

      it("renders FormatSetSelector", async function () {
        // __PUBLISH_EXTRACT_START__ QuantityFormat.FormatSetSelectorExample
        const formatSets: FormatSet[] = [
          {
            name: "MetricSet",
            label: "Metric Formats",
            unitSystem: "metric",
            description: "Standard metric unit formats",
            formats: {},
          } as FormatSet,
          {
            name: "ImperialSet",
            label: "Imperial Formats",
            unitSystem: "imperial",
            description: "Imperial unit formats",
            formats: {},
          } as FormatSet,
        ];

        const handleFormatSetChange = (_formatSet: FormatSet, _key: string) => {
          // Handle format set change
        };

        render(
          <FormatSetSelector
            formatSets={formatSets}
            selectedFormatSetKey="MetricSet"
            activeFormatSetKey="ImperialSet"
            onFormatSetChange={handleFormatSetChange}
          />,
        );
        // __PUBLISH_EXTRACT_END__

        expect(screen.getByPlaceholderText("labels.searchFormatSets")).to.exist;
      });
    });
  });
});
