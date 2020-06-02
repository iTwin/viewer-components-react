/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import classnames from "classnames";
import { ProjectScope } from "@bentley/ui-framework";
import { ProjectInfo, ProjectInfoService } from "../api/ProjectInfoService";
import { ProjectTabs, ProjectTab } from "./ProjectTabs";
import { SearchBox, Spinner, SpinnerSize } from "@bentley/ui-core";
import { IModelSelect } from "../IModelSelect";
import "./Common.scss";
import "./ProjectDialog.scss";

/**
 * Properties for the [[ProjectDialog]] component
 * @public
 */
export interface ProjectDialogProps {
  filterType?: ProjectScope;
  onClose: () => void;
  onProjectSelected?: (project: ProjectInfo) => void;
}

/**
 * State of the [[ProjectDialog]] component
 * @public
 */
export interface ProjectDialogState {
  isLoading: boolean;
  projects?: ProjectInfo[];
  activeFilter: ProjectScope;
  filter: string;
}

/**
 * Project picker dialog
 * @public
 */
export class ProjectDialog extends React.Component<ProjectDialogProps, ProjectDialogState> {
  private _isMounted = false;
  private _projectInfoService: ProjectInfoService;

  constructor(props?: any, context?: any) {
    super(props, context);

    this._projectInfoService = new ProjectInfoService();
    this.state = {
      isLoading: true,
      activeFilter: this.props.filterType!,
      filter: "",
    };
  }

  public static defaultProps: Partial<ProjectDialogProps> = {
    filterType: ProjectScope.MostRecentlyUsed,
  };

  // called when this component is first loaded
  public async componentDidMount() {
    this._isMounted = true;
    this.getRecentProjects(this.props.filterType!);
  }

  public componentWillUnmount() {
    this._isMounted = false;
  }

  private getRecentProjects(projectScope: ProjectScope) {
    this.setState({
      isLoading: true,
      projects: undefined,
      activeFilter: projectScope,
    });
    this._projectInfoService
      .getProjects(projectScope, 40, 0)
      .then((projectInfos: ProjectInfo[]) => {
        if (this._isMounted)
          this.setState({ isLoading: false, projects: projectInfos });
      });
  }

  private _onClose = () => {
    if (this.props.onClose) this.props.onClose();
  };

  private _onMyProjectsClicked = () => {
    this.getRecentProjects(ProjectScope.Invited);
  };

  private _onFavoritesClicked = () => {
    this.getRecentProjects(ProjectScope.Favorites);
  };

  private _onRecentClicked = () => {
    this.getRecentProjects(ProjectScope.MostRecentlyUsed);
  };

  private _onSearchClicked = () => {
    this.setState({ projects: undefined, activeFilter: ProjectScope.All });
    // this.getRecentProjects(ProjectScope.All);
  };

  private _onProjectSelected = (projectInfo: ProjectInfo) => {
    if (this.props.onProjectSelected) {
      this.props.onProjectSelected(projectInfo);
    }
  };

  private _handleSearchValueChanged = (value: string): void => {
    if (!value || value.trim().length === 0) {
      this.setState({
        isLoading: false,
        projects: undefined,
        activeFilter: ProjectScope.All,
        filter: value,
      });
    } else {
      const filter = "Name like '" + value + "'";
      this.setState({
        isLoading: true,
        projects: undefined,
        activeFilter: ProjectScope.All,
      });
      this._projectInfoService
        .getProjects(ProjectScope.All, 40, 0, filter)
        .then((projectInfos: ProjectInfo[]) => {
          // tslint:disable-line:no-floating-promises
          this.setState({
            isLoading: false,
            projects: projectInfos,
            filter: value,
          });
        });
    }
  };

  private getNoProjectsPrompt(): string {
    switch (this.state.activeFilter) {
      case ProjectScope.Favorites:
        return IModelSelect.translate("noFavorites");
      case ProjectScope.MostRecentlyUsed:
        return IModelSelect.translate("noRecents");
      case ProjectScope.Invited:
        return IModelSelect.translate("noProjAssigned");
      default:
        if (this.state.filter.trim() !== "")
          return IModelSelect.translate("noMatches", {
            filter: this.state.filter,
          });
        else return IModelSelect.translate("searchAllProjects");
    }
  }

  private getTabIndexFromProjectScope() {
    if (this.props.filterType === ProjectScope.Invited) return 0;
    if (this.props.filterType === ProjectScope.Favorites) return 1;
    if (this.props.filterType === ProjectScope.MostRecentlyUsed) return 2;
    else return 3;
  }

  private renderProject(project: ProjectInfo) {
    return (
      <tr
        key={project.wsgId}
        onClick={this._onProjectSelected.bind(this, project)}
      >
        <td>{project.projectNumber}</td>
        <td>{project.name}</td>
        <td />
        <td />
      </tr>
    );
  }

  public render() {
    const searchClassName = classnames(
      "tabs-searchbox",
      this.state.activeFilter !== ProjectScope.All && "hidden"
    );
    return (
      <div className="imodel-select-modal-background imodel-select-fade-in-fast">
        <div className="imodel-select-projects imodel-select-animate">
          <div className="header">
            <h3>{IModelSelect.translate("selectProject")}</h3>
            <span
              onClick={this._onClose.bind(this)}
              className="icon icon-close"
              title={IModelSelect.translate("close")}
            />
          </div>
          <div className="imodel-select-projects-content">
            <div className="tabs-container">
              <ProjectTabs defaultTab={this.getTabIndexFromProjectScope()}>
                <ProjectTab
                  label={IModelSelect.translate("myProjects")}
                  icon="icon-manager"
                  onTabClicked={this._onMyProjectsClicked}
                />
                <ProjectTab
                  label={IModelSelect.translate("favorites")}
                  icon="icon-star"
                  onTabClicked={this._onFavoritesClicked}
                />
                <ProjectTab
                  label={IModelSelect.translate("recent")}
                  icon="icon-history"
                  onTabClicked={this._onRecentClicked}
                />
                <ProjectTab
                  label={IModelSelect.translate("search")}
                  icon="icon-search"
                  onTabClicked={this._onSearchClicked}
                />
              </ProjectTabs>
              <div className={searchClassName}>
                <SearchBox
                  placeholder={IModelSelect.translate("searchDotDotDot")}
                  onValueChanged={this._handleSearchValueChanged}
                  valueChangedDelay={400}
                />
              </div>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>{IModelSelect.translate("projectNumber")}</th>
                    <th>{IModelSelect.translate("projectName")}</th>
                    <th>{IModelSelect.translate("assetType")}</th>
                    <th>{IModelSelect.translate("location")}</th>
                  </tr>
                </thead>
                <tbody>
                  {this.state.projects &&
                    this.state.projects.length > 0 &&
                    this.state.projects.map((project: ProjectInfo) =>
                      this.renderProject(project)
                    )}
                </tbody>
              </table>
              {this.state.isLoading && (
                <div className="imodel-select-projects-loading">
                  <Spinner size={SpinnerSize.Large} />
                </div>
              )}
              {!this.state.isLoading &&
                (!this.state.projects || this.state.projects.length === 0) && (
                  <div className="imodel-select-projects-none">
                    {this.getNoProjectsPrompt()}
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>
    );
  }
}
