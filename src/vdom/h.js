// JSX 이름과 실제 DOM 이벤트 이름이 다른 경우 (onDoubleClick -> dblclick)
const EVENT_NAME_MAP = { doubleclick: 'dblclick' };

/**
 * CamelCase 스타일 이름을 kebab-case로 변환 (예: fontSize -> font-size)
 * @param {string} str
 * @returns {string}
 */
function camelToKebab(str) {
  return str.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

/**
 * style 객체를 CSS 인라인 스타일 문자열로 변환
 * @param {Record<string, any> | string} style
 * @returns {string}
 */
function normalizeStyle(style) {
  if (typeof style === 'string') return style;
  if (typeof style === 'object' && style !== null) {
    return Object.entries(style)
      .filter(([_, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => `${camelToKebab(k)}:${v}`)
      .join(';');
  }
  return '';
}

/**
 * JSX 및 선언적 컴포넌트 작성을 위한 VNode 생성 헬퍼 함수.
 *
 * 규칙 준수 (AGENTS.md):
 * 1. attrs는 오직 문자열(Record<string, string>)만 보관한다. (structuredClone 가능)
 * 2. 이벤트 핸들러(on*)는 attrs에 넣지 않고 events 필드로 분리한다. (diff 왜곡 방지)
 * 3. 불리언 속성: false/null/undefined는 속성을 추가하지 않고, true는 ''(빈 문자열)로 넣는다.
 * 4. className은 표준 class로 변환한다.
 * 5. style 객체는 인라인 문자열로 변환한다.
 *
 * @param {string | Function} tag
 * @param {Record<string, any>} [props={}]
 * @param {...any} rawChildren
 * @returns {import('./types.js').VNode}
 */
export function h(tag, props = {}, ...rawChildren) {
  const currentProps = props || {};

  // 자식 노드 평탄화 및 정규화
  const children = [];
  function normalize(child) {
    if (child === null || child === undefined || child === false || child === true) return;
    if (Array.isArray(child)) {
      for (const c of child) normalize(c);
      return;
    }
    if (typeof child === 'object' && child.type) {
      children.push(child);
      return;
    }
    children.push({ type: 'text', text: String(child) });
  }

  for (const child of rawChildren) {
    normalize(child);
  }

  // 함수형 컴포넌트인 경우 직접 실행 (tag에 함수가 남지 않음)
  if (typeof tag === 'function') {
    return tag({ ...currentProps, children });
  }

  const attrs = Object.create(null);
  const events = Object.create(null);
  let hasEvents = false;

  for (const [key, value] of Object.entries(currentProps)) {
    if (key === 'children') continue;

    // 1. 이벤트 핸들러 분리 (AGENTS.md 규칙: attrs에 함수를 넣지 않는다)
    if (key.startsWith('on') && typeof value === 'function') {
      const rawName = key.slice(2).toLowerCase();
      const eventName = EVENT_NAME_MAP[rawName] ?? rawName;
      events[eventName] = value;
      hasEvents = true;
      continue;
    }

    // 2. className -> class 변환
    const attrName = key === 'className' ? 'class' : key;

    // 3. 불리언 및 nullish 속성 처리: false/null/undefined는 속성 자체를 생략
    if (value === false || value === null || value === undefined) {
      continue;
    }

    // 4. 불리언 true 속성: <input disabled> 형태인 { disabled: '' }로 변환
    if (value === true) {
      attrs[attrName] = '';
      continue;
    }

    // 5. style 객체 지원
    if (attrName === 'style') {
      const styleStr = normalizeStyle(value);
      if (styleStr !== '') {
        attrs.style = styleStr;
      }
      continue;
    }

    // 6. 일반 속성은 문자열로 저장
    attrs[attrName] = String(value);
  }

  const vnode = {
    type: 'element',
    tag: tag.toLowerCase(),
    attrs,
    children,
  };

  if (hasEvents) {
    vnode.events = events;
  }

  return vnode;
}
