/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useActiveIModelConnection, useActiveViewport } from "@itwin/appui-react";
import type { AccessToken } from "@itwin/core-bentley";
import type { ContextRealityModelProps } from "@itwin/core-common";
import { CartographicRange, RealityDataFormat, RealityDataProvider } from "@itwin/core-common";
import type { IModelConnection, Viewport } from "@itwin/core-frontend";
import { ExpandableBlock } from "@itwin/itwinui-react";
import type {
  ITwinRealityData,
  RealityDataAccessClient,
  RealityDataQueryCriteria,
  RealityDataResponse,
} from "@itwin/reality-data-client";
import React, { useCallback, useEffect, useState } from "react";

import "./GeospatialProvider.scss";
import { RDProperties } from "./RDProperties";
import { getAttachedRealityDataModels } from "./utils";

interface RDWidgetProps {
  accessToken: AccessToken;
  rdClient: RealityDataAccessClient;
}

export const RealityDataWidget = ({ accessToken, rdClient }: RDWidgetProps) => {
  const iModelConnection = useActiveIModelConnection();
  const viewport = useActiveViewport();
  const [attachedRealityModels, setAttachedRealityModels] = useState<ReturnType<typeof getAttachedRealityDataModels>>(
    []
  );
  const [withinExtents, setWithinExtents] = useState<ITwinRealityData[]>();
  const [outsideExtents, setOutsideExtents] = useState<ITwinRealityData[]>();

  // Initialize the widget
  useEffect(() => {
    const queryRealityDatas = async (attachedModels: ContextRealityModelProps[]) => {
      //@todo: We could filter the whole list by extent into the other two arrays (within and outside)?
      if (accessToken && iModelConnection) {
        const availModels = await getRealityDatas(rdClient, iModelConnection, accessToken, false, attachedModels);
        const within = await getRealityDatas(rdClient, iModelConnection, accessToken, true, attachedModels);
        const outside: ITwinRealityData[] = [];
        const limit = 100; //practical limit for this UI as too many causes major delays
        for (const rdEntry of availModels) {
          if (outside.length === limit) {
            break;
          }
          if (!within.some((wProps) => rdEntry.id === wProps.id)) {
            outside.push(rdEntry);
          }
        }
        within.length = Math.min(limit, within.length);
        setWithinExtents(within);
        setOutsideExtents(outside);
      }
    };

    if (iModelConnection) {
      const attachedModels = getAttachedRealityDataModels(iModelConnection);
      queryRealityDatas(attachedModels).catch(console.error);
      setAttachedRealityModels(attachedModels);
    }
  }, [iModelConnection, viewport, accessToken, rdClient]);

  const getExpandableBlock = <T,>(
    entries: T[] | undefined,
    baseTitle: string,
    childFunc: (entries: T[]) => React.JSX.Element[],
    isExpanded = false
  ) => {
    if (entries?.length) {
      return (
        <ExpandableBlock title={`${baseTitle} (${entries.length})`} isExpanded={isExpanded} styleType="borderless">
          {childFunc(entries)}
        </ExpandableBlock>
      );
    }
  };

  const getRealityDataComponents = (entries: ITwinRealityData[]) => {
    return entries?.map((element) => {
      const model = getContextRealityModelProps(rdClient, iModelConnection?.iTwinId, element);
      return (
        <div className="visibility-grid-container" key={`reality-model-${model.tilesetUrl}`}>
          <RealityDataVisibility viewport={viewport} realityModel={model} />
          <RDProperties accessToken={accessToken} rdClient={rdClient} model={model} realityData={element} />
        </div>
      );
    });
  };

  const getModelVisiblityComponents = () => {
    return attachedRealityModels?.map((element) => {
      return (
        <div className="visibility-grid-container" key={`reality-model-${element.tilesetUrl}`}>
          <ModelVisibility viewport={viewport} modelId={element.modelId} />
          <RDProperties accessToken={accessToken} rdClient={rdClient} model={element} />
        </div>
      );
    });
  };

  return (
    <>
      {getExpandableBlock(attachedRealityModels, "Attached Reality Models", getModelVisiblityComponents, true)}
      {getExpandableBlock(
        withinExtents,
        "Reality Models within extents",
        getRealityDataComponents,
        attachedRealityModels.length === 0
      )}
      {getExpandableBlock(outsideExtents, "Reality Models outside extents", getRealityDataComponents)}
    </>
  );
};

