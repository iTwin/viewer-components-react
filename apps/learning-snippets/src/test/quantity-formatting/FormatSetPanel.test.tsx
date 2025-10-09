/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { render, screen } from "@testing-library/react";
// __PUBLISH_EXTRACT_START__ QuantityFormat.FormatSetPanelExampleImports
import { FormatSetPanel } from "@itwin/quantity-formatting-react";
import type { FormatSet } from "@itwin/ecschema-metadata";
// __PUBLISH_EXTRACT_END__
import { QuantityFormattingTestUtils } from "../../utils/QuantityFormattingTestUtils.js";

describe("Quantity formatting", () => {
  describe("Learning snippets", () => {
    describe("FormatSetPanel", () => {
      before(async function () {
        await QuantityFormattingTestUtils.initialize();
      });

      after(async function () {
        await QuantityFormattingTestUtils.terminate();
      });

      it("renders FormatSetPanel in editable mode", async function () {
        // __PUBLISH_EXTRACT_START__ QuantityFormat.FormatSetPanelEditableExample
        const formatSet: FormatSet = {
          name: "CustomSet",
          label: "Custom Format Set",
          unitSystem: "metric",
          description: "A custom format set",
          formats: {},
        } as FormatSet;

        const handleFormatSetChange = (_updatedFormatSet: FormatSet) => {
          // Handle format set change
        };

        render(
          <FormatSetPanel
            formatSet={formatSet}
            editable={true}
            onFormatSetChange={handleFormatSetChange}
          />,
        );
        // __PUBLISH_EXTRACT_END__

        expect(screen.getByText("labels.formatSetDetails")).to.exist;
      });

      it("renders FormatSetPanel in read-only mode", async function () {
        // __PUBLISH_EXTRACT_START__ QuantityFormat.FormatSetPanelReadOnlyExample
        const formatSet: FormatSet = {
          name: "ReadOnlySet",
          label: "Read-Only Format Set",
          unitSystem: "imperial",
          description: "A read-only format set",
          formats: {},
        } as FormatSet;

        render(
          <FormatSetPanel
            formatSet={formatSet}
            editable={false}
          />,
        );
        // __PUBLISH_EXTRACT_END__

        expect(screen.getByText("labels.formatSetDetails")).to.exist;
        const labelInput = screen.getByLabelText("labels.description");
        expect((labelInput as HTMLInputElement).disabled).to.be.true;
      });
    });
  });
});
