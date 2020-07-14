/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import classnames from "classnames";
import { ProjectInfo } from "../api/ProjectInfoService";
import { ProjectDialog } from "./ProjectDialog";
import { Popup } from "@bentley/ui-core";
import { RelativePosition } from "@bentley/ui-abstract";
import { IModelSelect } from "../IModelSelect";
import "./ProjectDropdown.scss";

/**
 * Properties for the [[ProjectDropdown]] component
 * @public
 */
export interface ProjectDropdownProps {
  numVisibleProjects?: number;
  recentProjects?: ProjectInfo[];
  currentProject?: ProjectInfo;
  onProjectClicked: (project: ProjectInfo) => any;
}

/**
 * State of the [[ProjectDropdown]] component
 * @public
 */
export interface ProjectDropdownState {
  isDropdownOpen: boolean;
  showProjectsDialog: boolean;
}

/**
 * List of projects in a dropdown
 * @public
 */
export class ProjectDropdown extends React.Component<ProjectDropdownProps, ProjectDropdownState> {
  private _itemHeight: number = 3.25; // each item (project) height is (n-em) in the dropdown
  private _target: HTMLElement | null = null;

  public static defaultProps: Partial<ProjectDropdownProps> = {
    numVisibleProjects: 5, // default number of visible project to 5
  };

  constructor(props: ProjectDropdownProps, context?: any) {
    super(props, context);

    this.state = { isDropdownOpen: false, showProjectsDialog: false };
  }

  private _onMoreClicked = (_event: React.MouseEvent<HTMLDivElement>) => {
    this.closeDropdown();
    this.setState((_prevState) => ({ showProjectsDialog: true }));
  };

  private _onCloseProjectDialog = () => {
    this.closeDialog();
  };

  private _onItemClick(project: ProjectInfo) {
    this.closeDropdown();
    this.props.onProjectClicked(project);
  }

  private _onProjectSelected = (project: ProjectInfo) => {
    this.closeDialog();
    this.props.onProjectClicked(project);
  };

  private _splitterClicked = (_event: React.MouseEvent<HTMLElement>) => {
    this.setState((_prevState) => ({
      isDropdownOpen: !this.state.isDropdownOpen,
    }));
  };

  private _handleOnOutsideClick = () => {
    this.closeDropdown();
  };

  private closeDropdown() {
    this.setState((_prevState) => ({ isDropdownOpen: false }));
  }

  private closeDialog() {
    this.setState((_prevState) => ({ showProjectsDialog: false }));
  }

  private getProjects(): ProjectInfo[] {
    if (this.props.recentProjects) {
      return this.props.recentProjects;
    }
    return [];
  }

  private renderProjects() {
    const projects: ProjectInfo[] = this.getProjects();
    const ulStyle: React.CSSProperties = {
      height: this.props.numVisibleProjects! * this._itemHeight + "em",
    };
    const liStyle: React.CSSProperties = {
      height: this._itemHeight + "em",
    };

    if (projects && projects.length === 0) {
      return (
        <div className="pp-no-mru" style={ulStyle}>
          <p>{IModelSelect.translate("mruProjHere")}</p>
          {IModelSelect.translate("clickMore")}
        </div>
      );
    } else {
      return (
        <ul style={ulStyle}>
          {projects &&
            projects.map((project: ProjectInfo, i: number) => (
              <li
                style={liStyle}
                key={i}
                onClick={() => this._onItemClick(project)}
              >
                <span className="pp-icon icon icon-placeholder" />
                <div className="pp-details">
                  <span>{project.projectNumber}</span>
                  <span>{project.name}</span>
                </div>
              </li>
            ))}
        </ul>
      );
    }
  }

  private renderDropdown() {
    const liStyle: React.CSSProperties = {
      height: this._itemHeight + "em",
    };
    return (
      <Popup
        isOpen={this.state.isDropdownOpen}
        position={RelativePosition.Bottom}
        onClose={this._handleOnOutsideClick}
        target={this._target}
      >
        <div className="pp-dropdown">
          {this.renderProjects()}
          <div
            className="pp-more"
            style={liStyle}
            onClick={this._onMoreClicked}
          >
            <span className="pp-icon icon icon-search" />
            More
          </div>
        </div>
      </Popup>
    );
  }

  public render() {
    const splitterClassName = classnames(
      "pp-splitter icon icon-chevron-down",
      this.state.isDropdownOpen && "opened"
    );
    return (
      <div className="pp">
        <div
          className="pp-content"
          onClick={this._splitterClicked}
          ref={(element) => {
            this._target = element;
          }}
        >
          <div>
            <span className="number">
              {this.props.currentProject
                ? this.props.currentProject.projectNumber
                : ""}
            </span>
            <span className="name">
              {this.props.currentProject ? this.props.currentProject.name : ""}
            </span>
          </div>
          <span className={splitterClassName} />
        </div>
        <div className="pp-highlight" />
        {this.renderDropdown()}
        {this.state.showProjectsDialog && (
          <ProjectDialog
            onClose={this._onCloseProjectDialog}
            onProjectSelected={this._onProjectSelected}
          />
        )}
      </div>
    );
  }
}
