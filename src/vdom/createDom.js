/**
 * VNode 트리를 실제 브라우저 DOM 노드로 변환한다.
 * mount() 시 초기 DOM 생성에 사용된다.
 *
 * @param {import('./types.js').VNode} vnode
 * @returns {Node}
 */
export function createDom(vnode) {
  if (vnode.type === 'text') {
    return document.createTextNode(vnode.text);
  }
  if (vnode.type === 'comment') {
    return document.createComment(vnode.text);
  }

  // element
  const el = document.createElement(vnode.tag);
  for (const [name, value] of Object.entries(vnode.attrs)) {
    if (name.startsWith('on') && typeof value === 'function') {
      const eventProp = 'on' + name.slice(2).toLowerCase();
      el[eventProp] = value;
    } else {
      el.setAttribute(name, value);
    }
  }
  for (const child of vnode.children) {
    el.appendChild(createDom(child));
  }
  return el;
}
