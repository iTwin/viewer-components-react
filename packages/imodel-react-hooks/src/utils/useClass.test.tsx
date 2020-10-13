// Copyright (c) Bentley Systems, Incorporated. All rights reserved.

import { act, render } from "@testing-library/react";
import React from "react";

import { useClass } from "./useClass";

describe("Hook useClass", () => {
  it("references changing react state in methods", async () => {
    let classDef!: any;
    let setState!: React.Dispatch<React.SetStateAction<string>>;
    const MockComponent = () => {
      let state: string;
      [state, setState] = React.useState("initial");
      classDef = useClass(
        class A {
          method() {
            return state;
          }
          static staticProp = state;
        }
      );
      return null;
    };

    render(<MockComponent />);

    const instance = new classDef();

    expect(instance.method()).toBe("initial");

    act(() => setState("after"));

    expect(instance.method()).toBe("after");
  });

  it("references changing react state in static properties", async () => {
    let classDef!: any;
    let setState!: React.Dispatch<React.SetStateAction<string>>;
    const MockComponent = () => {
      let state: string;
      [state, setState] = React.useState("initial");
      classDef = useClass(
        class A {
          static staticProp = state;
        }
      );
      return null;
    };

    render(<MockComponent />);

    expect(classDef.staticProp).toBe("initial");

    act(() => setState("after"));

    expect(classDef.staticProp).toBe("after");
  });
});
