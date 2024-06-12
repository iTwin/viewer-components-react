/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useRef } from "react";
import { isPresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";

import type { PresentationHierarchyNode, PresentationTreeNode } from "@itwin/presentation-hierarchies-react";

interface UseNodeHighlightingProps {
  rootNodes: PresentationTreeNode[] | undefined;
  textToHighlight?: string;
  caseSensitive?: boolean;
  activeMatchIndex?: number;
  onHighlightChanged?: (activeMatchIndex: number, matches: number) => void;
}

interface HighlightedChunk {
  start: number;
  end: number;
}

interface NodeChunkInfo {
  chunks: HighlightedChunk[];
  activeChunkIndex?: number;
}

interface NodeHighlightInfo {
  startIndex: number;
  matches: HighlightedChunk[];
}

interface HighlightState {
  nodeInfoMap: Map<string, NodeHighlightInfo>;
  totalMatches: number;
}

interface UseNodeHighlightingResult {
  getLabel: (node: PresentationHierarchyNode) => React.ReactElement;
}

/** @internal */
export function useNodeHighlighting({
  rootNodes,
  textToHighlight,
  caseSensitive,
  activeMatchIndex,
  onHighlightChanged,
}: UseNodeHighlightingProps): UseNodeHighlightingResult {
  const state = useRef<HighlightState>({ nodeInfoMap: new Map(), totalMatches: 0 });
  const activeMatchIndexRef = useRef(activeMatchIndex);

  useEffect(() => {
    activeMatchIndexRef.current = activeMatchIndex;
  }, [activeMatchIndex]);

  const getNodeChunkInfo = useCallback((nodeId: string, activeIndex?: number): NodeChunkInfo | undefined => {
    const info = state.current.nodeInfoMap.get(nodeId);
    if (!info) {
      return undefined;
    }
    if (activeIndex === undefined) {
      return { chunks: info.matches };
    }
    const isActive = info && activeIndex >= info.startIndex && activeIndex < info.startIndex + info.matches.length;
    return isActive ? { activeChunkIndex: activeIndex - info.startIndex, chunks: info.matches } : { chunks: info.matches };
  }, []);

  const computeHighlightState = useCallback(() => {
    const newState: HighlightState = { nodeInfoMap: new Map(), totalMatches: 0 };
    let activeNodeInfo: { nodeId: string; info: NodeChunkInfo } | undefined;

    const computeHighlightStateRecursively = (nodes: Array<PresentationTreeNode>) => {
      nodes.forEach((node) => {
        if (!isPresentationHierarchyNode(node)) {
          return;
        }

        // keep track of previous active chunk
        const nodeInfo = getNodeChunkInfo(node.id, activeMatchIndexRef.current);
        if (nodeInfo?.activeChunkIndex !== undefined) {
          activeNodeInfo = { nodeId: node.id, info: nodeInfo };
        }

        const matches = findChunks(node.label, textToHighlight!, caseSensitive ?? false);
        newState.nodeInfoMap.set(node.id, { startIndex: newState.totalMatches, matches });
        newState.totalMatches += matches.length;

        if (typeof node.children !== "boolean") {
          computeHighlightStateRecursively(node.children);
        }
      });
    };

    computeHighlightStateRecursively(rootNodes!);

    let newActiveIndex = activeMatchIndexRef.current ?? 0;
    if (activeNodeInfo && newActiveIndex !== 0) {
      // update active index to not cause active chunk jumps when hierarchy changes
      const updatedInfo = newState.nodeInfoMap.get(activeNodeInfo.nodeId);
      updatedInfo && (newActiveIndex = updatedInfo?.startIndex + activeNodeInfo.info.activeChunkIndex!);
    }
    state.current = newState;
    onHighlightChanged?.(newActiveIndex, newState.totalMatches);
  }, [rootNodes, textToHighlight, caseSensitive, getNodeChunkInfo, onHighlightChanged]);

  useEffect(() => {
    if (rootNodes && textToHighlight) {
      computeHighlightState();
      return;
    }
    state.current = { nodeInfoMap: new Map(), totalMatches: 0 };
  }, [rootNodes, textToHighlight, caseSensitive, computeHighlightState]);

  useEffect(() => {
    onHighlightChanged?.(0, state.current.totalMatches);
  }, [textToHighlight, caseSensitive, onHighlightChanged]);

  useEffect(() => {
    // focus on currently highlighted node to scroll it into view
    for (const nodeId of state.current.nodeInfoMap.keys()) {
      if (getNodeChunkInfo(nodeId, activeMatchIndex)?.activeChunkIndex !== undefined) {
        const nodeElement = document.querySelector(`[id="${nodeId}"]`) as HTMLElement;
        nodeElement?.focus();
      }
    }
  }, [activeMatchIndex, getNodeChunkInfo]);

  const getLabel = useCallback(
    (node: PresentationHierarchyNode) => {
      const chunkInfo = getNodeChunkInfo(node.id, activeMatchIndex);
      if (textToHighlight && chunkInfo) {
        return <>{markChunks(node.label, chunkInfo.chunks, chunkInfo.activeChunkIndex)}</>;
      }
      return <span>{node.label}</span>;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [textToHighlight, activeMatchIndex, getNodeChunkInfo],
  );

  return { getLabel };
}

function findChunks(text: string, textToHighlight: string, caseSensitive: boolean): HighlightedChunk[] {
  const chunks: HighlightedChunk[] = [];

  const contentText = caseSensitive ? text : text.toLowerCase();
  const inputText = caseSensitive ? textToHighlight : textToHighlight.toLowerCase();
  let index = contentText.indexOf(inputText);

  while (index !== -1) {
    chunks.push({ start: index, end: index + inputText.length });
    index = contentText.indexOf(inputText, index + 1);
  }

  return chunks;
}

function markChunks(text: string, chunks: HighlightedChunk[], activeChunk?: number) {
  const markedText: React.ReactElement[] = [];
  let previousIndex = 0;

  // merge chunks if they are not highlighted
  const mergedChunks = activeChunk !== undefined ? chunks : mergeChunks(chunks);

  for (let i = 0; i < mergedChunks.length; i++) {
    const { start, end } = mergedChunks[i];

    // add unmarked text between previous chunk and current one
    const nonMarkedText = text.substring(previousIndex, start);
    nonMarkedText.length && markedText.push(<span key={previousIndex}>{nonMarkedText}</span>);

    // add marked chunk text
    markedText.push(
      <mark key={start} className={activeChunk === i ? "tw-active-match-highlight" : undefined}>
        {text.substring(start, end)}
      </mark>,
    );
    previousIndex = end;
  }

  // add unmarked text after last chunk
  const lastNonMarkedText = text.substring(previousIndex, text.length);
  lastNonMarkedText.length && markedText.push(<span key={previousIndex}>{lastNonMarkedText}</span>);

  return markedText;
}

function mergeChunks(chunks: HighlightedChunk[]) {
  const mergedChunks: HighlightedChunk[] = [];
  let lastChunk: HighlightedChunk | undefined;

  for (const chunk of chunks) {
    if (lastChunk && lastChunk.end === chunk.start) {
      lastChunk.end = chunk.end;
      continue;
    }
    const newChunk = { start: chunk.start, end: chunk.end };
    mergedChunks.push(newChunk);
    lastChunk = newChunk;
  }
  return mergedChunks;
}
