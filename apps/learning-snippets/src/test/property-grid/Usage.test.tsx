/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable import/no-duplicates */

import { expect } from "chai";
import sinon from "sinon";
import { StagePanelLocation, StagePanelSection, StageUsage } from "@itwin/appui-react";
import { PresentationPropertyDataProvider } from "@itwin/presentation-components";
// __PUBLISH_EXTRACT_START__ PropertyGrid.RegisterPropertyGridWidgetImports
import { createPropertyGrid } from "@itwin/property-grid-react";
import { UiItemsManager } from "@itwin/appui-react";
// __PUBLISH_EXTRACT_END__
// __PUBLISH_EXTRACT_START__ PropertyGrid.RegisterCustomPropertyGridWidgetImports
import {
  AddFavoritePropertyContextMenuItem,
  AncestorsNavigationControls,
  CopyPropertyTextContextMenuItem,
  IModelAppUserPreferencesStorage,
  RemoveFavoritePropertyContextMenuItem,
  ShowHideNullValuesSettingsMenuItem,
} from "@itwin/property-grid-react";
import type { IModelConnection } from "@itwin/core-frontend";
// __PUBLISH_EXTRACT_END__
import { PropertyGridTestUtils } from "../../utils/PropertyGridTestUtils.js";

describe("Property grid", () => {
  describe("Learning snippets", () => {
    describe("Usage", () => {
      beforeEach(async () => {
        await PropertyGridTestUtils.initialize();
      });

      afterEach(async () => {
        await PropertyGridTestUtils.terminate();
        sinon.restore();
        // eslint-disable-next-line @itwin/no-internal
        UiItemsManager.clearAllProviders();
      });

      it("registers property grid", async function () {
        // __PUBLISH_EXTRACT_START__ PropertyGrid.RegisterPropertyGridWidget
        UiItemsManager.register({ id: "property-grid-provider", getWidgets: () => [createPropertyGrid({})] });
        // __PUBLISH_EXTRACT_END__

        expect(UiItemsManager.getWidgets("", StageUsage.General, StagePanelLocation.Right, StagePanelSection.End)).to.not.be.empty;
      });

      it("registers customizable property grid", async function () {
        const MY_CUSTOM_RULESET = undefined;

        // __PUBLISH_EXTRACT_START__ PropertyGrid.RegisterCustomPropertyGridWidget
        UiItemsManager.register({
          id: "property-grid-provider",
          getWidgets: () => [
            createPropertyGrid(
              // supplies props for the `PropertyGridComponent`
              {
                // enable auto-expanding all property categories
                autoExpandChildCategories: true,

                // enable ancestor navigation by supplying a component for that
                ancestorsNavigationControls: (props) => <AncestorsNavigationControls {...props} />,

                // the list populates the context menu shown when a property is right-clicked.
                contextMenuItems: [
                  // allows adding properties to favorites list
                  (props) => <AddFavoritePropertyContextMenuItem {...props} />,
                  // allows removing properties from favorites list
                  (props) => <RemoveFavoritePropertyContextMenuItem {...props} />,
                  // allows copying property values
                  (props) => <CopyPropertyTextContextMenuItem {...props} />,
                ],

                // the list populates the settings menu
                settingsMenuItems: [
                  // allows hiding properties without values
                  (props) => <ShowHideNullValuesSettingsMenuItem {...props} persist={true} />,
                ],

                // supply an optional custom storage for user preferences, e.g. the show/hide null values used above
                preferencesStorage: new IModelAppUserPreferencesStorage("my-favorites-namespace"),

                // supply an optional data provider factory method to create a custom property data provider
                createDataProvider: (imodel: IModelConnection) => new PresentationPropertyDataProvider({ imodel, ruleset: MY_CUSTOM_RULESET }),

                // ... and a number of props of `VirtualizedPropertyGridWithDataProvider` from `@itwin/components-react` is also accepted here
              },
            ),
          ],
        });
        // __PUBLISH_EXTRACT_END__

        expect(UiItemsManager.getWidgets("", StageUsage.General, StagePanelLocation.Right, StagePanelSection.End)).to.not.be.empty;
      });
    });
  });
});
