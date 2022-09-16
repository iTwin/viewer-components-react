/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, TestUtils, waitForElementToBeRemoved, within } from "../test/test-utils";
import { faker } from "@faker-js/faker";
import { Groupings } from "../grouping-mapping-widget";
import type { Group, Mapping } from "@itwin/insights-client";
import * as moq from "typemoq";
import type { IModelConnection, SelectionSet, SelectionSetEvent} from "@itwin/core-frontend";
import { NoRenderApp } from "@itwin/core-frontend";
import type { SelectionManager, SelectionScopesManager } from "@itwin/presentation-frontend";
import { Presentation, SelectionChangeEvent } from "@itwin/presentation-frontend";
import type { BeEvent } from "@itwin/core-bentley";
import { setupServer } from "msw/node";
import { rest } from "msw";
import { Constants, IModelState } from "@itwin/imodels-client-management";

const mockITwinId = faker.datatype.uuid();
const mockIModelId = faker.datatype.uuid();
const mockMappingId = faker.datatype.uuid();
const mockGroupId1 = faker.datatype.uuid();
const mockGroupId2 = faker.datatype.uuid();
const mockIModelsResponse = [
  {
    iModel: {
      id: mockIModelId,
      displayName: "rAnDoMdIsPlAynAmE1",
      name: "rAnDomName1",
      description: "rAnDoMDeScRiPtIoN1",
      createdDateTime: "2021-10-04T22:13:50.397Z",
      state: IModelState.Initialized,
      projectId: mockITwinId,
      extent: null,
      _links: {
        creator: {
          href: "",
        },
        namedVersions: {
          href: "",
        },
        changesets: {
          href: "",
        },
      },
    },
  },
];

const connectionMock = moq.Mock.ofType<IModelConnection>();
const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
const selectionScopesManagerMock = moq.Mock.ofType<SelectionScopesManager>();

jest.mock("@itwin/appui-react", () => ({
  ...jest.requireActual("@itwin/appui-react"),
  useActiveIModelConnection: () => connectionMock.object,
}));

const server = setupServer();

beforeAll(async () => {
  // This is required by the i18n module within iTwin.js
  (global as any).XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest; // eslint-disable-line @typescript-eslint/no-var-requires
  await NoRenderApp.startup();
  await Presentation.initialize();
  const selectionSet = moq.Mock.ofType<SelectionSet>();
  const onChanged = moq.Mock.ofType<BeEvent<(ev: SelectionSetEvent) => void>>();
  selectionSet.setup((x) => x.elements).returns(() => new Set([]));
  selectionSet.setup((x) => x.onChanged).returns(() => onChanged.object);
  connectionMock
    .setup((x) => x.selectionSet)
    .returns(() => selectionSet.object);
  connectionMock.setup((x) => x.iModelId).returns(() => mockIModelId);
  connectionMock.setup((x) => x.iTwinId).returns(() => mockITwinId);

  selectionManagerMock
    .setup((x) => x.selectionChange)
    .returns(() => new SelectionChangeEvent());

  selectionScopesManagerMock
    .setup(async (x) => x.getSelectionScopes(connectionMock.object))
    .returns(async () => []);
  selectionManagerMock
    .setup((x) => x.scopes)
    .returns(() => selectionScopesManagerMock.object);

  Presentation.setSelectionManager(selectionManagerMock.object);
  await TestUtils.initializeUiFramework(connectionMock.object);
  server.listen();
});

afterAll(() => {
  server.close();
});

afterEach(() => {
  server.resetHandlers();
});

const mockMapping: Mapping = {
  id: mockMappingId,
  mappingName: "mOcKmApPiNg1",
  description: "mOcKmApPiNgDeScRiPtIoN1",
  createdBy: faker.random.alpha(),
  createdOn: faker.date.past().toDateString(),
  modifiedBy: faker.random.alpha(),
  modifiedOn: faker.date.past().toDateString(),
  extractionEnabled:false,
  _links: {
    imodel: {
      href: "",
    },
  },
};

const mockGroups: Group[] = [
  {
    id: mockGroupId1,
    groupName: "mOcKgRoUp1",
    description: "mOcKgRoUpDeScRiPtIoN1",
    query: faker.datatype.string(),
  },
  {
    id: mockGroupId2,
    groupName: "mOcKgRoUp2",
    description: "mOcKgRoUpDeScRiPtIoN2",
    query: faker.datatype.string(),
  },
];

jest.mock("@itwin/appui-react", () => ({
  ...jest.requireActual("@itwin/appui-react"),
  useActiveIModelConnection: () => connectionMock.object,
}));

describe("Groupings View", () => {
  it("List all groups", async () => {
    // Arange
    server.use(
      rest.get(
        `https://api.bentley.com/insights/reporting/datasources/imodels/${mockIModelId}/mappings/${mockMappingId}/groups`,
        async (_req, res, ctx) => {
          return res(
            ctx.delay(),
            ctx.status(200),
            ctx.json(mockGroups)
          );
        }
      ),rest.get(
        `${Constants.api.baseUrl}/${mockIModelId}`,
        async (_req, res, ctx) => {
          return res(
            ctx.delay(),
            ctx.status(200),
            ctx.json(mockIModelsResponse[0])
          );
        }
      ),
    );

    // Act
    render(<Groupings mapping={mockMapping} goBack={jest.fn()} />);

    await waitForElementToBeRemoved(() => screen.getByText(/loading/i));
    // Assert
    const horizontalTiles = screen.getAllByTestId("horizontal-tile");
    expect(horizontalTiles).toHaveLength(mockGroups.length);

    for (const [index, horizontalTile] of horizontalTiles.entries()) {
      const groupTile = within(horizontalTile);
      expect(
        groupTile.getByText(
          mockGroups[index].groupName
        )
      ).toBeInTheDocument();
      expect(
        groupTile.getByTitle(
          mockGroups[index].description ?? ""
        )
      ).toBeInTheDocument();
    }
  });
});
