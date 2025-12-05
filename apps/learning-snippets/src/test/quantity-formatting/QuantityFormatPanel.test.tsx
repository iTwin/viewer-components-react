/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { render, screen } from "@testing-library/react";
// __PUBLISH_EXTRACT_START__ QuantityFormat.QuantityFormatPanelExampleImports
import { QuantityFormatPanel } from "@itwin/quantity-formatting-react";
import { IModelApp } from "@itwin/core-frontend";
import type { FormatDefinition } from "@itwin/core-quantity";
// __PUBLISH_EXTRACT_END__
// __PUBLISH_EXTRACT_START__ QuantityFormat.TelemetryExampleImports
import { TelemetryContextProvider } from "@itwin/quantity-formatting-react";
// __PUBLISH_EXTRACT_END__
import { QuantityFormattingTestUtils } from "../../utils/QuantityFormattingTestUtils.js";

describe("Quantity formatting", () => {
  describe("Learning snippets", () => {
    describe("QuantityFormatPanel", () => {
      before(async function () {
        await QuantityFormattingTestUtils.initialize();
      });

      after(async function () {
        await QuantityFormattingTestUtils.terminate();
      });

      it("renders QuantityFormatPanel", async function () {
        // __PUBLISH_EXTRACT_START__ QuantityFormat.QuantityFormatPanelExample
        const formatDefinition: FormatDefinition = {
          precision: 4,
          type: "Decimal",
          composite: {
            units: [{ name: "Units.M", label: "m" }],
          },
        };

        const handleFormatChange = (_newFormat: FormatDefinition) => {
          // Handle format change
        };

        render(
          <QuantityFormatPanel
            formatDefinition={formatDefinition}
            unitsProvider={IModelApp.quantityFormatter.unitsProvider}
            onFormatChange={handleFormatChange}
            initialMagnitude={123.456}
          />,
        );
        // __PUBLISH_EXTRACT_END__

        expect(screen.getByText("labels.type")).to.exist;
      });
    });

    describe("Telemetry", () => {
      before(async function () {
        await QuantityFormattingTestUtils.initialize();
      });

      after(async function () {
        await QuantityFormattingTestUtils.terminate();
      });

      it("renders with telemetry tracking", async function () {
        // __PUBLISH_EXTRACT_START__ QuantityFormat.TelemetryExample
        const formatDefinition: FormatDefinition = {
          precision: 4,
          type: "Decimal",
          composite: {
            units: [{ name: "Units.M", label: "m" }],
          },
        };

        const handleFormatChange = (_newFormat: FormatDefinition) => {
          // Handle format change
        };

        const handleFeatureUsed = (featureId: string) => {
          // Send to your analytics service
          console.log(`Feature used: ${featureId}`);
        };

        render(
          <TelemetryContextProvider onFeatureUsed={handleFeatureUsed}>
            <QuantityFormatPanel
              formatDefinition={formatDefinition}
              unitsProvider={IModelApp.quantityFormatter.unitsProvider}
              onFormatChange={handleFormatChange}
            />
          </TelemetryContextProvider>,
        );
        // __PUBLISH_EXTRACT_END__

        expect(screen.getByText("labels.type")).to.exist;
      });
    });
  });
});
