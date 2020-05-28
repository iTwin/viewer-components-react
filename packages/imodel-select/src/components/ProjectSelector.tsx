/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * Licensed under the MIT License. See LICENSE.md in the project root for license terms.
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { UiFramework, ProjectInfo, ProjectScope } from "@bentley/ui-framework";
import { ProjectDialog } from "./ProjectDialog";
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
export class ProjectSelector extends React.Component<
  ProjectSelectorProps,
  ProjectSelectorState
> {
  constructor(props?: any, context?: any) {
    super(props, context);

    this.state = {
      isLoadingProjects: true,
      prompt: IModelSelect.translate("fechingProjInfo"),
    };
  }

  public componentDidMount() {
    UiFramework.projectServices
      .getProjects(ProjectScope.MostRecentlyUsed, 40, 0)
      .then((projectInfos: ProjectInfo[]) => {
        // tslint:disable-line:no-floating-promises
        this.setState(
          Object.assign({}, this.state, {
            isLoadingProjects: false,
            recentProjects: projectInfos,
          })
        );
      });
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
