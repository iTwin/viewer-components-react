/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelConnection } from "@itwin/core-frontend";
import { Range3d } from "@itwin/core-geometry";
import { expect } from "chai";
import type { SinonStub } from "sinon";
import sinon from "sinon";
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
  const defaultStoryId: string = "testId";
  const defaultClipAtSpaces: boolean = true;
  const compositeComposesClass = "spatialcomposition.CompositeComposesSubComposites";
  const compositeOverlapsClass = "spatialcomposition.CompositeOverlapsSpatialElements";
  const defaultRowFormat = { rowFormat: 0 };
  let queryStub: SinonStub;

  const constructQuery = (queryClass: string, storyIdParam: string) => {
    return `select MIN(spel.minX) as minX, MIN(spel.minY) as minY, MIN(spel.minZ) as minZ, MAX(spel.maxX) as maxX, MAX(spel.maxY) as maxY, MAX(spel.maxZ) as maxZ
        from ${queryClass} ovr join biscore.spatialIndex spel on spel.ECinstanceId = ovr.targetecinstanceid
        where sourceECInstanceId in
        (select sp.ecinstanceid from buildingspatial.story s join buildingspatial.space sp on s.ecinstanceid=sp.composingelement.id where s.ecinstanceid=${storyIdParam}
        union
        select s.ecinstanceid from buildingspatial.story s where s.ecinstanceid=${storyIdParam})`;
  };

  before(() => {
    queryStub = sinon.stub(IModelConnection.prototype, "query");

    connectionMock.setup((x) => x.query(Moq.It.isAny(), undefined, defaultRowFormat))
      .callback(queryStub)
      .returns(queryResultGenerator);
  });

  after(() => {
    queryStub.restore();
    connectionMock.reset();
  });

  it("should return correct data for queryStoryRange", async () => {
    const result = await DataLink.queryStoryRange(connectionMock.object, defaultStoryId, defaultClipAtSpaces);

    expect(result).to.eql(new Range3d(range3DProps.minX, range3DProps.minY, range3DProps.minZ, range3DProps.maxX, range3DProps.maxY, range3DProps.maxZ));
  });

  it("should execute query with correct params", async () => {
    await DataLink.queryStoryRange(connectionMock.object, defaultStoryId, defaultClipAtSpaces);

    const query = constructQuery(compositeComposesClass, defaultStoryId);
    expect(queryStub.calledWith(query, undefined, defaultRowFormat)).to.true;
  });

  it("should execute correct query when clipAtSpaces is false", async () => {
    await DataLink.queryStoryRange(connectionMock.object, defaultStoryId, !defaultClipAtSpaces);

    const query = constructQuery(compositeOverlapsClass, defaultStoryId);
    expect(queryStub.calledWith(query, undefined, defaultRowFormat)).to.true;
  });
});
