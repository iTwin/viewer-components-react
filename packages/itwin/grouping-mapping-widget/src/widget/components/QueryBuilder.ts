/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { PresentationPropertyDataProvider } from "@itwin/presentation-components";
import type { InstanceKey, PropertiesField } from "@itwin/presentation-common";
import type {
  Primitives,
  PropertyRecord,
} from "@itwin/appui-abstract";
import {
  PropertyValueFormat,
} from "@itwin/appui-abstract";
import "core-js/features/string/virtual";

export interface Query {
  classes: QueryClass[];
}

export interface QueryClass {
  // schemaName.className
  className: string;
  properties: QueryProperty[];
  isAspect: boolean;
  isRelational?: boolean;
}

export interface QueryProperty {
  name: string;
  value: Primitives.Value;
  needsQuote: boolean;
}

/* This class is to build adaptive and dynamic query for find similar property selections */
export class QueryBuilder {
  public static readonly MULTI_ASPECT_PRIMARY_CLASS =
    "BisCore:ElementOwnsMultiAspects";
  public static readonly UNIQUE_ASPECT_PRIMARY_CLASS =
    "BisCore:ElementOwnsUniqueAspect";
  public static readonly DEFAULT_DOUBLE_PRECISION = 4;

  public dataProvider: PresentationPropertyDataProvider | undefined;
  public query: Query | undefined;

  /**
   *
   */
  constructor(provider: PresentationPropertyDataProvider | undefined) {
    this.dataProvider = provider;
  }

  public async addProperty(prop: PropertyRecord) {
    // TODO: only handle primitive properties now
    if (
      prop.value?.valueFormat !== PropertyValueFormat.Primitive ||
      prop.value.value === undefined
    ) {
      return;
    }

    function replaceAll(str: string, match: string, replacement: string) {
      return str.split(match).join(replacement);
    }
    // if property value has single quote, escape
    if (
      (typeof prop.value.value === "string" ||
        prop.value.value instanceof String) &&
      String(prop.value.value).indexOf("'") >= 0
    ) {
      prop.value.value = replaceAll(prop.value.value.toString(), "'", "''");
    }

    const propertyField = (await this.dataProvider?.getFieldByPropertyRecord(
      prop,
    )) as PropertiesField;
    if (propertyField === undefined) {
      return;
    }

    // get the special cases
    const isNavigation: boolean =
      prop.property.typename.toLowerCase() === "navigation";

    const isAspect: boolean =
      propertyField.parent?.pathToPrimaryClass.find(
        (a) =>
          a.relationshipInfo?.name ===
          QueryBuilder.UNIQUE_ASPECT_PRIMARY_CLASS ||
          a.relationshipInfo?.name === QueryBuilder.MULTI_ASPECT_PRIMARY_CLASS,
      ) !== undefined;

    const className =
      propertyField.properties[0].property.classInfo.name.replace(":", ".");
    const propertyName = isNavigation
      ? `${propertyField.properties[0].property.name}.id`
      : propertyField.properties[0].property.name;
    const propertyValue = isNavigation
      ? (prop.value.value as InstanceKey).id
      : prop.value.value;

    // console.log(prop);
    // console.log(propertyField);

    if (
      !isAspect &&
      propertyField.parent?.pathToPrimaryClass &&
      propertyField.parent?.pathToPrimaryClass.length > 0
    ) {
      this.addRelatedProperty(
        propertyField,
        propertyName,
        propertyValue,
        isAspect,
      );
    } else {
      this.addPropertyToQuery(
        className,
        propertyName,
        propertyValue,
        isAspect,
        this._needsQuote(propertyField),
        false,
      );
    }
  }

  private _needsQuote(propertyField: PropertiesField): boolean {
    // list of property types that need quote around property value
    if (propertyField.type.typeName.toLowerCase() === "string") {
      return true;
    }
    if (propertyField.type.typeName.toLowerCase() === "uri") {
      return true;
    }
    return false;
  }

