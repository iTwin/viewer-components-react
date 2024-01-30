/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { useActiveIModelConnection } from "@itwin/appui-react";
import { SpatialContainmentTree } from "@itwin/breakdown-trees-react";
import React from "react";

export const SampleSpatialTree: React.FC = () => {
  const iModel = useActiveIModelConnection();
  return (
    <>
      {iModel && (
        <SpatialContainmentTree
          iModel={iModel}
          groupByType={true}
          setGroupByType={() => {
            return "group-by-type";
          }}
          groupByDiscipline={true}
          setGroupByDiscipline={() => {
            return "group-by-discipline";
          }}
          displayGuids={true}
          setIsDisplayGuids={() => {
            return "discard-guid-from-label";
          }}
          enableVisibility={true}
          clipHeight={1.2}
          clipAtSpaces={true}
        />
      )}
    </>
  );
};
