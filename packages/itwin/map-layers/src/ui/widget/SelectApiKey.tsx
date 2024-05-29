/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
// cSpell:ignore Modeless WMTS

import { Select } from "@itwin/itwinui-react";
import * as React from "react";
import { CustomParamsStorage } from "../../CustomParamsStorage";
import "./MapUrlDialog.scss";
interface SelectApiKeyProps {
  value?: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function SelectApiKey(props: SelectApiKeyProps) {
  const [keyValue, setKeyValue] = React.useState<string | undefined>(props.value);

  const [apiKeys] = React.useState(() => {
    const storage = new CustomParamsStorage();
    const keys = storage.get(undefined);
    if (keys && Array.isArray(keys)) {
      return keys.map((keyItem) => {
        return { value: keyItem.name, label: keyItem.name };
      });
    }
    return [];
  });

  React.useEffect(() => {
    setKeyValue(props.value);
  }, [props.value]);

  const handleOnChange = React.useCallback(
    (value: string) => {
      setKeyValue(value);
      if (props.onChange) {
        props.onChange(value);
      }
    },
    [props],
  );

  const handleKeyDown = React.useCallback((e) => {
    if (e.code === "Delete" || e.key === "Backspace") {
      setKeyValue(undefined);
    }
  }, []);

  return (
    <Select
      className="map-layer-source-select"
      options={apiKeys}
      value={keyValue}
      disabled={props.disabled}
      onChange={handleOnChange}
      size="small"
      onKeyDown={handleKeyDown}
    />
  );
}
