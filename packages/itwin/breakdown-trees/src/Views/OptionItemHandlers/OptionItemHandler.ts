/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

export abstract class OptionItemHandler {
  public key: string;
  public label: string;
  public toolIcon: string;
  constructor(key: string, label: string, toolIcon: string) {
    this.key = key;
    this.label = label;
    this.toolIcon = toolIcon;
  }
  public abstract toggle(): void;
  public abstract getIsActive(): boolean;
}
