/**
 * 실제 DOM 노드를 VNode로 변환한다. 형태는 docs/vnode-spec.md를 따른다.
 *
 * - Element → { type: 'element', tag, attrs, children }
 * - Text    → { type: 'text', text }
 * - Comment → { type: 'comment', text }
 *
 * 공백만 있는 텍스트 노드도 버리지 않고 그대로 변환한다.
 * VNode의 children은 실제 childNodes와 항상 1:1 대응한다.
 *
 * @param {Node} node
 * @returns {import('./types.js').VNode}
 */

//현재 DOM이 어떤 구조인지 읽어서 객체로 변환
export function domToVNode(node) {
  // Text 노드 
  if (node.nodeType === Node.TEXT_NODE) {
    return { type: 'text', text: node.textContent };
  }

  // Comment 노드 
  if (node.nodeType === Node.COMMENT_NODE) {
    return { type: 'comment', text: node.textContent };
  }

  // Element 노드
  if (node.nodeType === Node.ELEMENT_NODE) {
    // tag는 소문자 (localName 사용, tagName은 대문자를 반환하므로)
    const tag = node.localName;

    // attrs: 모든 속성을 문자열 값으로 수집
    // 값 없는 속성(disabled 등)은 빈 문자열 ''로 저장
    //
    // 테스트 조건(attrs가 일반 객체여야 함)을 만족하기 위해 일반 객체({})로 초기화한다.
    // 단, 일반 객체에 '__proto__' 속성을 일반 할당(=)으로 대입하면 
    // 자바스크립트가 특수 명령어로 오해해서 프로토타입 세터가 호출되어 값이 유실되거나 프로토타입이 오염된다.
    // 이를 방지하기 위해 '__proto__' 속성에 한해서만 Object.defineProperty를 
    // 사용하여 안전하게 객체 자체의 속성(own property)으로 저장한다.
    const attrs = {};
    for (const attr of node.attributes) {
      if (attr.name === '__proto__') {
        // __proto__는 일반 할당(=)을 쓰면 프로토타입이 오염되므로 defineProperty 사용
        Object.defineProperty(attrs, attr.name, {
          value: attr.value,
          enumerable: true,
          writable: true,
          configurable: true
        });
      } else {
        attrs[attr.name] = attr.value;
      }
    }

    // children: childNodes를 재귀적으로 변환 (공백 텍스트 노드 포함)
    const children = [];
    for (const child of node.childNodes) {
      children.push(domToVNode(child));
    }

    return { type: 'element', tag, attrs, children };
  }

  // 그 외 노드 타입은 지원하지 않음
  throw new Error(`domToVNode: 지원하지 않는 노드 타입입니다. nodeType=${node.nodeType}`);
}
