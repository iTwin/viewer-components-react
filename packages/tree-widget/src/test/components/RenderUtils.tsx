/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import axe from "axe-core";
import { expect } from "vitest";
import { render } from "vitest-browser-react";
import { ThemeProvider } from "@itwin/itwinui-react";
import { Root } from "@stratakit/foundations";
import { LocalizationContextProvider } from "../../tree-widget-react/components/trees/common/components/LocalizationContext.js";
import localeEn from "../../public/locales/en/TreeWidget.json" with { type: "json" };

import type { PropsWithChildren, ReactNode } from "react";
import type { Locator } from "vitest/browser";

/**
 * Minimal localization that resolves keys against the actual English locale, so rendered components display real
 * strings. Keys arrive namespaced (e.g. `TreeWidget:header.searchBox.search`); we strip the namespace and walk the JSON.
 */
const localization = {
  getLocalizedString: (key: string) => {
    const localKey = key.replace(/^[^:]+:/, "");
    let value: unknown = localeEn;
    for (const part of localKey.split(".")) {
      if (!value || typeof value !== "object") {
        return key;
      }
      value = (value as Record<string, unknown>)[part];
    }
    return typeof value === "string" ? value : key;
  },
};

export const COLOR_SCHEMES = ["light", "dark"] as const;
export type ColorScheme = (typeof COLOR_SCHEMES)[number];

interface RenderWithThemeOptions {
  colorScheme?: ColorScheme;
}

function createWrapper(colorScheme: ColorScheme) {
  return function Wrapper({ children }: PropsWithChildren<unknown>) {
    return (
      <ThemeProvider theme={colorScheme} future={true} as={Root} colorScheme={colorScheme} density="dense">
        <LocalizationContextProvider localization={localization}>{children}</LocalizationContextProvider>
      </ThemeProvider>
    );
  };
}

/** Renders `element` wrapped with the iTwinUI theme rendered as the StrataKit `Root` (design tokens + theming) and the tree-widget localization context. */
export async function renderWithTheme(element: ReactNode, options?: RenderWithThemeOptions) {
  const { colorScheme = "light" } = options ?? {};
  return render(element, { wrapper: createWrapper(colorScheme) });
}

interface ValidateSnapshotOptions {
  /** Skip the visual (screenshot) validation. */
  skipVisual?: boolean;
  /** Skip accessibility validation entirely (`true`) or disable specific axe rules (array of rule ids). */
  skipA11y?: boolean | string[];
}

/** Validates a rendered component both visually (screenshot) and for accessibility violations (axe). */
export async function validateSnapshot(component: Locator, options?: ValidateSnapshotOptions) {
  if (!options?.skipVisual) {
    await expect(component).toMatchScreenshot();
  }

  if (options?.skipA11y !== true) {
    const element = component.element();
    const rulesConfig: Record<string, { enabled: boolean }> = {};
    if (Array.isArray(options?.skipA11y)) {
      for (const ruleId of options.skipA11y) {
        rulesConfig[ruleId] = { enabled: false };
      }
    }
    const results = await axe.run(element as Element, { rules: rulesConfig });
    const violations = results.violations.map((violation) => ({
      rule: violation.id,
      impact: violation.impact,
      description: violation.description,
      nodes: violation.nodes.map((node) => node.html),
    }));
    expect(violations, `Accessibility violations found:\n${JSON.stringify(violations, undefined, 2)}`).toEqual([]);
  }
}
