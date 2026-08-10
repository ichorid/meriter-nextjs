import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Transaction } from '@tiptap/pm/state';

export type LockedRangeHighlightOptions = {
  getRanges: () => Array<{ rangeStart: number; rangeEnd: number }>;
  getTooltip: () => string;
};

export const SKIP_LOCKED_RANGE_FILTER_META = 'skipLockedRangeFilter';

function posAtPlainOffset(doc: { descendants: (f: (node: { isText: boolean; text?: string | null }, pos: number) => boolean | void) => void }, targetOffset: number): number | null {
  let plain = 0;
  let found: number | null = null;
  doc.descendants((node, pos) => {
    if (found != null) {
      return false;
    }
    if (node.isText && node.text) {
      const len = node.text.length;
      if (plain + len >= targetOffset) {
        found = pos + (targetOffset - plain);
        return false;
      }
      plain += len;
    }
    return undefined;
  });
  return found;
}

function plainTextSlice(
  doc: { descendants: (f: (node: { isText: boolean; text?: string | null }, pos: number) => boolean | void) => void; textBetween: (from: number, to: number, blockSep?: string, leafSep?: string) => string },
  rangeStart: number,
  rangeEnd: number,
): string {
  const from = posAtPlainOffset(doc, rangeStart);
  const to = posAtPlainOffset(doc, rangeEnd);
  if (from == null || to == null || to <= from) {
    return '';
  }
  return doc.textBetween(from, to, '\n', '\n');
}

function lockedRangesPlainUnchanged(
  tr: Transaction,
  ranges: Array<{ rangeStart: number; rangeEnd: number }>,
): boolean {
  if (tr.getMeta(SKIP_LOCKED_RANGE_FILTER_META)) {
    return true;
  }
  if (!ranges.length || !tr.docChanged) {
    return true;
  }
  const oldDoc = tr.before;
  const newDoc = tr.doc;
  for (const { rangeStart, rangeEnd } of ranges) {
    if (
      plainTextSlice(oldDoc, rangeStart, rangeEnd) !==
      plainTextSlice(newDoc, rangeStart, rangeEnd)
    ) {
      return false;
    }
  }
  return true;
}

export function createLockedRangeHighlightExtension(
  options: LockedRangeHighlightOptions,
) {
  return Extension.create({
    name: 'lockedRangeHighlight',
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: new PluginKey('lockedRangeHighlight'),
          filterTransaction(tr) {
            return lockedRangesPlainUnchanged(tr, options.getRanges());
          },
          props: {
            decorations(state) {
              const ranges = options.getRanges();
              if (!ranges.length) {
                return DecorationSet.empty;
              }
              const decos: Decoration[] = [];
              const tooltip = options.getTooltip();
              for (const { rangeStart, rangeEnd } of ranges) {
                const from = posAtPlainOffset(state.doc, rangeStart);
                const to = posAtPlainOffset(state.doc, rangeEnd);
                if (from != null && to != null && to > from) {
                  decos.push(
                    Decoration.inline(from, to, {
                      class: 'document-locked-range',
                      title: tooltip,
                    }),
                  );
                }
              }
              return DecorationSet.create(state.doc, decos);
            },
          },
        }),
      ];
    },
  });
}
