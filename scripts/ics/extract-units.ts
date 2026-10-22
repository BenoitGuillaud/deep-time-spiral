import {
  ICS_RANKS,
  LOCALES,
  type IcsBoundary,
  type IcsRank,
  type IcsUnit,
} from '../../src/data/types.ts';
import { parseTurtle, type Term, type Triple } from './turtle.ts';

const ISCHART = 'http://resource.geosciml.org/classifier/ics/ischart/';
const RANK = 'http://resource.geosciml.org/ontology/timescale/rank/';
const P = {
  rank: 'http://resource.geosciml.org/ontology/timescale/gts#rank',
  broader: 'http://www.w3.org/2004/02/skos/core#broader',
  prefLabel: 'http://www.w3.org/2004/02/skos/core#prefLabel',
  notation: 'http://www.w3.org/2004/02/skos/core#notation',
  note: 'http://www.w3.org/2004/02/skos/core#note',
  order: 'http://www.w3.org/ns/shacl#order',
  color: 'https://schema.org/color',
  marginOfError: 'https://schema.org/marginOfError',
  hasBeginning: 'http://www.w3.org/2006/time#hasBeginning',
  hasEnd: 'http://www.w3.org/2006/time#hasEnd',
  inMYA: `${ISCHART}inMYA`,
} as const;

/** Chart ranks we keep, mapped from the ICS rank vocabulary. Ages (stages) are left out. */
const RANKS: Record<string, IcsRank> = {
  'Super-Eon': 'super-eon',
  Eon: 'eon',
  Era: 'era',
  Period: 'period',
  'Sub-Period': 'sub-period',
  Epoch: 'epoch',
};

const keyOf = (term: Term): string =>
  term.kind === 'blank' ? `_:${String(term.id)}` : term.kind === 'iri' ? term.value : '';

function index(triples: Triple[]): Map<string, Map<string, Term[]>> {
  const bySubject = new Map<string, Map<string, Term[]>>();
  for (const { subject, predicate, object } of triples) {
    const key = keyOf(subject);
    const predicates = bySubject.get(key) ?? new Map<string, Term[]>();
    predicates.set(predicate, [...(predicates.get(predicate) ?? []), object]);
    bySubject.set(key, predicates);
  }
  return bySubject;
}

/** Extracts eons, eras, periods, sub-periods and epochs from the ICS chart data, youngest first. */
export function extractUnits(ttl: string): IcsUnit[] {
  const graph = index(parseTurtle(ttl));

  const values = (subject: string, predicate: string): Term[] =>
    graph.get(subject)?.get(predicate) ?? [];
  const one = (subject: string, predicate: string): Term => {
    const found = values(subject, predicate);
    const [term] = found;
    if (found.length !== 1 || !term) {
      throw new Error(
        `${subject}: expected exactly one ${predicate}, found ${String(found.length)}`,
      );
    }
    return term;
  };
  const literal = (term: Term, where: string): string => {
    if (term.kind !== 'literal') throw new Error(`${where}: expected a literal`);
    return term.value;
  };
  const number = (term: Term, where: string): number => {
    const value = Number(literal(term, where));
    if (!Number.isFinite(value)) throw new Error(`${where}: not a number`);
    return value;
  };

  const boundary = (subject: string, predicate: string): IcsBoundary => {
    const node = keyOf(one(subject, predicate));
    const age = one(node, P.inMYA);
    const margin = values(node, P.marginOfError)[0];
    const notes = values(node, P.note).map((term) => literal(term, `${subject} note`));
    if (notes.some((note) => note !== 'uncertain'))
      throw new Error(`${subject}: unknown boundary note`);
    return {
      ma: number(age, `${subject} age`),
      text: literal(age, `${subject} age`),
      plusMinus: margin ? number(margin, `${subject} margin`) : null,
      uncertain: notes.includes('uncertain'),
    };
  };

  const units: IcsUnit[] = [];
  for (const [subject, predicates] of graph) {
    const rankTerm = predicates.get(P.rank)?.[0];
    if (!subject.startsWith(ISCHART) || rankTerm?.kind !== 'iri') continue;
    const rank = RANKS[rankTerm.value.replace(RANK, '')];
    if (!rank) continue;

    const parents = values(subject, P.broader);
    if (parents.length > 1) throw new Error(`${subject}: more than one parent`);
    const parent = parents[0];

    const prefLabels = values(subject, P.prefLabel);
    const labels =
      prefLabels.length === 0
        ? null
        : (Object.fromEntries(
            LOCALES.map((locale) => {
              const label = prefLabels.find(
                (term) => term.kind === 'literal' && term.lang === locale,
              );
              if (!label) throw new Error(`${subject}: no ${locale} label`);
              return [locale, literal(label, `${subject} label`)];
            }),
          ) as Record<(typeof LOCALES)[number], string>);

    units.push({
      id: subject.slice(ISCHART.length),
      rank,
      parent: parent?.kind === 'iri' ? parent.value.slice(ISCHART.length) : null,
      order: number(one(subject, P.order), `${subject} order`),
      notation: literal(one(subject, P.notation), `${subject} notation`),
      color: literal(one(subject, P.color), `${subject} colour`).toUpperCase(),
      begin: boundary(subject, P.hasBeginning),
      end: boundary(subject, P.hasEnd),
      labels,
    });
  }

  const known = new Set<string>(ICS_RANKS);
  if (units.some((unit) => !known.has(unit.rank))) throw new Error('Unexpected rank');
  return units.sort((a, b) => a.order - b.order);
}
