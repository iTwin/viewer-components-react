/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { cloneDeep as _cloneDeep, get as _get, isFinite as _isFinite } from "lodash";

import { AccessLevel } from "../enums/AccessLevelEnum";

/**
 * Generic model for all objects returns from the database
 * Assumes "id" is stored as a top-level prop, while other props
 * are stored in the "props" field
 */
export abstract class DataObject {

  protected readonly id: string;
  protected readonly props: { [key: string]: any } = {};

  protected accessLevel: AccessLevel = AccessLevel.READ_ONLY;

  constructor(id: string) {
    this.id = id;
  }

  public getId(): string {
    return this.id;
  }

  public getEncodedId(): string {
    return encodeURIComponent(this.getId());
  }

  public getProp(prop: string): any {
    return _cloneDeep(this.props[prop]);
  }

  public setProp(prop: string, value: any): void {
    this.props[prop] = _cloneDeep(value);
  }

  public getPropInSettings(prop: string): any {
    const SETTINGS = this.getProp("SETTINGS");
    return SETTINGS ? SETTINGS[prop] : undefined;
  }

  public setPropInSettings(prop: string, value: any): void {
    const SETTINGS = this.getProp("SETTINGS") || {};
    SETTINGS[prop] = value;
    this.setProp("SETTINGS", SETTINGS);
  }

  public getName(): string {
    return this.props.NAME;
  }

  public setName(name: string): void {
    this.setProp("NAME", name);
  }

  public getNotes(): string {
    return this.props.NOTES;
  }

  public setNotes(notes: string): void {
    this.setProp("NOTES", notes);
  }

  public getLocation(): {lat: number, lng: number} | undefined {
    if (
      _isFinite(_get(this.props, "LOCATION.coordinates[0]")) &&
      _isFinite(_get(this.props, "LOCATION.coordinates[1]"))
    ) {
      return {lat: this.props.LOCATION.coordinates[1], lng: this.props.LOCATION.coordinates[0]};
    } else {
      return undefined;
    }
  }

  public getElevation(): number | undefined {
    if (_isFinite(_get(this.props, "LOCATION.coordinates[2]"))) {
      return this.props.LOCATION.coordinates[2];
    } else {
      return undefined;
    }
  }

  public getCreationDate(): string {
    return this.props.CREATION_DATE;
  }

  public getAccessLevel(): AccessLevel {
    return this.accessLevel;
  }

  public setAccessLevel(accessLevel: AccessLevel): void {
    this.accessLevel = accessLevel;
  }

  public isOwner(): boolean {
    return this.getAccessLevel() === AccessLevel.OWNER || this.getAccessLevel() === AccessLevel.CREATOR;
  }

  public canEdit(): boolean {
    return this.isOwner() || this.getAccessLevel() === AccessLevel.READ_WRITE;
  }

}
