/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * Licensed under the MIT License. See LICENSE.md in the project root for license terms.
 *--------------------------------------------------------------------------------------------*/
import "./CreateClassificationDialog.scss";
import * as React from "react";
import {
  ModelProps,
  ModelQueryParams,
  SpatialClassificationProps,
} from "@bentley/imodeljs-common";
import {
  IModelApp,
  SpatialModelState,
  SpatialViewState,
  Viewport,
} from "@bentley/imodeljs-frontend";
import {
  Checkbox,
  Dialog,
  DialogButtonType,
  Input,
  Select,
} from "@bentley/ui-core";
import { ModalDialogManager } from "@bentley/ui-framework";
import { AppContext } from "../reality-data-react";
import { Entry } from "../api/Entry";
import { Item } from "./Item";
import RealityData from "../api/RealityData";

/** Type of props for CreateClassificationModalDialog component */
export interface CreateClassificationModalDialogProps {
  appContext: AppContext;
  item: Entry;
  classifier?: SpatialClassificationProps.Properties;
}

interface CreateClassificationModalDialogState {
  models: { [key: string]: string };
  name: string;
  model: string | undefined;
  margin: number;
  insideDisplayKey: string;
  outsideDisplayKey: string;
  isVolumeClassifier: boolean;
}

/** ContextMenu component, can contain ContextMenuItems */
export class CreateClassificationDialog extends React.Component<
  CreateClassificationModalDialogProps,
  CreateClassificationModalDialogState
