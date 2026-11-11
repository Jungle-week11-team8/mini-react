// 타입 정의만 모아 둔 파일이다. 기준은 docs/vnode-spec.md다.

/**
 * @typedef {{ type: 'element', tag: string, attrs: Record<string, string>, key?: string, events?: Record<string, Function>, children: VNode[] }} ElementVNode
 * @typedef {{ type: 'text', text: string }} TextVNode
 * @typedef {{ type: 'comment', text: string }} CommentVNode
 * @typedef {ElementVNode | TextVNode | CommentVNode} VNode
 */

/** @typedef {number[]} Path */

/**
 * @typedef {{ type: 'INSERT', parentPath: Path, index: number, node: VNode }} InsertPatch
 * @typedef {{ type: 'REMOVE', path: Path }} RemovePatch
 * @typedef {{ type: 'REPLACE', path: Path, node: VNode }} ReplacePatch
 * @typedef {{ type: 'SET_DATA', path: Path, value: string }} SetDataPatch
 * @typedef {{ type: 'UPDATE_ATTRS', path: Path, set: Record<string, string>, remove: string[] }} UpdateAttrsPatch
 * @typedef {InsertPatch | RemovePatch | ReplacePatch | SetDataPatch | UpdateAttrsPatch} Patch
 */

export {};
