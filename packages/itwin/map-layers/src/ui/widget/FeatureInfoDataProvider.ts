/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { PropertyRecord } from "@itwin/appui-abstract";
import { IPropertyDataProvider, PropertyCategory, PropertyData, PropertyDataChangeEvent } from "@itwin/components-react";
import {  IModelApp, MapFeatureInfo, StartOrResume, Tool } from "@itwin/core-frontend";
import { MapFeatureInfoTool, MapFeatureInfoToolData  } from "@itwin/map-layers-formats";

/**
 * Implementation of [IPropertyDataProvider] that uses an associative array.
 * @public
 */

class SimplePropertyData implements PropertyData {
  public label: PropertyRecord = PropertyRecord.fromString("");
  public description?: string;
  public categories: PropertyCategory[] = [];
  public records: { [categoryName: string]: PropertyRecord[] } = {};
}

export class FeatureInfoDataProvider implements IPropertyDataProvider {
  private _detachActiveToolListener: VoidFunction|undefined;
  private readonly _detachToolAdminListener: VoidFunction;

  public onDataChanged = new PropertyDataChangeEvent();
  private _data = new SimplePropertyData();

  constructor( ){
    this._detachToolAdminListener = (IModelApp.toolAdmin.activeToolChanged.addListener(this.handleActiveToolChanged));
  }

  private handleActiveToolChanged = (tool: Tool, _start: StartOrResume) => {

    if (this._detachActiveToolListener) {
      this._detachActiveToolListener();
      this._detachActiveToolListener = undefined;
    }

    if (tool.toolId === MapFeatureInfoTool.toolId) {
      const mapInfoTool = tool as MapFeatureInfoTool;
      this._detachActiveToolListener =  mapInfoTool.onInfoReady.addListener(this.handleOnInfoReadyChanged);
      this._data = new SimplePropertyData();
      this.onDataChanged.raiseEvent();
    }
  };

  private handleOnInfoReadyChanged = (data: MapFeatureInfoToolData) => {
    void this.setInfo(data.mapInfo).then();    // No need to wait for data parsing.

  };

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

    if(mapInfo?.layerInfo) {

      for (const curLayerInfo of mapInfo.layerInfo) {
        const layerCatIdx = this.findCategoryIndexByName(curLayerInfo.layerName);
        let nbRecords = 0;
        const layerCategory = (
          layerCatIdx === -1 ?
            { name: curLayerInfo.layerName, label: curLayerInfo.layerName, expand: true, childCategories: [] }
            : this._data.categories[layerCatIdx]);

        if (curLayerInfo.info && !(curLayerInfo.info instanceof HTMLElement)) {
        // This is not an HTMLElement, so iterate over each sub-layer info
          for (const subLayerInfo of curLayerInfo.info) {
            nbRecords++;
            const subCatIdx = layerCategory.childCategories?.findIndex((testCategory: PropertyCategory) => {
              return testCategory.name === subLayerInfo.subLayerName;
            });
            let subLayerCategory;
            if (subCatIdx === -1) {
              subLayerCategory = { name: subLayerInfo.subLayerName, label: subLayerInfo.subLayerName, expand: true };
              this.addSubCategory(subLayerCategory.name);
              layerCategory.childCategories?.push(subLayerCategory);
            }
            if (subLayerInfo.records) {
              for (const record of subLayerInfo.records) {
              // Always use the string value for now
                this.addProperty(record, subLayerInfo.subLayerName);

              }
            }
          }
          if (layerCatIdx === -1 && nbRecords > 0)
            this.addCategory(layerCategory);

        }
      }
    }
    this.onDataChanged.raiseEvent();
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
