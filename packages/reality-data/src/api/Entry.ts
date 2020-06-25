/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Id64String } from "@bentley/bentleyjs-core";
import { SpatialClassificationProps } from "@bentley/imodeljs-common";

/** A reality model object */
export class RealityModel {
  constructor(public name: string, public url: string) {}
}

/** An attached reality model */
export class AttachedRealityModel extends RealityModel {
  constructor(public id: Id64String, public name: string, url: string) {
    super(name, url);
  }
}

/** An object representing a RealityData entry in the model */
export interface Entry {
  model: RealityModel;
  url: string;
  name: string;
  description: string;
  enabled: boolean;
  group: string;
  size: string;
  attached?: boolean;
  classifiers?: SpatialClassificationProps.Properties[]; // need for ContextRealityModelProps
}
