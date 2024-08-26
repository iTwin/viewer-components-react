import { join } from "path";
// __PUBLISH_EXTRACT_END__
import sinon from "sinon";
import { UiFramework } from "@itwin/appui-react";
import { BeEvent } from "@itwin/core-bentley";
import { IModelReadRpcInterface, SnapshotIModelRpcInterface } from "@itwin/core-common";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { PresentationRpcInterface } from "@itwin/presentation-common";
import { createClassBasedHierarchyDefinition, createNodesQueryClauseFactory } from "@itwin/presentation-hierarchies";
import { createBisInstanceLabelSelectClauseFactory } from "@itwin/presentation-shared";
import { HierarchyCacheMode, initialize as initializePresentationTesting, terminate as terminatePresentationTesting } from "@itwin/presentation-testing";
import { VisibilityTree, VisibilityTreeRenderer } from "@itwin/tree-widget-react";
import { createStorage } from "@itwin/unified-selection";
import { render, waitFor } from "@testing-library/react";
import { buildIModel, insertPhysicalElement, insertPhysicalModelWithPartition, insertSpatialCategory } from "../../utils/IModelUtils";
import { getSchemaContext, getTestViewer, TestUtils } from "../../utils/TestUtils";

import type { IModelConnection } from "@itwin/core-frontend";
import type { HierarchyNode } from "@itwin/presentation-hierarchies";
// __PUBLISH_EXTRACT_START__ Presentation.Tree-widget.Categories-tree-example-imports
import type { VisibilityStatus } from "@itwin/tree-widget-react";
import type { ComponentPropsWithoutRef } from "react";
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

        it("Custom tree snippet", async function () {
          const imodelConnection = (
            await buildIModel(this, async (builder) => {
              const physicalModel = insertPhysicalModelWithPartition({ builder, codeValue: "TestPhysicalModel" });
              const category = insertSpatialCategory({ builder, codeValue: "Test SpatialCategory" });
              insertPhysicalElement({ builder, modelId: physicalModel.id, categoryId: category.id });
              return { category };
            })
          ).imodel;
          const testViewport = getTestViewer(imodelConnection);
          const unifiedSelectionStorage = createStorage();
          sinon.stub(IModelApp.viewManager, "selectedView").get(() => testViewport);
          sinon.stub(UiFramework, "getIModelConnection").returns(imodelConnection);

          // __PUBLISH_EXTRACT_START__ Presentation.Tree-widget.Custom-tree-example
          type VisibilityTreeProps = ComponentPropsWithoutRef<typeof VisibilityTree>;
          const getHierarchyDefinition: VisibilityTreeProps["getHierarchyDefinition"] = ({ imodelAccess }) => {
            // create a hierarchy definition that defines what should be shown in the tree
            // see https://github.com/iTwin/presentation/blob/master/packages/hierarchies/README.md#hierarchy-definition
            const nodesQueryFactory = createNodesQueryClauseFactory({ imodelAccess });
            const labelsQueryFactory = createBisInstanceLabelSelectClauseFactory({ classHierarchyInspector: imodelAccess });
            return createClassBasedHierarchyDefinition({
              classHierarchyInspector: imodelAccess,
              hierarchy: {
                // For root nodes, select all BisCore.GeometricModel3d instances
                rootNodes: async () => [
                  {
                    fullClassName: "BisCore.GeometricModel3d",
                    query: {
                      ecsql: `
                      SELECT
                        ${await nodesQueryFactory.createSelectClause({
                          ecClassId: { selector: "this.ECClassId" },
                          ecInstanceId: { selector: "this.ECInstanceId" },
                          nodeLabel: {
                            selector: await labelsQueryFactory.createSelectClause({ classAlias: "this", className: "BisCore.GeometricModel3d" }),
                          },
                        })}
                      FROM BisCore.GeometricModel3d this
                    `,
                    },
                  },
                ],
                childNodes: [],
              },
            });
          };

          const visibilityHandlerFactory: VisibilityTreeProps["visibilityHandlerFactory"] = ({ imodelAccess }) => {
            return {
              // event that can be used to notify tree when visibility of instances represented by tree nodes changes from outside.
              onVisibilityChange: new BeEvent(),
              async getVisibilityStatus(_node: HierarchyNode): Promise<VisibilityStatus> {
                // TODO find where to put imodelAccess
                if (imodelAccess === undefined) return { state: "hidden" };
                return { state: "visible" };
                // determine visibility status of the instance represented by tree node.
              },
              async changeVisibility(_node: HierarchyNode, _on: boolean): Promise<void> {
                // change visibility of the instance represented by tree node.
              },
              dispose() {
                // if necessary, do some clean up before new visibility handler is created or component is unmounted.
              },
            };
          };

          interface MyVisibilityTreeProps {
            imodel: IModelConnection;
          }

          function MyVisibilityTree({ imodel }: MyVisibilityTreeProps) {
            return (
              <VisibilityTree
                treeName="MyVisibilityTree"
                imodel={imodel}
                selectionStorage={unifiedSelectionStorage}
                getSchemaContext={getSchemaContext}
                getHierarchyDefinition={getHierarchyDefinition}
                visibilityHandlerFactory={visibilityHandlerFactory}
                treeRenderer={(props) => <VisibilityTreeRenderer {...props} />}
              />
            );
          }
          // __PUBLISH_EXTRACT_END__

          const result = render(<MyVisibilityTree imodel={imodelConnection} />);
          await waitFor(() => result.getByText("TestPhysicalModel"));
        });
      });
    });
  });
});
