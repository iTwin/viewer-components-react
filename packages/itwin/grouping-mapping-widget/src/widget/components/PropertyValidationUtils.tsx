import type { CalculatedProperty, CustomCalculation, GroupProperty } from "@itwin/insights-client";

class Graph {
  adjList: Map<string, string[]>;

  constructor() {
    this.adjList = new Map();
  }

  public addEntity(entity: string) {
    this.adjList.set(entity, []);
  }

  public addDep(dependent: string, dependency: string) {
    if (this.adjList.has(dependent)) {
      this.adjList.get(dependent)?.push(dependency);
    }
  }

  public isNumeric(str: string): boolean {
    return /^\d+$/.test(str);
  }

  public isMathSymbol(str: string): boolean {
    const symbols = ["+", "-", "*", "/", "=", "<", ">", "!", "&", "|", "%"];
    return symbols.includes(str);
  }

  public hasCyclicDep(node: string, visited: Set<string>, stack: Set<string>, outliers: string[]): boolean {
    visited.add(node);
    stack.add(node);
    for(const neigh of this.adjList.get(node) || []) {
      if (!visited.has(neigh)) {
        if (this.hasCyclicDep(neigh, visited, stack, outliers)) {
          return true;
        }
      } else if (stack.has(neigh)) {
        outliers.push(node);
        return true;
      }
    }
    stack.delete(node);
    return false;
  }

  public cleanFromula(customCalcProps: CustomCalculation[]) {
    const calcPropsArray = [];
    for (const prop of customCalcProps) {
      const propName = prop.propertyName;
      calcPropsArray.push(propName);
      const pattern = /(["'`])(.*?)\1/g;
      const withOutQuotes = prop.formula.replace(pattern, "gotFactorWithQuotes");
      const deps = withOutQuotes.match(/(?:[0-9.,%()=/*+-]|\w+)/g);
      deps?.forEach((factor) => {
        if (this.adjList.has(factor)) {
          this.addDep(propName, factor);
        } else if (factor === "gotFactorWithQuotes") {
          this.addDep(propName, factor);
        }
      });
    }
    return calcPropsArray;
  }

  public validateSanity(calcPropsArray: string[]): string[] | null {
    const visited = new Set<string>();
    const stack = new Set<string>();
    const outliers: string[] = [];
    for (const node of this.adjList.keys()) {
      if (!visited.has(node) && this.hasCyclicDep(node, visited, stack, outliers)) {
        return outliers;
      }
    }
    for (const [node, dep] of this.adjList) {
      for (const dep_ of dep) {
        if (!this.adjList.has(dep_)) {
          if (dep_ !== "gotFactorWithQuotes") {
            outliers.push(node);
          }
        }
      }
      if (dep.includes(node)) {
        outliers.push(node);
      }
      if (calcPropsArray.includes(node) && dep.length === 0) {
        outliers.push(node);
      }
    }
    return outliers.length > 0 ? outliers : null;
  }
}

export interface invalids {
  id: string;
  customCalcName: string;
  origName: string;
  changedName: string;
  origFormula: string;
  changedFormula: string;
}

export interface PropertyValidationProps {
  customCalcProps: CustomCalculation[];
  origPropertyName: string;
  changedPropertyName: string;
}

export const PropertyValidation = async ({
  origPropertyName,
  changedPropertyName,
  customCalcProps,
}: PropertyValidationProps): Promise<invalids[]> => {
  let outliers: string[] | null = [];
  async function checkOutliers(changedPropName: string) {
    const graph: Graph = new Graph();
    [customCalcProps].forEach((array) => {
      array.forEach((dic) => {
        graph.addEntity(dic.propertyName);
      });
    });
    const calcPropsArray = graph.cleanFromula(customCalcProps);
    outliers = graph.validateSanity(calcPropsArray);
    const changes: invalids[] = [];
    for (const prop of customCalcProps) {
      const propName = prop.propertyName;
      const propertyFormula = prop.formula;
      if (outliers?.includes(propName)) {
        const regex = new RegExp(origPropertyName, "g");
        const newFormula = propertyFormula.replace(regex, changedPropName);
        if (newFormula !== prop.formula) {
          const change: invalids = {
            id: prop.id,
            customCalcName: prop.propertyName,
            origName: origPropertyName,
            changedName: changedPropName,
            origFormula: prop.formula,
            changedFormula: newFormula,
          };
          changes.push(change);
        }
      }
    }
    return changes;
  }
  return checkOutliers(changedPropertyName);
};

export interface GetOutliersProps {
  groupProps: GroupProperty[];
  calcProps: CalculatedProperty[];
  customCalcProps: CustomCalculation[];
  allProps: string[];
}

export const getOutliers = async ({
  groupProps,
  calcProps,
  customCalcProps,
  allProps,
}: GetOutliersProps) => {
  const graph: Graph = new Graph();
  [groupProps, calcProps, customCalcProps].forEach((array) => {
    array.forEach((dic) => {
      graph.addEntity(dic.propertyName);
      allProps.push(dic.propertyName);
    });
  });
  const calcPropsArray = graph.cleanFromula(customCalcProps);
  let outliers: string[] | null = [];
  outliers =  graph.validateSanity(calcPropsArray);
  if (outliers) {
    return outliers;
  } else {
    return [];
  }
};
