/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React, { useEffect, useState } from "react";
import { Reports } from "./Reports";
import "./Reports.scss";

import type { OneClickLCAProps } from "./OneClickLCAProps";
import { createDefaultReportsClient, ReportsClientContext } from "./context/ReportsClientContext";
import type { IOCLCAJobsClient, IReportsClient } from "@itwin/insights-client";
import { createDefaultOCLCAJobsClient, OCLCAJobsClientContext } from "./context/OCLCAJobsClientContext";

const OneClickLCA = (props?: OneClickLCAProps) => {
  const [reportsClient, setReportsClient] = useState<IReportsClient>(props?.reportsClient ?? createDefaultReportsClient(props?.reportingBasePath));
  const [oclcaJobsClient, setOclcaJobsClient] = useState<IOCLCAJobsClient>(
    props?.oclcaJobsClient ?? createDefaultOCLCAJobsClient(props?.carbonCalculationBasePath),
  );

  useEffect(
    () => setReportsClient(props?.reportsClient ?? createDefaultReportsClient(props?.reportingBasePath)),
    [props?.reportingBasePath, props?.reportsClient],
  );
  useEffect(
    () => setOclcaJobsClient(props?.oclcaJobsClient ?? createDefaultOCLCAJobsClient(props?.carbonCalculationBasePath)),
    [props?.carbonCalculationBasePath, props?.oclcaJobsClient],
  );

  return (
    <ReportsClientContext.Provider value={reportsClient}>
      <OCLCAJobsClientContext.Provider value={oclcaJobsClient}>
        <div className="oclca-container">
          <Reports />
        </div>
      </OCLCAJobsClientContext.Provider>
    </ReportsClientContext.Provider>
  );
};

export default OneClickLCA;
