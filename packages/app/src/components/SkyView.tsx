import { useEffect, useRef } from "react";
import type { Vec3 } from "@vobs/engine";
import { StarField, type StarPoint, type BodyMarker } from "../three/StarField";

interface Props {
  stars: StarPoint[];
  selectionDirs: Vec3[];
  overlays: Vec3[][];
  figures: Vec3[][];
  labels: { dir: Vec3; text: string }[];
  onHoverIndex: (i: number | null) => void;
  onPickIndex: (i: number | null) => void;
  onFov: (fov: number) => void;
  onLook: (dir: Vec3) => void;
  fovRef: (setFov: (f: number) => void) => void;
  exposureRef: (setExposure: (v: number) => void) => void;
  milkyWayPoints: { dir: Vec3 }[];
  bodies: BodyMarker[];
  paths: { pts: Vec3[]; color: number; periodYears: number }[];
  /** sim time driving the crawl phase of orbital tracks */
  plotTime: number;
  projection: "gnomonic" | "fisheye" | "dome";
  horizonBasis: { east: Vec3; north: Vec3; up: Vec3 };
  sun: { dirIcrs: Vec3 | null; radiusDeg: number };
}

export function SkyView(props: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<StarField | null>(null);
  const cb = useRef(props);
  cb.current = props;

  useEffect(() => {
    const field = new StarField(mountRef.current!);
    field.onHover = (i) => cb.current.onHoverIndex(i);
    field.onPick = (i) => cb.current.onPickIndex(i);
    field.onView = (f) => cb.current.onFov(f);
    field.onLook = (d) => cb.current.onLook(d);
    fieldRef.current = field;
    cb.current.fovRef((f) => field.setFov(f));
    cb.current.exposureRef((v) => field.setExposure(v));
    const onResize = () => field.resize();
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); field.dispose(); fieldRef.current = null; };
  }, []);

  useEffect(() => { fieldRef.current?.setStars(props.stars); }, [props.stars]);
  useEffect(() => { fieldRef.current?.setSelection(props.selectionDirs); }, [props.selectionDirs]);
  useEffect(() => { fieldRef.current?.setOverlays(props.overlays); }, [props.overlays]);
  useEffect(() => { fieldRef.current?.setFigures(props.figures); }, [props.figures]);
  useEffect(() => { fieldRef.current?.setLabels(props.labels); }, [props.labels]);
  useEffect(() => { fieldRef.current?.setMilkyWayPoints(props.milkyWayPoints); }, [props.milkyWayPoints]);
  useEffect(() => { fieldRef.current?.setBodies(props.bodies); }, [props.bodies]);
  useEffect(() => { fieldRef.current?.setPaths(props.paths); }, [props.paths]);
  useEffect(() => { fieldRef.current?.setPlotTime(props.plotTime); }, [props.plotTime]);
  useEffect(() => { fieldRef.current?.setHorizonBasis(props.horizonBasis.east, props.horizonBasis.north, props.horizonBasis.up); },
    [props.horizonBasis]);
  useEffect(() => { fieldRef.current?.setProjection(props.projection); }, [props.projection]);
  useEffect(() => { fieldRef.current?.setSun(props.sun.dirIcrs, props.sun.radiusDeg); }, [props.sun]);

  return <div className="sky" ref={mountRef} />;
}
