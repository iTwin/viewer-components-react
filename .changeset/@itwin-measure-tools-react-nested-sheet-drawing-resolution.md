---
"@itwin/measure-tools-react": minor
---

Fix sheet measurements resolving the wrong view attachment.

`getDrawingMetadata` and `getDrawingData` take an optional `ResolveDrawingOptions`. When a `viewport` is supplied, the drawing that owns the element under the cursor is preferred over the drawing whose rectangle contains the point, falling back to the rectangle when nothing is picked. View attachment rectangles overlap — a drawing's rectangle can be much larger than its visible content and cover a neighbouring drawing — so on plan-and-profile sheets a measurement taken in the profile could be resolved against the enclosing plan and computed with its isotropic transforms, losing the profile's vertical exaggeration.

`SheetMeasurementHelper.getDrawingsAtPoint` returns every drawing whose rectangle contains a point, so callers that cannot pick an element can detect that resolution was ambiguous and tell the user the measurement may not use the intended drawing.

A view attachment's sheet-space rectangle is now derived from its placement origin **and** `bBoxLow`, via the new `SheetMeasurementHelper.getDrawingRange`. Previously `bBoxLow` was queried but never used, so every containment test assumed the placement bounding box started at local `(0,0)` and computed a displaced rectangle for any attachment where it does not. `getDrawingData` reports that same rectangle as `viewAttachmentOrigin`/`viewAttachmentExtent`, so `DrawingMetadata.origin`/`extents` and anything decorating them match what was actually hit-tested.

`DrawingMetadata` now carries `drawingType`, so the resolved drawing's type and its transforms can no longer come from two different view attachments. `drawingType`, `worldScale` and `sheetToProfileTransform` are now preserved by `DrawingMetadata.toJSON`/`fromJSON` and by `Measurement.copyFrom`, so they survive serialization and cloning.

`sheetToProfileTransform` is now populated by `getDrawingMetadata` and is left `undefined` when the drawing does not define one. Previously it was only available from the deprecated `SheetMeasurementsHelper.getDrawingId`, which passed the missing property to `Transform.fromJSON` and silently produced an identity transform — indistinguishable from a genuine 1:1 scale.
