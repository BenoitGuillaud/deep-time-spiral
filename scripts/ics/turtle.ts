/**
 * A small Turtle (RDF) parser: just enough for the ICS chart data (`data/ics/chart.ttl`).
 *
 * Supports PREFIX / @prefix, prefixed names, <IRIs>, "strings" and """long strings""" with escapes,
 * @language tags, ^^datatypes, numbers, booleans, `a`, [ blank node property lists ] and the
 * `;` `,` `.` separators. Anything else (collections, labelled blank nodes, …) throws, so a format
 * change in a future chart version fails loudly instead of being misread.
 */

export type Term =
  | { kind: 'iri'; value: string }
  | { kind: 'blank'; id: number }
  | { kind: 'literal'; value: string; lang?: string; datatype?: string };

export interface Triple {
  subject: Term;
  predicate: string;
  object: Term;
}

type Token =
  | { type: 'iri'; value: string }
  | { type: 'pname'; prefix: string; local: string }
  | { type: 'string'; value: string }
  | { type: 'lang'; value: string }
  | { type: 'number'; value: string }
  | { type: 'boolean'; value: string }
  | { type: 'punct'; value: '[' | ']' | ';' | ',' | '.' | '^^' }
  | { type: 'keyword'; value: 'a' | 'PREFIX' | '@prefix' };

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const XSD = 'http://www.w3.org/2001/XMLSchema#';

const PNAME = /^[A-Za-z][\w-]*(?:\.[\w-]+)*:(?:[\w-]+(?:\.[\w-]+)*)?/;
const NUMBER = /^[+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/;
const LANG = /^@[A-Za-z]+(?:-[A-Za-z0-9]+)*/;

function unescape(raw: string): string {
  return raw.replace(/\\(u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8}|.)/g, (_, code: string) => {
    if (code.startsWith('u') || code.startsWith('U')) {
      return String.fromCodePoint(parseInt(code.slice(1), 16));
    }
    const simple: Record<string, string> = {
      t: '\t',
      n: '\n',
      r: '\r',
      '"': '"',
      "'": "'",
      '\\': '\\',
    };
    const value = simple[code];
    if (value === undefined) throw new SyntaxError(`Unknown escape \\${code}`);
    return value;
  });
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text.charAt(i);
    const rest = text.slice(i, i + 200);
    if (/\s/.test(ch)) {
      i++;
    } else if (ch === '#') {
      const end = text.indexOf('\n', i);
      i = end === -1 ? text.length : end;
    } else if (ch === '<') {
      const end = text.indexOf('>', i);
      if (end === -1) throw new SyntaxError(`Unclosed IRI at ${String(i)}`);
      tokens.push({ type: 'iri', value: text.slice(i + 1, end) });
      i = end + 1;
    } else if (text.startsWith('"""', i)) {
      let j = i + 3;
      while (!text.startsWith('"""', j) || text.charAt(j - 1) === '\\') {
        if (j >= text.length) throw new SyntaxError(`Unclosed long string at ${String(i)}`);
        j++;
      }
      tokens.push({ type: 'string', value: unescape(text.slice(i + 3, j)) });
      i = j + 3;
    } else if (ch === '"') {
      let j = i + 1;
      while (text.charAt(j) !== '"') {
        if (text.charAt(j) === '\\') j++;
        if (j >= text.length || text.charAt(j) === '\n') {
          throw new SyntaxError(`Unclosed string at ${String(i)}`);
        }
        j++;
      }
      tokens.push({ type: 'string', value: unescape(text.slice(i + 1, j)) });
      i = j + 1;
    } else if (rest.startsWith('^^')) {
      tokens.push({ type: 'punct', value: '^^' });
      i += 2;
    } else if (ch === '[' || ch === ']' || ch === ';' || ch === ',' || ch === '.') {
      tokens.push({ type: 'punct', value: ch });
      i++;
    } else if (/^@prefix\b/.test(rest)) {
      tokens.push({ type: 'keyword', value: '@prefix' });
      i += '@prefix'.length;
    } else if (ch === '@') {
      const match = LANG.exec(rest);
      if (!match) throw new SyntaxError(`Bad language tag at ${String(i)}`);
      tokens.push({ type: 'lang', value: match[0].slice(1) });
      i += match[0].length;
    } else if (NUMBER.test(rest)) {
      const match = NUMBER.exec(rest);
      if (!match) throw new SyntaxError(`Bad number at ${String(i)}`);
      tokens.push({ type: 'number', value: match[0] });
      i += match[0].length;
    } else {
      const pname = PNAME.exec(rest);
      if (pname) {
        const [prefix = '', local = ''] = pname[0].split(/:(.*)/s);
        tokens.push({ type: 'pname', prefix, local });
        i += pname[0].length;
        continue;
      }
      const word = /^[A-Za-z]+/.exec(rest)?.[0];
      if (word === 'a' || word === 'PREFIX') {
        tokens.push({ type: 'keyword', value: word });
      } else if (word === 'true' || word === 'false') {
        tokens.push({ type: 'boolean', value: word });
      } else {
        throw new SyntaxError(`Unsupported Turtle syntax at ${String(i)}: ${rest.slice(0, 30)}`);
      }
      i += word.length;
    }
  }
  return tokens;
}

