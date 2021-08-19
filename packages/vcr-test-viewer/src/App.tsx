/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See COPYRIGHT.md in the repository root for full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BrowserAuthorizationClientConfiguration } from "@bentley/frontend-authorization-client";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { Viewer } from "@itwin/web-viewer-react";
import React, { useEffect, useState } from "react";
import "./App.scss";
import { Header } from "./Header";
import { history } from "./history";

const App: React.FC = () => {
  const [isAuthorized, setIsAuthorized] = useState(
    (IModelApp.authorizationClient?.hasSignedIn &&
      IModelApp.authorizationClient?.isAuthorized) ||
      false
  );
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [buddiRegion] = useState(
    process.env.IMJS_BUDDI_REGION ? Number(process.env.IMJS_BUDDI_REGION) : 102
  );
  const [contextId, setContextId] = useState(process.env.IMJS_CONTEXT_ID);
  const [iModelId, setIModelId] = useState(process.env.IMJS_IMODEL_ID);
  const [changeSetId, setChangeSetId] = useState(process.env.IMJS_CHANGESET_ID);

  if (!process.env.IMJS_AUTH_CLIENT_CLIENT_ID) {
    throw new Error(
      "Please add a valid OIDC client id to the .env file and restart the application. See the README for more information."
    );
  }
  if (!process.env.IMJS_AUTH_CLIENT_REDIRECT_URI) {
    throw new Error(
      "Please add a valid redirect URI to the .env file and restart the application. See the README for more information."
    );
  }

  const authConfig: BrowserAuthorizationClientConfiguration = {
    scope: process.env.IMJS_AUTH_CLIENT_SCOPES ?? "",
    clientId: process.env.IMJS_AUTH_CLIENT_CLIENT_ID ?? "",
    redirectUri: process.env.IMJS_AUTH_CLIENT_REDIRECT_URI ?? "",
    authority: process.env.IMJS_AUTH_AUTHORITY,
    postSignoutRedirectUri: process.env.IMJS_AUTH_CLIENT_LOGOUT_URI,
    responseType: "code",
  };

  useEffect(() => {
    if (isAuthorized) {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has("contextId")) {
        setContextId(urlParams.get("contextId") as string);
      } else {
        if (!contextId) {
          throw new Error(
            "Please add a valid context ID in the .env file and restart the application or add it to the contextId query parameter in the url and refresh the page. See the README for more information."
          );
        }
      }

      if (urlParams.has("iModelId")) {
        setIModelId(urlParams.get("iModelId") as string);
      } else {
        if (!iModelId) {
          throw new Error(
            "Please add a valid iModel ID in the .env file and restart the application or add it to the iModelId query parameter in the url and refresh the page. See the README for more information."
          );
        }
      }

      if (urlParams.has("changeSetId")) {
        setChangeSetId(urlParams.get("changeSetId") as string);
      }
    }
  }, [isAuthorized]);

  useEffect(() => {
    if (isAuthorized && contextId && iModelId) {
      const url = `?contextId=${contextId}&iModelId=${iModelId}`;
      if (changeSetId) {
        url.concat(`&changeSetId=${changeSetId}`);
      }
      history.push(url);
    }
  }, [isAuthorized, contextId, iModelId, changeSetId]);

  useEffect(() => {
    if (isLoggingIn && isAuthorized) {
      setIsLoggingIn(false);
    }
  }, [isAuthorized, isLoggingIn]);

  const onLoginClick = async () => {
    setIsLoggingIn(true);
    await IModelApp.authorizationClient?.signIn();
  };

  const onLogoutClick = async () => {
    setIsLoggingIn(false);
    await IModelApp.authorizationClient?.signOut();
    setIsAuthorized(false);
  };

  const onIModelAppInit = () => {
    setIsAuthorized(IModelApp.authorizationClient?.isAuthorized || false);
    IModelApp.authorizationClient?.onUserStateChanged.addListener(() => {
      setIsAuthorized(
        (IModelApp.authorizationClient?.hasSignedIn &&
          IModelApp.authorizationClient?.isAuthorized) ||
          false
      );
    });
  };

  return (
    <div className="viewer-container">
      <Header
        handleLogin={onLoginClick}
        loggedIn={isAuthorized}
        handleLogout={onLogoutClick}
      />
      {isLoggingIn ? (
        <span>"Logging in...."</span>
      ) : (
        <Viewer
          contextId={contextId}
          iModelId={iModelId}
          changeSetId={changeSetId}
          authConfig={{ config: authConfig }}
          backend={{ buddiRegion }}
          defaultUiConfig={{
            contentManipulationTools: {
              verticalItems: {
                measureTools: false,
                sectionTools: false,
              },
              hideDefaultHorizontalItems: true,
            },
            hideTreeView: true,
            hidePropertyGrid: true,
          }}
          onIModelAppInit={onIModelAppInit}
        />
      )}
    </div>
  );
};

export default App;
