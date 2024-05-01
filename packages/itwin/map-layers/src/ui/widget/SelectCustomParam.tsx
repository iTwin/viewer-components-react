/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// cSpell:ignore Modeless WMTS

import { Select } from "@itwin/itwinui-react";
import * as React from "react";
import { CustomParamsStorage } from "../../CustomParamsStorage";
import "./MapUrlDialog.scss";
import { MapLayersUI } from "../../mapLayers";
interface SelectCustomParamProps {
  value?: string[];
  disabled?: boolean;
  onChange?: (value: string[]) => void;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export function SelectCustomParam(props: SelectCustomParamProps) {
  const [storage] = React.useState(() => new CustomParamsStorage());

  const [paramValues, setParamValues] = React.useState<string[]|undefined>(props.value);

  const getCustomParamsFromStorage = React.useCallback(() => {
    const params = storage.get(undefined);
    return (params ? params.map((item) => {return {value: item.name, label: item.name};}) : []);
  }, [storage]);

  const [customParams] = React.useState(() => getCustomParamsFromStorage());

  React.useEffect(() => {
    setParamValues(props.value);
  }, [props.value]);

  const handleOnChange = React.useCallback((val, event) => {
    const stateSetter = (prev: string[] | undefined) => {
      const getValue = (): string[] => {
        if (!prev)
          return [val];

        return event === "removed" ? prev.filter((v) => val !== v) : [...prev, val];
      };
      const value = getValue();
      if (props.onChange)
        props.onChange(value);
      return value;

    };
    setParamValues(stateSetter);

  }, [props]);

  const handleKeyDown = React.useCallback((e) => {
    if (e.code === "Delete" ||  e.key === "Backspace") {
      setParamValues(undefined);
    }
  }, []);

  return (
    <div className="map-layer-custom-param-select" title={customParams.length === 0 ? MapLayersUI.translate("CustomParamSelect.DisabledTitle") : undefined}>
      <Select<string>
        className="map-layer-source-select"
        options={customParams}
        value={paramValues}
        disabled={props.disabled || customParams.length === 0 }
        onChange={handleOnChange}
        size="small"
        onKeyDown={handleKeyDown}
        multiple
      >
      </Select>
    </div>
  );
}
