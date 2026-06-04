import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export type ProposalHighlightSpan = {
  rangeStart: number;
  rangeEnd: number;
  tooltip: string;
};

export type ProposalRangeHighlightOptions = {
  getRanges: () => ProposalHighlightSpan[];
};

function posAtPlainOffset(
  doc: {
    descendants: (
      f: (node: { isText: boolean; text?: string | null }, pos: number) => boolean | void,
    ) => void;
  },
  targetOffset: number,
): number | null {
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

export function createProposalRangeHighlightExtension(
  options: ProposalRangeHighlightOptions,
) {
  return Extension.create({
    name: 'proposalRangeHighlight',
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: new PluginKey('proposalRangeHighlight'),
          props: {
            decorations(state) {
              const ranges = options.getRanges();
              if (!ranges.length) {
                return DecorationSet.empty;
              }
              const decos: Decoration[] = [];
              for (const { rangeStart, rangeEnd, tooltip } of ranges) {
                const from = posAtPlainOffset(state.doc, rangeStart);
                const to = posAtPlainOffset(state.doc, rangeEnd);
                if (from != null && to != null && to > from) {
                  decos.push(
                    Decoration.inline(from, to, {
                      class: 'document-proposal-range',
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
