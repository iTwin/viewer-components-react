// Allows svg to be imported like this this:
// import geoSearchSvg from "./icons/geosearch.svg?sprite";
declare module "*.svg?sprite" {

  const src: string;

  export default src;

}
