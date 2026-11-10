/**
 * container 안의 DOM에 patch를 적용한다. 적용 순서는 docs/vnode-spec.md 5절을 따른다.
 * @param {Element} container 루트 노드를 감싸는 부모. 루트는 container.childNodes[0]이다.
 * @param {import('../vdom/types.js').Patch[]} patches
 */
export function applyPatches(container, patches) {
  // 앞쪽 형제를 지우면 뒤 인덱스가 밀리므로, 바꾸기 전에 대상 노드를 모두 찾아 둔다
  const targets = patches.map((patch) =>
    resolvePath(container, patch.type === 'INSERT' ? patch.parentPath : patch.path),
  );
  const withTarget = (type) =>
    patches
      .map((patch, i) => ({ patch, node: targets[i] }))
      .filter(({ patch }) => patch.type === type);

  for (const { node } of withTarget('REMOVE')) node.remove();

  for (const { patch, node } of withTarget('REPLACE')) node.replaceWith(createNode(patch.node));
  for (const { patch, node } of withTarget('SET_DATA')) node.data = patch.value;
  for (const { patch, node } of withTarget('UPDATE_ATTRS')) {
    for (const [name, value] of Object.entries(patch.set)) node.setAttribute(name, value);
    for (const name of patch.remove) node.removeAttribute(name);
  }

  // index는 new children 기준이라 오름차순으로 넣어야 앞 자리가 먼저 채워진다
  const inserts = withTarget('INSERT').sort((a, b) => a.patch.index - b.patch.index);
  for (const { patch, node: parent } of inserts) {
    parent.insertBefore(createNode(patch.node), parent.childNodes[patch.index] ?? null);
  }
}

/**
 * @param {Node} container
 * @param {import('../vdom/types.js').Path} path
 * @returns {any}
 */
function resolvePath(container, path) {
  const node = path.reduce((current, index) => current?.childNodes[index], container);
  // 잘못된 path를 조용히 넘기면 엉뚱한 DOM이 남으므로 바로 알린다
  if (!node) throw new Error(`applyPatches: path [${path}]에 노드가 없습니다.`);
  return node;
}

/**
 * VNode로 실제 DOM 노드를 만든다. element는 자식까지 재귀로 만든다.
 * @param {import('../vdom/types.js').VNode} vnode
 * @returns {Node}
 */
export function createNode(vnode) {
  if (vnode.type === 'text') return document.createTextNode(vnode.text);
  if (vnode.type === 'comment') return document.createComment(vnode.text);
  const element = document.createElement(vnode.tag);
  for (const [name, value] of Object.entries(vnode.attrs)) element.setAttribute(name, value);
  for (const child of vnode.children) element.appendChild(createNode(child));
  return element;
}
