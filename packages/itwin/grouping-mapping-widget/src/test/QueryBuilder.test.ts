/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Query, QueryBuilder, QueryClass } from "../widget/components/QueryBuilder";
import { assert } from "chai"

describe("QueryBuilder", () => {
  describe("buildQueryString()", () => {

    beforeEach(() => {
    });

    afterEach(() => {
    });

    const testBuildQueryString = (query: Query|undefined, expectedResult: string) => {
      let sut = new QueryBuilder(undefined);
      sut.query = query
      let result = sut.buildQueryString();

      assert.strictEqual(result, expectedResult)
    }

    it("should return empty string, when query is undefined", () => testBuildQueryString(undefined, ""))
    it("should return empty string, when query unions are empty", () => testBuildQueryString({unions: []}, ""))
    it("should return empty string, when query classes are empty", () => testBuildQueryString({unions: [{classes: []}]}, ""))

    it("should return query string with ROUND, when property is float", () => {
      let baseClass: QueryClass = {
        className: "BaseClassName",
        isAspect: false,
        isRelational: true,
        properties: []
      };

      let joinClass: QueryClass = {
        className: "JoinClassName",
        isAspect: false,
        isRelational: true,
        properties: [
          {
            name: "propName1",
            needsQuote: false,
            isCategory: false,
            value: 3.14159
          }
        ]
      };

      let query: Query = {
        unions: [
          {classes: [baseClass, joinClass]}
        ]
      }

      testBuildQueryString(query, "SELECT BaseClassName.ECInstanceId FROM BaseClassName JOIN JoinClassName ON ROUND(JoinClassName.propName1, 4)=3.1416")
    });

    it("should return query string with propery value in quotes, when property needs quotes", () => {
      let baseClass: QueryClass = {
        className: "BaseClassName",
        isAspect: false,
        isRelational: true,
        properties: []
      };

      let joinClass: QueryClass = {
        className: "JoinClassName",
        isAspect: false,
        isRelational: true,
        properties: [
          {
            name: "propName1",
            needsQuote: true,
            isCategory: false,
            value: "someName"
          }
        ]
      };

      let query: Query = {
        unions: [
          {classes: [baseClass, joinClass]}
        ]
      }

      testBuildQueryString(query, "SELECT BaseClassName.ECInstanceId FROM BaseClassName JOIN JoinClassName ON JoinClassName.propName1='someName'")
    });

    it("should return a category query string, when property is category", () => {
      let baseClass: QueryClass = {
        className: "BaseClassName",
        isAspect: false,
        isRelational: true,
        properties: []
      };

      let joinClass: QueryClass = {
        className: "JoinClassName",
        isAspect: false,
        isRelational: true,
        properties: [
          {
            name: "propName1",
            needsQuote: false,
            isCategory: true,
            value: "propValue1"
          }
        ]
      };

      let query: Query = {
        unions: [
          {classes: [baseClass, joinClass]}
        ]
      }

      testBuildQueryString(query, "SELECT BaseClassName.ECInstanceId FROM BaseClassName JOIN JoinClassName JOIN bis.Category ON bis.Category.ECInstanceId = bis.GeometricElement3d.category.id AND ((bis.Category.CodeValue='propValue1') OR (bis.Category.UserLabel='propValue1'))")
    });

    it("should return query string with where clause, when base class has properties", () => {
      let baseClass: QueryClass = {
        className: "BaseClassName",
        isAspect: false,
        isRelational: true,
        properties: [
          {
            name: "propName1",
            needsQuote: false,
            isCategory: false,
            value: "propValue1"
          },
          {
            name: "propName2",
            needsQuote: false,
            isCategory: false,
            value: "propValue2"
          }
        ]
      };

      let joinClass: QueryClass = {
        className: "JoinClassName",
        isAspect: false,
        isRelational: true,
        properties: [

        ]
      };

      let query: Query = {
        unions: [
          {classes: [baseClass, joinClass]}
        ]
      }
      testBuildQueryString(query, "SELECT BaseClassName.ECInstanceId FROM BaseClassName JOIN JoinClassName WHERE BaseClassName.propName1=propValue1 AND BaseClassName.propName2=propValue2")
    });

    it("should return query string with UNION, when there are multiple unions", () => {
      let queryClass: QueryClass = {
        className: "ClassName",
        isAspect: false,
        isRelational: true,
        properties: [
          {
            name: "propName1",
            needsQuote: false,
            isCategory: false,
            value: "propValue1"
          }
        ]
      }

      let query: Query = {
        unions: [
          {classes: [queryClass]},
          {classes: [queryClass]}
        ]
      };

      testBuildQueryString(query, "SELECT ClassName.ECInstanceId FROM ClassName WHERE ClassName.propName1=propValue1 UNION SELECT ClassName.ECInstanceId FROM ClassName WHERE ClassName.propName1=propValue1");
    });
  });
});