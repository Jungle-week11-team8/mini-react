const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const COMMENT_NODE = 8;

/**
 * 실제 DOM 노드를 VNode로 변환한다. 형태는 docs/vnode-spec.md를 따른다.
 * @param {Node} node
 * @returns {import('./types.js').VNode}
 */
export function domToVNode(node) {
  if (node.nodeType === TEXT_NODE) {
    return { type: 'text', text: /** @type {Text} */ (node).data };
  }
  if (node.nodeType === COMMENT_NODE) {
    return { type: 'comment', text: /** @type {Comment} */ (node).data };
  }
  if (node.nodeType === ELEMENT_NODE) {
    return elementToVNode(/** @type {Element} */ (node));
  }
  // 모르는 노드를 조용히 버리면 path 인덱스가 어긋나므로 바로 알린다
  throw new Error(`domToVNode: 지원하지 않는 nodeType ${node.nodeType}`);
}

/**
 * @param {Element} element
 * @returns {import('./types.js').ElementVNode}
 */
function elementToVNode(element) {
  const attrs = Object.fromEntries(Array.from(element.attributes, (a) => [a.name, a.value]));
  /** @type {import('./types.js').ElementVNode} */
  const vnode = {
    type: 'element',
    tag: element.localName,
    attrs,
    children: Array.from(element.childNodes, domToVNode),
  };
  // key는 attrs에도 남긴다. 지우면 patch 후 실제 DOM에서 key 속성이 사라진다.
  if ('key' in attrs) vnode.key = attrs.key;
  return vnode;
}
