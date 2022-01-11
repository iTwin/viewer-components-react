/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelApp } from '@bentley/imodeljs-frontend';
import { AuthorizationClient } from '@bentley/itwin-client';
import { getConfig } from '../config';

import {
  BASE_PATH,
  CalculatedPropertyCreateReportingAPI,
  CalculatedPropertyUpdateReportingAPI,
  GroupCreateReportingAPI,
  GroupPropertyCreateReportingAPI,
  GroupPropertyUpdateReportingAPI,
  GroupUpdateReportingAPI,
  MappingCreateReportingAPI,
  MappingsApi,
  MappingUpdateReportingAPI,
} from './generated';

const ACCEPT = 'application/vnd.bentley.itwin-platform.v1+json';

const getUrlPrefix = () => {
  const config = getConfig();
  console.log(config);
  switch (config.buddi?.region) {
    case '101':
    case '103':
      return 'dev';
    case '102':
      return 'qa';
    default:
      return '';
  }
};

const prefixUrl = (baseUrl?: string, prefix?: string) => {
  if (prefix && baseUrl) {
    return baseUrl.replace('api.bentley.com', `${prefix}-api.bentley.com`);
  }
  return baseUrl;
};

//To be only used within Viewer
class ReportingClient {
  private _mappingsApi: MappingsApi;
  constructor() {
    const baseUrl = prefixUrl(BASE_PATH, getUrlPrefix());
    this._mappingsApi = new MappingsApi(undefined, baseUrl);
  }

  public async getMappings(iModelId: string) {
    const _accessToken = await (
      IModelApp.authorizationClient as AuthorizationClient
    ).getAccessToken();
    return this._mappingsApi.getMappings(
      iModelId,
      _accessToken.toTokenString(),
      undefined,
      undefined,
      ACCEPT,
    );
  }

  public async createMapping(
    iModelId: string,
    mapping: MappingCreateReportingAPI,
  ) {
    const _accessToken = await (
      IModelApp.authorizationClient as AuthorizationClient
    ).getAccessToken();
    return this._mappingsApi.createMapping(
      iModelId,
      _accessToken.toTokenString(),
      mapping,
    );
  }

  public async updateMapping(
    iModelId: string,
    mappingId: string,
    mapping: MappingUpdateReportingAPI,
  ) {
    const _accessToken = await (
      IModelApp.authorizationClient as AuthorizationClient
    ).getAccessToken();
    return this._mappingsApi.updateMapping(
      iModelId,
      mappingId,
      _accessToken.toTokenString(),
      mapping,
    );
  }

  public async deleteMapping(iModelId: string, mappingId: string) {
    const _accessToken = await (
      IModelApp.authorizationClient as AuthorizationClient
    ).getAccessToken();
    return this._mappingsApi.deleteMapping(
      iModelId,
      mappingId,
      _accessToken.toTokenString(),
    );
  }

  public async getGroups(iModelId: string, mappingId: string) {
    const _accessToken = await (
      IModelApp.authorizationClient as AuthorizationClient
    ).getAccessToken();
    return this._mappingsApi.getGroups(
      iModelId,
      mappingId,
      _accessToken.toTokenString(),
    );
  }

  public async createGroup(
    iModelId: string,
    mappingId: string,
    group: GroupCreateReportingAPI,
  ) {
    const _accessToken = await (
      IModelApp.authorizationClient as AuthorizationClient
    ).getAccessToken();
    return this._mappingsApi.createGroup(
      iModelId,
      mappingId,
      _accessToken.toTokenString(),
      group,
    );
  }

  public async getGroup(iModelId: string, mappingId: string, groupId: string) {
    const _accessToken = await (
      IModelApp.authorizationClient as AuthorizationClient
    ).getAccessToken();
    return this._mappingsApi.getGroup(
      iModelId,
      mappingId,
      groupId,
      _accessToken.toTokenString(),
    );
  }

  public async updateGroup(
    iModelId: string,
    mappingId: string,
    groupId: string,
    group: GroupUpdateReportingAPI,
  ) {
    const _accessToken = await (
      IModelApp.authorizationClient as AuthorizationClient
    ).getAccessToken();
    return this._mappingsApi.updateGroup(
      iModelId,
      mappingId,
      groupId,
      _accessToken.toTokenString(),
      group,
    );
  }

  public async deleteGroup(
    iModelId: string,
    mappingId: string,
    groupId: string,
  ) {
    const _accessToken = await (
      IModelApp.authorizationClient as AuthorizationClient
    ).getAccessToken();
    return this._mappingsApi.deleteGroup(
      iModelId,
      mappingId,
      groupId,
      _accessToken.toTokenString(),
    );
  }

