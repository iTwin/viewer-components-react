/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { AccessToken } from "@itwin/core-bentley";
import { CalculatedProperty, CalculatedPropertyCreate, CalculatedPropertySingle, CalculatedPropertyUpdate, CustomCalculation, CustomCalculationCreate, CustomCalculationSingle, CustomCalculationUpdate, Group, GroupCreate, GroupProperty, GroupPropertyCreate, GroupPropertySingle, GroupPropertyUpdate, GroupSingle, GroupUpdate, Mapping, MappingCopy, MappingCreate, MappingSingle, MappingUpdate } from "@itwin/insights-client";

export interface IMappingClient {
  /**
   * Gets all Mappings for an iModel.
   *
   * @summary Get Mappings.
   * @param {string} iModelId The iModel Id.
   * @param {string} accessToken OAuth access token with scope `insights:read`.
   * @memberof IMappingClient
   * @see https://developer.bentley.com/apis/insights/operations/get-mappings/
   */
  getMappings(accessToken: AccessToken, iModelId: string): Promise<Mapping[]>;

  /**
   * Gets a Mapping for an iModel.
   *
   * @summary Get Mapping.
   * @param {string} iModelId The iModel Id.
   * @param {string} mappingId The Mapping Id.
   * @param {string} accessToken OAuth access token with scope `insights:read`.
   * @memberof IMappingClient
   * @see https://developer.bentley.com/apis/insights/operations/get-mapping/
   */
  getMapping(accessToken: AccessToken, mappingId: string, iModelId: string): Promise<MappingSingle>;

  /**
   * Creates a Mapping for an iModel.
   *
   * @summary Create Mapping.
   * @param {string} iModelId Id of the iModel for which to create a new Mapping.
   * @param {string} accessToken OAuth access token with scope `insights:modify`.
   * @param {MappingCreate} mapping Request body.
   * @memberof IMappingClient
   * @see https://developer.bentley.com/apis/insights/operations/create-mapping/
   */
  createMapping(accessToken: AccessToken, iModelId: string, mapping: MappingCreate): Promise<MappingSingle>;

  /**
   * Updates a Mapping for an iModel.
   *
   * @summary Update Mapping.
   * @param {string} iModelId The iModel Id.
   * @param {string} mappingId Id of the Mapping to be updated.
   * @param {string} accessToken OAuth access token with scope `insights:modify`.
   * @param {MappingUpdate} mapping Request body.
   * @memberof IMappingClient
   * @see https://developer.bentley.com/apis/insights/operations/update-mapping/
   */
  updateMapping(accessToken: AccessToken, iModelId: string, mappingId: string, mapping: MappingUpdate): Promise<MappingSingle>;

  /**
   * Deletes a Mapping for an iModel.
   *
   * @summary Delete Mapping.
   * @param {string} iModelId The iModel Id.
   * @param {string} mappingId Id of the Mapping to be deleted.
   * @param {string} accessToken OAuth access token with scope `insights:modify`.
   * @memberof IMappingClient
   * @see https://developer.bentley.com/apis/insights/operations/delete-mapping/
   */
  deleteMapping(accessToken: AccessToken, iModelId: string, mappingId: string): Promise<Response>;

  /**
   * Copies a Mapping and all its Groups, GroupProperties, CalculatedProperties, and CustomCalculations to a target iModel.
   *
   * @summary Copy Mapping.
   * @param {string} iModelId Id of the source Mapping's iModel.
   * @param {string} mappingId Id of the source Mapping.
   * @param {string} accessToken OAuth access token with scope `insights:modify`.
   * @param {MappingCopy} mappingCopy Request body.
   * @memberof IMappingClient
   * @see https://developer.bentley.com/apis/insights/operations/copy-mapping/
   */
  copyMapping(accessToken: AccessToken, iModelId: string, mappingId: string, mappingCopy: MappingCopy): Promise<MappingSingle>;

  /**
   * Gets all Groups for a Mapping.
   *
   * @summary Get Groups.
   * @param {string} iModelId The iModel Id.
   * @param {string} mappingId The Mapping Id.
   * @param {string} accessToken OAuth access token with scope `insights:read`.
   * @memberof IMappingClient
   * @see https://developer.bentley.com/apis/insights/operations/get-groups/
   */
  getGroups(accessToken: AccessToken, iModelId: string, mappingId: string): Promise<Group[]>;

