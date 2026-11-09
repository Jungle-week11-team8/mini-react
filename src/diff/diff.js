/**
 * 두 VNode 트리를 비교해 patch 배열을 만든다. DOM에 접근하지 않는 순수 함수다.
 * @param {import('../vdom/types.js').VNode} oldVNode
 * @param {import('../vdom/types.js').VNode} newVNode
 * @returns {import('../vdom/types.js').Patch[]}
 */
export function diff(oldVNode, newVNode) {
  /** @type {import('../vdom/types.js').Patch[]} */
  const patches = [];
  // 루트 노드는 container.childNodes[0]이므로 path는 [0]에서 시작한다
  walk(oldVNode, newVNode, [0], patches);
  return patches;
}

/**
 * @param {import('../vdom/types.js').VNode} oldVNode
 * @param {import('../vdom/types.js').VNode} newVNode
 * @param {import('../vdom/types.js').Path} path
 * @param {import('../vdom/types.js').Patch[]} patches
 */
function walk(oldVNode, newVNode, path, patches) {
  if (oldVNode.type !== newVNode.type) {
    patches.push({ type: 'REPLACE', path, node: newVNode });
    return;
  }
  if (newVNode.type === 'text' || newVNode.type === 'comment') {
    if (oldVNode.text !== newVNode.text) {
      patches.push({ type: 'SET_DATA', path, value: newVNode.text });
    }
    return;
  }
  // 태그가 다르면 자식도 대부분 다르므로 통째로 바꾼다
  if (oldVNode.tag !== newVNode.tag) {
    patches.push({ type: 'REPLACE', path, node: newVNode });
    return;
  }
  const { set, remove } = diffAttrs(oldVNode.attrs, newVNode.attrs);
  if (Object.keys(set).length > 0 || remove.length > 0) {
    patches.push({ type: 'UPDATE_ATTRS', path, set, remove });
  }
  diffChildren(oldVNode.children, newVNode.children, path, patches);
}

/**
 * 자식을 같은 인덱스끼리 비교한다. 남는 쪽은 INSERT 또는 REMOVE가 된다.
 * @param {import('../vdom/types.js').VNode[]} oldChildren
 * @param {import('../vdom/types.js').VNode[]} newChildren
 * @param {import('../vdom/types.js').Path} parentPath
 * @param {import('../vdom/types.js').Patch[]} patches
 */
function diffChildren(oldChildren, newChildren, parentPath, patches) {
  const length = Math.max(oldChildren.length, newChildren.length);
  for (let i = 0; i < length; i++) {
    // path는 매번 새 배열로 만든다. 공유하면 이미 만든 patch의 path까지 바뀐다.
    if (i >= newChildren.length) {
      patches.push({ type: 'REMOVE', path: [...parentPath, i] });
    } else if (i >= oldChildren.length) {
      patches.push({ type: 'INSERT', parentPath: [...parentPath], index: i, node: newChildren[i] });
    } else {
      walk(oldChildren[i], newChildren[i], [...parentPath, i], patches);
    }
  }
}

/**
 * 속성 객체 두 개를 비교한다. 추가·수정은 set, 삭제는 remove에 담는다.
 * @param {Record<string, string>} oldAttrs
 * @param {Record<string, string>} newAttrs
 * @returns {{ set: Record<string, string>, remove: string[] }}
 */
function diffAttrs(oldAttrs, newAttrs) {
  /** @type {Record<string, string>} */
  const set = {};
  for (const [name, value] of Object.entries(newAttrs)) {
    if (oldAttrs[name] !== value) set[name] = value;
  }
  const remove = Object.keys(oldAttrs).filter((name) => !(name in newAttrs));
  return { set, remove };
}
