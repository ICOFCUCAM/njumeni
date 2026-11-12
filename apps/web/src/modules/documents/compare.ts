// Version comparison (Phase 7): section by section, with a word-level diff for changed sections.
import type { DocumentSection } from './analysis.ts';

export type DiffOp = { op: 'equal' | 'insert' | 'delete'; text: string };
export interface SectionComparison {
  key: string;
  title: string;
  change: 'unchanged' | 'added' | 'removed' | 'modified';
  ops: DiffOp[];
}

const MAX_WORDS = 3000;

function tokens(text: string): string[] {
  return text.match(/\s+|[^\s]+/g) ?? [];
}

function push(ops: DiffOp[], op: DiffOp['op'], text: string): void {
  const last = ops.at(-1);
  if (last && last.op === op) last.text += text;
  else ops.push({ op, text });
}

/** Word diff by longest common subsequence; very long sections fall back to replace-all. */
export function diffWords(before: string, after: string): DiffOp[] {
  if (before === after) return before ? [{ op: 'equal', text: before }] : [];
  const a = tokens(before);
  const b = tokens(after);
  if (a.length > MAX_WORDS || b.length > MAX_WORDS) {
    return [
      ...(before ? [{ op: 'delete' as const, text: before }] : []),
      ...(after ? [{ op: 'insert' as const, text: after }] : []),
    ];
  }
  const table: Uint16Array[] = Array.from(
    { length: a.length + 1 },
    () => new Uint16Array(b.length + 1),
  );
  for (let i = a.length - 1; i >= 0; i -= 1)
    for (let j = b.length - 1; j >= 0; j -= 1)
      table[i]![j] =
        a[i] === b[j] ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push(ops, 'equal', a[i]!);
      i += 1;
      j += 1;
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      push(ops, 'delete', a[i]!);
      i += 1;
    } else {
      push(ops, 'insert', b[j]!);
      j += 1;
    }
  }
  while (i < a.length) push(ops, 'delete', a[i++]!);
  while (j < b.length) push(ops, 'insert', b[j++]!);
  return cleanup(ops);
}

/** Merges change runs separated only by whitespace into one deletion followed by one insertion. */
function cleanup(ops: DiffOp[]): DiffOp[] {
  const out: DiffOp[] = [];
  let removed = '';
  let added = '';
  const flush = () => {
    if (removed) out.push({ op: 'delete', text: removed });
    if (added) out.push({ op: 'insert', text: added });
    removed = '';
    added = '';
  };
  ops.forEach((op, index) => {
    const between =
      index > 0 &&
      index < ops.length - 1 &&
      ops[index - 1]!.op !== 'equal' &&
      ops[index + 1]!.op !== 'equal';
    if (op.op === 'equal' && between && !op.text.trim()) {
      removed += op.text;
      added += op.text;
    } else if (op.op === 'delete') removed += op.text;
    else if (op.op === 'insert') added += op.text;
    else {
      flush();
      out.push({ ...op });
    }
  });
  flush();
  return out;
}

export function compareVersions(
  before: readonly DocumentSection[],
  after: readonly DocumentSection[],
): SectionComparison[] {
  const keys = [...new Set([...after.map((s) => s.key), ...before.map((s) => s.key)])];
  return keys.map((key) => {
    const a = before.find((s) => s.key === key);
    const b = after.find((s) => s.key === key);
    const title = b?.title ?? a?.title ?? key;
    const left = a?.content ?? '';
    const right = b?.content ?? '';
    const change =
      left === right
        ? 'unchanged'
        : !left.trim()
          ? 'added'
          : !right.trim()
            ? 'removed'
            : 'modified';
    return { key, title, change, ops: diffWords(left, right) };
  });
}
