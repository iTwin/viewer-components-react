# @bentley\imodel-select-react

Copyright © Bentley Systems, Incorporated. All rights reserved.

The imodel-select-react provides React components to select an iModel or a project on iModelHub.

## Sample deployments

### Selecting an iModel in iModelHub

#### Just assign the IModelSelector component with its callback functions

```ts
this.reactElement = (
  <IModelSelector
    onIModelSelected={this._onSelectIModel}
    showSignoutButton={true}
  />
);
```

#### This frontstage example assumes sign-in has already been completed

```ts
import * as React from "react";
import { CoreTools, ContentGroup, ContentControl, ConfigurableCreateInfo, FrontstageProvider, FrontstageProps, Frontstage, IModelInfo, UiFramework } from "@bentley/ui-framework";
import { IModelSelector } from "@bentley/imodel-select-react";
import { remote } from "electron";

class IModelSelectorControl extends ContentControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    this.reactElement = (
      <IModelSelector
        onIModelSelected={this._onSelectIModel}
        showSignoutButton={true}
      />
    );
  }

  // called when an imodel has been selected on the IModelSelect
  private _onSelectIModel = async (iModelInfo: IModelInfo) => {
    const accessToken = UiFramework.getAccessToken();
    const jsonData = {
      token: accessToken,
      project: iModelInfo.projectInfo.wsgId,
      model: iModelInfo.wsgId,
    };
    // log data to stdout and exit with success (0)
    const dataStr: string = JSON.stringify(jsonData);
    const con = remote.getGlobal("console");
    con.log(dataStr);

    window.close();
    return process.exit(0);
  };
}

export class IModelSelectorFrontstage extends FrontstageProvider {
  private _contentLayoutDef: ContentLayoutDef;

  constructor() {
    super();

    // Create the content layouts.
    this._contentLayoutDef = new ContentLayoutDef({});
  }

  public get frontstage(): React.ReactElement<FrontstageProps> {
    const contentGroup: ContentGroup = new ContentGroup({
      contents: [
        {
          classId: IModelSelectorControl,
        },
      ],
    });

    return (
      <Frontstage
        id="IModelSelector"
        defaultTool={CoreTools.selectElementCommand}
        defaultLayout={this._contentLayoutDef}
        contentGroup={contentGroup}
        isInFooterMode={false}
      />
    );
  }
}
```

### Selecting a Project in iModelHub

#### Just assign the ProjectSelector component with its callback functions

```ts
this.reactElement = (
  <ProjectSelector
    onClose={this._onCloseProjectDialog}
    onProjectSelected={this._onSelectProject}
  />
);
```

#### This frontstage example assumes sign-in has been completed

```ts
import * as React from "react";
import { remote } from "electron";
import { CoreTools, ContentGroup, ContentControl, ConfigurableCreateInfo, FrontstageProvider, FrontstageProps, Frontstage, ProjectInfo, UiFramework } from @bentley/ui-framework";
import { ProjectSelector } from "@bentley/imodel-select-react";

class ProjectSelectorControl extends ContentControl {
  constructor(info: ConfigurableCreateInfo, options: any) {
    super(info, options);

    // Assign the ProjectSelector component with its callback functions
    this.reactElement = (
      <ProjectSelector
        onClose={this._onCloseProjectDialog}
        onProjectSelected={this._onSelectProject}
      />
    );
  }

  // called when a project has been selected
  private _onSelectProject = async (projectInfo: ProjectInfo) => {
    const accessToken = UiFramework.getAccessToken();
    const jsonData = {
      token: accessToken,
      project: projectInfo.wsgId,
    };
    // log data to stdout and exit with success (0)
    const dataStr: string = JSON.stringify(jsonData);
    const con = remote.getGlobal("console");
    con.log(dataStr);

    window.close();
    return process.exit(0);
  };

  // called when the project dialog is closed
  private _onCloseProjectDialog = () => {
    window.close();
    return process.exit(0);
  };
}

export class ProjectSelectorFrontstage extends FrontstageProvider {
  private _contentLayoutDef: ContentLayoutDef;

  constructor() {
    super();

    // Create the content layouts.
    this._contentLayoutDef = new ContentLayoutDef({});
  }

  public get frontstage(): React.ReactElement<FrontstageProps> {
    const contentGroup: ContentGroup = new ContentGroup({
      contents: [
        {
          classId: ProjectSelectorControl,
        },
      ],
    });

    return (
      <Frontstage
        id="ProjectSelector"
        defaultTool={CoreTools.selectElementCommand}
        defaultLayout={this._contentLayoutDef}
        contentGroup={contentGroup}
        isInFooterMode={false}
      />
    );
  }
}
```
