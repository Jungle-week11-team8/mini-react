import { createDomNode } from './createDomNode.js';

function resolvePath(container, path) {
  return path.reduce((node, index) => node.childNodes[index], container);
}

function updateAttrs(element, { set, remove }) {
  for (const name of remove) {
    element.removeAttribute(name);
  }
  for (const [name, value] of Object.entries(set)) {
    element.setAttribute(name, value);
  }
}

/**
 * container 안의 DOM에 patch를 적용한다. 적용 순서는 docs/vnode-spec.md 5절을 따른다.
 * @param {Element} container 루트 노드를 감싸는 부모. 루트는 container.childNodes[0]이다.
 * @param {import('../vdom/types.js').Patch[]} patches
 */
export function applyPatches(container, patches) {
  const document = container.ownerDocument;
  // 형제 노드를 삭제해도 경로가 처음 가리킨 노드를 수정할 수 있도록 참조를 먼저 확보한다.
  const targets = patches.map((patch) => ({
    patch,
    target: resolvePath(container, patch.type === 'INSERT' ? patch.parentPath : patch.path),
  }));

  for (const { patch, target } of targets) {
    if (patch.type === 'REMOVE') target.remove();
  }

  const insertions = [];
  for (const entry of targets) {
    const { patch, target } = entry;

    switch (patch.type) {
      case 'REPLACE':
        target.replaceWith(createDomNode(document, patch.node));
        break;
      case 'SET_DATA':
        target.data = patch.value;
        break;
      case 'UPDATE_ATTRS':
        updateAttrs(target, patch);
        break;
      case 'INSERT':
        insertions.push(entry);
        break;
    }
  }

  // 삽입 위치는 새 자식 목록 기준이라 앞에서부터 채워야 한다.
  insertions.sort((a, b) => a.patch.index - b.patch.index);
  for (const { patch, target } of insertions) {
    target.insertBefore(
      createDomNode(document, patch.node),
      target.childNodes[patch.index] ?? null,
    );
  }
}
