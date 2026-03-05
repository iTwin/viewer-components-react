/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import "@testing-library/jest-dom/vitest";
import { EmptyLocalization } from "@itwin/core-common";
import { GroupingMappingWidget } from "../GroupingMappingWidget";

void GroupingMappingWidget.initialize({ localization: new EmptyLocalization() });
