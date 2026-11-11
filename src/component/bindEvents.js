/**
 * 렌더가 DOM에 반영된 뒤, VNode의 events를 같은 위치의 DOM 요소에 연결한다.
 * diff가 인덱스 기준으로 DOM을 재사용하므로, 매 렌더 전체를 최신 핸들러로 다시 맞춘다.
 * @param {Node} dom VNode와 같은 위치의 실제 DOM 노드
 * @param {import('../vdom/types.js').VNode} vnode
 */
export function bindEvents(dom, vnode) {
  if (vnode.type !== 'element') return;
  // VNode와 DOM이 1:1이 아니면 엉뚱한 요소에 핸들러가 붙으므로 바로 알린다
  if (!dom || dom.nodeType !== 1) {
    throw new Error('bindEvents: VNode와 DOM의 위치가 맞지 않습니다.');
  }

  // prev: 지난 렌더에 이 요소에 실제로 붙인 이벤트, next: 이번 렌더의 이벤트
  const prev = dom.__events ?? {};
  const next = vnode.events ?? {};
  // 이번 렌더에서 사라진 이벤트는 떼어야 이전 핸들러가 남지 않는다
  for (const name in prev) if (!(name in next)) dom['on' + name] = null;
  // 대입이라 덮어쓰면 이전 핸들러가 사라지고, 몇 번 렌더해도 하나만 남는다
  for (const name in next) dom['on' + name] = next[name];
  dom.__events = next;

  vnode.children.forEach((child, i) => bindEvents(dom.childNodes[i], child));
}
