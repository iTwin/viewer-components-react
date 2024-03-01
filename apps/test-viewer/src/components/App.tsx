/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./App.scss";
import { Route, Routes } from "react-router-dom";
import { FillCentered } from "@itwin/core-react";
import { ProgressLinear } from "@itwin/itwinui-react";
import { ArcGisOauthRedirect } from "./ArcGisOauthRedirect";
import { AuthorizationProvider, AuthorizationState, SignInRedirect, useAuthorizationContext } from "./Authorization";
import { Viewer } from "./Viewer";
import { EC3AuthRedirect } from "./EC3AuthRedirect";

export function App() {
  return (
    <AuthorizationProvider>
      <Routes>
        <Route path="/signin-callback" element={<SignInRedirect />} />
        <Route path="/*" element={<Main />} />
        <Route path="/esri-oauth2-callback" element={<ArcGisOauthRedirect />} />
        <Route path="/ec3-oauth2-callback" element={<EC3AuthRedirect />} />
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