> {
  public readonly state: Readonly<CreateClassificationModalDialogState>;
  private _displayEntries: { [key: string]: string } = {};
  private _outsideDisplayEntries: { [key: string]: string } = {};
  private _insideLabel: string = "";
  private _outsideLabel: string = "";
  private _volumeLabel: string = "";

  constructor(props: CreateClassificationModalDialogProps) {
    super(props);

    this._insideLabel = RealityData.translate("createClassifier.insideDisplay");
    this._outsideLabel = RealityData.translate(
      "createClassifier.outsideDisplay"
    );
    this._volumeLabel = RealityData.translate("createClassifier.volume");

    this._displayEntries[
      SpatialClassificationProps.Display[SpatialClassificationProps.Display.Off]
    ] = RealityData.translate("createClassifier.off");
    this._displayEntries[
      SpatialClassificationProps.Display[SpatialClassificationProps.Display.On]
    ] = RealityData.translate("createClassifier.on");
    this._displayEntries[
      SpatialClassificationProps.Display[
        SpatialClassificationProps.Display.Dimmed
      ]
    ] = RealityData.translate("createClassifier.dimmed");
    this._displayEntries[
      SpatialClassificationProps.Display[
        SpatialClassificationProps.Display.Hilite
      ]
    ] = RealityData.translate("createClassifier.hilite");
    this._displayEntries[
      SpatialClassificationProps.Display[
        SpatialClassificationProps.Display.ElementColor
      ]
    ] = RealityData.translate("createClassifier.elementcolor");

    this._outsideDisplayEntries[
      SpatialClassificationProps.Display[SpatialClassificationProps.Display.Off]
    ] = RealityData.translate("createClassifier.off");
    this._outsideDisplayEntries[
      SpatialClassificationProps.Display[SpatialClassificationProps.Display.On]
    ] = RealityData.translate("createClassifier.on");
    this._outsideDisplayEntries[
      SpatialClassificationProps.Display[
        SpatialClassificationProps.Display.Dimmed
      ]
    ] = RealityData.translate("createClassifier.dimmed");

    const classifier = this.props.classifier;
    const name = classifier
      ? classifier.name
      : RealityData.translate("createClassifier.new");
    const margin = classifier ? classifier.expand : 0;
    const isVolumeClassifier = classifier
      ? !!classifier.flags.isVolumeClassifier
      : false;
    const insideDisplayKey = classifier
      ? SpatialClassificationProps.Display[classifier.flags.inside]
      : SpatialClassificationProps.Display[
          SpatialClassificationProps.Display.On
        ];
    const outsideDisplayKey = classifier
      ? SpatialClassificationProps.Display[classifier.flags.outside]
      : SpatialClassificationProps.Display[
          SpatialClassificationProps.Display.Dimmed
        ];

    this.state = {
      models: {},
      margin,
      model: undefined,
      name,
      insideDisplayKey,
      outsideDisplayKey,
      isVolumeClassifier,
    };
  }

  public async componentDidMount() {
    const classifier = this.props.classifier;
    await this._initModels(classifier ? classifier.modelId : undefined);
  }

  private isEditMode(): boolean {
    return !!this.props.classifier;
  }

  private async _initModels(modelId: string | undefined) {
    const vp = IModelApp.viewManager.selectedView;
    const models = await CreateClassificationDialog.getAvailableModelListForViewport(
      vp
    );
    const count = Object.keys(models).length;
    if (models && count > 0) {
      if (modelId && models[modelId]) {
        this.setState({ models, model: modelId });
        return;
      }
      const firstModelid = Object.keys(models)[0];
      this.setState({ models, model: firstModelid });
    }
  }

  public static async getAvailableModelListForViewport(
    vp?: Viewport
  ): Promise<{ [key: string]: string }> {
    const models: { [key: string]: string } = {};
    if (!vp || !(vp.view instanceof SpatialViewState))
      return Promise.resolve(models);

    const modelQueryParams: ModelQueryParams = {
      from: SpatialModelState.classFullName,
      wantPrivate: false,
    };

    let curModelProps: ModelProps[] = new Array<ModelProps>();
    curModelProps = await vp.iModel.models.queryProps(modelQueryParams);

    for (const modelProps of curModelProps) {
      if (modelProps.id) {
        const modelId = modelProps.id;
        const name = modelProps.name ? modelProps.name : modelId;
        // models.push({ modelId, name });
        models[modelId] = name;
      }
    }
    return Promise.resolve(models);
  }

  private _handleOK = () => {
    const vp = IModelApp.viewManager.selectedView;
    if (vp) {
      const {
        name,
        model,
        insideDisplayKey,
        outsideDisplayKey,
        margin,
        isVolumeClassifier,
      } = this.state;

      // convert enum as string to enum integer values see https://stackoverflow.com/questions/17380845/how-do-i-convert-a-string-to-enum-in-typescript
      const insideVal: number =
        SpatialClassificationProps.Display[
          insideDisplayKey as keyof typeof SpatialClassificationProps.Display
        ];
      const outsideVal: number =
        SpatialClassificationProps.Display[
          outsideDisplayKey as keyof typeof SpatialClassificationProps.Display
        ];
      const flags = new SpatialClassificationProps.Flags();
      flags.inside = insideVal;
      flags.outside = outsideVal;
      flags.isVolumeClassifier = isVolumeClassifier;
      let classifierToUpdate = "";
      const editClassifier = this.props.classifier;
      const entry = this.props.item;

      if (entry.classifiers && entry.classifiers.length > 0)
        // walk existing entries and if creating new classifier isActive off on any existing classifiers since new one is active when created.
        entry.classifiers.forEach(
          (c: SpatialClassificationProps.Properties) => {
            if (!editClassifier) c.isActive = false;

            // if editing then update existing classifier
            if (editClassifier && editClassifier.name === c.name) {
              classifierToUpdate = editClassifier.name;
              c.name = name;
              c.flags = flags;
              c.expand = margin;
              c.modelId = model!;
            }
          }
        );

      // if not editing then add new classifier
      if (!editClassifier) {
        classifierToUpdate = name;
        const classifier = {
          modelId: model!,
          expand: margin,
          name,
          flags,
          isActive: true,
        };
        if (!entry.classifiers) entry.classifiers = [];
        entry.classifiers.push(
          classifier as SpatialClassificationProps.Properties
        );
      }

      Item.updateRealityDataClassifiers(vp, entry, classifierToUpdate);
    }
    this._closeDialog();
  };

  private _handleCancel = () => {
    this._closeDialog();
  };

  private _closeDialog() {
    ModalDialogManager.closeDialog();
  }

  private _onInsideDisplayChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ): void => {
    this.setState({ insideDisplayKey: event.target.value });
  };
  private _onOutsideDisplayChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ): void => {
    this.setState({ outsideDisplayKey: event.target.value });
  };

  private _onNameChange = (event: any) => {
    this.setState({ name: event.target.value });
  };

  private _onMarginChange = (event: any) => {
    try {
      const margin = parseInt(event.target.value, 10);
      this.setState({ margin });
    } catch {}
  };

  private _onIsVolumeClassifierChanged = () => {
    const isVolumeClassifier = !this.state.isVolumeClassifier;
    this.setState({ isVolumeClassifier });
  };

  private _onModelChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ): void => {
    this.setState({ model: event.target.value });
  };

  private _isValidInput() {
    const name = this.state.name;
    return (
      !this.isEmptyOrWhitespace(name) && (this.state.model || this.isEditMode())
    );
  }

  private isEmptyOrWhitespace(str: string) {
    return str === null || str.match(/^ *$/) !== null;
  }

  private _handleKeyDown(event: any) {
    if (event.keyCode === 13) {
      this._handleOK();
    }
  }

  public render(): JSX.Element {
    const {
      margin,
      name,
      insideDisplayKey,
      outsideDisplayKey,
      model,
      isVolumeClassifier,
    } = this.state;
    const title = this.isEditMode()
      ? RealityData.translate("createClassifier.editTitle")
      : RealityData.translate("createClassifier.createTitle");
    return (
      <Dialog
        title={title}
        opened={true}
        resizable={false}
        movable={true}
        modal={true}
        width={400}
        height={240}
        buttonCluster={[
          {
            type: DialogButtonType.OK,
            onClick: () => {
              this._handleOK();
            },
            disabled: !this._isValidInput(),
          },
          {
            type: DialogButtonType.Cancel,
            onClick: () => {
              this._handleCancel();
            },
          },
        ]}
        onClose={() => this._handleCancel()}
        onEscape={() => this._handleCancel()}
      >
        <div className="reality-data-classification-dialog">
          <span className="classifier-label">
            {RealityData.translate("createClassifier.name")}
          </span>
          <Input
            autoFocus={true}
            value={name}
            onChange={this._onNameChange}
            placeholder="Enter Name"
            onKeyDown={this._handleKeyDown.bind(this)}
          />
          <span className="classifier-label">
            {RealityData.translate("createClassifier.model")}
          </span>
          <Select
            className="classification-dialog-select"
            options={this.state.models}
            value={model}
            onChange={this._onModelChange}
          />
          <span className="classifier-label">{this._insideLabel}</span>
          <Select
            className="classification-dialog-select"
            options={this._displayEntries}
            value={insideDisplayKey}
            onChange={this._onInsideDisplayChange}
          />
          <span className="classifier-label">{this._outsideLabel}</span>
          <Select
            className="classification-dialog-select"
            options={this._outsideDisplayEntries}
            value={outsideDisplayKey}
            onChange={this._onOutsideDisplayChange}
          />
          <span className="classifier-label">
            {RealityData.translate("createClassifier.margin")}
          </span>
          <Input
            type="number"
            min="0"
            max="100"
            step="1"
            value={margin}
            onChange={this._onMarginChange}
          />
          <span></span>
          <Checkbox
            className="classifier-checkbox"
            label={this._volumeLabel}
            checked={isVolumeClassifier}
            onClick={this._onIsVolumeClassifierChanged}
          />
        </div>
      </Dialog>
    );
  }
}
