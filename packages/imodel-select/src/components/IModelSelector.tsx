/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import classnames from "classnames";
import { IModelApp } from "@bentley/imodeljs-frontend";
import {
  UiFramework,
  IModelInfo,
  ProjectInfo,
  ProjectScope,
  Backstage,
} from "@bentley/ui-framework";
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { FrontendAuthorizationClient } from "@bentley/frontend-authorization-client";
import { Button, ButtonSize, ButtonType } from "@bentley/ui-core";
import { IModelList } from "./IModelList";
import { ProjectDropdown } from "./ProjectDropdown";
import { BlockingPrompt } from "./BlockingPrompt";
import { IModelSelect } from "../IModelSelect";
import "./IModelSelector.scss";
import "./Common.scss";

/**
 * Properties for the [[IModelSelect]] component
 * @public
 */
export interface IModelSelectorProps {
  onIModelSelected?: (iModelInfo: IModelInfo) => void;
  initialIModels?: IModelInfo[];
  showSignoutButton?: boolean;
  showBackstageButton?: boolean;
}

/**
 * State of the [[IModelSelector]] component
 * @public
 */
export interface IModelSelectorState {
  isLoadingProjects: boolean;
  isLoadingiModels: boolean;
  recentProjects?: ProjectInfo[];
  iModels?: IModelInfo[];
  currentProject?: ProjectInfo;
  prompt: string;
}

/**
 * Open component showing projects and iModels
 * @public
 */
export class IModelSelector extends React.Component<
  IModelSelectorProps,
  IModelSelectorState
> {
  private _isMounted = false;

  constructor(props?: any, context?: any) {
    super(props, context);

    this.state = {
      isLoadingProjects: true,
      isLoadingiModels: false,
      prompt: IModelSelect.translate("fechingProjInfo"),
    };
  }

  public componentDidMount() {
    this._isMounted = true;
    if (this.props.initialIModels && this.props.initialIModels.length > 0) {
      this.setState(
        Object.assign({}, this.state, {
          isLoadingProjects: false,
          isLoadingiModels: false,
          currentProject: this.props.initialIModels[0].projectInfo,
          iModels: this.props.initialIModels,
        })
      );
      return;
    }

    UiFramework.projectServices
      .getProjects(ProjectScope.MostRecentlyUsed, 100, 0)
      .then((projectInfos: ProjectInfo[]) => {
        // tslint:disable-line:no-floating-promises
        if (this._isMounted)
          this.setState(
            Object.assign({}, this.state, {
              isLoadingProjects: false,
              isLoadingiModels: true,
              recentProjects: projectInfos,
            })
          );
        if (projectInfos.length > 0) this._selectProject(projectInfos[0]);
      });
  }

  public componentWillUnmount() {
    this._isMounted = false;
  }

  // retrieves the IModels for a Project. Called when first mounted and when a new Project is selected.
  private async startRetrieveIModels(project: ProjectInfo) {
    this.setState(
      Object.assign({}, this.state, {
        prompt: IModelSelect.translate("fechingModelInfo"),
        isLoadingiModels: true,
        isLoadingProjects: false,
        currentProject: project,
      })
    );
    let iModelInfos: IModelInfo[] = [];
    try {
      iModelInfos = await UiFramework.iModelServices.getIModels(
        project,
        1000,
        0
      );
    } catch (e) {
      console.log(e.message);
    }
    if (this._isMounted)
      this.setState({
        isLoadingiModels: false,
        iModels: iModelInfos,
      });
  }

  private _selectProject(project: ProjectInfo) {
    this.startRetrieveIModels(project); // tslint:disable-line:no-floating-promises
  }

  private _handleIModelSelected = (iModelInfo: IModelInfo): void => {
    if (this.props.onIModelSelected) this.props.onIModelSelected(iModelInfo);
  };

  private _onClickSignOut = async () => {
    const oidcClient = IModelApp.authorizationClient as FrontendAuthorizationClient;
    oidcClient.signOut(new ClientRequestContext());
  };

  private renderIModels() {
    if (this.state.isLoadingProjects || this.state.isLoadingiModels) {
      return <BlockingPrompt prompt={this.state.prompt} />;
    } else {
      return (
        <IModelList
          iModels={this.state.iModels}
          onIModelSelected={this._handleIModelSelected}
        />
      );
    }
  }

  public render() {
    const contentStyle = classnames("select-content", false);
    return (
      <div className="imodel-select-pane">
        <div className="select-appbar">
          {this.props.showBackstageButton && (
            <div className="backstage-icon">
              <span
                className="icon icon-home"
                onPointerUp={() => Backstage.backstageToggleCommand.execute()}
              />
              {this.props.showSignoutButton && (
                <div>
                  <Button
                    size={ButtonSize.Default}
                    buttonType={ButtonType.Blue}
                    onClick={this._onClickSignOut}
                  >
                    <span>{IModelSelect.translate("signoutButton")}</span>
                  </Button>
                </div>
              )}
            </div>
          )}
          <div className="project-picker-content">
            <span className="projects-label">
              {IModelSelect.translate("projects")}{" "}
            </span>
            <div className="project-picker">
              <ProjectDropdown
                currentProject={this.state.currentProject}
                recentProjects={this.state.recentProjects}
                onProjectClicked={this._selectProject.bind(this)}
              />
            </div>
          </div>
        </div>
        <div className={contentStyle}>{this.renderIModels()}</div>
      </div>
    );
  }
}
