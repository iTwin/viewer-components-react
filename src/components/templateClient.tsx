/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Guid } from "@itwin/core-bentley";
import { Template, Label, Material } from "./Template"

// For now only one template for each report.

export default class TemplateClient {
  getTemplatesT(): Template[] {

    var templates: Template[] = [];

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

    //templates[0] =
    //const text = localStorage.getItem("template");

    //return JSON.parse(text ?? "");
  }


  getTemplateT(templateId: string): Template | undefined {

    const value = localStorage.getItem("sel." + templateId);

    /*
    if (value == null) {
      const template: Template = {
        id: Guid.createValue(),
        reportId: reportId,
        labels: [],
      }

      this.createTemplate(template, reportId);
      */

    //return template;
    //}

    if (value) {
      const sel = JSON.parse(value);
      return sel;
    }
    else {
      return undefined;
    }


    //const sel = templates.filter(x => x.reportId == props.reportId);
  }


  //getLabel(id: string): LabelLabel {
  //  const text = localStorage.getItem("sel" + id);
  //  console.log("get (" + id + "): " + text);

  //  return JSON.parse(text ?? "");
  //}

  createUpdateTemplate(template: Template): string {

    if (!template.id)
      template.id = Guid.createValue()

    const key = template.id;
    //const key = "sel." + reportId //Guid.createValue();
    //const key = "template";

    //console.log("set (" + key + "): " + text);
    const text = JSON.stringify(template);
    localStorage.removeItem("sel." + key);
    localStorage.setItem("sel." + key, text);

    return key ?? "";
  }


  createTemplateDep(template: Template): string {
    const key = Guid.createValue();
    template.id = key;
    const text = JSON.stringify(template);

    //const key = "sel." + reportId //Guid.createValue();
    //const key = "template";

    //console.log("set (" + key + "): " + text);
    localStorage.removeItem("sel." + key);
    localStorage.setItem("sel." + key, text);

    return key;
  }

  deleteMaterialDep(template: Template, label: Label, materials: Material[], material: Material) {
    //const template = this.getTemplate(templateId);

    label.materials = materials.filter(x => x.name !== material.name);
    //this.deleteLabel(template.id ?? "", label.labelName);
    template.labels = template.labels.filter(x => x.reportTable !== label.reportTable);
    //template = this.getTemplate(template.)
    template.labels.push(label);
    //this.updateTemplate(template);
  }

  deleteTemplateDep(templateId: string) {
    localStorage.removeItem("sel." + templateId);
  }
}