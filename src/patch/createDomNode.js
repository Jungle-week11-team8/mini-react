/**
 * @param {Document} document
 * @param {import('../vdom/types.js').VNode} vnode
 * @returns {Element | Text | Comment}
 */
export function createDomNode(document, vnode) {
  if (vnode.type === 'text') return document.createTextNode(vnode.text);
  if (vnode.type === 'comment') return document.createComment(vnode.text);
  if (vnode.type !== 'element') {
    throw new TypeError(`요소 하위 트리에 만들 수 없는 VNode입니다 (${vnode.type}).`);
  }

  const element = document.createElement(vnode.tag);
  for (const [name, value] of Object.entries(vnode.attrs)) {
    element.setAttribute(name, value);
  }
  for (const child of vnode.children) {
    element.appendChild(createDomNode(document, child));
  }
  return element;
}

// 미리보기는 최신 트리 전체를 그려 실제 영역의 patch 적용과 분리한다.
export function renderPreview(container, vnode) {
  container.replaceChildren(createDomNode(container.ownerDocument, vnode));
}
