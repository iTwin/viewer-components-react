/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Guid } from "@itwin/core-bentley";
import { Configuration, Label, Material } from "./Template"

// For now only one template for each report.

export default class TemplateClient {
  public getTemplates(): Configuration[] {
    var templates: Configuration[] = [];
    for (var i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("sel.")) {
        const value = localStorage.getItem(key);
        if (value) {
          const sel = JSON.parse(value);
          templates.push(sel);
        }
      }
    }
    return templates;
  }

  public createUpdateTemplate(template: Configuration): string {
    if (!template.id)
      template.id = Guid.createValue()

    const key = template.id;
    const text = JSON.stringify(template);
    localStorage.removeItem("sel." + key);
    localStorage.setItem("sel." + key, text);

    return key ?? "";
  }

  public deleteTemplate(templateId: string) {
    localStorage.removeItem("sel." + templateId);
  }
}