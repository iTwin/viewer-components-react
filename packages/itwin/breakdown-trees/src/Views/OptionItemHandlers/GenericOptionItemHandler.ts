/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { OptionItemHandler } from "./OptionItemHandler";

export class GenericOptionItemHandler extends OptionItemHandler {
  public _getItemState: () => boolean;
  public _setItemState: (state: boolean) => void;
  constructor(key: string, label: string, toolIcon: string, getItemState: () => boolean, setItemState: (state: boolean) => void) {
    super(key, label, toolIcon);
    this._getItemState = getItemState;
    this._setItemState = setItemState;
  }
  public toggle() {
    this._setItemState(!this._getItemState());
  }

  public getIsActive(): boolean {
    return this._getItemState();
  }
}
