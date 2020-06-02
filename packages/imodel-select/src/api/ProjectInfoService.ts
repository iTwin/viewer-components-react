/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ContextRegistryClient, ContextRegistryRequestQueryOptions, Project } from "@bentley/context-registry-client";
import { ProjectScope } from "@bentley/ui-framework";
import { AuthorizedFrontendRequestContext } from "@bentley/imodeljs-frontend";

/**
 * Project properties returned by ProjectInfoService
 * @public
 */
export interface ProjectInfo {
  name: string;
  projectNumber: string;
  wsgId: string;
}

/**
 * Implementation of ProjectInfo interface
 * @public
 */
class ProjectInfoImpl implements ProjectInfo {

  constructor(public name: string, public projectNumber: string, public wsgId: string) {
  }
}

/**
 * ProjectInfoService queries iModelHub for list of projects
 * @public
 */
export class ProjectInfoService {
  private _connectClient: ContextRegistryClient;

  constructor() {
    this._connectClient = new ContextRegistryClient();
  }

  /** Get projects accessible to the user based on various scopes/criteria */
  public async getProjects(projectScope: ProjectScope, top: number, skip: number, filter?: string): Promise<ProjectInfo[]> {
    const requestContext = await AuthorizedFrontendRequestContext.create();

    const queryOptions: ContextRegistryRequestQueryOptions = {
      $select: "*", // TODO: Get Name,Number,AssetType to work
      $top: top,
      $skip: skip,
      $filter: filter,
    };

    let projectList: Project[];
    try {
      if (projectScope === ProjectScope.Invited) {
        projectList = await this._connectClient.getInvitedProjects(requestContext, queryOptions);
      } else {
        if (projectScope === ProjectScope.Favorites) {
          queryOptions.isFavorite = true;
        } else if (projectScope === ProjectScope.MostRecentlyUsed) {
          queryOptions.isMRU = true;
        }
        projectList = await this._connectClient.getProjects(requestContext, queryOptions);
      }
    } catch (e) {
      alert(JSON.stringify(e));
      throw e;
    }

    const projects: ProjectInfo[] = [];
    for (const thisProject of projectList) {
      projects.push(this.createProjectInfo(thisProject));
    }
    return projects;
  }

  private createProjectInfo(thisProject: Project): ProjectInfo {
    const thisProjectInfo: ProjectInfo = new ProjectInfoImpl(thisProject.name ? thisProject.name : "", thisProject.number ? thisProject.number : "", thisProject.wsgId);
    return thisProjectInfo;
  }
}
