import { handleEC3AuthCallback } from "@itwin/ec3-widget-react";
import { ProgressRadial } from "@itwin/itwinui-react";
import { useEffect } from "react";

export const EC3AuthRedirect = () => {
  useEffect(() => {
    handleEC3AuthCallback({
      clientId: process.env.IMJS_EC3_PORTAL_AUTH_CLIENT_ID ?? "",
      redirectUri: process.env.IMJS_EC3_PORTAL_AUTH_CLIENT_REDIRECT_URI ?? "",
    });
  }, []);

  return <ProgressRadial indeterminate={true}></ProgressRadial>;
};
