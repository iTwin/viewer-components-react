/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import errorSvg from "@itwin/itwinui-icons/status-error.svg";
import { Button, Icon, Text } from "@itwin/itwinui-react/bricks";
import { TreeWidget } from "../../TreeWidget.js";

import type { FallbackProps } from "react-error-boundary";

/** @internal */
export function ErrorState({ resetErrorBoundary }: FallbackProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "0.5rem" }}>
      <Icon href={errorSvg} size="large" />
      <Text variant={"body-md"}>{TreeWidget.translate("errorState.description")}</Text>
      <Button onClick={resetErrorBoundary}>{TreeWidget.translate("errorState.retryButtonLabel")}</Button>
    </div>
  );
}
