/**
 * 속성 또는 프로퍼티 설정 헬퍼.
 * - value, checked, selected 등은 DOM 프로퍼티와 어트리뷰트 양쪽에 올바르게 동기화
 * - 그 외는 표준 setAttribute 호출
 */
function setAttributeOrProperty(element, name, value) {
  if (name === 'checked' || name === 'selected') {
    // 불리언 프로퍼티: ''(값 없는 속성), true, 'true'는 true로 처리
    const isChecked = value === '' || value === true || value === 'true' || value === name;
    element[name] = isChecked;
    element.setAttribute(name, value);
  } else if (name === 'value') {
    element.value = String(value);
    element.setAttribute(name, value);
  } else if (name.startsWith('on') && typeof value === 'function') {
    const eventProp = 'on' + name.slice(2).toLowerCase();
    element[eventProp] = value;
  } else {
    element.setAttribute(name, value);
  }
}

/**
 * 속성 또는 프로퍼티 제거 헬퍼.
 */
function removeAttributeOrProperty(element, name) {
  element.removeAttribute(name);
  if (name.startsWith('on')) {
    const eventProp = 'on' + name.slice(2).toLowerCase();
    element[eventProp] = null;
  } else if (name === 'checked' || name === 'selected') {
    element[name] = false;
  } else if (name === 'value') {
    element.value = '';
  }
}

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
    for (const [name, value] of Object.entries(patch.set)) {
      setAttributeOrProperty(node, name, value);
    }
    for (const name of patch.remove) {
      removeAttributeOrProperty(node, name);
    }
  }

  // index는 new children 기준이라 오름차순으로 넣어야 앞 자리가 먼저 채워진다
  const inserts = withTarget('INSERT').sort((a, b) => a.patch.index - b.patch.index);
  for (const { patch, node: parent } of inserts) {
    const isSvgParent = parent.namespaceURI === 'http://www.w3.org/2000/svg';
    parent.insertBefore(
      createNode(patch.node, isSvgParent),
      parent.childNodes[patch.index] ?? null,
    );
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
 * VNode로 실제 DOM 노드를 만든다.
 * 부모가 SVG 네임스페이스이거나 태그가 svg인 경우 모든 하위 자식 노드도 SVG 네임스페이스를 상속받는다.
 *
 * @param {import('../vdom/types.js').VNode} vnode
 * @param {boolean} [isSvg=false]
 * @returns {Node}
 */
export function createNode(vnode, isSvg = false) {
  if (vnode.type === 'text') return document.createTextNode(vnode.text);
  if (vnode.type === 'comment') return document.createComment(vnode.text);

  const isCurrentSvg = isSvg || vnode.tag === 'svg';
  const element = isCurrentSvg
    ? document.createElementNS('http://www.w3.org/2000/svg', vnode.tag)
    : document.createElement(vnode.tag);

  for (const [name, value] of Object.entries(vnode.attrs)) {
    setAttributeOrProperty(element, name, value);
  }

  // VNode에 events 필드가 있는 경우 (h()를 통해 등록된 이벤트 핸들러)
  if (vnode.events) {
    for (const [eventName, handler] of Object.entries(vnode.events)) {
      element['on' + eventName] = handler;
    }
  }

  for (const child of vnode.children) {
    element.appendChild(createNode(child, isCurrentSvg));
  }
  return element;
}
