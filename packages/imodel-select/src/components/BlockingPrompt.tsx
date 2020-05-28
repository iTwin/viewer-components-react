/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import "./BlockingPrompt.scss";
import "./Common.scss";
import { Spinner, SpinnerSize } from "@bentley/ui-core";

/**
 * Properties for the [[BlockingPrompt]] component
 * @public
 */
export interface BlockingPromptProps {
  prompt: string;
}

/**
 * Display a message box centered in the view port with lightbox (ghosting background)
 * @public
 */
export class BlockingPrompt extends React.Component<BlockingPromptProps> {

  // @internal
  public render() {
    return (
      <div className="blocking-modal-background fade-in-fast">
        <div className="blocking-prompt fade-in">
          <Spinner size={SpinnerSize.Large} />
          <span>{this.props.prompt}</span>
        </div>
      </div>
    );
  }
}
