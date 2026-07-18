// UI-layer integration test (Phase 3 acceptance, at the layer where it was actually
// failing): drive the real buttons and verify the button -> state -> localStorage -> reload
// -> re-resolution chain. The WebGL view is mocked (jsdom has no GL); everything else is the
// real App + real @vobs/engine. This is what guarantees "annotation persists across reload"
// is true in the UI, not only in the engine.
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { serializeAnnotations } from "@vobs/engine";
import { App } from "../App";

// jsdom can't create a WebGL context, so stub the 3D view (we test panels + persistence).
vi.mock("../components/SkyView", () => ({ SkyView: () => null }));

const star = (id: string, name: string, pos: [number, number, number], mag: number) => ({
  id, name, pos_pc: pos, vel_kms: [0, 0, 0], mag_ref: mag,
  d_ref_pc: Math.hypot(...pos), bp_rp: 0.6, has_rv: false,
});
const catalog = {
  schema_version: "0.1", frame: "galactic_cartesian_pc", epoch: "J2000.0",
  stars: [
    star("HIP71683", "Alpha Cen A", [10, 0, 0], -0.01),
    star("A", "Star A", [12, 3, 1], 3.0),
    star("B", "Star B", [8, -2, 2], 4.0),
  ],
};
const world = {
  schema_version: "0.1", name: "Test",
  host_star: { catalog_id: null, galactic_xyz_pc: [0, 0, 0], space_velocity_kms: [0, 0, 0], mass_msun: 1, luminosity_lsun: 1, teff_k: 5772, radius_rsun: 1 },
  planet: { radius_km: 6371, mass_mearth: 1, rotation_period_s: 86164, axial_tilt_deg: 23.4, north_pole_inertial: { ra_deg: 0, dec_deg: 90 }, orbit: { a_au: 1, e: 0, i_deg: 0, Omega_deg: 0, omega_deg: 0, M0_deg: 0, epoch_jd: 2451545 } },
  moons: [], observer: { lat_deg: 0, lon_deg: 0, elevation_m: 0 }, epoch_jd: 2451545, catalog_ref: "x",
};

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn((url: string) =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(String(url).includes("catalog") ? catalog : world) }),
  ));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Phase 3 UI persistence (through the 6R modal chrome)", () => {
  // The UI is modal now: LOG (key 5) holds survey+notebook, MEASURE (key 3) holds
  // measurements+annotations. Wait for the chrome, pause the alive-by-default clock, then
  // enter the mode under test with its number key.
  const boot = async (user: ReturnType<typeof userEvent.setup>) => {
    await screen.findByText("epoch");   // time bar = the app is loaded
    await user.keyboard(" ");           // pause the local clock (plays by default)
  };

  it("a note is created from the button and survives a reload", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await boot(user);
    await user.keyboard("5"); // LOG mode

    await user.click(await screen.findByText("+ note"));
    await user.type(await screen.findByPlaceholderText("observation / note"), "Barnard crosses the meridian");
    await user.click(screen.getByText("save"));

    expect(await screen.findByText(/Barnard crosses the meridian/)).toBeTruthy();
    expect(localStorage.getItem("vobs.notebook.v1") ?? "").toContain("Barnard crosses the meridian");

    unmount(); // simulate a reload
    render(<App />);
    await boot(user);
    await user.keyboard("5");
    expect(await screen.findByText(/Barnard crosses the meridian/)).toBeTruthy();
  });

  it("a time marker is created from the button and survives a reload", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await boot(user);
    await user.keyboard("5");

    await user.click(await screen.findByText("+ time marker"));
    await user.type(await screen.findByPlaceholderText("marker label"), "epoch zero");
    await user.click(screen.getByText("save"));

    expect(await screen.findByText(/epoch zero/)).toBeTruthy();
    expect(localStorage.getItem("vobs.notebook.v1") ?? "").toContain("epoch zero");

    unmount();
    render(<App />);
    await boot(user);
    await user.keyboard("5");
    expect(await screen.findByText(/epoch zero/)).toBeTruthy();
  });

  it("a figure persists across reload and reconnects its star IDs", async () => {
    const user = userEvent.setup();
    localStorage.setItem("vobs.annotations.v1", serializeAnnotations([
      { id: "f1", kind: "figure", name: "Test line", nodeIds: ["A", "B"], edges: [[0, 1]], constellation: true, createdAtYears: 0 },
    ]));
    render(<App />);
    await boot(user);
    await user.keyboard("3"); // MEASURE mode
    await user.click(await screen.findByText("Annotations")); // expand section
    // appears in the annotations list, fully resolved (not flagged "missing")
    expect(await screen.findByText("Test line")).toBeTruthy();
    expect(screen.queryByText(/some stars missing/)).toBeNull();

    cleanup(); // reload
    render(<App />);
    await boot(user);
    await user.keyboard("3");
    await user.click(await screen.findByText("Annotations"));
    expect(await screen.findByText("Test line")).toBeTruthy();
  });
});