  /**
   * Creates a Group for an iModel data source Mapping.
   *
   * @summary Create Group
   * @param {string} iModelId The iModel Id.
   * @param {string} mappingId Id of the Mapping for which to create a new Group.
   * @param {string} accessToken OAuth access token with scope `insights:modify`.
   * @param {GroupCreate} group Request body.
   * @memberof IMappingClient
   * @see https://developer.bentley.com/apis/insights/operations/create-group/
   */
  createGroup(accessToken: AccessToken, iModelId: string, mappingId: string, group: GroupCreate): Promise<GroupSingle>;

  /**
   * Gets a Group for a Mapping.
   *
   * @summary Get Group.
   * @param {string} iModelId The iModel Id.
   * @param {string} mappingId The Mapping Id.
   * @param {string} groupId The Group Id.
   * @param {string} accessToken OAuth access token with scope `insights:read`.
   * @memberof IMappingClient
   * @see https://developer.bentley.com/apis/insights/operations/get-group/
   */
  getGroup(accessToken: AccessToken, iModelId: string, mappingId: string, groupId: string): Promise<GroupSingle>;

  /**
   * Updates a Group for a Mapping.
   *
   * @summary Update Group.
   * @param {string} iModelId Globally Unique Identifier of the target iModel.
   * @param {string} mappingId Globally Unique Identifier of the target Mapping.
   * @param {string} groupId Id of the Group to be updated.
   * @param {string} accessToken OAuth access token with scope `insights:modify`.
   * @param {GroupUpdate} group Request body.
   * @memberof IMappingClient
   * @see https://developer.bentley.com/apis/insights/operations/update-group/
   */
  updateGroup(accessToken: AccessToken, iModelId: string, mappingId: string, groupId: string, group: GroupUpdate): Promise<GroupSingle>;

  /**
   * Deletes a Group for a Mapping.
   *
   * @summary Delete Group.
   * @param {string} iModelId The iModel Id.
   * @param {string} mappingId The Mapping Id.
   * @param {string} groupId Id of the Group to be deleted.
   * @param {string} accessToken OAuth access token with scope `insights:modify`.
   * @memberof IMappingClient
   * @see https://developer.bentley.com/apis/insights/operations/delete-group/
   */
  deleteGroup(accessToken: AccessToken, iModelId: string, mappingId: string, groupId: string): Promise<Response>;

  /**
   * Gets all GroupProperties for a Group.
   *
   * @summary Get GroupProperties.
   * @param {string} iModelId The iModel Id.
   * @param {string} mappingId The Mapping Id.
   * @param {string} groupId The Group Id.
   * @param {string} accessToken OAuth access token with scope `insights:read`.
   * @memberof IMappingClient
   * @see https://developer.bentley.com/apis/insights/operations/get-groupproperties/
   */
  getGroupProperties(accessToken: AccessToken, iModelId: string, mappingId: string, groupId: string): Promise<GroupProperty[]>;

  /**
   * Gets a GroupProperty for a Group.
   *
   * @summary Get GroupProperty.
   * @param {string} iModelId The iModel Id.
   * @param {string} mappingId The Mapping Id.
   * @param {string} groupId The Group Id.
   * @param {string} propertyId The GroupProperty Id.
   * @param {string} accessToken access token with scope `insights:read`.
   * @memberof IMappingClient
   * @see https://developer.bentley.com/apis/insights/operations/get-groupproperty/
   */
  getGroupProperty(accessToken: AccessToken, iModelId: string, mappingId: string, groupId: string, propertyId: string): Promise<GroupPropertySingle>;

  /**
   * Creates a GroupProperty for a Group.
   *
   * @summary Create GroupProperty.
   * @param {string} iModelId The iModel Id.
   * @param {string} mappingId The Mapping Id.
   * @param {string} groupId Id of the Group for which to create a new GroupProperty.
   * @param {string} accessToken OAuth access token with scope `insights:modify`.
   * @param {GroupPropertyCreate} groupProperty Request body.
   * @memberof IMappingClient
   * @see https://developer.bentley.com/apis/insights/operations/create-groupproperty/
   */
  createGroupProperty(accessToken: AccessToken, iModelId: string, mappingId: string, groupId: string, groupProperty: GroupPropertyCreate): Promise<GroupPropertySingle>;

