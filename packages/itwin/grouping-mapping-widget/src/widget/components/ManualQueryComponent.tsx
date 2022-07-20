/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import React from "react";
import { Textarea } from "@itwin/itwinui-react";

interface ManualQueryProps {
  query: string;
  setQuery: React.Dispatch<React.SetStateAction<string>>;
}

export const ManualQuery = ({ query, setQuery }: ManualQueryProps) => {
  return (
    <div>
      <Textarea value={query} onChange={(e) => setQuery(e.target.value)} />
    </div>
  );
};
