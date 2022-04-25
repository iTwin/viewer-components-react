/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// Allows module SCSS file imports
declare module "*.scss" {
  const content: { [className: string]: string };
  export = content;
}

// Declare HighCharts theme modules, whos typings are missing in official package
declare module "highcharts/themes/brand-light";
declare module "highcharts/themes/brand-dark";
