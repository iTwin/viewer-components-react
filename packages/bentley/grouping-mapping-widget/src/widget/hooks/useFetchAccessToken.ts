/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelApp } from "@bentley/imodeljs-frontend";
import { useEffect, useState } from "react";

const useFetchAccessToken = () => {
  const [accessToken, setAccessToken] = useState<string>("");

  useEffect(() => {
    const fetchAccessToken = async () => {
      const accessToken = await IModelApp.authorizationClient?.getAccessToken();
      setAccessToken(accessToken?.toTokenString() as string);
    };
    void fetchAccessToken();
  }, []);

  return accessToken;
};

export default useFetchAccessToken;
