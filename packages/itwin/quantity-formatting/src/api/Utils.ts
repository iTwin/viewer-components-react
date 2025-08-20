/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import type { IModelConnection } from "@itwin/core-frontend";

/**
 * Queries an iModel to get all KindOfQuantity items that are actually used by properties
 *
 * @param iModel - The iModel connection to query, used to create a queryReader.
 * @returns Array of used KindOfQuantity full names.
 *
 * @example
 * ```typescript
 * const usageInfo = await getUsedKindOfQuantitiesFromIModel(iModel);
 * console.log(`Found ${usageInfo.length} used KindOfQuantities`);
 * usageInfo.forEach(info => {
 *   console.log(`${info.kindOfQuantityFullName}`);
 * });
 * ```
 * @alpha
 */
export async function getUsedKindOfQuantitiesFromIModel(iModel: IModelConnection): Promise<{ kindOfQuantityFullName: string }[]> {
  const ecsqlQuery = `
    SELECT
      ks.Name || '.' || k.Name AS kindOfQuantityFullName
    FROM
      ECDbMeta.ECPropertyDef p
      JOIN ECDbMeta.KindOfQuantityDef k ON k.ECInstanceId = p.KindOfQuantity.Id
      JOIN ECDbMeta.ECSchemaDef ks ON ks.ECInstanceId = k.Schema.Id
    GROUP BY
      ks.Name,
      k.Name
  `;

  try {
    const reader = iModel.createQueryReader(ecsqlQuery);
    const allRows = await reader.toArray();

    return allRows.map(row => {
      return {
        kindOfQuantityFullName: row[0] as string
      };
    });
  } catch (error) {
    // Query failed, return empty array
    console.warn("Failed to query used KindOfQuantities from iModel:", error);
    return [];
  }
}
