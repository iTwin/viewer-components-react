/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

export const LOCALIZED_STRINGS = {
  widget: {
    label: "Tree view",
  },
  header: {
    dropdownMore: "More",
    searchBox: {
      searchForSomething: "Search the tree",
      search: "Search...",
      open: "Open",
      close: "Close",
      next: "Next",
      previous: "Previous",
    },
  },
  loading: {
    search: "Search in progress",
    skeleton: "Loading tree",
  },
  selectableTree: {
    noTrees: "There are no trees available for this iModel.",
  },
  errorState: {
    title: "Error",
    description: "Failed to load tree",
    retryButtonLabel: "Retry",
  },
  visibilityTooltips: {
    status: {
      visible: "Hide",
      hidden: "Show",
      disabled: "Disabled",
      partial: "Show",
      determining: "Determining visibility...",
    },
  },
  categoriesTree: {
    label: "Categories",
    buttons: {
      showAll: {
        tooltip: "Show all",
      },
      hideAll: {
        tooltip: "Hide all",
      },
      invert: {
        tooltip: "Invert",
      },
    },
    search: {
      noMatches: "No results were found for your search query.",
      noMatchesRetry: "Please modify your search and try again.",
      unknownSearchError: "An unknown error occurred while searching the tree.",
      tooManySearchMatches: "There are too many matches for your search query.",
      tooManySearchMatchesRetry: "Please refine your search and try again.",
    },
  },
  classificationsTree: {
    label: "Classifications",
    search: {
      noMatches: "No results were found for your search query.",
      noMatchesRetry: "Please modify your search and try again.",
      unknownSearchError: "An unknown error occurred while searching the tree.",
      tooManySearchMatches: "There are too many matches for your search query.",
      tooManySearchMatchesRetry: "Please refine your search and try again.",
    },
  },
  modelsTree: {
    label: "Models",
    buttons: {
      showAll: {
        tooltip: "Show all",
      },
      hideAll: {
        tooltip: "Hide all",
      },
      invert: {
        tooltip: "Invert",
      },
      toggle2d: {
        tooltip: "Toggle 2D views",
        label: "2D",
      },
      toggle3d: {
        tooltip: "Toggle 3D views",
        label: "3D",
      },
      toggleFocusMode: {
        enable: {
          tooltip: "Enable instance focus mode",
        },
        disable: {
          tooltip: "Disable instance focus mode",
        },
        disabled: {
          tooltip: "Instance focus mode is disabled while search is active",
        },
      },
    },
    subTree: {
      unknownSubTreeError: "An unknown error occurred while creating a sub-tree.",
    },
    search: {
      noMatches: "No results were found for your search query.",
      noMatchesRetry: "Please modify your search and try again.",
      unknownSearchError: "An unknown error occurred while searching the tree.",
      unknownInstanceFocusError: "An unknown error occurred while focusing instances.",
      tooManySearchMatches: "There are too many matches for your search query.",
      tooManySearchMatchesRetry: "Please refine your search and try again.",
      tooManyInstancesFocused: "There are too many elements selected for focus mode.",
      disableInstanceFocusMode: "Disable the focus mode",
    },
  },
  imodelContentTree: {
    label: "iModel content",
  },
  externalSourcesTree: {
    label: "External sources",
  },
  baseTree: {
    dataIsNotAvailable: "The data required for this tree layout is not available in this iModel.",
  },
  filteringDialog: {
    failedToCalculateMatchingInstancesCount: "Failed to calculate matching instances count",
    matchingInstancesCount: "Number of instances matching current filter: {{instanceCount}}",
    filterExceedsLimit: "Number of instances matching current filter exceeds the limit of {{limit}}",
  },
};

type AddPrefix<TPrefix extends string, TPath extends string> = [TPrefix] extends [never] ? `${TPath}` : `${TPrefix}.${TPath}`;

/**
 * Utility type that extracts all possible keys from a nested object as dot-separated strings
 *
 * Example:
 *
 * ```ts
 * type Example = {
 *   a: {
 *     b: string;
 *     c: number;
 *   };
 *   d: boolean;
 * }
 * // ExampleKeys will be "a.b" | "a.c" | "d"
 * type ExampleKeys = ObjectKeys<Example>
 * ```
 */
type ObjectKeys<TObject extends object, Acc extends string = never> =
  | Acc
  | {
      [K in keyof TObject & string]: TObject[K] extends object ? ObjectKeys<TObject[K], AddPrefix<Acc, K>> : AddPrefix<Acc, K>;
    }[keyof TObject & string];

/**
 * Type representing all possible localization keys
 * @internal
 */
export type LocalizationKey = ObjectKeys<typeof LOCALIZED_STRINGS>;

/** @internal */
export const LOCALIZATION_NAMESPACE = "TreeWidget";

/** @internal */
export function getLocalizationKey(key: LocalizationKey): string {
  return `${LOCALIZATION_NAMESPACE}:${key}`;
}