/** Parses Turtle text into triples with fully expanded IRIs. */
export function parseTurtle(text: string): Triple[] {
  const tokens = tokenize(text);
  const prefixes = new Map<string, string>();
  const triples: Triple[] = [];
  let pos = 0;
  let nextBlank = 0;

  const peek = (): Token | undefined => tokens[pos];
  const next = (): Token => {
    const token = tokens[pos++];
    if (!token) throw new SyntaxError('Unexpected end of input');
    return token;
  };
  const isPunct = (value: string): boolean => {
    const token = peek();
    return token?.type === 'punct' && token.value === value;
  };
  const expect = (value: string): void => {
    const token = next();
    if (token.type !== 'punct' || token.value !== value) {
      throw new SyntaxError(`Expected "${value}" but found ${JSON.stringify(token)}`);
    }
  };
  const expand = (token: Token): string => {
    if (token.type === 'iri') return token.value;
    if (token.type === 'pname') {
      const base = prefixes.get(token.prefix);
      if (base === undefined) throw new SyntaxError(`Unknown prefix "${token.prefix}:"`);
      return base + token.local;
    }
    throw new SyntaxError(`Expected an IRI but found ${JSON.stringify(token)}`);
  };

  function readObject(): Term {
    const token = next();
    switch (token.type) {
      case 'iri':
      case 'pname':
        return { kind: 'iri', value: expand(token) };
      case 'number':
        return {
          kind: 'literal',
          value: token.value,
          datatype:
            XSD +
            (/[eE]/.test(token.value)
              ? 'double'
              : token.value.includes('.')
                ? 'decimal'
                : 'integer'),
        };
      case 'boolean':
        return { kind: 'literal', value: token.value, datatype: `${XSD}boolean` };
      case 'string': {
        const following = peek();
        if (following?.type === 'lang') {
          pos++;
          return { kind: 'literal', value: token.value, lang: following.value.toLowerCase() };
        }
        if (isPunct('^^')) {
          pos++;
          return { kind: 'literal', value: token.value, datatype: expand(next()) };
        }
        return { kind: 'literal', value: token.value };
      }
      case 'punct':
        if (token.value === '[') {
          const blank: Term = { kind: 'blank', id: nextBlank++ };
          if (!isPunct(']')) readPredicateObjectList(blank);
          expect(']');
          return blank;
        }
        break;
      default:
        break;
    }
    throw new SyntaxError(`Unexpected ${JSON.stringify(token)} where an object was expected`);
  }

  function readPredicateObjectList(subject: Term): void {
    for (;;) {
      const verb = next();
      const predicate = verb.type === 'keyword' && verb.value === 'a' ? RDF_TYPE : expand(verb);
      for (;;) {
        triples.push({ subject, predicate, object: readObject() });
        if (!isPunct(',')) break;
        pos++;
      }
      if (!isPunct(';')) return;
      while (isPunct(';')) pos++;
      if (isPunct('.') || isPunct(']')) return;
    }
  }

  while (pos < tokens.length) {
    const token = next();
    if (token.type === 'keyword' && (token.value === 'PREFIX' || token.value === '@prefix')) {
      const name = next();
      if (name.type !== 'pname' || name.local !== '') {
        throw new SyntaxError(`Bad prefix declaration ${JSON.stringify(name)}`);
      }
      prefixes.set(name.prefix, expand(next()));
      if (token.value === '@prefix') expect('.');
      continue;
    }
    let subject: Term;
    if (token.type === 'punct' && token.value === '[') {
      subject = { kind: 'blank', id: nextBlank++ };
      readPredicateObjectList(subject);
      expect(']');
      if (isPunct('.')) {
        pos++;
        continue;
      }
    } else {
      subject = { kind: 'iri', value: expand(token) };
    }
    readPredicateObjectList(subject);
    expect('.');
  }
  return triples;
}
