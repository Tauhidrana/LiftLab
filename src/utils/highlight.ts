/** A tiny TypeScript tokenizer for the code inspector (keywords, strings, comments, numbers). */
const KW = new Set(
  'const let var function return if else for while switch case default break continue new class private public readonly static import export from type interface extends implements this true false null undefined as of in typeof void throw try catch get'.split(
    ' ',
  ),
)

export interface Token {
  text: string
  cls?: string
}

const RE = /(\/\/.*$|\/\*.*?\*\/|^\s*\*.*$)|('(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*")|(\b\d+(?:\.\d+)?(?:e-?\d+)?\b)|([A-Za-z_$][\w$]*)/g

export function tokenize(line: string): Token[] {
  const out: Token[] = []
  let last = 0
  for (const m of line.matchAll(RE)) {
    const i = m.index!
    if (i > last) out.push({ text: line.slice(last, i) })
    const [text, com, str, num, word] = m
    let cls: string | undefined
    if (com) cls = 'tok-com'
    else if (str) cls = /^'[a-z]+\.[A-Za-z.]+'$/.test(str) ? 'tok-marker' : 'tok-str'
    else if (num) cls = 'tok-num'
    else if (word) {
      if (KW.has(word)) cls = 'tok-kw'
      else if (/^[A-Z]/.test(word)) cls = 'tok-type'
      else if (line[i + word.length] === '(') cls = 'tok-fn'
    }
    out.push({ text, cls })
    last = i + text.length
  }
  if (last < line.length) out.push({ text: line.slice(last) })
  return out
}
