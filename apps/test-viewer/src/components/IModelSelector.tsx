/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useEffect, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "react-router-dom";
import { UiFramework } from "@itwin/appui-react";
import { IModelsClient, toArray } from "@itwin/imodels-client-management";
import { NativeSelect } from "@mui/material";
import { useAuthorizationContext } from "./Authorization";

type ModelsState =
  | { iTwinId: string; status: "loading" }
  | { iTwinId: string; status: "ready"; options: { value: string; label: string }[] }
  | { iTwinId: string; status: "error" };

export function IModelSelector() {
  const { client: authClient } = useAuthorizationContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const iTwinId = searchParams.get("iTwinId");
  const iModelId = searchParams.get("iModelId");
  const [state, setState] = useState<ModelsState>();
  const viewerReady = useSyncExternalStore(subscribeToFrontstage, isFrontstageReady);

  useEffect(() => {
    if (!iTwinId) {
      return;
    }
    let disposed = false;
    setState({ iTwinId, status: "loading" });
    const loadModels = async () => {
      try {
        const client = new IModelsClient({ api: { baseUrl: `https://${import.meta.env.IMJS_URL_PREFIX ?? ""}api.bentley.com/imodels` } });
        const models = await toArray(
          client.iModels.getRepresentationList({
            authorization: async () => ({ scheme: "Bearer", token: (await authClient.getAccessToken()).replace(/^Bearer\s+/i, "") }),
            urlParams: { iTwinId, $top: 100, $continuationToken: "" },
          }),
        );
        if (!disposed) {
          setState({
            iTwinId,
            status: "ready",
            options: models.map((model) => ({ value: model.id, label: model.name })).sort((first, second) => first.label.localeCompare(second.label)),
          });
        }
      } catch {
        if (!disposed) {
          setState({ iTwinId, status: "error" });
        }
      }
    };
    void loadModels();
    return () => {
      disposed = true;
    };
  }, [authClient, iTwinId]);

  if (!iTwinId || !iModelId) {
    return null;
  }

  const currentState = state?.iTwinId === iTwinId ? state : undefined;
  const loading = !currentState || currentState.status === "loading";
  const failed = currentState?.status === "error";
  const options = currentState?.status === "ready" ? currentState.options : [];
  const placeholder = loading ? "Loading iModels..." : failed ? "Could not load iModels" : "No iModels available";

  return (
    <NativeSelect
      style={{ position: "fixed", top: 6, right: 40, zIndex: 9999, width: "min(280px, 45vw)" }}
      size="small"
      value={options.length ? iModelId : ""}
      disabled={!viewerReady || loading || failed || options.length === 0}
      inputProps={{
        "aria-label": "Switch iModel",
        title: options.find((option) => option.value === iModelId)?.label ?? (options.length > 0 ? iModelId : placeholder),
      }}
      onChange={(event) => {
        const nextIModelId = event.target.value;
        if (nextIModelId === iModelId) {
          return;
        }
        setSearchParams((previous) => {
          const next = new URLSearchParams(previous);
          next.set("iModelId", nextIModelId);
          next.delete("changesetId");
          return next;
        });
      }}
    >
      {options.length === 0 ? (
        <option value="" disabled>
          {placeholder}
        </option>
      ) : (
        options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))
      )}
    </NativeSelect>
  );
}

function subscribeToFrontstage(onChange: () => void) {
  const removeActivatedListener = UiFramework.frontstages.onFrontstageActivatedEvent.addListener(onChange);
  const removeReadyListener = UiFramework.frontstages.onFrontstageReadyEvent.addListener(onChange);
  return () => {
    removeActivatedListener();
    removeReadyListener();
  };
}

function isFrontstageReady() {
  return UiFramework.frontstages.activeFrontstageDef?.isReady ?? false;
}