  public addRelatedProperty(
    propertyField: PropertiesField,
    propertyName: string,
    propertyValue: Primitives.Value,
    isAspect: boolean,
  ) {
    const paths = [...(propertyField.parent?.pathToPrimaryClass ?? [])];
    paths.reverse().forEach((path) => {
      const sourceClassName = path.sourceClassInfo?.name.replace(":", ".");
      const targetClassName = path.targetClassInfo?.name.replace(":", ".");
      const relClassName = path.relationshipInfo?.name.replace(":", ".");
      if (!path.isForwardRelationship) {
        this.addPropertyToQuery(
          targetClassName,
          `ECInstanceId`,
          `${relClassName}.SourceECInstanceId`,
          isAspect,
          false,
          true,
        );
        this.addPropertyToQuery(
          relClassName,
          `TargetECInstanceId`,
          `${sourceClassName}.ECInstanceId`,
          isAspect,
          false,
          true,
        );
        if (
          path.sourceClassInfo?.name ===
          propertyField.parent?.contentClassInfo.name
        ) {
          this.addPropertyToQuery(
            sourceClassName,
            propertyName,
            propertyValue,
            isAspect,
            this._needsQuote(propertyField),
            true,
          );
        } else {
          this.addPropertyToQuery(
            sourceClassName,
            `ECInstanceId`,
            `${relClassName}.TargetECInstanceId`,
            isAspect,
            false,
            true,
          );
        }
      } else {
        this.addPropertyToQuery(
          targetClassName,
          `ECInstanceId`,
          `${relClassName}.TargetECInstanceId`,
          isAspect,
          false,
          true,
        );
        this.addPropertyToQuery(
          relClassName,
          `SourceECInstanceId`,
          `${sourceClassName}.ECInstanceId`,
          isAspect,
          false,
          true,
        );
        if (
          path.sourceClassInfo?.name ===
          propertyField.parent?.contentClassInfo.name
        ) {
          this.addPropertyToQuery(
            sourceClassName,
            propertyName,
            propertyValue,
            isAspect,
            this._needsQuote(propertyField),
            true,
          );
        } else {
          this.addPropertyToQuery(
            sourceClassName,
            `ECInstanceId`,
            `${relClassName}.SourceECInstanceId`,
            isAspect,
            false,
            true,
          );
        }
      }
    });
  }

  public addPropertyToQuery(
    className: string,
    propertyName: string,
    propertyValue: Primitives.Value,
    isAspect: boolean,
    needsQuote: boolean,
    isRelational?: boolean,
  ) {
    if (this.query === undefined || this.query.classes.length === 0) {
      this.query = {
        classes: [
          {
            className,
            isAspect,
            isRelational,
            properties: [
              {
                name: propertyName,
                value: propertyValue,
                needsQuote,
              },
            ],
          },
        ],
      };
      return;
    }

    const foundClass = this.query.classes.find(
      (c) => c.className === className,
    );
    if (foundClass) {
      foundClass.isRelational = isRelational;
      if (!foundClass.properties.find((x) => x.name === propertyName)) {
        foundClass.properties.push({
          name: propertyName,
          value: propertyValue,
          needsQuote,
        });
      }
    } else {
      this.query.classes.push({
        className,
        isRelational,
        properties: [
          {
            name: propertyName,
            value: propertyValue,
            needsQuote,
          },
        ],
        isAspect,
      });
    }
  }

