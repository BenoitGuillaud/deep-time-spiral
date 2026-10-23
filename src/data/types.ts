/** Shapes of the data files in src/data. */

export const LOCALES = ['en', 'fr', 'de', 'hu'] as const;
export type Locale = (typeof LOCALES)[number];

export const ICS_RANKS = ['super-eon', 'eon', 'era', 'period', 'sub-period', 'epoch'] as const;
export type IcsRank = (typeof ICS_RANKS)[number];

/** One end of a geologic unit, in millions of years ago (Ma), exactly as the ICS chart gives it. */
export interface IcsBoundary {
  ma: number;
  /** The number as printed in the chart data, e.g. "66.00", kept for grown-up mode. */
  text: string;
  /** ± uncertainty in Ma, or null when the chart gives none. */
  plusMinus: number | null;
  /** True where the chart marks the age as approximate ("~" on the PDF). */
  uncertain: boolean;
}

export interface IcsUnit {
  /** Local name in the ICS vocabulary, e.g. "Cretaceous". */
  id: string;
  rank: IcsRank;
  parent: string | null;
  /** ICS display order: 1 is the youngest unit. */
  order: number;
  /** CCGM short code, e.g. "K". */
  notation: string;
  /** Official ICS (CCGM) colour, "#RRGGBB". */
  color: string;
  begin: IcsBoundary;
  end: IcsBoundary;
  /**
   * Official unit names from the chart data. Null where the data gives none: some subdivided epochs
   * (e.g. "Lower Jurassic") are named on the PDF from their parent's name instead.
   */
  labels: Record<Locale, string> | null;
}

export interface IcsData {
  chart: {
    version: string;
    source: string;
    commit: string;
    sha256: string;
    license: string;
  };
  units: IcsUnit[];
}

export type AgeQualifier = 'about' | 'at-least' | 'exact';

export interface Source {
  citation: string;
  url: string;
  /** Where in the source the number appears, so anyone can check it. */
  detail: string;
  /** ISO date the source was checked. */
  accessed: string;
}

/** An event age taken from a cited, non-ICS source. */
export interface CitedAge {
  kind: 'cited';
  years: number;
  plusMinusYears: number | null;
  qualifier: AgeQualifier;
  source: Source;
}

/** An event age taken from a boundary of an ICS unit, so the number is never duplicated. */
export interface IcsAge {
  kind: 'ics';
  unit: string;
  boundary: 'begin' | 'end';
}

export interface DeepTimeEvent {
  id: string;
  age: CitedAge | IcsAge;
}
