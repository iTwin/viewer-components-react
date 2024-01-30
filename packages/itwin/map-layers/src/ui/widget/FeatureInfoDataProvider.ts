/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { PropertyRecord } from "@itwin/appui-abstract";
import { IPropertyDataProvider, PropertyCategory, PropertyData, PropertyDataChangeEvent } from "@itwin/components-react";
import { IModelApp, MapFeatureInfo, MapLayerFeatureRecord, MapSubLayerFeatureInfo, StartOrResume, Tool } from "@itwin/core-frontend";
import { MapFeatureInfoTool, MapFeatureInfoToolData } from "@itwin/map-layers-formats";

/**
 * Implementation of [IPropertyDataProvider] that uses an associative  array.
 * @internal
 */

class SimplePropertyData implements PropertyData {
  public label: PropertyRecord = PropertyRecord.fromString("");
  public description?: string;
  public categories: PropertyCategory[] = [];
  public records: { [categoryName: string]: PropertyRecord[] } = {};
}

/**
 * @internal
 */
export class FeatureInfoDataProvider implements IPropertyDataProvider {
  private _detachActiveToolListener: VoidFunction | undefined;
  private readonly _detachToolAdminListener: VoidFunction;

  public onDataChanged = new PropertyDataChangeEvent();
  private _data = new SimplePropertyData();

  constructor() {
    this._detachToolAdminListener = IModelApp.toolAdmin.activeToolChanged.addListener(this.handleActiveToolChanged);
  }

  private handleActiveToolChanged = (tool: Tool, _start: StartOrResume) => {
    if (this._detachActiveToolListener) {
      this._detachActiveToolListener();
      this._detachActiveToolListener = undefined;
    }

    if (tool.toolId === MapFeatureInfoTool.toolId) {
      const mapInfoTool = tool as MapFeatureInfoTool;
      this._detachActiveToolListener = mapInfoTool.onInfoReady.addListener(this.handleOnInfoReadyChanged);
      this._data = new SimplePropertyData();
      this.onDataChanged.raiseEvent();
    }
  };

  private handleOnInfoReadyChanged = (data: MapFeatureInfoToolData) => {
    void this.setInfo(data.mapInfo).then(); // No need to wait for data parsing.
  };

  private generateLayerCategoryName(subLayerName: string) {
    return `_layer_${subLayerName}`;
  }

  private generateSubLayerCategoryName(subLayerName: string) {
    return `_subLayer_${subLayerName}`;
  }

  public onUnload() {
    this._detachToolAdminListener();
    if (this._detachActiveToolListener) {
      this._detachActiveToolListener();
      this._detachActiveToolListener = undefined;
    }
  }

  public get hasRecords() {
    return this._data.categories.length > 0;
  }

  private async setInfo(mapInfo?: MapFeatureInfo) {
    this._data = new SimplePropertyData();

    if (mapInfo?.layerInfos) {
      for (const curLayerInfo of mapInfo.layerInfos) {
        const categoryName = this.generateLayerCategoryName(curLayerInfo.layerName);
        const layerCatIdx = this.findCategoryIndexByName(categoryName);
        let nbRecords = 0;

        const layerCategory =
          layerCatIdx === -1 ? { name: categoryName, label: curLayerInfo.layerName, expand: true, childCategories: [] } : this._data.categories[layerCatIdx];

        if (curLayerInfo.subLayerInfos) {
          for (const subLayerInfo of curLayerInfo.subLayerInfos) {
            this.addSubLayerCategory(subLayerInfo, layerCategory);

            // Add every feature records for this sub-layer
            for (const feature of subLayerInfo.features) {
              nbRecords++;
              for (const attribute of feature.attributes) {
                // Always use the string value for now
                this.addProperty(MapLayerFeatureRecord.createRecordFromAttribute(attribute), this.generateSubLayerCategoryName(subLayerInfo.subLayerName));
              }
            }
          }
          if (layerCatIdx === -1 && nbRecords > 0) this.addCategory(layerCategory);
        }
      }
    }

    this.onDataChanged.raiseEvent();
  }

  public addSubLayerCategory(subLayerInfo: MapSubLayerFeatureInfo, layerCategory: PropertyCategory) {
    const subLayerName = this.generateSubLayerCategoryName(subLayerInfo.subLayerName);
    const subCatIdx = layerCategory.childCategories?.findIndex((testCategory: PropertyCategory) => {
      return testCategory.name === subLayerName;
    });

    let subLayerCategory;
    if (subCatIdx === -1) {
      subLayerCategory = { name: subLayerName, label: subLayerInfo.subLayerName, expand: true };
      this.addSubCategory(subLayerName);
      layerCategory.childCategories?.push(subLayerCategory);
    }
  }
  public addSubCategory(categoryName: string) {
    this._data.records[categoryName] = [];
  }

  public addCategory(category: PropertyCategory): number {
    const categoryIdx = this._data.categories.push(category) - 1;
    this._data.records[this._data.categories[categoryIdx].name] = [];
    return categoryIdx;
  }

  public findCategoryIndex(category: PropertyCategory): number {
    const index = this._data.categories.findIndex((testCategory: PropertyCategory) => {
      return testCategory.name === category.name;
    });
    return index;
  }
  public findCategoryIndexByName(name: string): number {
    const index = this._data.categories.findIndex((testCategory: PropertyCategory) => {
      return testCategory.name === name;
    });
    return index;
  }

  public addProperty(propertyRecord: PropertyRecord, categoryName: string): void {
    const idx = this._data.records[categoryName].findIndex((prop) => prop.property.name === propertyRecord.property.name);
    if (idx === -1) {
      this._data.records[categoryName].push(propertyRecord);
    } else {
      this._data.records[categoryName][idx].isMerged = true;
      this._data.records[categoryName][idx].isReadonly = true;
    }
  }

  public removeProperty(propertyRecord: PropertyRecord, categoryIdx: number): boolean {
    const index = this._data.records[this._data.categories[categoryIdx].name].findIndex((record: PropertyRecord) => {
      return record === propertyRecord;
    });

    let result = false;

    if (index >= 0) {
      this._data.records[this._data.categories[categoryIdx].name].splice(index, 1);
      this.onDataChanged.raiseEvent();
      result = true;
    }
    return result;
  }

  public replaceProperty(propertyRecord: PropertyRecord, categoryIdx: number, newRecord: PropertyRecord): boolean {
    const index = this._data.records[this._data.categories[categoryIdx].name].findIndex((record: PropertyRecord) => {
      return record === propertyRecord;
    });

    let result = false;

    if (index >= 0) {
      this._data.records[this._data.categories[categoryIdx].name].splice(index, 1, newRecord);
      result = true;
    }
    return result;
  }

  public async getData(): Promise<PropertyData> {
    return this._data;
  }
}