  public async getGroupProperties(
    iModelId: string,
    mappingId: string,
    groupId: string,
  ) {
    const _accessToken = await (
      IModelApp.authorizationClient as AuthorizationClient
    ).getAccessToken();
    return this._mappingsApi.getGroupproperties(
      iModelId,
      mappingId,
      groupId,
      _accessToken.toTokenString(),
    );
  }

  public async getGroupProperty(
    iModelId: string,
    mappingId: string,
    groupId: string,
    propertyId: string,
  ) {
    const _accessToken = await (
      IModelApp.authorizationClient as AuthorizationClient
    ).getAccessToken();
    return this._mappingsApi.getGroupproperty(
      iModelId,
      mappingId,
      groupId,
      propertyId,
      _accessToken.toTokenString(),
    );
  }

  public async createGroupProperty(
    iModelId: string,
    mappingId: string,
    groupId: string,
    groupProperty: GroupPropertyCreateReportingAPI,
  ) {
    const _accessToken = await (
      IModelApp.authorizationClient as AuthorizationClient
    ).getAccessToken();
    return this._mappingsApi.createGroupproperty(
      iModelId,
      mappingId,
      groupId,
      _accessToken.toTokenString(),
      groupProperty,
    );
  }

  public async updateGroupProperty(
    iModelId: string,
    mappingId: string,
    groupId: string,
    groupPropertyId: string,
    groupProperty: GroupPropertyUpdateReportingAPI,
  ) {
    const _accessToken = await (
      IModelApp.authorizationClient as AuthorizationClient
    ).getAccessToken();
    return this._mappingsApi.updateGroupproperty(
      iModelId,
      mappingId,
      groupId,
      groupPropertyId,
      _accessToken.toTokenString(),
      groupProperty,
    );
  }

  public async deleteGroupProperty(
    iModelId: string,
    mappingId: string,
    groupId: string,
    groupPropertyId: string,
  ) {
    const _accessToken = await (
      IModelApp.authorizationClient as AuthorizationClient
    ).getAccessToken();
    return this._mappingsApi.deleteGroupproperty(
      iModelId,
      mappingId,
      groupId,
      groupPropertyId,
      _accessToken.toTokenString(),
    );
  }

  public async getCalculatedProperties(
    iModelId: string,
    mappingId: string,
    groupId: string,
  ) {
    const _accessToken = await (
      IModelApp.authorizationClient as AuthorizationClient
    ).getAccessToken();
    return this._mappingsApi.getCalculatedproperties(
      iModelId,
      mappingId,
      groupId,
      _accessToken.toTokenString(),
    );
  }

  public async getCalculatedProperty(
    iModelId: string,
    mappingId: string,
    groupId: string,
    propertyId: string,
  ) {
    const _accessToken = await (
      IModelApp.authorizationClient as AuthorizationClient
    ).getAccessToken();
    return this._mappingsApi.getCalculatedproperty(
      iModelId,
      mappingId,
      groupId,
      propertyId,
      _accessToken.toTokenString(),
    );
  }

  public async createCalculatedProperty(
    iModelId: string,
    mappingId: string,
    groupId: string,
    property: CalculatedPropertyCreateReportingAPI,
  ) {
    const _accessToken = await (
      IModelApp.authorizationClient as AuthorizationClient
    ).getAccessToken();
    return this._mappingsApi.createCalculatedproperty(
      iModelId,
      mappingId,
      groupId,
      _accessToken.toTokenString(),
      property,
    );
  }

  public async updateCalculatedProperty(
    iModelId: string,
    mappingId: string,
    groupId: string,
    propertyId: string,
    property: CalculatedPropertyUpdateReportingAPI,
  ) {
    const _accessToken = await (
      IModelApp.authorizationClient as AuthorizationClient
    ).getAccessToken();
    return this._mappingsApi.updateCalculatedproperty(
      iModelId,
      mappingId,
      groupId,
      propertyId,
      _accessToken.toTokenString(),
      property,
    );
  }

  public async deleteCalculatedProperty(
    iModelId: string,
    mappingId: string,
    groupId: string,
    propertyId: string,
  ) {
    const _accessToken = await (
      IModelApp.authorizationClient as AuthorizationClient
    ).getAccessToken();
    return this._mappingsApi.deleteCalculatedproperty(
      iModelId,
      mappingId,
      groupId,
      propertyId,
      _accessToken.toTokenString(),
    );
  }
}

//Global singleton
const reportingClientApi = new ReportingClient();

export { reportingClientApi };