  public async removeProperty(prop: PropertyRecord) {
    if (this.query === undefined || this.query.classes.length === 0) {
      return;
    }

    const propertyField = (await this.dataProvider?.getFieldByPropertyRecord(
      prop,
    )) as PropertiesField;
    if (propertyField === undefined) {
      return;
    }

    const isAspect: boolean =
      propertyField.parent?.pathToPrimaryClass.find(
        (a) =>
          a.relationshipInfo?.name ===
          QueryBuilder.UNIQUE_ASPECT_PRIMARY_CLASS ||
          a.relationshipInfo?.name === QueryBuilder.MULTI_ASPECT_PRIMARY_CLASS,
      ) !== undefined;

    const isNavigation: boolean =
      prop.property.typename.toLowerCase() === "navigation";

    const propertyName = isNavigation
      ? `${propertyField.properties[0].property.name}.id`
      : propertyField.properties[0].property.name;
    const className =
      propertyField.properties[0].property.classInfo.name.replace(":", ".");

    if (
      !isAspect &&
      propertyField.parent?.pathToPrimaryClass &&
      propertyField.parent?.pathToPrimaryClass.length > 0
    ) {
      this.removeRelatedProperty(propertyField, propertyName);
    } else {
      this.removePropertyFromQuery(className, propertyName);
    }
  }

  public removeRelatedProperty(
    propertyField: PropertiesField,
    propertyName: string,
  ) {
    const paths = [...(propertyField.parent?.pathToPrimaryClass ?? [])];
    paths.reverse().forEach((path) => {
      const sourceClassName = path.sourceClassInfo?.name.replace(":", ".");
      const targetClassName = path.targetClassInfo?.name.replace(":", ".");
      const relClassName = path.relationshipInfo?.name.replace(":", ".");
      if (!path.isForwardRelationship) {
        this.removePropertyFromQuery(targetClassName, `ECInstanceId`);
        this.removePropertyFromQuery(relClassName, `TargetECInstanceId`);
        if (
          path.sourceClassInfo?.name ===
          propertyField.parent?.contentClassInfo.name
        ) {
          this.removePropertyFromQuery(sourceClassName, propertyName);
        } else {
          this.removePropertyFromQuery(sourceClassName, `ECInstanceId`);
        }
      } else {
        this.removePropertyFromQuery(targetClassName, `ECInstanceId`);
        this.removePropertyFromQuery(relClassName, `SourceECInstanceId`);
        if (
          path.sourceClassInfo?.name ===
          propertyField.parent?.contentClassInfo.name
        ) {
          this.removePropertyFromQuery(sourceClassName, propertyName);
        } else {
          this.removePropertyFromQuery(sourceClassName, `ECInstanceId`);
        }
      }
    });
  }

  public removePropertyFromQuery(className: string, propertyName: string) {
    const foundClass = this.query?.classes.find(
      (c) => c.className === className,
    );
    if (foundClass) {
      const foundPropertyIndex = foundClass.properties.findIndex(
        (p) => p.name === propertyName,
      );
      if (foundPropertyIndex > -1) {
        foundClass.properties.splice(foundPropertyIndex, 1);
      }
      if (foundClass.properties.length === 0) {
        // remove the entire class if all properties are removed
        const foundClassIndex =
          this.query?.classes.findIndex((c) => c.className === className) ?? -1;
        if (foundClassIndex > -1) {
          this.query?.classes.splice(foundClassIndex, 1);
        }
      }
    }
  }

