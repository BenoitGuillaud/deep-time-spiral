import { describe, expect, it } from 'vitest';
import { parseTurtle } from '../../scripts/ics/turtle';

const EX = 'http://example.org/';

describe('parseTurtle', () => {
  it('reads prefixes, literals, language tags, datatypes, numbers and blank nodes', () => {
    const triples = parseTurtle(`
      PREFIX ex: <${EX}>
      @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
      # a comment
      ex:Cretaceous
          a ex:Period ;
          ex:label "Crétacé"@fr , "Kreide"@de ;
          ex:color "#7FC64E"^^ex:RGBHex ;
          ex:note """two
      lines""" ;
          ex:start [ ex:inMYA 143.1 ; ex:margin 0.6 ] ;
          ex:order 49 ;
          ex:ratified true .
    `);
    const objects = (predicate: string) =>
      triples.filter((t) => t.predicate === EX + predicate).map((t) => t.object);

    expect(triples[0]?.subject).toEqual({ kind: 'iri', value: `${EX}Cretaceous` });
    expect(objects('label')).toEqual([
      { kind: 'literal', value: 'Crétacé', lang: 'fr' },
      { kind: 'literal', value: 'Kreide', lang: 'de' },
    ]);
    expect(objects('color')).toEqual([
      { kind: 'literal', value: '#7FC64E', datatype: `${EX}RGBHex` },
    ]);
    expect(objects('note')[0]).toMatchObject({ value: 'two\n      lines' });
    expect(objects('order')[0]).toMatchObject({ value: '49' });
    expect(objects('inMYA')[0]).toMatchObject({ value: '143.1' });
    expect(objects('start')[0]).toEqual({ kind: 'blank', id: 0 });
    expect(triples.find((t) => t.predicate.endsWith('#type'))?.object).toEqual({
      kind: 'iri',
      value: `${EX}Period`,
    });
  });

  it('decodes escapes', () => {
    const [triple] = parseTurtle(`<${EX}a> <${EX}b> "say \\"hi\\" \\u00e9" .`);
    expect(triple?.object).toEqual({ kind: 'literal', value: 'say "hi" é' });
  });

  it('rejects syntax it does not support, instead of misreading it', () => {
    expect(() => parseTurtle(`<${EX}a> <${EX}b> ( 1 2 ) .`)).toThrow(SyntaxError);
    expect(() => parseTurtle(`<${EX}a> <${EX}b> _:x .`)).toThrow(SyntaxError);
    expect(() => parseTurtle(`ex:a ex:b ex:c .`)).toThrow(/Unknown prefix/);
  });
});
