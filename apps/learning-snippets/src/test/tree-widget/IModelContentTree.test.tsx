import { IModel, IModelReadRpcInterface, SnapshotIModelRpcInterface } from "@itwin/core-common";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import type { InstanceKey } from "@itwin/presentation-common";
import { PresentationRpcInterface } from "@itwin/presentation-common";
// __PUBLISH_EXTRACT_START__ Presentation.Tree-widget.Categories-tree-example-imports
import { IModelContentTreeComponent } from "@itwin/tree-widget-react";
// __PUBLISH_EXTRACT_END__
import sinon from "sinon";
import { getSchemaContext, getTestViewer, TestUtils } from "../../utils/TestUtils";
import { HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting } from "@itwin/presentation-testing";
import { join } from "path";
import { UiFramework } from "@itwin/appui-react";
import { createStorage } from "@itwin/unified-selection";
import { buildIModel, insertSubject } from "../../utils/IModelUtils";
import { render, waitFor } from "@testing-library/react";
import { expect } from "chai";
import React from "react";

describe("Tree-widget", () => {
  describe("Learning-snippets", () => {
    describe("Components", () => {
      describe("Imodel content tree", () => {
        before(async function () {
          await initializePresentationTesting({
            backendProps: {
              caching: {
                hierarchies: {
                  mode: HierarchyCacheMode.Memory,
                },
              },
            },
            testOutputDir: join(__dirname, "output"),
            backendHostProps: {
              cacheDir: join(__dirname, "cache"),
            },
            rpcs: [SnapshotIModelRpcInterface, IModelReadRpcInterface, PresentationRpcInterface, ECSchemaRpcInterface],
          });
          // eslint-disable-next-line @itwin/no-internal
          ECSchemaRpcImpl.register();
        });

        after(async function () {
          await terminatePresentationTesting();
        });

        beforeEach(async () => {
          await NoRenderApp.startup();
          await TestUtils.initialize();
        });

        afterEach(async () => {
          TestUtils.terminate();
          await IModelApp.shutdown();
          sinon.restore();
        });

        it("Imodel content tree snippet", async function () {
          const rootSubject: InstanceKey = { className: "BisCore.Subject", id: IModel.rootSubjectId };
          const dictionaryModel: InstanceKey = { className: "BisCore.DictionaryModel", id: IModel.dictionaryId };

          const imodel = (
            await buildIModel(this, async (builder) => {
              const subjectA = insertSubject({ builder, codeValue: "A", parentId: IModel.rootSubjectId });
              const subjectB = insertSubject({ builder, codeValue: "B", parentId: IModel.rootSubjectId });
              const subjectC = insertSubject({ builder, codeValue: "C", parentId: subjectB.id });
              return { rootSubject, dictionaryModel, subjectA, subjectB, subjectC };
            })
          ).imodel;
          const testViewport = getTestViewer(imodel);
          const unifiedSelectionStorage = createStorage();
          sinon.stub(IModelApp.viewManager, "selectedView").get(() => testViewport);
          sinon.stub(UiFramework, "getIModelConnection").returns(imodel);

          // __PUBLISH_EXTRACT_START__ Presentation.Tree-widget.Categories-tree-example
          function MyWidget() {
            return (
              <IModelContentTreeComponent
                // see "Creating schema context" section for example implementation
                getSchemaContext={getSchemaContext}
                // see "Creating unified selection storage" section for example implementation
                selectionStorage={unifiedSelectionStorage}
              />
            );
          }
          // __PUBLISH_EXTRACT_END__

          const result = render(<MyWidget />);
          await waitFor(
            () => expect(result.getByText("tree-widget-learning-snippets-components-imodel-content-tree-imodel-content-tree-snippet")).to.not.be.null,
          );
        });
      });

      // it.skip("Custom imodel content tree snippet", async function () {
      //   const rootSubject: InstanceKey = { className: "BisCore.Subject", id: IModel.rootSubjectId };
      //   const dictionaryModel: InstanceKey = { className: "BisCore.DictionaryModel", id: IModel.dictionaryId };

      //   const imodelConnection = (
      //     await buildIModel(this, async (builder) => {
      //       const subjectA = insertSubject({ builder, codeValue: "A", parentId: IModel.rootSubjectId });
      //       const subjectB = insertSubject({ builder, codeValue: "B", parentId: IModel.rootSubjectId });
      //       const subjectC = insertSubject({ builder, codeValue: "C", parentId: subjectB.id });
      //       return { rootSubject, dictionaryModel, subjectA, subjectB, subjectC };
      //     })
      //   ).imodel;
      //   const testViewport = getTestViewer(imodelConnection);
      //   const unifiedSelectionStorage = createStorage();
      //   sinon.stub(IModelApp.viewManager, "selectedView").get(() => testViewport);
      //   sinon.stub(UiFramework, "getIModelConnection").returns(imodelConnection);

      //   // __PUBLISH_EXTRACT_START__ Presentation.Tree-widget.Categories-tree-example
      //   type TreeProps = ComponentPropsWithoutRef<typeof Tree>;
      //   const getHierarchyDefinition: TreeProps["getHierarchyDefinition"] = ({ imodelAccess }) => {
      //     // create a hierarchy definition that defines what should be shown in the tree
      //     // see https://github.com/iTwin/presentation/blob/master/packages/hierarchies/README.md#hierarchy-definition
      //     return imodelAccess;
      //   };

      //   interface MyTreeProps {
      //     imodel: IModelConnection;
      //   }

      //   function MyTree({ imodel }: MyTreeProps) {
      //     return (
      //       <Tree
      //         treeName="MyTree"
      //         imodel={imodel}
      //         selectionStorage={unifiedSelectionStorage}
      //         getSchemaContext={getSchemaContext}
      //         getHierarchyDefinition={getHierarchyDefinition}
      //         treeRenderer={(props) => <TreeRenderer {...props} />}
      //       />
      //     );
      //   }
      //   // __PUBLISH_EXTRACT_END__

      //   const result = render(MyTree({ imodel: imodelConnection }));
      //   await waitFor(() => expect(result.getByText("Test SpatialCategory")).to.not.be.null, { timeout: 5000 });
      // });
    });
  });
});
