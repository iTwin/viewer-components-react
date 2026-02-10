/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "./App.scss";

import { ErrorBoundary } from "react-error-boundary";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { FillCentered } from "@itwin/core-react";
import { SvgError } from "@itwin/itwinui-illustrations-react";
import { NonIdealState, ProgressLinear, ThemeProvider } from "@itwin/itwinui-react";
import { Root } from "@stratakit/foundations";
import { ArcGisOauthRedirect } from "./ArcGisOauthRedirect";
import { AuthorizationProvider, AuthorizationState, SignInRedirect, useAuthorizationContext } from "./Authorization";
import { EC3AuthRedirect } from "./EC3AuthRedirect";
import { Viewer } from "./Viewer";

import type { FallbackProps } from "react-error-boundary";

export function App() {
  return (
    <BrowserRouter>
      <ThemeProvider theme={"light"} future={true} as={Root} colorScheme={"light"} synchronizeColorScheme density="dense">
        <ErrorBoundary FallbackComponent={ErrorState}>
          <AuthorizationProvider>
            <AppRoutes />
          </AuthorizationProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </BrowserRouter>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/signin-callback" element={<SignInRedirect />} />
      <Route path="/*" element={<Main />} />
      <Route path="/esri-oauth2-callback" element={<ArcGisOauthRedirect />} />
      <Route path="/ec3-oauth2-callback" element={<EC3AuthRedirect />} />
    </Routes>
  );
}

function Main() {
  const { state } = useAuthorizationContext();

  return <div className="viewer-container">{state === AuthorizationState.Pending ? <Loader /> : <Viewer />}</div>;
}

function Loader() {
  return (
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    <FillCentered>
      <div className="signin-content">
        <ProgressLinear indeterminate={true} labels={["Signing in..."]} />
      </div>
    </FillCentered>
  );
}

function ErrorState({ error }: FallbackProps) {
  const message = error instanceof Error ? error.message : JSON.stringify(error);
  return <NonIdealState svg={<SvgError />} heading={"An error occurred"} description={message} />;
}
