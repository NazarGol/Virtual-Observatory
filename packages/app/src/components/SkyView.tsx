import { useEffect, useRef } from "react";
import type { Vec3 } from "@vobs/engine";
import { StarField, type StarPoint } from "../three/StarField";

interface Props {
  stars: StarPoint[];
  selectionDirs: Vec3[];
  overlays: Vec3[][];
  figures: Vec3[][];
  labels: { dir: Vec3; text: string }[];
  onHoverIndex: (i: number | null) => void;
  onPickIndex: (i: number | null) => void;
  onFov: (fov: number) => void;
  fovRef: (setFov: (f: number) => void) => void;
  exposureRef: (setExposure: (v: number) => void) => void;
  milkyWay: { normalIcrs: Vec3; centerIcrs: Vec3; gain: number };
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
  useEffect(() => { fieldRef.current?.setMilkyWay(props.milkyWay.normalIcrs, props.milkyWay.centerIcrs, props.milkyWay.gain); },
    [props.milkyWay]);

  return <div className="sky" ref={mountRef} />;
}
