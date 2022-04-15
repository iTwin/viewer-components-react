/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { IModelConnection } from "@itwin/core-frontend";
import { Range3d } from "@itwin/core-geometry";
import { expect } from "chai";
import * as Moq from "typemoq";
import { DataLink } from "../../Views/visibility/DataLink";

const range3DProps = {
  minX: 1,
  minY: 2,
  minZ: 3,
  maxX: 4,
  maxY: 5,
  maxZ: 6,
};

async function* queryResultGenerator() {
  yield range3DProps;
}

describe("DataLink", () => {
  const connectionMock = Moq.Mock.ofType<IModelConnection>();

  before(() => {
    connectionMock.setup((x) => x.query(Moq.It.isAny(), undefined, { rowFormat: 0 })).returns(queryResultGenerator);
  });

  it("should return correct data for queryStoryRange", async () => {
    const result = await DataLink.queryStoryRange(connectionMock.object, "testId", true);

    expect(result).to.eql(new Range3d(range3DProps.minX, range3DProps.minY, range3DProps.minZ, range3DProps.maxX, range3DProps.maxY, range3DProps.maxZ));
  });
});
