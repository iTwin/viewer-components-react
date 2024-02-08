import { useEffect, useState } from "react";
import { Id64Set, Id64String } from "@itwin/core-bentley";
import { ColorDef, FeatureAppearance, IModelVersion } from "@itwin/core-common";
import { CheckpointConnection } from "@itwin/core-frontend";
import { useFeatureOverrides } from "@itwin/imodel-react-hooks";
import { useIModelInfo } from "./Viewer";

export function RandomColorOverrides({ className }: { className: string }) {
  const { iTwinId, iModelId } = useIModelInfo();
  const [elementIds, setElementIds] = useState<Id64Set>();

  useEffect(() => {
    let isStale = false;
    async function fetchIds() {
      if (!iTwinId || !iModelId || !className) return;

      try {
        const connection = await CheckpointConnection.openRemote(iTwinId, iModelId, IModelVersion.latest());
        if (isStale) return;

        const elements = await getEcElementIds(className, connection);
        if (isStale || !elements) return;

        setElementIds(elements);
      } catch (err: unknown) {
        console.error(`Error occurred while trying to fetch '${className}' ids: ${err}`);
      }
    }

    fetchIds();

    return () => {
      isStale = true;
    };
  }, [iTwinId, iModelId, className]);

  // create a feature override with a random color for each element
  useFeatureOverrides(
    {
      overrider: (overrides) => {
        elementIds?.forEach((id) => {
          overrides.override({
            elementId: id,
            appearance: FeatureAppearance.fromRgb(ColorDef.from(Math.random() * 255, Math.random() * 255, Math.random() * 255)),
          });
        });
      },
    },
    [elementIds],
  );

  return null;
}

async function getEcElementIds(className: string, connection: CheckpointConnection) {
  if (!connection) return null;

  const set: Id64Set = new Set<Id64String>();
  const limit = 10000;
  let offset = 0;
  while (set.size >= offset) {
    const nextSet = await connection.elements.queryIds({
      from: className,
      offset,
      limit,
    });
    offset += limit;

    nextSet.forEach((id) => set.add(id));
  }

  return set;
}
