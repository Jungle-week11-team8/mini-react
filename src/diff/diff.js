/**
 * 두 VNode 트리를 비교해 patch 배열을 만든다. DOM에 접근하지 않는 순수 함수다.
 *
 * Diff 판단 5가지 케이스:
 *   1. oldVNode 없음 & newVNode 있음 → INSERT
 *   2. oldVNode 있음 & newVNode 없음 → REMOVE
 *   3. 둘 다 있지만 type 다름 or element tag 다름 → REPLACE
 *   4. 둘 다 텍스트/주석 노드 & 내용 다름 → SET_DATA
 *   5. 둘 다 동일한 element tag → UPDATE_ATTRS 후 자식 재귀
 *
 * patch 배열 순서: 전위 순회 (부모 → 자식 인덱스 오름차순)
 * 입력 VNode를 절대 변경하지 않는다.
 *
 * @param {import('../vdom/types.js').VNode} oldVNode
 * @param {import('../vdom/types.js').VNode} newVNode
 * @returns {import('../vdom/types.js').Patch[]}
 */
export function diff(oldVNode, newVNode) {
  const patches = [];
  // 루트 노드는 container.childNodes[0] 이므로 path [0]에서 시작
  diffNode(oldVNode, newVNode, [0], patches);
  return patches;

  /**
   * 두 VNode를 재귀적으로 비교하여 patches 배열에 Patch를 추가한다.
   *
   * @param {import('../vdom/types.js').VNode} oldNode
   * @param {import('../vdom/types.js').VNode} newNode
   * @param {number[]} path 현재 노드까지의 경로 (container 기준 childNodes 인덱스 배열)
   * @param {import('../vdom/types.js').Patch[]} patches
   */
  function diffNode(oldNode, newNode, path, patches) {
    // 케이스 3: type이 다르거나, 둘 다 element인데 tag가 다름 → REPLACE
    //노드 타입 비교
    //타입이 다르면 REPLACE
    if (oldNode.type !== newNode.type) {
      patches.push({ type: 'REPLACE', path: [...path], node: newNode });
      return;
    }

    // element라면 태그 비교
    if (oldNode.type === 'element' && newNode.type === 'element') {
      if (oldNode.tag !== newNode.tag) {
        //태그가 다르면 REPLACE
        patches.push({ type: 'REPLACE', path: [...path], node: newNode });
        return;
      }

      // 케이스 5: 같은 element tag → 속성 비교 후 자식 재귀
      //동일한 태그면 속성을 비교
      diffAttrs(oldNode.attrs, newNode.attrs, path, patches);
      diffChildren(oldNode.children, newNode.children, path, patches);
      return;
    }

    // 케이스 4: element가 아니고 text 또는 comment라면 노드의 내용 비교
    if (oldNode.text !== newNode.text) {
      patches.push({ type: 'SET_DATA', path: [...path], value: newNode.text });
    }
  }

  /**
   * 두 attrs 객체를 비교하여 UPDATE_ATTRS patch를 생성한다.
   *
   * @param {Record<string, string>} oldAttrs
   * @param {Record<string, string>} newAttrs
   * @param {number[]} path
   * @param {import('../vdom/types.js').Patch[]} patches
   */
  function diffAttrs(oldAttrs, newAttrs, path, patches) {
    // Object.create(null)로 __proto__ 키도 안전하게 저장
    const set = Object.create(null);
    const remove = [];

    // 새로 추가되거나 값이 변경된 속성 -> set
    for (const [key, value] of Object.entries(newAttrs)) {
      if (oldAttrs[key] !== value) {
        set[key] = value;
      }
    }

    // 삭제된 속성 -> remove
    for (const key of Object.keys(oldAttrs)) {
      // in 연산자 대신 Object.hasOwn을 사용하여 프로토타입 체인 검사를 방지
      if (!Object.hasOwn(newAttrs, key)) {
        remove.push(key);
      }
    }

    // set이나 remove 중 하나라도 비어있지 않을 때만 patch 생성
    if (Object.keys(set).length > 0 || remove.length > 0) {
      patches.push({ type: 'UPDATE_ATTRS', path: [...path], set, remove });
    }
  }

  /**
   * 두 children 배열을 인덱스별로 비교한다. (key 없는 경우)
   * key 기반 리스트 재조정이나 이동 최적화 구현 필요
   *
   * @param {import('../vdom/types.js').VNode[]} oldChildren
   * @param {import('../vdom/types.js').VNode[]} newChildren
   * @param {number[]} parentPath
   * @param {import('../vdom/types.js').Patch[]} patches
   */
  function diffChildren(oldChildren, newChildren, parentPath, patches) {
    const commonLen = Math.min(oldChildren.length, newChildren.length);

    // 같은 인덱스끼리 재귀 비교 (전위 순회: 인덱스 오름차순)
    for (let i = 0; i < commonLen; i++) {
      diffNode(oldChildren[i], newChildren[i], [...parentPath, i], patches);
    }

    // new에만 있는 자식 → INSERT
    for (let i = commonLen; i < newChildren.length; i++) {
      patches.push({
        type: 'INSERT',
        parentPath: [...parentPath],
        index: i,
        node: newChildren[i],
      });
    }

    // old에만 있는 자식 → REMOVE
    for (let i = commonLen; i < oldChildren.length; i++) {
      patches.push({
        type: 'REMOVE',
        path: [...parentPath, i],
      });
    }
  }
}