function Visibility({ displayed, onClick }: { displayed: boolean; onClick: () => void }) {
  return <span className={displayed ? "icon icon-visibility" : "icon icon-visibility-hide-2"} onClick={onClick} />;
}

function ModelVisibility({ viewport, modelId }: { viewport: Viewport | undefined; modelId: string }) {
  const [displayed, setDisplayed] = useState(false);

  const syncDisplayed = useCallback(() => {
    setDisplayed(viewport?.viewsModel(modelId) ?? false);
  }, [modelId, viewport]);

  useEffect(() => {
    syncDisplayed();
  }, [syncDisplayed]);

  useEffect(() => {
    if (viewport) {
      return viewport.onViewedModelsChanged.addListener(() => {
        syncDisplayed();
      });
    }
  }, [syncDisplayed, viewport]);

  return (
    <Visibility
      displayed={displayed}
      onClick={() => {
        if (viewport !== undefined) {
          viewport.changeModelDisplay(modelId, !viewport.viewsModel(modelId));
        }
      }}
    />
  );
}

function RealityDataVisibility({
  viewport,
  realityModel,
}: {
  viewport: Viewport | undefined;
  realityModel: ContextRealityModelProps;
}) {
  const [displayed, setDisplayed] = useState(false);

  const syncDisplayed = useCallback(() => {
    setDisplayed(
      viewport?.displayStyle.hasAttachedRealityModel(realityModel.name ?? "", realityModel.tilesetUrl) ?? false
    );
  }, [viewport, realityModel]);

  useEffect(() => {
    syncDisplayed();
  }, [syncDisplayed]);

  useEffect(() => {
    if (viewport) {
      return viewport.displayStyle.settings.contextRealityModels.onChanged.addListener(() => {
        syncDisplayed();
      });
    }
  }, [syncDisplayed, viewport]);

  return (
    <Visibility
      displayed={displayed}
      onClick={() => {
        if (viewport !== undefined) {
          if (displayed) {
            viewport?.displayStyle.detachRealityModelByNameAndUrl(realityModel.name ?? "", realityModel.tilesetUrl);
          } else {
            viewport?.displayStyle.attachRealityModel(realityModel);
          }
          setDisplayed(!displayed);
        }
      }}
    />
  );
}

function getContextRealityModelProps(
  rdClient: RealityDataAccessClient,
  iTwinId: string | undefined,
  iTwinRealityData: ITwinRealityData
): ContextRealityModelProps {
  return {
    //Note: we should call RealityDataAccessClient.getRealityDataUrl except its unnecessarily async
    tilesetUrl: `${rdClient.baseUrl}/${iTwinRealityData.id}?projectId=${iTwinId}`,
    rdSourceKey: {
      provider: RealityDataProvider.ContextShare,
      format: iTwinRealityData.type === RealityDataFormat.OPC ? RealityDataFormat.OPC : RealityDataFormat.ThreeDTile,
      id: iTwinRealityData.id,
    },
    name: iTwinRealityData.displayName ?? iTwinRealityData.id,
    description: iTwinRealityData?.description,
    realityDataId: iTwinRealityData.id,
  };
}

async function getRealityDatas(
  rdClient: RealityDataAccessClient,
  iModelConnection: IModelConnection,
  accessToken: AccessToken,
  withinExtents = false,
  attachedModels: ContextRealityModelProps[] = []
) {
  const { iTwinId, projectExtents, ecefLocation } = iModelConnection;
  const criteria: RealityDataQueryCriteria = {
    getFullRepresentation: true,
    top: 500,
  };

  if (withinExtents && ecefLocation) {
    criteria.extent = new CartographicRange(projectExtents, ecefLocation.getTransform());
  }
  const results: ITwinRealityData[] = [];

  let response: RealityDataResponse;
  do {
    response = await rdClient.getRealityDatas(accessToken, iTwinId, criteria);
    criteria.continuationToken = response.continuationToken;
    for (const rdEntry of response.realityDatas) {
      if (rdEntry.rootDocument && !attachedModels.some((entry) => entry.realityDataId === rdEntry.id)) {
        results.push(rdEntry);
      }
    }
  } while (response.continuationToken);

  results.sort((a, b) => {
    if (a.displayName && b.displayName) {
      return a.displayName.localeCompare(b.displayName);
    }
    return 0;
  });
  return results;
}
