// Notebook (spec Phase 3): observations/notes anchored to objects and/or times, plus
// timeline markers. Pure data + persistence; anchored to object IDs + sim time so a note
// re-finds its objects (and its moment) after a reload or a time-scrub. The instrument
// renders the notebook and lets you jump back to a note's time/objects.

export interface Note {
  id: string;
  title?: string;
  text: string;
  /** Objects this note is about (may be empty for a free note). */
  objectIds: string[];
  /** Sim time (Julian years since J2000) the note is pinned to, or null if not time-anchored. */
  atYears: number | null;
  createdAtYears: number;
}

export interface TimelineMarker {
  id: string;
  label: string;
  atYears: number;
}

export interface Notebook {
  notes: Note[];
  markers: TimelineMarker[];
}

const SCHEMA = 1;

export function emptyNotebook(): Notebook {
  return { notes: [], markers: [] };
}

export function serializeNotebook(nb: Notebook): string {
  return JSON.stringify({ schema: SCHEMA, ...nb });
}

export function parseNotebook(json: string): Notebook {
  const obj = JSON.parse(json) as { notes?: unknown; markers?: unknown };
  const notes: Note[] = Array.isArray(obj.notes)
    ? obj.notes.map((n, i) => {
        const d = n as Partial<Note>;
        if (typeof d.id !== "string") throw new Error(`note ${i}: missing id`);
        return {
          id: d.id,
          title: d.title,
          text: d.text ?? "",
          objectIds: Array.isArray(d.objectIds) ? (d.objectIds as string[]) : [],
          atYears: typeof d.atYears === "number" ? d.atYears : null,
          createdAtYears: typeof d.createdAtYears === "number" ? d.createdAtYears : 0,
        };
      })
    : [];
  const markers: TimelineMarker[] = Array.isArray(obj.markers)
    ? obj.markers.map((m, i) => {
        const d = m as Partial<TimelineMarker>;
        if (typeof d.id !== "string") throw new Error(`marker ${i}: missing id`);
        if (typeof d.atYears !== "number") throw new Error(`marker ${d.id}: atYears required`);
        return { id: d.id, label: d.label ?? "", atYears: d.atYears };
      })
    : [];
  return { notes, markers };
}
