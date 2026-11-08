/**
 * @param {Element} element
 * @returns {import('./types.js').ElementVNode}
 */
function elementToVNode(element) {
  const attrs = Object.fromEntries(
    Array.from(element.attributes, ({ name, value }) => [name, value]),
  );
  const key = element.getAttribute('key');

  return {
    type: 'element',
    tag: element.localName,
    attrs,
    ...(key === null ? {} : { key }),
    children: Array.from(element.childNodes, domToVNode),
  };
}

/**
 * 실제 DOM 노드를 VNode로 변환한다. 형태는 docs/vnode-spec.md를 따른다.
 * @param {Node} node
 * @returns {import('./types.js').VNode}
 */
export function domToVNode(node) {
  switch (node.nodeType) {
    case Node.DOCUMENT_NODE:
      return { type: 'document', children: Array.from(node.childNodes, domToVNode) };

    case Node.DOCUMENT_TYPE_NODE: {
      const { name, publicId, systemId } = /** @type {DocumentType} */ (node);
      return { type: 'doctype', name, publicId, systemId };
    }

    case Node.ELEMENT_NODE:
      return elementToVNode(/** @type {Element} */ (node));

    case Node.TEXT_NODE:
      return { type: 'text', text: /** @type {Text} */ (node).data };

    case Node.COMMENT_NODE:
      return { type: 'comment', text: /** @type {Comment} */ (node).data };

    default:
      throw new TypeError(`domToVNode: 지원하지 않는 DOM 노드 유형입니다 (${node.nodeType}).`);
  }
}
