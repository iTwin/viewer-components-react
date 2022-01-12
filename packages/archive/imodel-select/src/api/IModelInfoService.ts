/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { GuidString } from "@bentley/bentleyjs-core";
import { HubIModel, IModelHubClient, IModelQuery } from "@bentley/imodelhub-client";
import { AuthorizedFrontendRequestContext } from "@bentley/imodeljs-frontend";
import { ProjectInfo } from "./ProjectInfoService";

/**
 * iModel properties returned by IModelInfoService
 * @public
 */
export interface IModelInfo {
  name: string;
  description: string;
  wsgId: string;
  createdDate: Date;
  thumbnail?: string;
  projectInfo: ProjectInfo;
  status: string;
}

/**
 * IModelInfoService queries iModelHub for list of iModels
 * @public
 */
export class IModelInfoService {
  private _hubClient: IModelHubClient;

  /** Initialize the iModelHub Api */
  constructor() {
    this._hubClient = new IModelHubClient();
  }

  /** Get all iModels in a project */
  public async getIModels(projectInfo: ProjectInfo, top: number, skip: number): Promise<IModelInfo[]> {
    const requestContext = await AuthorizedFrontendRequestContext.create();

    const iModelInfos: IModelInfo[] = [];
    const queryOptions = new IModelQuery();
    queryOptions.select("*").top(top).skip(skip);
    try {
      const iModels: HubIModel[] = await this._hubClient.iModels.get(requestContext, projectInfo.wsgId, queryOptions);
      for (const thisIModel of iModels) {
        iModelInfos.push(this.createIModelInfo(thisIModel, projectInfo));
      }
    } catch (e) {
      alert(JSON.stringify(e));
      throw e;
    }
    return iModelInfos;
  }

  /** Get the thumbnail for the iModel */
  public async getThumbnail(contextId: string, iModelId: GuidString): Promise<string | undefined> {
    const requestContext = await AuthorizedFrontendRequestContext.create();
    try {
      const pngImage = await this._hubClient.thumbnails.download(requestContext, iModelId, { contextId: contextId!, size: "Small" });
      return pngImage;
    } catch (err) {
      // No image available
    }
    return undefined;
  }

  private createIModelInfo(thisIModel: HubIModel, thisProjectInfo: ProjectInfo): IModelInfo {
    const createdDate: Date = new Date(thisIModel.createdDate!);
    const thisIModelInfo: IModelInfo = {
      name: thisIModel.name!,
      description: thisIModel.description!,
      wsgId: thisIModel.wsgId,
      createdDate,
      projectInfo: thisProjectInfo,
      status: "",
      thumbnail: thisIModel.thumbnail
    };
    return thisIModelInfo;
  }
}
