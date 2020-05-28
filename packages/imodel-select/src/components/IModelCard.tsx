/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { Spinner, SpinnerSize } from "@bentley/ui-core";
import { UiFramework, IModelInfo } from "@bentley/ui-framework";
import { IModelSelect } from "../IModelSelect";

import "./IModelCard.scss";

/**
 * Properties for the [[IModelCard]] component
 * @public
 */
export interface IModelCardProps {
  showDescription?: boolean;
  iModel: IModelInfo;
  onSelectIModel?: (iModelInfo: IModelInfo) => void;
}

/**
 * State of the [[IModelCard]] component
 * @public
 */
export interface IModelCardState {
  waitingForThumbnail: boolean;
  showOptions: boolean;
}

/**
 * Card representing a single IModel
 * @public
 */
export class IModelCard extends React.Component<
  IModelCardProps,
  IModelCardState
> {
  constructor(props: IModelCardProps, context?: any) {
    super(props, context);
    this.state = { waitingForThumbnail: false, showOptions: false };
  }

  public static defaultProps: Partial<IModelCardProps> = {
    showDescription: true,
  };

  // called when this component is first loaded
  public async componentDidMount() {
    // we don't get the thumbnail until it's needed.
    if (!this.props.iModel.thumbnail)
      this.startRetrieveThumbnail(this.props.iModel); // tslint:disable-line:no-floating-promises
  }

  // retrieves the IModels for a Project. Called when first mounted and when a new Project is selected.
  private async startRetrieveThumbnail(thisIModel: IModelInfo) {
    this.setState({ waitingForThumbnail: true });
    thisIModel.thumbnail = await UiFramework.iModelServices.getThumbnail(
      thisIModel.projectInfo.wsgId,
      thisIModel.wsgId
    );
    this.setState({ waitingForThumbnail: false });
  }

  private _onCardClicked = () => {
    if (this.props.onSelectIModel) this.props.onSelectIModel(this.props.iModel);
  };

  private renderDescription() {
    if (
      this.props.iModel.description &&
      this.props.iModel.description.length > 0
    ) {
      return (
        <span className="imodel-card-description">
          {this.props.iModel.description}
        </span>
      );
    } else {
      return (
        <span
          className="imodel-card-description"
          style={{ fontStyle: "italic" }}
        >
          {IModelSelect.translate("noDescription")}
        </span>
      );
    }
  }

  public renderThumbnail() {
    if (this.state.waitingForThumbnail) {
      return (
        <div className="preview-loader">
          <Spinner size={SpinnerSize.Large} />
        </div>
      );
    } else if (this.props.iModel.thumbnail) {
      return (
        <div className="preview-container">
          <img
            className="thumbnail"
            id="base64image"
            src={this.props.iModel.thumbnail}
            alt=""
          />
          }<span className="select">{IModelSelect.translate("select")}</span>
        </div>
      );
    } else {
      return (
        <div className="preview-container">
          <span className="icon icon-placeholder" />
          <span className="select">{IModelSelect.translate("select")}</span>
        </div>
      );
    }
  }

  public render() {
    return (
      <div className="imodel-card">
        <div className="imodel-card-content">
          <div className="imodel-card-preview" onClick={this._onCardClicked}>
            {this.renderThumbnail()}
          </div>
          <div className="imodel-card-name">
            <span className="text">{this.props.iModel.name}</span>
          </div>
          {this.props.showDescription && this.renderDescription()}
        </div>
      </div>
    );
  }
}
