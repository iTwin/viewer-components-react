/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon from "sinon";
// __PUBLISH_EXTRACT_START__  TreeWidget.SelectionStorageInitializeExampleImports
import { Presentation } from "@itwin/presentation-frontend";
// __PUBLISH_EXTRACT_END__
// __PUBLISH_EXTRACT_START__  TreeWidget.SelectionStorageExampleImports
import { IModelConnection } from "@itwin/core-frontend";
import { createStorage } from "@itwin/unified-selection";
import type { SelectionStorage } from "@itwin/unified-selection";
// __PUBLISH_EXTRACT_END__

describe("Tree widget", () => {
  describe("Learning snippets", () => {
    describe("Components", () => {
      describe("Unified selection storage", () => {
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

        afterEach(async () => {
          sinon.restore();
          unifiedSelectionStorage = undefined;
        });

        it("creates unified storage", async function () {
          const result = getUnifiedSelectionStorage();
          expect(result).to.be.eq(unifiedSelectionStorage);
        });

        it("initializes presentation with unified storage", async function () {
          sinon.stub(Presentation, "initialize").resolves(undefined);

          // __PUBLISH_EXTRACT_START__ TreeWidget.SelectionStorageInitializeExample
          await Presentation.initialize({ selection: { selectionStorage: getUnifiedSelectionStorage() } });
          // __PUBLISH_EXTRACT_END__

          // note: ideally, we'd ensure that `Presentation.selection.selectionStorage` equals to what we set,
          // however, `selectionStorage` prop on `SelectionManager` is available only since 5.0, so there's
          // nothing we can use at this moment
        });
      });
    });
  });
});
