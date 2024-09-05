/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/* eslint-disable import/no-duplicates */
import { expect } from "chai";
import sinon from "sinon";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
// __PUBLISH_EXTRACT_START__  TreeWidget.SelectionStorageInitializeExampleImports
import { Presentation } from "@itwin/presentation-frontend";
// __PUBLISH_EXTRACT_END__
import { TestUtils } from "../../utils/TestUtils";
// __PUBLISH_EXTRACT_START__  TreeWidget.SelectionStorageExampleImports
import { IModelConnection } from "@itwin/core-frontend";
import { createStorage } from "@itwin/unified-selection";
import type { SelectionStorage } from "@itwin/unified-selection";
// __PUBLISH_EXTRACT_END__

describe("Tree widget", () => {
  describe("Learning snippets", () => {
    describe("Components", () => {
      describe("Unified selection storage", () => {
        beforeEach(async () => {
          await NoRenderApp.startup();
          await TestUtils.initialize();
        });

        afterEach(async () => {
          TestUtils.terminate();
          await IModelApp.shutdown();
          sinon.restore();
        });
        
        it("Creates unified storage", async function () {
          // __PUBLISH_EXTRACT_START__ TreeWidget.SelectionStorageExample
          let unifiedSelectionStorage: SelectionStorage | undefined;
          function getUnifiedSelectionStorage(): SelectionStorage {
            if (!unifiedSelectionStorage) {
              unifiedSelectionStorage = createStorage();
              IModelConnection.onClose.addListener((imodel) => {
                unifiedSelectionStorage!.clearStorage({ imodelKey: imodel.key });
              });
            }
            return unifiedSelectionStorage;
          }
          // __PUBLISH_EXTRACT_END__
          const result = getUnifiedSelectionStorage();
          expect(result).to.be.eq(unifiedSelectionStorage);
        });

        it("Initializes presentation with unified storage", async function () {
          const spy = sinon.spy(Presentation, "initialize");
          let unifiedSelectionStorage: SelectionStorage | undefined;
          await IModelApp.startup();
          function getUnifiedSelectionStorage(): SelectionStorage {
            if (!unifiedSelectionStorage) {
              unifiedSelectionStorage = createStorage();
              IModelConnection.onClose.addListener((imodel) => {
                unifiedSelectionStorage!.clearStorage({ imodelKey: imodel.key });
              });
            }
            return unifiedSelectionStorage;
          }

          // __PUBLISH_EXTRACT_START__ TreeWidget.SelectionStorageInitializeExample
          await Presentation.initialize({ selection: { selectionStorage: getUnifiedSelectionStorage() } });
          // __PUBLISH_EXTRACT_END__
          
          expect(spy.calledOnce);
          Presentation.terminate();
        });
      });
    });
  });
});
