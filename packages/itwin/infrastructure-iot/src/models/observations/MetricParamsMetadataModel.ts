/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { times as _times } from "lodash";

import { UtilitiesService } from "../../services/UtilitiesService";

export class MetricParamsMetadata {

  private readonly paramsMetadata: any = {
    dt: {
      name: "Rolling Interval",
      type: "input-with-unit",
      config: {
        input: {
          defaultValue: 1,
        },
        select: {
          defaultValue: "604800",
          options: [
            {
              value: "60",
              label: "Minute(s)",
            },
            {
              value: "3600",
              label: "Hour(s)",
            },
            {
              value: "86400",
              label: "Day(s)",
            },
            {
              value: "604800",
              label: "Week(s)",
            },
            {
              value: "2628000",
              label: "Month(s)",
            },
          ],
        },
      },
    },
    ZERO_DATE: {
      name: "Reference Date",
      type: "date-picker",
      config: {
        defaultValue: UtilitiesService.fixDateEncoding(new Date().toISOString()),
      },
    },
    AZIMUTH_XY: {
      name: "Sensor Azimuth",
      type: "input-with-unit",
      config: {
        input: {
          defaultValue: 0,
        },
        label: "(°)",
      },
    },
    AZIMUTH_LT: {
      name: "Structure Azimuth",
      type: "input-with-unit",
      config: {
        input: {
          defaultValue: 0,
        },
        label: "(°)",
      },
    },
    h: {
      name: "Gauge Length",
      type: "input-with-unit",
      config: {
        input: {
          defaultValue: 100,
        },
        select: {
          defaultValue: "m",
          options: [
            {
              value: "m",
              label: "m",
            },
            {
              value: "ft",
              label: "ft",
            },
          ],
        },
      },
    },
    za: {
      name: "Zenith Angle",
      type: "input-with-unit",
      config: {
        input: {
          defaultValue: 0,
        },
        label: "(°)",
      },
    },
    d: {
      name: "Sensor Depth",
      type: "input-with-unit",
      config: {
        input: {
          defaultValue: 100,
        },
        select: {
          defaultValue: "m",
          options: [
            {
              value: "m",
              label: "m",
            },
            {
              value: "ft",
              label: "ft",
            },
          ],
        },
      },
    },
    END: {
      name: "IPI Mode",
      type: "select",
      config: {
        defaultValue: "FAR",
        options: [
          {
            value: "FAR",
            label: "Far",
          },
          {
            value: "NEAR",
            label: "Near",
          },
        ],
      },
    },
    DIMENSIONS: {
      name: "IPI Dimensions",
      type: "select",
      config: {
        defaultValue: 3,
        options: [
          {
            value: 2,
            label: "2D",
          },
          {
            value: 3,
            label: "3D",
          },
        ],
      },
    },
    MEDIAL_AXIS_CORRECTION: {
      name: "Cyclical Adjustment",
      type: "select",
      config: {
        defaultValue: true,
        options: [
          {
            value: true,
            label: "Enabled",
          },
          {
            value: false,
            label: "Disabled",
          },
        ],
      },
    },
    SIGN_INVERTED: {
      name: "Slope Stability Mode",
      type: "checkbox",
    },
    MAX_SEGMENTS: {
      name: "Rel. Displacement",
      type: "select",
      config: {
        defaultValue: 1,
        options: [],
      },
    },
  };

  constructor() {

    // Populate MAX_SEGMENTS param options (1 > 100)
    this.paramsMetadata.MAX_SEGMENTS.config.options = _times(100, (index: number) => {
      return {
        value: index + 1,
        label: `${index + 1} Segment${index !== 0 ? "s" : ""}`,
      };
    });
  }

  public isKnownParam(id: string): boolean {
    return !!this.paramsMetadata[id];
  }

  public getParamName(id: string): string {
    return this.isKnownParam(id) ? this.paramsMetadata[id].name : undefined;
  }

  public getParamType(id: string): string {
    return this.isKnownParam(id) ? this.paramsMetadata[id].type : undefined;
  }

  public getParamSelectOptions(id: string): {value: any, label: string}[] {
    if (this.isKnownParam(id) && this.paramsMetadata[id].config) {
      if (this.paramsMetadata[id].config.options) {
        return this.paramsMetadata[id].config.options;
      } else if (this.paramsMetadata[id].config.select && this.paramsMetadata[id].config.select.options) {
        return this.paramsMetadata[id].config.select.options;
      } else {
        return [];
      }
    } else {
      return [];
    }
  }

  public getParamInputLabel(id: string): string {
    return this.isKnownParam(id) ? this.paramsMetadata[id].config.label : undefined;
  }

  public getDefaultParamValue(id: string): {value?: any, unit?: string} {
    switch (id) {
      case "dt":
        return {
          value: this.paramsMetadata[id].config.input.defaultValue *
            parseInt(this.paramsMetadata[id].config.select.defaultValue, 10),
        };
      default:
        if (this.paramsMetadata[id].type === "checkbox") {
          return { value: true };
        } else if (
          this.paramsMetadata[id].config &&
          this.paramsMetadata[id].config.defaultValue !== undefined
        ) {
          return { value: this.paramsMetadata[id].config.defaultValue };
        } else if (
          this.paramsMetadata[id].config &&
          this.paramsMetadata[id].config.input &&
          this.paramsMetadata[id].config.input.defaultValue !== undefined
        ) {
          const value: any = { value: this.paramsMetadata[id].config.input.defaultValue };
          if (this.paramsMetadata[id].config.select && this.paramsMetadata[id].config.select.defaultValue !== undefined) {
            value.unit = this.paramsMetadata[id].config.select.defaultValue;
          }
          return value;
        } else {
          return {};
        }
    }
  }

  // Takes a saved param value (in proper format for data calls) and converts it
  // to a format that can be used to customize it
  public convertParamValue(id: string, value: any): {value?: any, unit?: string} {
    switch (id) {
      case "dt":
        const val = parseFloat(value.value);
        if (val < 3600) {
          return {value: Math.round(val * 100 / 60) / 100, unit: "60"};
        } else if (val >= 3600 && val < 86400) {
          return {value: Math.round(val * 100 / 3600) / 100, unit: "3600"};
        } else if (val >= 86400 && val < 604800) {
          return {value: Math.round(val * 100 / 86400) / 100, unit: "86400"};
        } else if (val >= 604800 && val < 2628000) {
          return {value: Math.round(val * 100 / 604800) / 100, unit: "604800"};
        } else {
          return {value: Math.round(val * 100 / 2628000) / 100, unit: "2628000"};
        }
      default:
        return value;
    }
  }

}
