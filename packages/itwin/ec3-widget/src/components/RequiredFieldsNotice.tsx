/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import React from "react";
import { Text } from "@itwin/itwinui-react";
import "./RequiredFieldsNotice.scss";
import type { useEC3WidgetLocalizationResult } from "../common/UseEC3WidgetLocalization";
import { useEC3WidgetLocalization } from "../common/UseEC3WidgetLocalization";

export const RequiredFieldsNotice = (props: { localizedStrings?: useEC3WidgetLocalizationResult }) => {
  const localizedStrings = useEC3WidgetLocalization(props.localizedStrings);
  return (
    <Text variant="small" className="ec3w-template-field-legend">
      {localizedStrings.requiredFieldNotice}
    </Text>
  );
};
