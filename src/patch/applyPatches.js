/**
 * container 안의 DOM에 patch를 적용한다. 적용 순서는 docs/vnode-spec.md 5절을 따른다.
 * @param {Element} _container 루트 노드를 감싸는 부모. 루트는 container.childNodes[0]이다.
 * @param {import('../vdom/types.js').Patch[]} _patches
 */
export function applyPatches(_container, _patches) {
  throw new Error('applyPatches: 아직 구현하지 않았습니다.');
}
