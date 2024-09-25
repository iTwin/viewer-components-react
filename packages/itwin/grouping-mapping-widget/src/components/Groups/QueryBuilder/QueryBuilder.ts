/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import type { PresentationPropertyDataProvider } from "@itwin/presentation-components";
import type { InstanceKey, NavigationPropertyValue, PropertiesField } from "@itwin/presentation-common";
import type { Primitives, PropertyRecord } from "@itwin/appui-abstract";
import { PropertyValueFormat } from "@itwin/appui-abstract";
import { toaster } from "@itwin/itwinui-react";
import type { IModelConnection } from "@itwin/core-frontend";
import { QueryBinder } from "@itwin/core-common";

export interface Query {
  unions: QueryUnion[];
}

export interface QueryUnion {
  classes: QueryClass[];
  properties: QueryProperty[];
}

export interface QueryClass {
  // schemaName.className
  className: string;
  classJoins: ClassJoin[];
}

export interface ClassJoin {
  classProperty: string;
  joinClassName: string;
  joinClassProperty: string;
}

export interface QueryProperty {
  className: string;
  classProperties: ClassProperty[];
  isCategory: boolean;
  modeledElementClass?: string;
  isAspect: boolean;
}

export interface ClassProperty {
  name: string;
  value: Primitives.Value;
  needsQuote: boolean;
}

export interface AddedProperty {
  propertyRecord: PropertyRecord;
  propertiesField: PropertiesField;
}

/* This class is to build adaptive and dynamic query for find similar property selections */
export class QueryBuilder {
  private static readonly MULTI_ASPECT_PRIMARY_CLASS = "BisCore:ElementOwnsMultiAspects";
  private static readonly UNIQUE_ASPECT_PRIMARY_CLASS = "BisCore:ElementOwnsUniqueAspect";
  private static readonly DEFAULT_DOUBLE_PRECISION = 4;
  private query: Query | undefined;

  constructor(
    private readonly dataProvider: PresentationPropertyDataProvider,
    private readonly iModelConnection: IModelConnection,
  ) {}

  private isCategory(propertyField: PropertiesField): boolean {
    const classInfo = propertyField.properties[0].property.navigationPropertyInfo?.classInfo;
    return classInfo?.name === "BisCore:GeometricElement3dIsInCategory";
  }

  private async getPotentialModeledElement(propertyField: PropertiesField, propertyRecord: PropertyRecord): Promise<string | undefined> {
    const classInfo = propertyField.properties[0].property.navigationPropertyInfo?.classInfo;
    if (propertyRecord.value?.valueFormat !== PropertyValueFormat.Primitive) return;
    const navigationPropertyValue = propertyRecord.value.value as NavigationPropertyValue;
    if (classInfo?.name === "BisCore:ModelContainsElements") {
      // Lookup the modeled element as they share the same ECInstanceId
      const modeledElementQuery = `SELECT ec_classname(ecclassid) FROM biscore.element WHERE ecinstanceid = ? LIMIT 1`;
      const queryBinder = new QueryBinder();
      queryBinder.bindString(1, navigationPropertyValue.id);
      const modeledElement = (await this.iModelConnection.createQueryReader(modeledElementQuery, queryBinder).next()).value[0];
      return modeledElement.replace(":", ".");
    }
    return;
  }

  private _propertyMap: Map<string, AddedProperty> = new Map();

  public resetQueryBuilder = () => {
    this._propertyMap = new Map();
  };

  private regenerateQuery = async () => {
    this.query = undefined;

    for (const property of this._propertyMap.values()) {
      await this.buildProperty(property.propertyRecord, property.propertiesField);
    }
  };

  public async addProperty(prop: PropertyRecord): Promise<boolean> {
    // TODO: only handle primitive properties now
    if (prop.value?.valueFormat !== PropertyValueFormat.Primitive) {
      toaster.warning("Only primitive types are supported for now.");
      return false;
    }
    if (prop.value.value === undefined) {
      return false;
    }

    const propertyField = (await this.dataProvider.getFieldByPropertyRecord(prop)) as PropertiesField;

    if (!propertyField) {
      toaster.negative("Error. Failed to fetch field for this property record.");
      return false;
    }

    this._propertyMap.set(JSON.stringify(propertyField.getFieldDescriptor()), { propertyRecord: prop, propertiesField: propertyField });
    return true;
  }

  public async removeProperty(prop: PropertyRecord) {
    const propertyField = (await this.dataProvider.getFieldByPropertyRecord(prop)) as PropertiesField;

    this._propertyMap.delete(JSON.stringify(propertyField.getFieldDescriptor()));
  }

