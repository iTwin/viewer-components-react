/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./App.scss";
import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { FillCentered } from "@itwin/core-react";
import { ProgressLinear } from "@itwin/itwinui-react";
import { ArcGisOauthRedirect } from "./ArcGisOauthRedirect";
import { AuthorizationProvider, AuthorizationState, SignInRedirect, useAuthorizationContext } from "./Authorization";
import { Viewer } from "./Viewer";

// Turn off errors related to resize Observers. We might want to
// drop this we me migrate to react 18.
// Based on this bug: https://github.com/iTwin/iTwinUI/issues/1317
// and this post https://stackoverflow.com/questions/1146973/how-do-i-revert-all-local-changes-in-git-managed-project-to-previous-state
export const useBeforeRender = (callback: any, deps: any) => {
  const [isRun, setIsRun] = useState(false);
  if (!isRun) {
    callback();
    setIsRun(true);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => setIsRun(false), deps);
};

export function App() {
  useBeforeRender(() => {
    window.addEventListener("error", (e) => {
      if (e) {
        const resizeObserverErrDiv = document.getElementById(
          "webpack-dev-server-client-overlay-div",
        );
        const resizeObserverErr = document.getElementById(
          "webpack-dev-server-client-overlay",
        );
        if (resizeObserverErr)
          resizeObserverErr.className = "hide-resize-observer";
        if (resizeObserverErrDiv)
          resizeObserverErrDiv.className = "hide-resize-observer";
      }
    });
  }, []);

  return (
    <AuthorizationProvider>
      <Routes>
        <Route path="/signin-callback" element={<SignInRedirect />} />
        <Route path="/*" element={<Main />} />
        <Route path="/esri-oauth2-callback" element={<ArcGisOauthRedirect />} />
      </Routes>
    </AuthorizationProvider>
  );
}

function Main() {
  const { state } = useAuthorizationContext();

  return <div className="viewer-container">{state === AuthorizationState.Pending ? <Loader /> : <Viewer />}</div>;
}

function Loader() {
  return (
    <FillCentered>
      <div className="signin-content">
        <ProgressLinear indeterminate={true} labels={["Signing in..."]} />
      </div>
    </FillCentered>
  );
}
