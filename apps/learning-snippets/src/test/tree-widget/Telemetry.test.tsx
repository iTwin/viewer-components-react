// /* eslint-disable no-console */
// import { ModelsTreeComponent, TelemetryContextProvider } from "@itwin/tree-widget-react";
// import React from "react";

// // __PUBLISH_EXTRACT_START__ Presentation.Tree-widget.Typical-example-imports

// // __PUBLISH_EXTRACT_END__
// describe("Tree-widget", () => {
//   describe("Learning-snippets", () => {
//     describe("Telemetry", () => {
//       describe("Usage tracking", () => {
//         it.skip("Telemetry learning snippet", async function () {
//           // __PUBLISH_EXTRACT_START__ Presentation.Tree-widget.Models-tree-example
//           // UiItemsManager.register( new TreeWidgetUiItemsProvider({
//           //   onPerformanceMeasured={(feature, elapsedTime) => {
//           //     telemetryClient.log(`TreeWidget [${feature}] took ${elapsedTime} ms`);
//           //   }},
//           //   onFeatureUsed={(feature) => { telemetryClient.log(`TreeWidget [${feature}] used`);
//           //   }},
//           // }) );
//           // __PUBLISH_EXTRACT_END__
//         });

//         it.skip("Telemetry for individual tree components learning snippet", async function () {
//           // __PUBLISH_EXTRACT_START__ Presentation.Tree-widget.Models-tree-example
//           function MyWidget() {
//             return (
//               <ModelsTreeComponent
//                 {...otherProps}
//                 onPerformanceMeasured={(feature, elapsedTime) => {
//                   console.log(`TreeWidget [${feature}] took ${elapsedTime} ms`);
//                 }}
//                 onFeatureUsed={(feature) => {
//                   console.log(`TreeWidget [${feature}] used`);
//                 }}
//               />
//             );
//           }
//           // __PUBLISH_EXTRACT_END__
//         });

//         it.skip("Telemetry for custom components learning snippet", async function () {
//           // __PUBLISH_EXTRACT_START__ Presentation.Tree-widget.Models-tree-example
//           function MyWidget() {
//             return (
//               <TelemetryContextProvider
//                 componentIdentifier="MyTree"
//                 onPerformanceMeasured={(feature, elapsedTime) => {
//                   console.log(`TreeWidget [${feature}] took ${elapsedTime} ms`);
//                 }}
//                 onFeatureUsed={(feature) => {
//                   console.log(`TreeWidget [${feature}] used`);
//                 }}
//               >
//                 <MyTree />
//               </TelemetryContextProvider>
//             );
//           }
//           function MyTree() {
//             // see "Custom trees" section for example implementation
//           }
//           // __PUBLISH_EXTRACT_END__
//         });
//       });
//     });
//   });
// });
