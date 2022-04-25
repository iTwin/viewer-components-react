/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import React, { useEffect, useState } from "react";

import {
  ColorBuilder,
  ColorInputPanel,
  ColorPalette,
  ColorPicker,
  ColorSwatch,
  ColorValue,
  DropdownMenu,
  IconButton,
  MenuExtraContent,
  useTheme,
} from "@itwin/itwinui-react";

import styles from "./InputColorPicker.module.scss";

export function InputColorPicker(props: {presetColors?: string[], value: string, onChange: (newValue: string) => void}) {

  // This is needed to iTwin React component to respect system-wide light/dark mode
  useTheme("os");

  // Storage for color object of input
  const [color, setColor] = useState<ColorValue>(ColorValue.create(props.value));
  useEffect(() => {
    setColor(ColorValue.create(props.value));
  }, [props.value]);

  // Fire off event on color change
  const onChange = (newColor: ColorValue) => {
    setColor(newColor);
    const newColorValue = newColor ? newColor.toHexString(): undefined;
    const oldColorValue = color ? color.toHexString() : undefined;
    if (newColorValue && newColorValue !== oldColorValue) {
      props.onChange(newColorValue);
    }
  };

  return (
    <div>
      <DropdownMenu placement="bottom-end" menuItems={
        () => [
          <MenuExtraContent key={0} className={styles["dropdown-menu-content"]}>
            <ColorPicker selectedColor={color} onChangeComplete={onChange}>
              <ColorBuilder className={styles["color-builder"]} />
              <ColorInputPanel defaultColorFormat="hex" />
              <ColorPalette label="Default Colors" colors={props.presetColors} />
            </ColorPicker>
          </MenuExtraContent>,
        ]
      }>
        <IconButton className={styles["dropdown-menu-button"]}>
          <ColorSwatch className={styles["dropdown-menu-button-color-swatch"]} color={color}/>
        </IconButton>
      </DropdownMenu>
    </div>
  );
}