  private async buildProperty(prop: PropertyRecord, propertiesField: PropertiesField) {
    if (prop.value?.valueFormat !== PropertyValueFormat.Primitive || prop.value.value === undefined) {
      toaster.negative("Error. An unexpected error has occured while building a query.");
      return;
    }

    function replaceAll(str: string, match: string, replacement: string) {
      return str.split(match).join(replacement);
    }
    // if property value has single quote, escape
    if ((typeof prop.value.value === "string" || prop.value.value instanceof String) && String(prop.value.value).indexOf("'") >= 0) {
      prop.value.value = replaceAll(prop.value.value.toString(), "'", "''");
    }

    const pathToPrimaryClass = propertiesField.parent?.pathToPrimaryClass;

    // get the special cases
    const isNavigation: boolean = prop.property.typename.toLowerCase() === "navigation";
    const isCategory: boolean = isNavigation && this.isCategory(propertiesField);
    const modeledElement = await this.getPotentialModeledElement(propertiesField, prop);

    const isAspect: boolean =
      pathToPrimaryClass?.find(
        (a) => a.relationshipInfo?.name === QueryBuilder.UNIQUE_ASPECT_PRIMARY_CLASS || a.relationshipInfo?.name === QueryBuilder.MULTI_ASPECT_PRIMARY_CLASS,
      ) !== undefined;

    for (let i = 0; i < propertiesField.properties.length; i++) {
      const property = propertiesField.properties[i].property;

      const className = property.classInfo.name.replace(":", ".");
      const propertyName = isNavigation ? (isCategory || modeledElement ? `${property.name}.CodeValue` : `${property.name}.id`) : property.name;
      const propertyValue = isNavigation
        ? isCategory || modeledElement
          ? prop.value.displayValue ?? ""
          : (prop.value.value as InstanceKey).id
        : prop.value.value;

      if (!isAspect && pathToPrimaryClass && pathToPrimaryClass.length > 0) {
        this.addRelatedToQuery(i, propertiesField, propertyName, propertyValue);
      } else {
        this.addPropertyToQuery(i, className, propertyName, propertyValue, this.needsQuote(propertiesField), isCategory, modeledElement, isAspect);
      }
    }
    return true;
  }

  private needsQuote(propertyField: PropertiesField): boolean {
    // list of property types that need quote around property value
    const typeName = propertyField.type.typeName.toLowerCase();
    return "string" === typeName || "uri" === typeName;
  }

  private addRelatedToQuery(unionIndex: number, propertyField: PropertiesField, propertyName: string, propertyValue: Primitives.Value) {
    const paths = [...(propertyField.parent?.pathToPrimaryClass ?? [])];
    paths.reverse().forEach((path) => {
      const sourceClassName = path.sourceClassInfo?.name.replace(":", ".");
      const targetClassName = path.targetClassInfo?.name.replace(":", ".");
      const relClassName = path.relationshipInfo?.name.replace(":", ".");

      const relClassProperty = path.isForwardRelationship ? `SourceECInstanceId` : `TargetECInstanceId`;

      const relPropertyValue = path.isForwardRelationship ? `TargetECInstanceId` : `SourceECInstanceId`;

      this.addClassToQuery(unionIndex, targetClassName, `ECInstanceId`, relClassName, relPropertyValue);

      this.addClassToQuery(unionIndex, relClassName, relClassProperty, sourceClassName, `ECInstanceId`);

      if (path.sourceClassInfo?.name === propertyField.parent?.contentClassInfo.name) {
        this.addPropertyToQuery(unionIndex, sourceClassName, propertyName, propertyValue, this.needsQuote(propertyField), false, "", false);
      }
    });
  }

  private addClassToQuery(unionIndex: number, className: string, classProperty: string, joinClassName: string, joinClassProperty: string) {
    if (this.query === undefined) {
      this.query = { unions: [] };
    }

    const classJoin: ClassJoin = {
      classProperty,
      joinClassName,
      joinClassProperty,
    };

    const queryClass: QueryClass = {
      className,
      classJoins: [classJoin],
    };

    if (this.query.unions.length <= unionIndex) {
      this.query.unions.push({
        classes: [queryClass],
        properties: [],
      });
      return;
    }

    const foundClass = this.query.unions[unionIndex].classes.find((c) => c.className === className);

    if (foundClass) {
      const foundJoin = foundClass.classJoins.find(
        (join) => join.classProperty === classProperty && join.joinClassName === joinClassName && join.joinClassProperty === joinClassProperty,
      );

      if (!foundJoin) foundClass.classJoins.push(classJoin);
      return;
    }

    this.query.unions[unionIndex].classes.push(queryClass);
  }

  private addPropertyToQuery(
    unionIndex: number,
    className: string,
    propertyName: string,
    propertyValue: Primitives.Value,
    needsQuote: boolean,
    isCategory: boolean,
    modeledElementClass: string | undefined,
    isAspect: boolean,
  ) {
    if (this.query === undefined) {
      this.query = { unions: [] };
    }

    const queryJoin: ClassProperty = {
      name: propertyName,
      value: propertyValue,
      needsQuote,
    };

    const queryProperty: QueryProperty = {
      className,
      isCategory,
      modeledElementClass,
      isAspect,
      classProperties: [queryJoin],
    };

    if (this.query.unions.length <= unionIndex) {
      this.query.unions.push({
        classes: [],
        properties: [queryProperty],
      });
      return;
    }

    const foundPropertyClass = this.query.unions[unionIndex].properties.find((p) => p.className === className);

    if (foundPropertyClass) {
      const foundJoin = foundPropertyClass?.classProperties.find((join) => join.name === propertyName);

      if (foundJoin) {
        foundJoin.value = propertyValue;
        return;
      }

      foundPropertyClass.classProperties.push(queryJoin);
      return;
    }

    this.query.unions[unionIndex].properties.push(queryProperty);
  }

