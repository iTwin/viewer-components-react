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

async function* emptyQueryResultGenerator() {
  yield {};
}

describe("DataLink", () => {
  const connectionMock = Moq.Mock.ofType<IModelConnection>();
  const defaultStoryId: string = "testId";
  const defaultClipAtSpaces: boolean = true;
  const defaultRowFormat = { rowFormat: 0 };
  let queryStub: SinonStub;

  beforeEach(() => {
    queryStub = sinon.stub(IModelConnection.prototype, "query");

    connectionMock.setup((x) => x.query(Moq.It.isAny(), undefined, defaultRowFormat)) // eslint-disable-line deprecation/deprecation
      .callback(queryStub)
      .returns(queryResultGenerator);
  });

  afterEach(() => {
    queryStub.restore();
    connectionMock.reset();
  });

  it("should return correct data for queryStoryRange", async () => {
    const result = await DataLink.queryStoryRange(connectionMock.object, defaultStoryId, defaultClipAtSpaces);

    expect(result).to.eql(new Range3d(range3DProps.minX, range3DProps.minY, range3DProps.minZ, range3DProps.maxX, range3DProps.maxY, range3DProps.maxZ));
  });

  it("should execute query with correct params", async () => {
    await DataLink.queryStoryRange(connectionMock.object, defaultStoryId, defaultClipAtSpaces);

    const expectedQuery = "select MIN(spel.minX) as minX, MIN(spel.minY) as minY, MIN(spel.minZ) as minZ, MAX(spel.maxX) as maxX, MAX(spel.maxY) as maxY, MAX(spel.maxZ) as maxZ\n\
        from spatialcomposition.CompositeComposesSubComposites ovr join biscore.spatialIndex spel on spel.ECinstanceId = ovr.targetecinstanceid\n\
        where sourceECInstanceId in\n\
        (select sp.ecinstanceid from buildingspatial.story s join buildingspatial.space sp on s.ecinstanceid=sp.composingelement.id where s.ecinstanceid=testId\n\
        union\n\
        select s.ecinstanceid from buildingspatial.story s where s.ecinstanceid=testId)";

    expect(queryStub.calledWith(expectedQuery, undefined, defaultRowFormat)).to.true;
  });

  it("should execute correct query when clipAtSpaces is false", async () => {
    await DataLink.queryStoryRange(connectionMock.object, defaultStoryId, !defaultClipAtSpaces);

    const expectedQuery = "select MIN(spel.minX) as minX, MIN(spel.minY) as minY, MIN(spel.minZ) as minZ, MAX(spel.maxX) as maxX, MAX(spel.maxY) as maxY, MAX(spel.maxZ) as maxZ\n\
        from spatialcomposition.CompositeOverlapsSpatialElements ovr join biscore.spatialIndex spel on spel.ECinstanceId = ovr.targetecinstanceid\n\
        where sourceECInstanceId in\n\
        (select sp.ecinstanceid from buildingspatial.story s join buildingspatial.space sp on s.ecinstanceid=sp.composingelement.id where s.ecinstanceid=testId\n\
        union\n\
        select s.ecinstanceid from buildingspatial.story s where s.ecinstanceid=testId)";

    expect(queryStub.calledWith(expectedQuery, undefined, defaultRowFormat)).to.true;
  });

  it("should run the query again with compositeOverlaps class if compositeCompose returns undefined", async () => {
    connectionMock.reset();
    connectionMock.setup((x) => x.query(Moq.It.isAny(), undefined, defaultRowFormat)) // eslint-disable-line deprecation/deprecation
      .callback(queryStub)
      .returns(emptyQueryResultGenerator);

    await DataLink.queryStoryRange(connectionMock.object, defaultStoryId, defaultClipAtSpaces);

    const expectedQuery = "select MIN(spel.minX) as minX, MIN(spel.minY) as minY, MIN(spel.minZ) as minZ, MAX(spel.maxX) as maxX, MAX(spel.maxY) as maxY, MAX(spel.maxZ) as maxZ\n\
        from spatialcomposition.CompositeOverlapsSpatialElements ovr join biscore.spatialIndex spel on spel.ECinstanceId = ovr.targetecinstanceid\n\
        where sourceECInstanceId in\n\
        (select sp.ecinstanceid from buildingspatial.story s join buildingspatial.space sp on s.ecinstanceid=sp.composingelement.id where s.ecinstanceid=testId\n        union\n        select s.ecinstanceid from buildingspatial.story s where s.ecinstanceid=testId)";

    expect(queryStub.callCount).to.eql(2);
    expect(queryStub.calledWith(expectedQuery, undefined, defaultRowFormat));
  });
});
