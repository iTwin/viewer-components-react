// Copyright (c) Bentley Systems, Incorporated. All rights reserved.

import { useEffect } from "react";

import { useErrorOnUnstableShape, useStable } from "./basic-hooks";

// TODO: update transpilation settings to support Object.fromEntries
const objectFromEntries = <K extends string | symbol | number, V extends any>(
  entries: [K, V][]
): Record<K, V> => {
  return entries.reduce((prev, [key, val]) => {
    prev[key] = val;
    return prev;
  }, {} as Record<K, V>);
};

/**
 * a hook for using a class in a functional component, this allows you to reference
 * react state easily.
 *
 * @warn if you need performance, just define a nested class of a class component in React,
 * javascript and react were not built to be used like this in reality, hooks are great but
 * javascript isn't designed for them.
 */
export function useClass<Class extends new (...args: any) => any>(
  inClass: Class
): Class {
  const theClass = useStable(() => inClass);

  const classPropertyDescriptors = Object.getOwnPropertyDescriptors(
    inClass.prototype
  );

  // prototype properties are not enumerable so we get them this way
  // NOTE: if this becomes expensive, can tighten it
  const classProperties = objectFromEntries(
    Object.entries(classPropertyDescriptors).map(([key, desc]) => [
      key,
      desc.value,
    ])
  );

  try {
    useErrorOnUnstableShape(inClass);
    useErrorOnUnstableShape(classProperties);
  } catch (err) {
    throw Error(
      "useClass must always receive the same class shape each time, " +
        "there cannot be dynamic or optional static or class properties." +
        "Instance properties are not considered."
    );
  }

  const { ...staticProperties } = inClass;

  // TODO: check what this changes on in practice, methods should always be different
  // in different class insantiations so this may just always change
  useEffect(() => {
    Object.assign(theClass, inClass);
    for (const propKey in classPropertyDescriptors) {
      theClass.prototype[propKey] = inClass.prototype[propKey];
    }
  }, [...Object.values(staticProperties), ...Object.values(classProperties)]);

  return theClass;
}
