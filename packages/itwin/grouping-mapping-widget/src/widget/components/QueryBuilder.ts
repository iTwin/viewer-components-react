/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { PresentationPropertyDataProvider } from "@itwin/presentation-components";
import type {
  InstanceKey,
  PropertiesField,
} from "@itwin/presentation-common";
import type { Primitives, PropertyRecord } from "@itwin/appui-abstract";
import { PropertyValueFormat } from "@itwin/appui-abstract";
import { toaster } from "@itwin/itwinui-react";

export interface Query {
  unions: QueryUnion[];
}

export interface QueryUnion {
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
  isCategory: boolean;
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

  private isCategory(propertyField: PropertiesField): boolean {
    const classInfo =
      propertyField.properties[0].property.navigationPropertyInfo?.classInfo;
    return classInfo?.name === "BisCore:GeometricElement3dIsInCategory";
  }

  public async addProperty(prop: PropertyRecord): Promise<boolean> {
    // TODO: only handle primitive properties now
    if (prop.value?.valueFormat !== PropertyValueFormat.Primitive) {
      toaster.warning("Only primitive types are supported for now.");
      return false;
    }
    if (prop.value.value === undefined) {
      return false;
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

    // get descriptor
    const descriptor = await this.dataProvider?.getContentDescriptor();
    const propertyField = (await this.dataProvider?.getFieldByPropertyRecord(
      prop,
    )) as PropertiesField;

    if (!descriptor || !propertyField) {
      toaster.negative(
        "Error. Failed to fetch field for this property record.",
      );
      return false;
    }

    // get the special cases
    const isNavigation: boolean =
      prop.property.typename.toLowerCase() === "navigation";
    const isCategory: boolean = isNavigation && this.isCategory(propertyField);
    const isAspect: boolean =
      propertyField.parent?.pathToPrimaryClass.find(
        (a) =>
          a.relationshipInfo?.name ===
          QueryBuilder.UNIQUE_ASPECT_PRIMARY_CLASS ||
          a.relationshipInfo?.name === QueryBuilder.MULTI_ASPECT_PRIMARY_CLASS,
      ) !== undefined;

    for (let i = 0; i < propertyField.properties.length; i++) {
      const className = propertyField.properties[i].property.classInfo.name.replace(":", ".");
      const propertyName = isNavigation
        ? isCategory
          ? `${propertyField.properties[i].property.name}.CodeValue`
          : `${propertyField.properties[i].property.name}.id`
        : propertyField.properties[i].property.name;
      const propertyValue = isNavigation
        ? isCategory
          ? prop.value.displayValue ?? ""
          : (prop.value.value as InstanceKey).id
        : prop.value.value;

      if (
        !isAspect &&
        propertyField.parent?.pathToPrimaryClass &&
        propertyField.parent?.pathToPrimaryClass.length > 0
      ) {
        this.addRelatedProperty(
          i,
          propertyField,
          propertyName,
          propertyValue,
          isAspect,
        );
      } else {
        this.addPropertyToQuery(
          i,
          className,
          propertyName,
          propertyValue,
          isAspect,
          this._needsQuote(propertyField),
          isCategory,
          false,
        );
      }
    }
    return true;
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
    unionIndex: number,
    propertyField: PropertiesField,
    propertyName: string,
    propertyValue: Primitives.Value,
    isAspect: boolean,
  ) {
    const addRelatedPropertyToQuery = this.addRelatedPropertyToQuery(unionIndex, isAspect);

    const paths = [...(propertyField.parent?.pathToPrimaryClass ?? [])];
    paths.reverse().forEach((path) => {
      const sourceClassName = path.sourceClassInfo?.name.replace(":", ".");
      const targetClassName = path.targetClassInfo?.name.replace(":", ".");
      const relClassName = path.relationshipInfo?.name.replace(":", ".");

      const relPropertyName = path.isForwardRelationship
        ? `SourceECInstanceId`
        : `TargetECInstanceId`;

      const relPropertyValue = path.isForwardRelationship
        ? `${relClassName}.TargetECInstanceId`
        : `${relClassName}.SourceECInstanceId`;

      addRelatedPropertyToQuery(
        targetClassName,
        `ECInstanceId`,
        relPropertyValue,
        false
      );

      addRelatedPropertyToQuery(
        relClassName,
        relPropertyName,
        `${sourceClassName}.ECInstanceId`,
        false
      );

      if (path.sourceClassInfo?.name
        === propertyField.parent?.contentClassInfo.name) {
        addRelatedPropertyToQuery(
          sourceClassName,
          propertyName,
          propertyValue,
          this._needsQuote(propertyField)
        );
      }
    });
  }

  private addRelatedPropertyToQuery = (
    unionIndex: number,
    isAspect: boolean,
  ) => (
    className: string,
    propertyName: string,
    propertyValue: Primitives.Value,
    needsQuote: boolean,
  ) => this.addPropertyToQuery(unionIndex, className, propertyName, propertyValue, isAspect, needsQuote, false, true);

  private addPropertyToQuery(
    unionIndex: number,
    className: string,
    propertyName: string,
    propertyValue: Primitives.Value,
    isAspect: boolean,
    needsQuote: boolean,
    isCategory: boolean,
    isRelational?: boolean,
  ) {
    if (this.query === undefined || this.query.unions.length === 0) {
      this.query = { unions: [] };
    }

    const queryProperty: QueryProperty = {
      name: propertyName,
      value: propertyValue,
      needsQuote,
      isCategory,
    };

    const queryClass: QueryClass = {
      className,
      isAspect,
      isRelational,
      properties: [
        queryProperty,
      ],
    };

    if (this.query.unions.length <= unionIndex) {
      this.query.unions.push({
        classes: [
          queryClass,
        ],
      });
      return;
    }

    const foundClass = this.query.unions[unionIndex].classes.find(
      (c) => c.className === className,
    );
    if (foundClass) {
      foundClass.isRelational = isRelational;
      if (!foundClass.properties.find((x) => x.name === propertyName)) {
        foundClass.properties.push(queryProperty);
      }
    } else {
      this.query.unions[unionIndex].classes.push(queryClass);
    }
  }

  public async removeProperty(prop: PropertyRecord) {
    if (this.query === undefined || this.query.unions.length === 0) {
      return;
    }
    if (
      this.query.unions.length === 1 &&
      this.query.unions[0].classes.length === 0
    ) {
      return;
    }

    const descriptor = await this.dataProvider?.getContentDescriptor();
    const propertyField = (await this.dataProvider?.getFieldByPropertyRecord(
      prop,
    )) as PropertiesField;
    if (!descriptor || !propertyField) {
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
    const isCategory: boolean = isNavigation && this.isCategory(propertyField);

    for (let i = 0; i < propertyField.properties.length; i++) {
      const propertyName = isNavigation
        ? isCategory
          ? `${propertyField.properties[i].property.name}.CodeValue`
          : `${propertyField.properties[i].property.name}.id`
        : propertyField.properties[i].property.name;
      const className = propertyField.properties[
        i
      ].property.classInfo.name.replace(":", ".");

      if (
        !isAspect &&
        propertyField.parent?.pathToPrimaryClass &&
        propertyField.parent?.pathToPrimaryClass.length > 0
      ) {
        this.removeRelatedProperty(i, propertyField, propertyName);
      } else {
        this.removePropertyFromQuery(i, className, propertyName);
      }
    }
  }

  private removeRelatedProperty(
    unionIndex: number,
    propertyField: PropertiesField,
    propertyName: string,
  ) {
    const paths = [...(propertyField.parent?.pathToPrimaryClass ?? [])];
    paths.reverse().forEach((path) => {
      const sourceClassName = path.sourceClassInfo?.name.replace(":", ".");
      const targetClassName = path.targetClassInfo?.name.replace(":", ".");
      const relClassName = path.relationshipInfo?.name.replace(":", ".");
      this.removePropertyFromQuery(
        unionIndex,
        targetClassName,
        `ECInstanceId`,
      );

      const relPropertyName = path.isForwardRelationship ? `SourceECInstanceId` : `TargetECInstanceId`;
      this.removePropertyFromQuery(
        unionIndex,
        relClassName,
        relPropertyName,
      );

      if (
        path.sourceClassInfo?.name ===
        propertyField.parent?.contentClassInfo.name
      ) {
        this.removePropertyFromQuery(
          unionIndex,
          sourceClassName,
          propertyName,
        );
      }
    });
  }

  private removePropertyFromQuery(
    unionIndex: number,
    className: string,
    propertyName: string,
  ) {
    const foundClass = this.query?.unions[unionIndex].classes.find(
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
          this.query?.unions[unionIndex].classes.findIndex(
            (c) => c.className === className,
          ) ?? -1;
        if (foundClassIndex > -1) {
          this.query?.unions[unionIndex].classes.splice(foundClassIndex, 1);
        }
      }
    }
  }

  public buildQueryString() {
    if (
      this.query === undefined ||
      this.query.unions.length === 0 ||
      this.query.unions[0].classes.length === 0
    ) {
      return "";
    }

    const querySegments: string[] = [];
    for (const union of this.query.unions) {
      const baseClass = union.classes[0];
      const baseClassName = baseClass.className;
      const baseIdName = baseClass.isAspect
        ? `${baseClassName}.Element.id`
        : `${baseClassName}.ECInstanceId`;

      const selectSegment = `SELECT ${baseIdName}${baseClass.isAspect ? " ECInstanceId" : ""} FROM ${baseClassName}`;
      querySegments.push(selectSegment);

      if (union.classes.length > 1) {
        for (let i = 1; i < union.classes.length; i++) {
          const joinClass = union.classes[i];
          const joinClassName = joinClass.className;
          const joinIdName = joinClass.isAspect
            ? `${joinClassName}.Element.id`
            : `${joinClassName}.ECInstanceId`;

          const joinSegment = joinClass.isRelational
            ? ` JOIN ${joinClassName}`
            : ` JOIN ${joinClassName} ON ${joinIdName} = ${baseIdName}`;
          querySegments.push(joinSegment);

          for (let j = 0; j < joinClass.properties.length; j++) {
            const prefix = j === 0 && joinClass.isRelational ? "ON" : "AND";
            const propertySegment = this._propertySegment(joinClassName, joinClass.properties[j], prefix);
            querySegments.push(propertySegment);
          }
          // when base is regular property, link base to first joined relational property
          if (joinClass.isRelational && !baseClass.isRelational && i === 1) {
            querySegments.push(` AND ${joinIdName} = ${baseIdName}`);
          }
        }
      }

      const whereSegment = this._whereSegment(baseClass, baseClassName);
      querySegments.push(whereSegment);

      const unionSegment = " UNION ";
      querySegments.push(unionSegment);
    }

    querySegments.pop();
    return querySegments.join("");
  }

  private _whereSegment = (
    baseClass: QueryClass,
    baseClassName: string
  ): string => {
    let queryString = "";
    const properties = baseClass.properties;
    for (let i = 0; i < properties.length; i++) {
      const prefix = i === 0 ? "WHERE" : "AND";
      queryString += this._propertySegment(baseClassName, properties[i], prefix);
    }

    return queryString;
  }

  private _propertySegment(
    className: string,
    property: QueryProperty,
    prefix: string
  ): string {
    let segmentString = "";

    if (property.isCategory) {
      segmentString += this._categoryQuery(property.value.toString());
    } else {
      if (property.needsQuote) {
        segmentString += ` ${prefix} ${className}.${property.name}='${property.value}'`;
      } else {
        if (this._isFloat(property.value)) {
          segmentString += ` ${prefix} ROUND(${className}.${property.name}, `;
          segmentString += `${QueryBuilder.DEFAULT_DOUBLE_PRECISION})=`;
          segmentString += `${Number(property.value).toFixed(
            QueryBuilder.DEFAULT_DOUBLE_PRECISION
          )}`;
        } else {
          segmentString += ` ${prefix} ${className}.${property.name}=${property.value}`;
        }
      }
    }

    return segmentString;
  }

  private _categoryQuery(codeValue: string): string {
    return ` JOIN bis.Category ON bis.Category.ECInstanceId = bis.GeometricElement3d.category.id AND ((bis.Category.CodeValue='${codeValue}') OR (bis.Category.UserLabel='${codeValue}'))`;
  }

  private _isFloat(n: unknown): boolean {
    return Number(n) === n && n % 1 !== 0;
  }
}
