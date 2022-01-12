/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import classnames from "classnames";
import { IModelInfo } from "../api/IModelInfoService";
import { IModelCard } from "./IModelCard";
import { ProjectDialog } from "./ProjectDialog";
import { SearchBox } from "@bentley/ui-core";
import { IModelSelect } from "../IModelSelect";
import "./IModelList.scss";

/**
 * Properties for the [[IModelList]] component
 * @public
 */
export interface IModelListProps {
  iModels?: IModelInfo[];
  onIModelSelected?: (iModel: IModelInfo) => void;
}

/**
 * State of the [[IModelList]] component
 * @public
 */
export interface IModelListState {
  showDescriptions: boolean;
  showProjectDialog: boolean;
  currentIModel?: IModelInfo;
  showDetails: boolean;
  filter: string;
}

/**
 * A list of IModelCards (IModels)
 * @public
 */
export class IModelList extends React.Component<IModelListProps, IModelListState> {
  constructor(props?: any, context?: any) {
    super(props, context);

    this.state = {
      showDescriptions: true /* show descriptions by default */,
      showProjectDialog: false,
      showDetails: false,
      filter: "",
    };
  }

  private _onShowThumbnails = () => {
    this.setState({ showDetails: false });
  };

  private _onShowDetails = () => {
    this.setState({ showDetails: true });
  };

  private _onShowProjectsSelector = () => {
    this.setState({ showProjectDialog: true });
  };

  private _onProjectsSelectorClose = () => {
    this.setState({ showProjectDialog: false });
  };

  private _handleSearchValueChanged = (value: string): void => {
    this.setState({ filter: value });
  };

  private _onIModelClick = (iModelInfo: IModelInfo) => {
    if (this.props.onIModelSelected) this.props.onIModelSelected(iModelInfo);
  };

  public componentDidMount() {
    if (this.props.iModels && 1 === this.props.iModels.length) {
      this.setState({ currentIModel: this.props.iModels[0] });
    }
  }

  private getFilteredIModels(): IModelInfo[] {
    let iModels: IModelInfo[] = [];
    if (this.props.iModels) {
      iModels = this.props.iModels!.filter((iModel) =>
        iModel.name.toLowerCase().includes(this.state.filter.toLowerCase())
      );
    }
    return iModels;
  }

  private renderIModel(iModelInfo: IModelInfo) {
    const size = Math.floor(Math.random() * 100).toString() + " MB";
    return (
      <tr key={iModelInfo.wsgId}>
        <td onClick={this._onIModelClick.bind(this, iModelInfo)}>
          <span className="icon icon-placeholder" />
          {iModelInfo.name}
        </td>
        <td onClick={this._onIModelClick.bind(this, iModelInfo)}>{size}</td>
        <td onClick={this._onIModelClick.bind(this, iModelInfo)}>
          {IModelSelect.translate("thisDevice")}
        </td>
        <td onClick={this._onIModelClick.bind(this, iModelInfo)}>
          {iModelInfo.createdDate.toLocaleString()}
        </td>
      </tr>
    );
  }

  private renderThumbnails(iModels: IModelInfo[]) {
    return (
      <div className="imodel-select-cards">
        {iModels.map((iModelInfo: IModelInfo) => (
          <IModelCard
            key={iModelInfo.wsgId}
            iModel={iModelInfo}
            showDescription={this.state.showDescriptions}
            onSelectIModel={this.props.onIModelSelected}
          />
        ))}
      </div>
    );
  }

  private renderList(iModels: IModelInfo[]) {
    return (
      <div className="table-container imodel-select-fade-in-fast">
        <table>
          <thead>
            <tr>
              <th>{IModelSelect.translate("name")}</th>
              <th>{IModelSelect.translate("size")}</th>
              <th>{IModelSelect.translate("location")}</th>
              <th>{IModelSelect.translate("selected")}</th>
            </tr>
          </thead>
          <tbody>
            {iModels.map((iModelInfo: IModelInfo) =>
              this.renderIModel(iModelInfo)
            )}
          </tbody>
        </table>
      </div>
    );
  }

  private renderContent() {
    if (!this.props.iModels || this.props.iModels.length === 0) {
      return (
        <div className="imodel-select-cards-empty">
          <div className="imodel-select-fade-in-fast">
            {IModelSelect.translate("noIModels")}
            <button onClick={this._onShowProjectsSelector}>
              {IModelSelect.translate("searchProjects")}
            </button>
          </div>
          {this.state.showProjectDialog && (
            <ProjectDialog onClose={this._onProjectsSelectorClose} />
          )}
        </div>
      );
    } else {
      const filteredIModels = this.getFilteredIModels();
      return (
        <div>
          {!this.state.showDetails && this.renderThumbnails(filteredIModels)}
          {this.state.showDetails && this.renderList(filteredIModels)}
          {filteredIModels.length === 0 && (
            <span className="imodel-select-cards-noresults imodel-select-fade-in-fast">
              {IModelSelect.translate("noResultsForFilter", {
                searchText: this.state.filter,
              })}
            </span>
          )}
        </div>
      );
    }
  }

  public render() {
    const classThumbnails = classnames(
      "viewtype icon icon-placeholder",
      !this.state.showDetails && "active"
    );
    const classList = classnames(
      "viewtype icon icon-list",
      this.state.showDetails && "active"
    );
    return (
      <div className="imodel-select-cards-content">
        <div className="header">
          <span className="title">{IModelSelect.translate("recent")}</span>
          <SearchBox
            placeholder={IModelSelect.translate("recent")}
            onValueChanged={this._handleSearchValueChanged}
            valueChangedDelay={300}
          />
          <span
            className={classThumbnails}
            title={IModelSelect.translate("thumbnails")}
            onClick={this._onShowThumbnails}
          />
          <span
            className={classList}
            title={IModelSelect.translate("list")}
            onClick={this._onShowDetails}
          />
        </div>
        <div className="imodel-select-cards-scroll-y">{this.renderContent()}</div>
      </div>
    );
  }
}