  public buildQueryString() {
    if (this.query === undefined || this.query.classes.length === 0) {
      return "";
    }

    const baseClass = this.query.classes[0];
    const baseClassName = baseClass.className;
    const baseIdName = baseClass.isAspect
      ? `${baseClassName}.Element.id`
      : `${baseClassName}.ECInstanceId`;

    let queryString = `SELECT ${baseIdName}${baseClass.isAspect ? " ECInstanceId" : ""} FROM ${baseClassName}`;

    if (this.query.classes.length > 1) {
      for (let i = 1; i < this.query.classes.length; i++) {
        const joinClass = this.query.classes[i];
        const joinClassName = joinClass.className;
        const joinIdName = joinClass.isAspect
          ? `${joinClassName}.Element.id`
          : `${joinClassName}.ECInstanceId`;

        if (joinClass.isRelational) {
          queryString += ` JOIN ${joinClassName}`;
          if (joinClass.properties.length > 0) {
            if (joinClass.properties[0].needsQuote) {
              queryString += ` ON ${joinClassName}.${joinClass.properties[0].name}='${joinClass.properties[0].value}'`;
            } else {
              if (this._isFloat(joinClass.properties[0].value)) {
                queryString += ` ON ROUND(${joinClassName}.${joinClass.properties[0].name}, `;
                queryString += `${QueryBuilder.DEFAULT_DOUBLE_PRECISION})=`;
                queryString += `${Number(joinClass.properties[0].value).toFixed(
                  QueryBuilder.DEFAULT_DOUBLE_PRECISION,
                )}`;
              } else {
                queryString += ` ON ${joinClassName}.${joinClass.properties[0].name}=${joinClass.properties[0].value}`;
              }
            }
          }
          // when base is regular property, link base to first joined relational property
          if (!baseClass.isRelational && i === 1) {
            queryString += ` AND ${joinIdName} = ${baseIdName}`;
          }
          for (const property of joinClass.properties) {
            if (property.needsQuote) {
              queryString += ` AND ${joinClassName}.${property.name}='${property.value}'`;
            } else {
              if (this._isFloat(property.value)) {
                queryString += ` AND ROUND(${joinClassName}.${property.name}, `;
                queryString += `${QueryBuilder.DEFAULT_DOUBLE_PRECISION})=`;
                queryString += `${Number(property.value).toFixed(
                  QueryBuilder.DEFAULT_DOUBLE_PRECISION,
                )}`;
              } else {
                queryString += ` AND ${joinClassName}.${property.name}=${property.value}`;
              }
            }
          }
        } else {
          queryString += ` JOIN ${joinClassName} ON ${joinIdName} = ${baseIdName}`;
          for (const property of joinClass.properties) {
            if (property.needsQuote) {
              queryString += ` AND ${joinClassName}.${property.name}='${property.value}'`;
            } else {
              if (this._isFloat(property.value)) {
                queryString += ` AND ROUND(${joinClassName}.${property.name}, `;
                queryString += `${QueryBuilder.DEFAULT_DOUBLE_PRECISION})=`;
                queryString += `${Number(property.value).toFixed(
                  QueryBuilder.DEFAULT_DOUBLE_PRECISION,
                )}`;
              } else {
                queryString += ` AND ${joinClassName}.${property.name}=${property.value}`;
              }
            }
          }
        }
      }
    }

    const properties = baseClass.properties;
    if (properties.length > 0) {
      if (properties[0].needsQuote) {
        queryString += ` WHERE ${baseClassName}.${properties[0].name}='${properties[0].value}'`;
      } else {
        if (this._isFloat(properties[0].value)) {
          queryString += ` WHERE ROUND(${baseClassName}.${properties[0].name}, `;
          queryString += `${QueryBuilder.DEFAULT_DOUBLE_PRECISION})=`;
          queryString += `${Number(properties[0].value).toFixed(
            QueryBuilder.DEFAULT_DOUBLE_PRECISION,
          )}`;
        } else {
          queryString += ` WHERE ${baseClassName}.${properties[0].name}=${properties[0].value}`;
        }
      }
      if (properties.length > 1) {
        for (let i = 1; i < properties.length; i++) {
          if (properties[i].needsQuote) {
            queryString += ` AND ${baseClassName}.${properties[i].name}='${properties[i].value}'`;
          } else {
            if (this._isFloat(properties[i].value)) {
              queryString += ` AND ROUND(${baseClassName}.${properties[i].name}, `;
              queryString += `${QueryBuilder.DEFAULT_DOUBLE_PRECISION})=`;
              queryString += `${Number(properties[i].value).toFixed(
                QueryBuilder.DEFAULT_DOUBLE_PRECISION,
              )}`;
            } else {
              queryString += ` AND ${baseClassName}.${properties[i].name}=${properties[i].value}`;
            }
          }
        }
      }
    }

    // console.log(queryString);
    // console.log(this.query);
    return queryString;
  }

  private _isFloat(n: unknown): boolean {
    return Number(n) === n && n % 1 !== 0;
  }
}