  public async buildQueryString() {
    await this.regenerateQuery();
    if (this.query === undefined || this.query.unions.find((u) => u.classes.length === 0 && u.properties.length === 0)) {
      return "";
    }

    const unionSegments: string[] = [];
    for (const union of this.query.unions) {
      const baseClass = union.classes[0];
      const baseProperty = union.properties[0];
      const baseClassName = baseClass ? baseClass.className : baseProperty?.className;
      const baseIdName = `${baseClassName}.ECInstanceId`;

      const selectClause = this.selectClause(baseProperty, baseClass);

      let querySegments: Map<string, string[]> = new Map();
      querySegments = this.relationalJoinSegments(union.classes, querySegments);

      const whereSegments: string[] = [];
      for (const property of union.properties) {
        if (property.isCategory) {
          if (property.className !== baseClassName)
            querySegments.set("BisCore.GeometricElement3d", [`BisCore.GeometricElement3d.ECInstanceId = ${baseIdName}`]);

          querySegments.set("BisCore.Category", [`BisCore.Category.ECInstanceId = BisCore.GeometricElement3d.category.id`]);
          whereSegments.push(this.categoryWhereQuery(property.classProperties[0].value.toString()));
          continue;
        } else if (property.modeledElementClass) {
          querySegments.set(property.modeledElementClass, [`${property.modeledElementClass}.ECInstanceId = BisCore.Element.Model.id`]);
          whereSegments.push(
            `${property.modeledElementClass}.UserLabel = '${property.classProperties[0].value.toString()}' OR ${property.modeledElementClass}.CodeValue = '${property.classProperties[0].value.toString()}'`,
          );
          continue;
        }

        const joinIdName = property.isAspect ? `${property.className}.Element.id` : `${property.className}.ECInstanceId`;

        if (!querySegments.has(property.className) && property.className !== baseClassName)
          querySegments.set(property.className, [`${joinIdName} = ${baseIdName}`]);

        for (const prop of property.classProperties) {
          whereSegments.push(this.propertyQuerySegment(property.className, prop, prop.needsQuote));
        }
      }

      const joinClauses: string[] = [];
      for (const key of querySegments.keys()) {
        joinClauses.push(`JOIN ${key} ON ${querySegments.get(key)?.join(" AND ")}`);
      }

      const whereClause = `WHERE ${whereSegments.join(" AND ")}`;

      unionSegments.push([selectClause, ...joinClauses, whereClause].join(" "));
    }

    return unionSegments.join(" UNION ");
  }

  private selectClause(baseProperty: QueryProperty | undefined, baseClass: QueryClass | undefined) {
    if (baseClass) {
      return `SELECT ${baseClass.className}.ECInstanceId, ${baseClass.className}.ECClassId FROM ${baseClass.className}`;
    }

    if (baseProperty) {
      const baseIdName = baseProperty.isAspect
        ? `${baseProperty.className}.Element.id ECInstanceId`
        : `${baseProperty.className}.ECInstanceId, ${baseProperty.className}.ECClassId`;

      return `SELECT ${baseIdName} FROM ${baseProperty.className}`;
    }

    return "";
  }

  private relationalJoinSegments = (classes: QueryClass[], querySegments: Map<string, string[]>): Map<string, string[]> => {
    for (const queryClass of classes) {
      for (const classJoin of queryClass.classJoins) {
        const querySegment = [
          ...(querySegments.get(classJoin.joinClassName) ?? []),
          `${queryClass.className}.${classJoin.classProperty} = ${classJoin.joinClassName}.${classJoin.joinClassProperty}`,
        ];
        querySegments.set(classJoin.joinClassName, querySegment);
      }
    }

    return querySegments;
  };

  private propertyQuerySegment = (className: string, property: ClassProperty, needsQuote: boolean): string => {
    if (this.isFloat(property.value))
      return (
        `ROUND(${className}.${property.name}, ` +
        `${QueryBuilder.DEFAULT_DOUBLE_PRECISION}) = ` +
        `${Number(property.value).toFixed(QueryBuilder.DEFAULT_DOUBLE_PRECISION)}`
      );

    const propertyValue = needsQuote ? `'${property.value}'` : property.value;
    return `${className}.${property.name} = ${propertyValue}`;
  };

  private categoryWhereQuery(codeValue: string): string {
    return `((BisCore.Category.CodeValue = '${codeValue}') OR (BisCore.Category.UserLabel = '${codeValue}'))`;
  }

  private isFloat(n: unknown): boolean {
    return Number(n) === n && n % 1 !== 0;
  }
}