  /**
   * Updates a GroupProperty for a Group.
   *
   * @summary Update GroupProperty.
   * @param {string} iModelId The iModel Id.
   * @param {string} mappingId The Mapping Id.
   * @param {string} groupId The Group Id.
   * @param {string} propertyId Id of the GroupProperty to be updated.
   * @param {string} accessToken OAuth access token with scope `insights:modify`.
   * @param {GroupPropertyUpdate} groupProperty Request body.
   * @memberof IMappingClient
   * @see https://developer.bentley.com/apis/insights/operations/update-groupproperty/
   */
  updateGroupProperty(accessToken: AccessToken, iModelId: string, mappingId: string, groupId: string, groupPropertyId: string, groupProperty: GroupPropertyUpdate): Promise<GroupPropertySingle>;

  /**
   * Deletes a GroupProperty from a Group.
   *
   * @summary Delete GroupProperty.
   * @param {string} iModelId The iModel Id.
   * @param {string} mappingId The Mapping Id.
   * @param {string} groupId The Group Id.
   * @param {string} groupPropertyId Id of the GroupProperty to be deleted.
   * @param {string} accessToken OAuth access token with scope `insights:modify`.
   * @memberof IMappingClient
   * @see https://developer.bentley.com/apis/insights/operations/delete-groupproperty/
   */
  deleteGroupProperty(accessToken: AccessToken, iModelId: string, mappingId: string, groupId: string, groupPropertyId: string): Promise<Response>;

  /**
   * Gets all CalculatedProperties for a Group.
   *
   * @summary Get CalculatedProperties.
   * @param {string} iModelId The iModel Id.
   * @param {string} mappingId The Mapping Id.
   * @param {string} groupId The Group Id.
   * @param {string} accessToken OAuth access token with scope `insights:read`.
   * @memberof IMappingClient
   * @see https://developer.bentley.com/apis/insights/operations/get-calculatedproperties/
   */
  getCalculatedProperties(accessToken: AccessToken, iModelId: string, mappingId: string, groupId: string): Promise<CalculatedProperty[]>;

  /**
   * Gets a CalculatedProperty for a Group.
   *
   * @summary Get CalculatedProperty.
   * @param {string} iModelId The iModel Id.
   * @param {string} mappingId The Mapping Id.
   * @param {string} groupId The Group Id.
   * @param {string} propertyId The CalculatedProperty Id.
   * @param {string} accessToken OAuth access token with scope `insights:read`.
   * @memberof IMappingClient
   * @see https://developer.bentley.com/apis/insights/operations/get-calculatedproperty/
   */
  getCalculatedProperty(accessToken: AccessToken, iModelId: string, mappingId: string, groupId: string, propertyId: string): Promise<CalculatedPropertySingle>;

  /**
   * Creates a CalculatedProperty for a Group.
   *
   * @summary Create CalculatedProperty.
   * @param {string} iModelId The iModel Id.
   * @param {string} mappingId The Mapping Id.
   * @param {string} groupId Id of the Group for which to create a new CalculatedProperty.
   * @param {string} accessToken OAuth access token with scope `insights:modify`.
   * @param {CalculatedPropertyCreate} property Request body.
   * @memberof IMappingClient
   * @see https://developer.bentley.com/apis/insights/operations/create-calculatedproperty/
   */
  createCalculatedProperty(accessToken: AccessToken, iModelId: string, mappingId: string, groupId: string, property: CalculatedPropertyCreate): Promise<CalculatedPropertySingle>;

  /**
   * Updates a CalculatedProperty for a Group.
   *
   * @summary Update CalculatedProperty.
   * @param {string} iModelId The iModel Id.
   * @param {string} mappingId The Mapping Id.
   * @param {string} groupId The Group Id.
   * @param {string} propertyId Id of the CalculatedProperty to be updated.
   * @param {string} accessToken OAuth access token with scope `insights:modify`.
   * @param {CalculatedPropertyUpdate} property Request body.
   * @memberof IMappingClient
   * @see https://developer.bentley.com/apis/insights/operations/update-calculatedproperty/
   */
  updateCalculatedProperty(accessToken: AccessToken, iModelId: string, mappingId: string, groupId: string, propertyId: string, property: CalculatedPropertyUpdate): Promise<CalculatedPropertySingle>;

