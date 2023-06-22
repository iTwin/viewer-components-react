/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// Allows modular SCSS file imports
declare module "*.scss" {
  const content: { [className: string]: string };
  export = content;
}

// Declare HighCharts theme modules, which do not provide their own typings
declare module "highcharts/themes/brand-light";
declare module "highcharts/themes/brand-dark";
