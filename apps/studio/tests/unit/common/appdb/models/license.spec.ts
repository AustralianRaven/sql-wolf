import { LicenseKey } from "@/common/appdb/models/LicenseKey";
import { isVersionLessThanOrEqual, parseVersion } from "@/common/version";
import _ from "lodash";
import platformInfo from "@/common/platform_info";
import { TestOrmConnection } from "@tests/lib/TestOrmConnection";

const ANY_VERSION = "1.0.0";
const ANY_VERSION_TAG = "v1.0.0";
const EARLY_VERSION_TAG = "v0.9.0";

function v(strings: TemplateStringsArray) {
  const [major, minor, patch] = strings[0].split(".");
  return {
    major: parseInt(major),
    minor: parseInt(minor),
    patch: parseInt(patch),
  };
}

function expectStatus() {
  return expect(
    LicenseKey.getLicenseStatus().then((s) => _.omit(s, ["license", "fromFile", "filePath"]))
  ).resolves;
}

async function createLicense(options: {
  validUntil: string;
  supportUntil?: string;
  maxAllowedAppRelease: Nullable<{ tagName: string }>;
  licenseType?: "PersonalLicense" | "TrialLicense";
}) {
  await LicenseKey.clear();
  const license = new LicenseKey();
  license.validUntil = new Date(options.validUntil);
  license.supportUntil = new Date(options.supportUntil ?? options.validUntil);
  license.licenseType = options.licenseType ?? "PersonalLicense";
  license.email = "fake-email";
  license.key = "fake-key";
  license.maxAllowedAppRelease = options.maxAllowedAppRelease;
  return await license.save();
}

function currentTime(date: string) {
  jest.useFakeTimers({ now: new Date(date).getTime() });
}

function currentVersion(version: string) {
  const [major, minor, patch] = version.split(".");
  platformInfo.parsedAppVersion = {
    major: parseInt(major),
    minor: parseInt(minor),
    patch: parseInt(patch),
  };
}

describe("License", () => {
  it("parse version correctly", () => {
    expect(parseVersion("1.0.2")).toEqual({ major: 1, minor: 0, patch: 2 });
    expect(parseVersion("10.12.11")).toEqual({
      major: 10,
      minor: 12,
      patch: 11,
    });
  });

  it("isVersionLessThanOrEqual", () => {
    expect(isVersionLessThanOrEqual(v`1.2.3`, v`1.2.3`)).toBe(true);
    expect(isVersionLessThanOrEqual(v`1.2.1`, v`1.2.3`)).toBe(true);
    expect(isVersionLessThanOrEqual(v`1.2.3`, v`1.0.0`)).toBe(false);
    expect(isVersionLessThanOrEqual(v`1.3.2`, v`1.2.3`)).toBe(false);

    expect(isVersionLessThanOrEqual(v`1.99.99`, v`2.2.3`)).toBe(true);
    expect(isVersionLessThanOrEqual(v`1.1.99`, v`1.2.3`)).toBe(true);
    expect(isVersionLessThanOrEqual(v`1.1.99-beta.1`, v`1.1.99-beta.2`)).toBe(true);
    expect(isVersionLessThanOrEqual(v`1.1.99`, v`1.2.0-beta.1`)).toBe(true);
  });

  /**
   * This fork replaced upstream's tiered licensing with a flat "always ultimate"
   * rule (see keysToStatus in LicenseKey.ts). These tests pin that contract, so
   * a future upstream merge that quietly restores the tiered logic fails here
   * instead of silently locking features away.
   */
  describe("License status - fork always reports ultimate", () => {
    const origParsedAppVersion = platformInfo.parsedAppVersion;

    beforeEach(async () => {
      await TestOrmConnection.connect();
    });

    afterEach(async () => {
      jest.useRealTimers();
      await TestOrmConnection.disconnect();
      platformInfo.parsedAppVersion = origParsedAppVersion;
    });

    it("reports ultimate when no license is present", async () => {
      await expectStatus().toEqual({
        edition: "ultimate",
        condition: ["App version allowed"],
      });
    });

    it.each([
      [
        "an expired trial license",
        { validUntil: "17-Sep-2024", maxAllowedAppRelease: { tagName: ANY_VERSION_TAG }, licenseType: "TrialLicense" as const },
      ],
      [
        "a license past both its support and valid dates",
        { validUntil: "17-Sep-2024", supportUntil: "17-Sep-2024", maxAllowedAppRelease: { tagName: ANY_VERSION_TAG } },
      ],
      [
        "a license with no app version restriction",
        { validUntil: "17-Sep-2024", maxAllowedAppRelease: null },
      ],
      [
        "a lifetime license whose support window has ended",
        { validUntil: "18-Sep-2024", supportUntil: "17-Sep-2024", maxAllowedAppRelease: { tagName: ANY_VERSION_TAG } },
      ],
      [
        "a license that does not allow the current app version",
        { validUntil: "18-Sep-2024", supportUntil: "17-Sep-2024", maxAllowedAppRelease: { tagName: EARLY_VERSION_TAG } },
      ],
    ])("reports ultimate given %s", async (_title, options) => {
      currentTime("18-Sep-2024");
      currentVersion(ANY_VERSION);
      await createLicense(options);

      await expectStatus().toEqual({
        edition: "ultimate",
        condition: ["App version allowed"],
      });
    });
  });

  // Regression tests for version comparison
  it("Should properly compare versions", async () => {
    expect(isVersionLessThanOrEqual(parseVersion("v2.4.6"), parseVersion("v5.7.2"))).toBeTruthy();
    expect(isVersionLessThanOrEqual(parseVersion("v2.5.1-beta.4"), parseVersion("v5.0.0"))).toBeTruthy();
    expect(isVersionLessThanOrEqual(parseVersion("v6.3.7"), parseVersion("v4.2.1"))).not.toBeTruthy();
    expect(isVersionLessThanOrEqual(parseVersion("v3.1.3-beta.4"), parseVersion("v1.8.1"))).not.toBeTruthy();
    expect(isVersionLessThanOrEqual(parseVersion("v5.0.0"), parseVersion("v5.0.0"))).toBeTruthy();
  });
});
