/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/


import { getSuper } from "./getSuper";

describe("function getSuper", () => {
  it("references the same method as if using the super keyword", async () => {
    const innerCall = jest.fn();
    class A {
      f() {
        innerCall();
      }
    }

    class B extends A {
      f() {
        super.f();
      }
    }

    const b = new B();
    b.f();
    expect(innerCall).toBeCalledTimes(1);
    innerCall.mockClear();

    class C extends A {
      f() {
        getSuper(this).f();
      }
    }

    const c = new C();
    c.f();
    expect(innerCall).toBeCalledTimes(1);
  });
});
