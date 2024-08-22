import { IModelApp, IModelConnection } from "@itwin/core-frontend";
import { Presentation } from "@itwin/presentation-frontend";
import sinon from "sinon";

// __PUBLISH_EXTRACT_START__ Presentation.Tree-widget.Typical-example-imports
import type { SelectionStorage } from "@itwin/unified-selection";
import { createStorage } from "@itwin/unified-selection";

import { expect } from "chai";

// __PUBLISH_EXTRACT_END__
describe("Tree-widget", () => {
  describe("Learning-snippets", () => {
    describe("Components", () => {
      describe("Unified selection storage", () => {
        afterEach(async () => {
          Presentation.terminate();
          await IModelApp.shutdown();
        });
        it("Unified selection storage learning snippet", async function () {
          // __PUBLISH_EXTRACT_START__ Presentation.Tree-widget.Models-tree-example
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

        it.skip("Presentation initialize unified selection storage learning snippet", async function () {
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

          // __PUBLISH_EXTRACT_START__ Presentation.Tree-widget.Models-tree-example
          await Presentation.initialize({ selection: { selectionStorage: getUnifiedSelectionStorage() } });
          // __PUBLISH_EXTRACT_END__
          expect(spy.calledOnce);
        });
      });
    });
  });
});
