/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import * as sinon from "sinon";

export type StubbedType<T> = sinon.SinonStubbedInstance<T> & T;

export class MockFactory {
  public static create<T>(constructor: sinon.StubbableType<T> & { prototype: T }): StubbedType<T> {
    return sinon.createStubInstance(constructor) as StubbedType<T>;
  }

  public static stubProperty(obj: any, property: string, replacement: () => any): void {
    if (property in obj) {
      delete obj[property];
    }

    const stubGetterDescriptor: PropertyDescriptor = { get: () => undefined, configurable: true };
    Object.defineProperty(obj, property, stubGetterDescriptor);

    sinon.replaceGetter(obj, property, replacement);
  }
}
