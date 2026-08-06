/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Button, Typography } from "@mui/material";
import errorSvg from "@stratakit/icons/status-error.svg";
import { Icon } from "@stratakit/mui";
import { useTranslation } from "../shared/components/LocalizationContext.js";

import type { FallbackProps } from "react-error-boundary";

/** @internal */
export function ErrorState({ resetErrorBoundary }: FallbackProps) {
  const translate = useTranslation();
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "0.5rem" }}>
      <Icon href={errorSvg} size="large" />
      <Typography variant={"body-sm"}>{translate("errorState.description")}</Typography>
      <Button size="small" onClick={resetErrorBoundary}>
        {translate("errorState.retryButtonLabel")}
      </Button>
    </div>
  );
}
