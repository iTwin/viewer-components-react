/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelApp } from "@itwin/core-frontend";

import type {
  CalculatedPropertyCreateReportingAPI,
  CalculatedPropertyUpdateReportingAPI,
  CustomCalculationCreateReportingAPI,
  CustomCalculationUpdateReportingAPI,
  GroupCreateReportingAPI,
  GroupPropertyCreateReportingAPI,
  GroupPropertyUpdateReportingAPI,
  GroupUpdateReportingAPI,
  MappingCollectionReportingAPI,
  MappingCopyReportingAPI,
  MappingCreateReportingAPI,
  MappingReportingAPI,
  MappingUpdateReportingAPI} from "./generated/api";
import {
  BASE_PATH,
  MappingsApi,
} from "./generated/api";

const ACCEPT = "application/vnd.bentley.itwin-platform.v1+json";

export const getUrlPrefix = () => {
  const prefix = process.env.IMJS_URL_PREFIX;
  switch (prefix ?? "") {
    case "dev-":
      return "dev";
    case "qa-":
      return "qa";
    default:
      return "";
  }
};

const prefixUrl = (baseUrl?: string, prefix?: string) => {
  if (prefix && baseUrl) {
    return baseUrl.replace("api.bentley.com", `${prefix}api.bentley.com`);
  }
  return baseUrl;
};

// To be only used within Viewer
class ReportingClient {
  private _mappingsApi: MappingsApi;
  constructor() {
    const baseUrl = prefixUrl(BASE_PATH, process.env.IMJS_URL_PREFIX);
    this._mappingsApi = new MappingsApi(undefined, baseUrl);
  }

  public async getMappings(iModelId: string) {
    const mappings: Array<MappingReportingAPI> = [];

    const _accessToken =
      (await IModelApp.authorizationClient?.getAccessToken()) ?? "";

    let response: MappingCollectionReportingAPI;
    let continuationToken: string | undefined;

    do {
      response = await this._mappingsApi.getMappings(
        iModelId,
        _accessToken,
        undefined,
        continuationToken,
        ACCEPT
      );
      response.mappings && mappings.push(...response.mappings);
      if (!response._links?.next?.href) {
        continue;
      }
      const url = new URL(response._links?.next?.href);
      continuationToken =
        url.searchParams.get("$continuationToken") ?? undefined;
    } while (response._links?.next?.href);

    return mappings;
  }

  public async createMapping(
    iModelId: string,
    mapping: MappingCreateReportingAPI
  ) {
    const _accessToken =
      (await IModelApp.authorizationClient?.getAccessToken()) ?? "";
    return this._mappingsApi.createMapping(iModelId, _accessToken, mapping);
  }

  public async updateMapping(
    iModelId: string,
    mappingId: string,
    mapping: MappingUpdateReportingAPI
  ) {
    const _accessToken =
      (await IModelApp.authorizationClient?.getAccessToken()) ?? "";
    return this._mappingsApi.updateMapping(
      iModelId,
      mappingId,
      _accessToken,
      mapping
    );
  }

  public async deleteMapping(iModelId: string, mappingId: string) {
    const _accessToken =
      (await IModelApp.authorizationClient?.getAccessToken()) ?? "";
    return this._mappingsApi.deleteMapping(iModelId, mappingId, _accessToken);
  }

  public async copyMapping(
    iModelId: string,
    mappingId: string,
    mappingCopy: MappingCopyReportingAPI
  ) {
    const _accessToken =
      (await IModelApp.authorizationClient?.getAccessToken()) ?? "";
    return this._mappingsApi.copyMapping(
      iModelId,
      mappingId,
      _accessToken,
      mappingCopy
    );
  }

  public async getGroups(iModelId: string, mappingId: string) {
    const _accessToken =
      (await IModelApp.authorizationClient?.getAccessToken()) ?? "";
    return this._mappingsApi.getGroups(iModelId, mappingId, _accessToken);
  }

  public async createGroup(
    iModelId: string,
    mappingId: string,
    group: GroupCreateReportingAPI
  ) {
    const _accessToken =
      (await IModelApp.authorizationClient?.getAccessToken()) ?? "";
    return this._mappingsApi.createGroup(
      iModelId,
      mappingId,
      _accessToken,
      group
    );
  }

  public async getGroup(iModelId: string, mappingId: string, groupId: string) {
    const _accessToken =
      (await IModelApp.authorizationClient?.getAccessToken()) ?? "";
    return this._mappingsApi.getGroup(
      iModelId,
      mappingId,
      groupId,
      _accessToken
    );
  }

  public async updateGroup(
    iModelId: string,
    mappingId: string,
    groupId: string,
    group: GroupUpdateReportingAPI
  ) {
    const _accessToken =
      (await IModelApp.authorizationClient?.getAccessToken()) ?? "";
    return this._mappingsApi.updateGroup(
      iModelId,
      mappingId,
      groupId,
      _accessToken,
      group
    );
  }

  public async deleteGroup(
    iModelId: string,
    mappingId: string,
    groupId: string
  ) {
    const _accessToken =
      (await IModelApp.authorizationClient?.getAccessToken()) ?? "";
    return this._mappingsApi.deleteGroup(
      iModelId,
      mappingId,
      groupId,
      _accessToken
    );
  }

  public async getGroupProperties(
    iModelId: string,
    mappingId: string,
    groupId: string
  ) {
    const _accessToken =
      (await IModelApp.authorizationClient?.getAccessToken()) ?? "";
    return this._mappingsApi.getGroupproperties(
      iModelId,
      mappingId,
      groupId,
      _accessToken
    );
  }

