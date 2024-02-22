/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { Radio } from "@itwin/itwinui-react";
import { MapLayersUI } from "../../mapLayers";

interface UserPreferencesStorageOptionsProps {
  disabled?: boolean;
  itwinChecked?: boolean;
  modelChecked?: boolean;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export function UserPreferencesStorageOptions(props: UserPreferencesStorageOptionsProps) {
  return (
    <div>
      <Radio
        disabled={props.disabled}
        name="settingsStorage"
        value="iTwin"
        label={MapLayersUI.translate("CustomAttach.StoreOnITwinSettings")}
        checked={props.itwinChecked}
        onChange={props.onChange}
      />
      <Radio
        disabled={props.disabled}
        name="settingsStorage"
        value="Model"
        label={MapLayersUI.translate("CustomAttach.StoreOnModelSettings")}
        checked={props.modelChecked}
        onChange={props.onChange}
      />
    </div>
  );
}
