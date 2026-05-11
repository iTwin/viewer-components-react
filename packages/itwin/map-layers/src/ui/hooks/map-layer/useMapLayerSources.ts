/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import React from "react";
import { BentleyError, compareStrings } from "@itwin/core-bentley";
import { IModelApp, MapLayerSources, NotifyMessageDetails, OutputMessagePriority } from "@itwin/core-frontend";
import { CustomParamsMappingStorage } from "../../../CustomParamsMappingStorage";
import { CustomParamUtils } from "../../../CustomParamUtils";
import { MapLayerPreferences, MapLayerSourceChangeType } from "../../../MapLayerPreferences";

import type { MapLayerSource, ScreenViewport } from "@itwin/core-frontend";
import type { MapLayerSourcesState } from "./types";

function useIsMountedRef() {
  const isMounted = React.useRef(false);

  React.useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  return isMounted;
}

/**
 * Loads and maintains available non-basemap map-layer sources for the active viewport.
 *
 * The hook merges public/external sources with persisted user preference sources,
 * applies custom parameter mappings, sorts the final list, and keeps it in sync with
 * `MapLayerPreferences.onLayerSourceChanged` events.
 */
export function useMapLayerSources(args: {
  activeViewport: ScreenViewport;
  fetchPublicMapLayerSources: boolean;
  hideExternalMapLayersSection: boolean;
}): MapLayerSourcesState {
  const { activeViewport, fetchPublicMapLayerSources, hideExternalMapLayersSection } = args;
  const [mapSources, setMapSources] = React.useState<MapLayerSource[] | undefined>();
  const [loadingSources, setLoadingSources] = React.useState(false);
  const isMounted = useIsMountedRef();

  React.useEffect(() => {
    async function fetchSources() {
      let preferenceSources: MapLayerSource[] = [];
      const sourceLayers = await MapLayerSources.create(undefined, fetchPublicMapLayerSources && !hideExternalMapLayersSection);

      const iModel = activeViewport.iModel;
      try {
        if (iModel?.iTwinId !== undefined) {
          preferenceSources = await MapLayerPreferences.getSources(iModel.iTwinId, iModel.iModelId);
        }
      } catch (err) {
        IModelApp.notifications.outputMessage(
          new NotifyMessageDetails(
            OutputMessagePriority.Error,
            IModelApp.localization.getLocalizedString("mapLayers:CustomAttach.ErrorLoadingLayers"),
            BentleyError.getErrorMessage(err),
          ),
        );
      }

      if (!isMounted.current) {
        return;
      }

      const sources: MapLayerSource[] = [];
      const addSource = (source: MapLayerSource) => !source.baseMap && sources.push(source);
      sourceLayers?.allSource.forEach(addSource);
      const cpMappingStorage = new CustomParamsMappingStorage();
      preferenceSources.forEach((source) => {
        if (!sources.find((curSource) => source.name === curSource.name)) {
          const cpMapping = cpMappingStorage.get(source.url.toLowerCase());
          if (cpMapping && !Array.isArray(cpMapping)) {
            CustomParamUtils.setSourceCustomParams(source, cpMapping.customParamNames);
          }
          addSource(source);
        }
      });
      sources.sort((a: MapLayerSource, b: MapLayerSource) => compareStrings(a.name.toLowerCase(), b.name.toLowerCase()));

      setMapSources(sources);
    }

    setLoadingSources(true);

    fetchSources()
      .then(() => {
        if (isMounted.current) {
          setLoadingSources(false);
        }
      })
      .catch(() => {
        if (isMounted.current) {
          setLoadingSources(false);
        }
      });
  }, [activeViewport.iModel, fetchPublicMapLayerSources, hideExternalMapLayersSection, isMounted]);

  React.useEffect(() => {
    const handleLayerSourceChange = async (changeType: MapLayerSourceChangeType, oldSource?: MapLayerSource, newSource?: MapLayerSource) => {
      const removeSource = changeType === MapLayerSourceChangeType.Replaced || changeType === MapLayerSourceChangeType.Removed;
      const addSource = changeType === MapLayerSourceChangeType.Replaced || changeType === MapLayerSourceChangeType.Added;

      let tmpSources = mapSources ? [...mapSources] : undefined;
      if (removeSource) {
        if (oldSource && tmpSources) {
          tmpSources = tmpSources.filter((source) => source.name !== oldSource.name);

          if (changeType !== MapLayerSourceChangeType.Replaced) {
            setMapSources(tmpSources);
          }
        }
      }

      if (addSource) {
        if (tmpSources && newSource && !tmpSources.find((curSource) => newSource.name === curSource.name)) {
          tmpSources.push(newSource);
          tmpSources.sort((a: MapLayerSource, b: MapLayerSource) => compareStrings(a.name.toLowerCase(), b.name.toLowerCase()));
          setMapSources(tmpSources);
        }
      }
    };

    return MapLayerPreferences.onLayerSourceChanged.addListener(handleLayerSourceChange);
  }, [mapSources]);

  return { loadingSources, mapSources };
}