  public async getGroupProperty(
    iModelId: string,
    mappingId: string,
    groupId: string,
    propertyId: string
  ) {
    const _accessToken =
      (await IModelApp.authorizationClient?.getAccessToken()) ?? "";
    return this._mappingsApi.getGroupproperty(
      iModelId,
      mappingId,
      groupId,
      propertyId,
      _accessToken
    );
  }

  public async createGroupProperty(
    iModelId: string,
    mappingId: string,
    groupId: string,
    groupProperty: GroupPropertyCreateReportingAPI
  ) {
    const _accessToken =
      (await IModelApp.authorizationClient?.getAccessToken()) ?? "";
    return this._mappingsApi.createGroupproperty(
      iModelId,
      mappingId,
      groupId,
      _accessToken,
      groupProperty
    );
  }

  public async updateGroupProperty(
    iModelId: string,
    mappingId: string,
    groupId: string,
    groupPropertyId: string,
    groupProperty: GroupPropertyUpdateReportingAPI
  ) {
    const _accessToken =
      (await IModelApp.authorizationClient?.getAccessToken()) ?? "";
    return this._mappingsApi.updateGroupproperty(
      iModelId,
      mappingId,
      groupId,
      groupPropertyId,
      _accessToken,
      groupProperty
    );
  }

  public async deleteGroupProperty(
    iModelId: string,
    mappingId: string,
    groupId: string,
    groupPropertyId: string
  ) {
    const _accessToken =
      (await IModelApp.authorizationClient?.getAccessToken()) ?? "";
    return this._mappingsApi.deleteGroupproperty(
      iModelId,
      mappingId,
      groupId,
      groupPropertyId,
      _accessToken
    );
  }

  public async getCalculatedProperties(
    iModelId: string,
    mappingId: string,
    groupId: string
  ) {
    const _accessToken =
      (await IModelApp.authorizationClient?.getAccessToken()) ?? "";
    return this._mappingsApi.getCalculatedproperties(
      iModelId,
      mappingId,
      groupId,
      _accessToken
    );
  }

  public async getCalculatedProperty(
    iModelId: string,
    mappingId: string,
    groupId: string,
    propertyId: string
  ) {
    const _accessToken =
      (await IModelApp.authorizationClient?.getAccessToken()) ?? "";
    return this._mappingsApi.getCalculatedproperty(
      iModelId,
      mappingId,
      groupId,
      propertyId,
      _accessToken
    );
  }

  public async createCalculatedProperty(
    iModelId: string,
    mappingId: string,
    groupId: string,
    property: CalculatedPropertyCreateReportingAPI
  ) {
    const _accessToken =
      (await IModelApp.authorizationClient?.getAccessToken()) ?? "";
    return this._mappingsApi.createCalculatedproperty(
      iModelId,
      mappingId,
      groupId,
      _accessToken,
      property
    );
  }

  public async updateCalculatedProperty(
    iModelId: string,
    mappingId: string,
    groupId: string,
    propertyId: string,
    property: CalculatedPropertyUpdateReportingAPI
  ) {
    const _accessToken =
      (await IModelApp.authorizationClient?.getAccessToken()) ?? "";
    return this._mappingsApi.updateCalculatedproperty(
      iModelId,
      mappingId,
      groupId,
      propertyId,
      _accessToken,
      property
    );
  }

  public async deleteCalculatedProperty(
    iModelId: string,
    mappingId: string,
    groupId: string,
    propertyId: string
  ) {
    const _accessToken =
      (await IModelApp.authorizationClient?.getAccessToken()) ?? "";
    return this._mappingsApi.deleteCalculatedproperty(
      iModelId,
      mappingId,
      groupId,
      propertyId,
      _accessToken
    );
  }

  public async getCustomCalculations(
    iModelId: string,
    mappingId: string,
    groupId: string
  ) {
    const _accessToken =
      (await IModelApp.authorizationClient?.getAccessToken()) ?? "";
    return this._mappingsApi.getCustomcalculations(
      iModelId,
      mappingId,
      groupId,
      _accessToken
    );
  }

  public async getCustomCalculation(
    iModelId: string,
    mappingId: string,
    groupId: string,
    propertyId: string
  ) {
    const _accessToken =
      (await IModelApp.authorizationClient?.getAccessToken()) ?? "";
    return this._mappingsApi.getCustomcalculation(
      iModelId,
      mappingId,
      groupId,
      propertyId,
      _accessToken
    );
  }

  public async createCustomCalculation(
    iModelId: string,
    mappingId: string,
    groupId: string,
    property: CustomCalculationCreateReportingAPI
  ) {
    const _accessToken =
      (await IModelApp.authorizationClient?.getAccessToken()) ?? "";
    return this._mappingsApi.createCustomcalculation(
      iModelId,
      mappingId,
      groupId,
      _accessToken,
      property
    );
  }

  public async updateCustomCalculation(
    iModelId: string,
    mappingId: string,
    groupId: string,
    propertyId: string,
    property: CustomCalculationUpdateReportingAPI
  ) {
    const _accessToken =
      (await IModelApp.authorizationClient?.getAccessToken()) ?? "";
    return this._mappingsApi.updateCustomcalculation(
      iModelId,
      mappingId,
      groupId,
      propertyId,
      _accessToken,
      property
    );
  }

  public async deleteCustomCalculation(
    iModelId: string,
    mappingId: string,
    groupId: string,
    propertyId: string
  ) {
    const _accessToken =
      (await IModelApp.authorizationClient?.getAccessToken()) ?? "";
    return this._mappingsApi.deleteCustomcalculation(
      iModelId,
      mappingId,
      groupId,
      propertyId,
      _accessToken
    );
  }
}

// Global singleton
const reportingClientApi = new ReportingClient();

export { reportingClientApi };
