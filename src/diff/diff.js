/** @typedef {import('../vdom/types.js').VNode} VNode */
/** @typedef {import('../vdom/types.js').Patch} Patch */
/** @typedef {import('../vdom/types.js').Path} Path */

/**
 * @param {Record<string, string>} oldAttrs
 * @param {Record<string, string>} newAttrs
 * @param {Path} path
 * @param {Patch[]} patches
 */
function diffAttrs(oldAttrs, newAttrs, path, patches) {
  const changed = Object.entries(newAttrs).filter(
    ([name, value]) => !Object.hasOwn(oldAttrs, name) || oldAttrs[name] !== value,
  );
  const remove = Object.keys(oldAttrs).filter((name) => !Object.hasOwn(newAttrs, name));

  if (changed.length > 0 || remove.length > 0) {
    // __proto__처럼 객체에 기본 동작이 있는 이름도 일반 속성으로 담는다.
    patches.push({ type: 'UPDATE_ATTRS', path, set: Object.fromEntries(changed), remove });
  }
}

/**
 * @param {VNode[]} oldChildren
 * @param {VNode[]} newChildren
 * @param {Path} parentPath
 * @param {Patch[]} patches
 */
function diffChildren(oldChildren, newChildren, parentPath, patches) {
  // 키 기반 이동을 지원하기 전까지 자식은 같은 위치를 기준으로 대응시킨다.
  const commonLength = Math.min(oldChildren.length, newChildren.length);

  for (let index = 0; index < commonLength; index += 1) {
    diffNode(oldChildren[index], newChildren[index], [...parentPath, index], patches);
  }

  for (let index = commonLength; index < oldChildren.length; index += 1) {
    patches.push({ type: 'REMOVE', path: [...parentPath, index] });
  }

  for (let index = commonLength; index < newChildren.length; index += 1) {
    patches.push({ type: 'INSERT', parentPath, index, node: newChildren[index] });
  }
}

/**
 * @param {VNode} oldNode
 * @param {VNode} newNode
 * @param {Path} path
 * @param {Patch[]} patches
 */
function diffNode(oldNode, newNode, path, patches) {
  if (
    oldNode.type !== newNode.type ||
    (oldNode.type === 'element' && newNode.type === 'element' && oldNode.tag !== newNode.tag)
  ) {
    patches.push({ type: 'REPLACE', path, node: newNode });
    return;
  }

  // 전위 순회 순서를 유지하기 위해 부모 속성을 자식보다 먼저 비교한다.
  if (oldNode.type === 'element' && newNode.type === 'element') {
    diffAttrs(oldNode.attrs, newNode.attrs, path, patches);
    diffChildren(oldNode.children, newNode.children, path, patches);
  } else if ('text' in oldNode && 'text' in newNode && oldNode.text !== newNode.text) {
    patches.push({ type: 'SET_DATA', path, value: newNode.text });
  }
}

/**
 * 두 요소 서브트리를 비교해 patch 배열을 만든다. DOM에 접근하지 않는 순수 함수다.
 * @param {VNode} oldVNode
 * @param {VNode} newVNode
 * @returns {Patch[]}
 */
export function diff(oldVNode, newVNode) {
  /** @type {Patch[]} */
  const patches = [];
  diffNode(oldVNode, newVNode, [0], patches);
  return patches;
}
