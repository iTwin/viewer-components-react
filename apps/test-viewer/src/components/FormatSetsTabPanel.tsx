/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import React from "react";
import { Flex, Text } from "@itwin/itwinui-react";

/** Tab panel component for Format Sets management */
export const FormatSetsTabPanel: React.FC = () => {
  return (
    <Flex flexDirection="row" gap="l">
      <Flex.Item className="quantity-format-selector-item">
        <Flex flexDirection="column" justifyContent="center" alignItems="center">
          <Text variant="leading">FormatSetSelector</Text>
        </Flex>
      </Flex.Item>

      <Flex.Item className="quantity-format-panel-item">
        <Flex flexDirection="column" justifyContent="center" alignItems="center">
          <Text variant="leading">Editing FormatSet Panel</Text>
        </Flex>
      </Flex.Item>
    </Flex>
  );
};
