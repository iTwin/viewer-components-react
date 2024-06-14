/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useRef, useState } from "react";
import { isPresentationHierarchyNode } from "@itwin/presentation-hierarchies-react";
import { useLatest } from "./UseLatest";

import type { PresentationHierarchyNode, PresentationTreeNode } from "@itwin/presentation-hierarchies-react";

interface UseNodeHighlightingProps {
  rootNodes: PresentationTreeNode[] | undefined;
  searchText?: string;
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
  activeNodeId?: string;
  getLabel: (node: PresentationHierarchyNode) => React.ReactElement;
}

/** @internal */
export function useNodeHighlighting({ rootNodes, searchText, activeMatchIndex, onHighlightChanged }: UseNodeHighlightingProps): UseNodeHighlightingResult {
  const state = useRef<HighlightState>({ nodeInfoMap: new Map(), totalMatches: 0 });
  const [activeNodeId, setActiveNodeId] = useState<string | undefined>();
  const activeMatchIndexRef = useLatest(activeMatchIndex);
  const activeNodeIdRef = useLatest(activeNodeId);

  const updateHighlightInfo = useCallback(
    (index: number, matches: number) => {
      if (matches === 0) {
        setActiveNodeId(undefined);
        index = 0;
      }
      onHighlightChanged?.(index, matches);
    },
    [onHighlightChanged],
  );

  useEffect(() => {
    const { state: newState, activeIndex } =
      rootNodes && searchText
        ? computeHighlightState(rootNodes, searchText, state.current, activeNodeIdRef.current, activeMatchIndexRef.current)
        : { state: { nodeInfoMap: new Map(), totalMatches: 0 }, activeIndex: 0 };

    state.current = newState;
    updateHighlightInfo(activeIndex, newState.totalMatches);
  }, [rootNodes, searchText, activeNodeIdRef, activeMatchIndexRef, updateHighlightInfo]);

  useEffect(() => {
    for (const nodeId of state.current.nodeInfoMap.keys()) {
      if (getNodeChunkInfo(state.current, nodeId, activeMatchIndex)?.activeChunkIndex !== undefined) {
        setActiveNodeId(nodeId);
      }
    }
  }, [activeMatchIndex]);

  const getLabel = useCallback(
    (node: PresentationHierarchyNode) => {
      const chunkInfo = getNodeChunkInfo(state.current, node.id, activeMatchIndex);
      if (searchText && chunkInfo) {
        return <>{markChunks(node.label, chunkInfo.chunks, chunkInfo.activeChunkIndex)}</>;
      }
      return <span>{node.label}</span>;
    },
    [searchText, activeMatchIndex],
  );

  return { activeNodeId, getLabel };
}

function getNodeChunkInfo(state: HighlightState, nodeId: string, activeIndex?: number): NodeChunkInfo | undefined {
  const info = state.nodeInfoMap.get(nodeId);
  if (!info) {
    return undefined;
  }
  if (activeIndex === undefined) {
    return { chunks: info.matches };
  }
  const isActive = info && activeIndex >= info.startIndex && activeIndex < info.startIndex + info.matches.length;
  return isActive ? { activeChunkIndex: activeIndex - info.startIndex, chunks: info.matches } : { chunks: info.matches };
}

function computeHighlightState(rootNodes: PresentationTreeNode[], searchText: string, state: HighlightState, activeNodeId?: string, activeMatchIndex?: number) {
  const newState: HighlightState = { nodeInfoMap: new Map(), totalMatches: 0 };
  let newActiveIndex = activeMatchIndex ?? 0;

  const computeHighlightStateRecursively = (nodes: Array<PresentationTreeNode>) => {
    nodes.forEach((node) => {
      if (!isPresentationHierarchyNode(node)) {
        return;
      }

      const matches = findChunks(node.label, searchText);
      newState.nodeInfoMap.set(node.id, { startIndex: newState.totalMatches, matches });
      newState.totalMatches += matches.length;

      if (typeof node.children !== "boolean") {
        computeHighlightStateRecursively(node.children);
      }
    });
  };

  computeHighlightStateRecursively(rootNodes);

  // update active index to not cause active chunk jumps when hierarchy changes
  if (activeNodeId && newActiveIndex !== 0) {
    const activeNodeInfo = getNodeChunkInfo(state, activeNodeId, activeMatchIndex);
    const updatedInfo = newState.nodeInfoMap.get(activeNodeId);

    if (updatedInfo && activeNodeInfo?.activeChunkIndex !== undefined) {
      newActiveIndex = updatedInfo.startIndex + activeNodeInfo.activeChunkIndex;
    }
  }

  return { state: newState, activeIndex: newActiveIndex };
}

function findChunks(text: string, searchText: string): HighlightedChunk[] {
  const chunks: HighlightedChunk[] = [];

  const contentText = text.toLowerCase();
  const inputText = searchText.toLowerCase();
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

  const { mergedChunks, newActiveIndex } = mergeChunks(chunks, activeChunk);

  for (let i = 0; i < mergedChunks.length; i++) {
    const { start, end } = mergedChunks[i];

    // add unmarked text between previous chunk and current one
    const nonMarkedText = text.substring(previousIndex, start);
    nonMarkedText.length && markedText.push(<span key={previousIndex}>{nonMarkedText}</span>);

    // add marked chunk text
    markedText.push(
      <mark key={start} className={i === newActiveIndex ? "tw-active-match-highlight" : undefined}>
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

function mergeChunks(chunks: HighlightedChunk[], activeChunk?: number) {
  const mergedChunks: HighlightedChunk[] = [];
  let lastChunk: { isActive: boolean; info: HighlightedChunk } | undefined;
  let newActiveIndex: number | undefined;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const isActive = i === activeChunk;
    if (lastChunk && lastChunk.info.end === chunk.start && !isActive && !lastChunk.isActive) {
      lastChunk.info.end = chunk.end;
      continue;
    }
    isActive && (newActiveIndex = mergedChunks.length);
    const newChunk = { start: chunk.start, end: chunk.end };
    lastChunk = { isActive, info: newChunk };
    mergedChunks.push(newChunk);
  }
  return { mergedChunks, newActiveIndex };
}
