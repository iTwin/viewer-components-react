/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  AbstractWidgetProps,
  StagePanelLocation,
  StagePanelSection,
  UiItemsProvider,
} from '@bentley/ui-abstract';

import * as React from 'react';
import GroupingMapping from './components/GroupingMapping';

export class GroupingMappingProvider implements UiItemsProvider {
  public readonly id = 'GroupingMappingProvider';

  public provideWidgets(
    _stageId: string,
    _stageUsage: string,
    location: StagePanelLocation,
    section?: StagePanelSection,
  ): ReadonlyArray<AbstractWidgetProps> {
    const widgets: AbstractWidgetProps[] = [];
    if (
      location === StagePanelLocation.Left &&
      section === StagePanelSection.Start
    ) {
      const GroupingMappingWidget: AbstractWidgetProps = {
        id: 'GroupingMappingWidget',
        label: 'Grouping & Mapping',
        getWidgetContent() {
          return <GroupingMapping />;
        },
      };

      widgets.push(GroupingMappingWidget);
    }

    return widgets;
  }
}
