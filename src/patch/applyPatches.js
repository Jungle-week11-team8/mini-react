/**
 * container 안의 DOM에 patch를 적용한다. 적용 순서는 docs/vnode-spec.md 5절을 따른다.
 *
 * 적용 순서:
 *   1. 모든 patch의 대상 노드를 old DOM 기준으로 먼저 찾아 참조로 보관
 *   2. REMOVE 적용
 *   3. REPLACE, SET_DATA, UPDATE_ATTRS 적용
 *   4. INSERT를 같은 부모 안에서 index 오름차순으로 적용
 *
 * @param {Element} container 루트 노드를 감싸는 부모. 루트는 container.childNodes[0]이다.
 * @param {import('../vdom/types.js').Patch[]} patches
 */
export function applyPatches(container, patches) {
  if (patches.length === 0) return;

  // ── 1단계: old DOM 기준으로 대상 노드 참조를 미리 확보 ──
  // path 기반 patch → 대상 노드 자체
  // INSERT → 부모 노드
  const resolved = patches.map((patch) => {
    if (patch.type === 'INSERT') {
      return { patch, target: resolvePath(container, patch.parentPath) };
    }
    return { patch, target: resolvePath(container, patch.path) };
  });

  //하나라도 대상을 못 찾으면 DOM을 건드리기 전에 실패
  for (const { patch, target } of resolved) {
    if (!target) {
      throw new Error(`applyPatches: 대상 노드를 찾을 수 없습니다. type=${patch.type}`);
    }
  }

  // ── 2단계: REMOVE 적용 ──
  for (const { patch, target } of resolved) {
    if (patch.type === 'REMOVE') {
      target.parentNode.removeChild(target);
    }
  }

  // ── 3단계: REPLACE, SET_DATA, UPDATE_ATTRS 적용 ──
  for (const { patch, target } of resolved) {
    if (patch.type === 'REPLACE') {
      const newDom = createDomFromVNode(patch.node);
      target.parentNode.replaceChild(newDom, target);
    } else if (patch.type === 'SET_DATA') {
      // Text, Comment 노드의 내용 변경
      target.textContent = patch.value;
    } else if (patch.type === 'UPDATE_ATTRS') {
      // 속성 추가/변경
      for (const [name, value] of Object.entries(patch.set)) {
        target.setAttribute(name, value);
      }
      // 속성 삭제
      for (const name of patch.remove) {
        target.removeAttribute(name);
      }
    }
  }

  // ── 4단계: INSERT를 같은 부모 안에서 index 오름차순 적용 ──
  // 같은 부모에 여러 INSERT가 있을 수 있으므로 index 오름차순 정렬
  const inserts = resolved
    .filter(({ patch }) => patch.type === 'INSERT')
    .sort((a, b) => a.patch.index - b.patch.index);

  for (const { patch, target: parent } of inserts) {
    const newDom = createDomFromVNode(patch.node);
    // parent.childNodes[index]가 있으면 그 앞에, 없으면 끝에 삽입
    parent.insertBefore(newDom, parent.childNodes[patch.index] ?? null);
  }
}

/**
 * container에서 path를 따라 노드를 찾는다.
 * path = [0, 2, 1] → container.childNodes[0].childNodes[2].childNodes[1]
 *
 * @param {Element} container
 * @param {number[]} path
 * @returns {Node}
 */
function resolvePath(container, path) {
  return path.reduce((node, index) => node.childNodes[index], container);
}

/**
 * VNode를 실제 DOM 노드로 변환한다. (INSERT, REPLACE 시 사용)
 *
 * @param {import('../vdom/types.js').VNode} vnode
 * @returns {Node}
 */
function createDomFromVNode(vnode) {
  if (vnode.type === 'text') {
    return document.createTextNode(vnode.text);
  }
  if (vnode.type === 'comment') {
    return document.createComment(vnode.text);
  }

  // element
  const el = document.createElement(vnode.tag);
  for (const [name, value] of Object.entries(vnode.attrs)) {
    el.setAttribute(name, value);
  }
  for (const child of vnode.children) {
    el.appendChild(createDomFromVNode(child));
  }
  return el;
}
