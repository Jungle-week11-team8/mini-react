/**
 * JSX나 선언적 컴포넌트 작성을 위한 VNode 생성 헬퍼 함수
 * 실제 DOM이 아니라 VNode 객체를 반환 -> createDom()이 이 VNode를 실제 브라우저 DOM으로 변환
 *
 * @param {string} tag - HTML 태그명
 * @param {Record<string, string>} [attrs={}] - 속성 객체
 * @param {...(import('./types.js').VNode | string | number | Array)} rawChildren
 * @returns {import('./types.js').ElementVNode}
 */
export function h(tag, attrs = {}, ...rawChildren) {
  const children = [];

  function normalize(child) {
    if (child == null || child === false || child === true) {
      // null, undefined, boolean은 렌더링하지 않음
      return;
    }
    if (Array.isArray(child)) {
      for (const c of child) {
        normalize(c);
      }
      return;
    }
    if (typeof child === 'object' && child.type) {
      children.push(child);
      return;
    }
    // 문자열 또는 숫자
    children.push({ type: 'text', text: String(child) });
  }

  for (const child of rawChildren) {
    normalize(child);
  }

  // attrs 안전 복사 및 문자열화
  const normalizedAttrs = Object.create(null);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      normalizedAttrs[key] = String(value);
    }
  }

  return {
    type: 'element',
    tag: tag.toLowerCase(),
    attrs: normalizedAttrs,
    children,
  };
}

