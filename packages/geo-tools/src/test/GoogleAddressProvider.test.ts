/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";
import { GoogleAddressProvider } from "../GoogleAddressProvider";

describe("GoogleAddressProvider", () => {
  let fetchStub: sinon.SinonStub;

  beforeEach(() => {
    fetchStub = sinon.stub(globalThis, "fetch");
  });

  async function getLocation(responseBody: unknown) {
    fetchStub.resolves({
      json: async () => responseBody,
    } as Response);

    return new GoogleAddressProvider().getLocation({
      formattedAddress: "Test address",
      placeId: "test-place-id",
    });
  }

  it("gets coordinates from a Google Places response", async () => {
    const location = await getLocation({
      location: {
        latitude: 40.7484,
        longitude: -73.9857,
      },
    });

    expect(location.latitudeDegrees).to.be.closeTo(40.7484, 1e-10);
    expect(location.longitudeDegrees).to.be.closeTo(-73.9857, 1e-10);
  });

  it("gets coordinates from a provider-wrapped Google Geocoding result", async () => {
    const location = await getLocation({
      result: {
        geometry: {
          location: {
            lat: 51.5007,
            lng: -0.1246,
          },
        },
      },
    });

    expect(location.latitudeDegrees).to.be.closeTo(51.5007, 1e-10);
    expect(location.longitudeDegrees).to.be.closeTo(-0.1246, 1e-10);
  });

  it("gets coordinates from the legacy provider response", async () => {
    const location = await getLocation({
      location: {
        geometry: {
          latitude: 48.8584,
          longitude: 2.2945,
        },
      },
    });

    expect(location.latitudeDegrees).to.be.closeTo(48.8584, 1e-10);
    expect(location.longitudeDegrees).to.be.closeTo(2.2945, 1e-10);
  });

  it("accepts zero coordinates", async () => {
    const location = await getLocation({
      location: {
        latitude: 0,
        longitude: 0,
      },
    });

    expect(location.latitudeDegrees).to.equal(0);
    expect(location.longitudeDegrees).to.equal(0);
  });

  for (const [description, responseBody] of [
    ["missing", {}],
    ["partially missing", { location: { latitude: 40.7484 } }],
    ["malformed", { location: { latitude: "40.7484", longitude: -73.9857 } }],
  ] as const) {
    it(`rejects ${description} coordinates`, async () => {
      const error = await getLocation(responseBody).then(
        () => undefined,
        (reason: unknown) => reason,
      );

      expect(error).to.be.instanceOf(Error);
      expect((error as Error).message).to.equal("Invalid location data");
    });
  }
});
