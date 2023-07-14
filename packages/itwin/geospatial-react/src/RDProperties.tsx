/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { useActiveIModelConnection } from "@itwin/appui-react";
import { FilteredType, VirtualizedPropertyGridWithDataProvider } from "@itwin/components-react";
import type { AccessToken } from "@itwin/core-bentley";
import type { BentleyError, ContextRealityModelProps } from "@itwin/core-common";
import { Orientation, ResizableContainerObserver } from "@itwin/core-react";
import type { ITwinRealityData, RealityDataAccessClient } from "@itwin/reality-data-client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import wktParser from "wkt-parser";

import { SimpleReadonlyPropertyDataProvider } from "./SimpleReadonlyPropertyDataProvider";
import { convertDDToDMS } from "./utils";

function useIsMounted() {
  const isMounted = useRef(false);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);
  return isMounted;
}

export interface RDPropertiesProps {
  accessToken: AccessToken;
  rdClient: RealityDataAccessClient;
  model?: ContextRealityModelProps;
  realityData?: ITwinRealityData;
}

enum DefaultValues {
  Loading = "Loading...",
  NotAvailable = "N/A",
}

class GCSCache {
  private m_cache = new Map<string, any>();

  public clear() {
    this.m_cache.clear();
  }

  public async getGCsInfo(accessToken: AccessToken, realityData: ITwinRealityData) {
    // Return if type is not one that supports the GCS as json
    if (!realityData.id || (realityData.type !== "RealityMesh3DTiles" && realityData.type !== "Terrain3DTiles")) {
      return;
    }
    const msg = `${realityData.id.substring(0, 8)} - ${realityData.displayName}`;
    if (this.m_cache.has(realityData.id)) {
      console.log(`Returning cached GCSInfo for ${msg}`);

      // the stored value may be undefined which would indicate we tried before and stored undefined
      return this.m_cache.get(realityData.id);
    }

    console.log(`Querying GCSInfo for ${msg}`);
    const gcsInfo = await GCSCache.queryGCSInfo(accessToken, realityData);
    this.m_cache.set(realityData.id, gcsInfo);
    return gcsInfo;
  }

  private static async queryGCSInfo(accessToken: AccessToken, realityData: ITwinRealityData) {
    try {
      const rdName = realityData.displayName ?? "Reality Data";
      const rootDoc = realityData.rootDocument ?? `${rdName}.json`;
      const url = (await realityData.getBlobUrl(accessToken, rootDoc)).toString();
      if (!rootDoc.toLocaleLowerCase().includes(".json")) {
        console.log(`Skipping non-json rootDoc: ${rootDoc}, blobUrl: ${url}`);
        return;
      }
      const response = await fetch(url);
      if (!response.ok) {
        return;
      }
      const contentType = response.headers.get("Content-Type") ?? undefined;
      if (contentType === "application/json" || contentType === "application/octet-stream") {
        const json = await response.json();
        const gcsWkt = json?.root?.SMMasterHeader?.GCS;
        if (gcsWkt) {
          const parsed = wktParser(gcsWkt);
          return parsed;
        }
      }
    } catch (e) {
      console.log(`${realityData.displayName} ${e}`);
      // @todo: handle errors differently than missing data (404)?
    }
  }
}

export const RDProperties = (props: RDPropertiesProps) => {
  const { accessToken } = props;
  const activeModel = useActiveIModelConnection();
  const [dataProvider, setDataProvider] = useState(getDataProvider(props, DefaultValues.Loading));
  const isMounted = useIsMounted();
  const [{ width, height }, setSize] = useState({ width: 0, height: 0 });
  const handleResize = useCallback((w: number, h: number) => {
    setSize({ width: w, height: h });
  }, []);

  useEffect(() => {
    const callback = async () => {
      if (activeModel && props.model?.realityDataId) {
        let realityData = props.realityData;
        try {
          if (!realityData && !RDProperties.MissingRealityData.has(props.model.realityDataId)) {
            realityData = await props.rdClient.getRealityData(
              accessToken,
              activeModel.iTwinId,
              props.model.realityDataId
            );
          }
        } catch (e) {
          if ((e as BentleyError).errorNumber === 404) {
            RDProperties.MissingRealityData.add(props.model.realityDataId);
          }
        }

        const dp = await queryGCSAndGetDataProvider(accessToken, { ...props, realityData });
        if (isMounted.current) {
          setDataProvider(dp);
        }
      }
    };
    void callback();
  }, [accessToken, props, isMounted, activeModel]);

  return (
    <div className="itwin-gcrs-property-grid">
      <ResizableContainerObserver onResize={handleResize}>
        <VirtualizedPropertyGridWithDataProvider
          dataProvider={dataProvider}
          orientation={Orientation.Horizontal}
          height={height}
          width={width}
          highlight={{
            highlightedText: DefaultValues.NotAvailable,
            filteredTypes: [FilteredType.Label, FilteredType.Value],
          }}
        />
      </ResizableContainerObserver>
    </div>
  );
};
RDProperties.MissingRealityData = new Set<string>();
RDProperties.GCSCache = new GCSCache();

async function queryGCSAndGetDataProvider(accessToken: AccessToken, props: RDPropertiesProps) {
  let gcsInfo: any | undefined;
  if (props.realityData) {
    gcsInfo = await RDProperties.GCSCache.getGCsInfo(accessToken, props.realityData);
  }
  return getDataProvider(props, DefaultValues.NotAvailable, gcsInfo);
}

enum PropertyLabels {
  CoordinateSystem = "Coordinate System",
  Vertical = "Vertical",
  MinLongitude = "Minimum Longitude",
  MaxLongitude = "Maximum Longitude",
  MinLatitude = "Minimum Latitude",
  MaxLatitude = "Maximum Latitude",
  Details = "Details",
}

function getDataProvider(props: RDPropertiesProps, defaultVal: DefaultValues, gcsInfo: any = undefined) {
  const { realityData, model } = props;
  // if we're in the initial loading phase and already have realityData then the default will be "N/A" if the extent isn't defined
  const extentDefault = defaultVal === DefaultValues.Loading && realityData ? DefaultValues.NotAvailable : defaultVal;

  const category = realityData?.displayName ?? model?.name ?? "Unknown Reality Data";
  const dataProvider = new SimpleReadonlyPropertyDataProvider();
  const record: any = {};
  const vertical = gcsInfo?.VERTICALCRS ?? gcsInfo?.VERTCRS ?? gcsInfo?.VERT_CS;
  const extent = realityData?.extent;

  // record["Id"] = realityData?.id ?? "Unknown Id";
  // record["Type"] = realityData?.type ?? "Unknown type";
  record[PropertyLabels.CoordinateSystem] = gcsInfo?.name ?? defaultVal;
  record[PropertyLabels.Vertical] = vertical?.name ?? defaultVal;
  record[PropertyLabels.MinLongitude] = extent ? convertDDToDMS(extent.southWest.longitude, false) : extentDefault;
  record[PropertyLabels.MaxLongitude] = extent ? convertDDToDMS(extent.northEast.longitude, false) : extentDefault;
  record[PropertyLabels.MinLatitude] = extent ? convertDDToDMS(extent.southWest.latitude, true) : extentDefault;
  record[PropertyLabels.MaxLatitude] = extent ? convertDDToDMS(extent.northEast.latitude, true) : extentDefault;
  record[PropertyLabels.Details] = gcsInfo ?? defaultVal;

  dataProvider.addPropertyRecords(record, category);
  return dataProvider;
}
