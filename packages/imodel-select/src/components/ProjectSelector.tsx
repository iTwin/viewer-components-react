/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { ProjectScope } from "@bentley/ui-framework";
import { ProjectDialog } from "./ProjectDialog";
import { ProjectInfo, ProjectInfoService } from "../api/ProjectInfoService";
import { IModelSelect } from "../IModelSelect";
import "./ProjectDialog.scss";

/** Properties for the [[ProjectSelector]] component */
export interface ProjectSelectorProps {
  onProjectSelected?: (projectInfo: ProjectInfo) => void;
  onClose?: () => void;
}

interface ProjectSelectorState {
  isLoadingProjects: boolean;
  recentProjects?: ProjectInfo[];
  currentProject?: ProjectInfo;
  prompt: string;
}

/**
 * Open component showing projects
 */
export class ProjectSelector extends React.Component<ProjectSelectorProps, ProjectSelectorState> {
  private _isMounted = false;
  private _projectInfoService: ProjectInfoService;

  constructor(props?: any, context?: any) {
    super(props, context);

    this._projectInfoService = new ProjectInfoService();
    this.state = {
      isLoadingProjects: true,
      prompt: IModelSelect.translate("fechingProjInfo"),
    };
  }

  public componentDidMount() {
    this._isMounted = true;
    this._projectInfoService
      .getProjects(ProjectScope.MostRecentlyUsed, 40, 0)
      .then((projectInfos: ProjectInfo[]) => {
        // tslint:disable-line:no-floating-promises
        if (this._isMounted)
          this.setState(
            Object.assign({}, this.state, {
              isLoadingProjects: false,
              recentProjects: projectInfos,
            })
          );
      });
  }

  public componentWillUnmount() {
    this._isMounted = false;
  }

  private _onProjectSelected = (project: ProjectInfo) => {
    if (this.props.onProjectSelected) this.props.onProjectSelected(project);
  };

  private _onCloseProjectDialog = () => {
    if (this.props.onClose) this.props.onClose();
  };

  public render() {
    return (
      <div>
        {
          <ProjectDialog
            onClose={this._onCloseProjectDialog}
            onProjectSelected={this._onProjectSelected}
          />
        }
      </div>
    );
  }
}