  /**
   * Deletes a CalculatedProperty from a Group.
   *
   * @summary Delete CalculatedProperty.
   * @param {string} iModelId The iModel Id.
   * @param {string} mappingId The Mapping Id.
   * @param {string} groupId The Group Id.
   * @param {string} propertyId Id of the CalculatedProperty to be deleted.
   * @param {string} accessToken OAuth access token with scope `insights:modify`.
   * @memberof IMappingClient
   * @see https://developer.bentley.com/apis/insights/operations/delete-calculatedproperty/
   */
  deleteCalculatedProperty(accessToken: AccessToken, iModelId: string, mappingId: string, groupId: string, propertyId: string): Promise<Response>;

  /**
   * Gets all CustomCalculations for a Group.
   *
   * @summary Get CustomCalculations.
   * @param {string} iModelId The iModel Id.
   * @param {string} mappingId The Mapping Id.
   * @param {string} groupId The Group Id.
   * @param {string} accessToken OAuth access token with scope `insights:read`.
   * @memberof IMappingClient
   * @see https://developer.bentley.com/apis/insights/operations/get-customcalculations/
   */
  getCustomCalculations(accessToken: AccessToken, iModelId: string, mappingId: string, groupId: string): Promise<CustomCalculation[]>;

  /**
   * Gets a CustomCalculation for a Group.
   *
   * @summary Get CustomCalculation.
   * @param {string} iModelId The iModel Id.
   * @param {string} mappingId The Mapping Id.
   * @param {string} groupId The Group Id.
   * @param {string} propertyId The CustomCalculation Id.
   * @param {string} accessToken OAuth access token with scope `insights:read`.
   * @memberof IMappingClient
   * @see https://developer.bentley.com/apis/insights/operations/get-customcalculation/
   */
  getCustomCalculation(accessToken: AccessToken, iModelId: string, mappingId: string, groupId: string, propertyId: string): Promise<CustomCalculationSingle>;

  /**
   * Creates a CustomCalculation for a Group.
   *
   * @summary Create CustomCalculation.
   * @param {string} iModelId The iModel Id.
   * @param {string} mappingId The Mapping Id.
   * @param {string} groupId Id of the Group for which to create a new CustomCalculation.
   * @param {string} accessToken OAuth access token with scope `insights:modify`.
   * @param {CustomCalculationCreate} property Request body.
   * @memberof IMappingClient
   * @see https://developer.bentley.com/apis/insights/operations/create-customcalculation/
   */
  createCustomCalculation(accessToken: AccessToken, iModelId: string, mappingId: string, groupId: string, property: CustomCalculationCreate): Promise<CustomCalculationSingle>;

  /**
   * Updates a CustomCalculation for a Group.
   *
   * @summary Update CustomCalculation.
   * @param {string} iModelId The iModel Id.
   * @param {string} mappingId The Mapping Id.
   * @param {string} groupId The Group Id.
   * @param {string} propertyId Id of the CustomCalculation to be updated.
   * @param {string} accessToken OAuth access token with scope `insights:modify`.
   * @param {CustomCalculationUpdate} property Request body.
   * @memberof IMappingClient
   * @see https://developer.bentley.com/apis/insights/operations/update-customcalculation/
   */
  updateCustomCalculation(accessToken: AccessToken, iModelId: string, mappingId: string, groupId: string, propertyId: string, property: CustomCalculationUpdate): Promise<CustomCalculationSingle>;

  /**
   * Deletes a CustomCalculation from a Group.
   *
   * @summary Delete CustomCalculation.
   * @param {string} iModelId The iModel Id.
   * @param {string} mappingId The Mapping Id.
   * @param {string} groupId The Group Id.
   * @param {string} propertyId Id of the CustomCalculation to be deleted.
   * @param {string} accessToken OAuth access token with scope `insights:modify`.
   * @memberof IMappingClient
   * @see https://developer.bentley.com/apis/insights/operations/delete-customcalculation/
   */
  deleteCustomCalculation(accessToken: AccessToken, iModelId: string, mappingId: string, groupId: string, propertyId: string): Promise<Response>;
}