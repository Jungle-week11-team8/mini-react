// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { domToVNode } from '../src/vdom/domToVNode.js';
import { domToVNode } from '../src/index.js';

/* ───────────────────────── 헬퍼 ───────────────────────── */

/** HTML 문자열을 파싱해서 첫 번째 "노드"(공백 포함)를 반환 */
function parseFirstNode(html) {
  const box = document.createElement('div');
  box.innerHTML = html;
  return box.firstChild;
}

/** HTML 문자열을 파싱해서 컨테이너 자체를 VNode로 변환 */
function parseBox(html) {
  const box = document.createElement('div');
  box.innerHTML = html;
  return domToVNode(box);
}

const el = (tag, attrs = {}, children = []) => ({ type: 'element', tag, attrs, children });
const text = (t) => ({ type: 'text', text: t });
const comment = (t) => ({ type: 'comment', text: t });

/** VNode 트리에 DOM 객체 참조가 섞여 있지 않은지 재귀 검사 */
function assertPureData(vnode) {
  expect(Object.getPrototypeOf(vnode)).toBe(Object.prototype);
  expect(vnode instanceof Node).toBe(false);
  if (vnode.type === 'element') {
    expect(Object.getPrototypeOf(vnode.attrs)).toBe(Object.prototype);
    expect(Array.isArray(vnode.children)).toBe(true);
    for (const v of Object.values(vnode.attrs)) expect(typeof v).toBe('string');
    vnode.children.forEach(assertPureData);
  }
}

/* ───────────────────────── 1. Text 노드 ───────────────────────── */

describe('domToVNode - Text 노드', () => {
  it('일반 텍스트를 { type, text }로 변환한다', () => {
    expect(domToVNode(document.createTextNode('hello'))).toEqual(text('hello'));
  });

  it('빈 문자열 텍스트 노드도 버리지 않는다 (경계값)', () => {
    expect(domToVNode(document.createTextNode(''))).toEqual(text(''));
  });

  it('공백만 있는 텍스트 노드를 그대로 보존한다 (trim 금지)', () => {
    expect(domToVNode(document.createTextNode('   '))).toEqual(text('   '));
    expect(domToVNode(document.createTextNode('\n\t  \r\n'))).toEqual(text('\n\t  \r\n'));
  });

  it('앞뒤 공백을 제거하지 않는다', () => {
    expect(domToVNode(document.createTextNode('  a b  '))).toEqual(text('  a b  '));
  });

  it('&nbsp;(\\u00a0)를 일반 공백과 구분해 보존한다', () => {
    const vnode = domToVNode(parseFirstNode('&nbsp;'));
    expect(vnode.text).toBe('\u00a0');
    expect(vnode.text).not.toBe(' ');
  });

  it('HTML 엔티티는 디코딩된 값을 담는다 (&amp; → &, &lt; → <)', () => {
    expect(domToVNode(parseFirstNode('a &amp; b &lt; c'))).toEqual(text('a & b < c'));
  });

  it('텍스트에 들어간 태그 모양 문자열은 요소로 해석되지 않는다', () => {
    const node = document.createTextNode('<script>alert(1)</script>');
    expect(domToVNode(node)).toEqual(text('<script>alert(1)</script>'));
  });

  it('이모지/한글/결합 문자 등 유니코드를 손상 없이 보존한다', () => {
    const s = '한글 😀 👨‍👩‍👧 é';
    expect(domToVNode(document.createTextNode(s)).text).toBe(s);
  });

  it('매우 긴 텍스트(100만 자)도 그대로 변환한다', () => {
    const long = 'a'.repeat(1_000_000);
    expect(domToVNode(document.createTextNode(long)).text).toHaveLength(1_000_000);
  });

  it('결과에 불필요한 필드(tag/attrs/children)가 없다', () => {
    const v = domToVNode(document.createTextNode('x'));
    expect(Object.keys(v).sort()).toEqual(['text', 'type']);
  });
});

/* ───────────────────────── 2. Comment 노드 ───────────────────────── */

describe('domToVNode - Comment 노드', () => {
  it('주석을 { type: "comment", text }로 변환한다', () => {
    expect(domToVNode(document.createComment('memo'))).toEqual(comment('memo'));
  });

  it('빈 주석도 변환한다 (경계값)', () => {
    expect(domToVNode(parseFirstNode('<!---->'))).toEqual(comment(''));
  });

  it('주석 내부 공백을 보존한다', () => {
    expect(domToVNode(document.createComment('  x  '))).toEqual(comment('  x  '));
  });

  it('주석 안의 태그 모양 문자열은 요소가 되지 않는다', () => {
    expect(domToVNode(parseFirstNode('<!-- <div>hi</div> -->'))).toEqual(
      comment(' <div>hi</div> '),
    );
  });

  it('text 타입과 comment 타입이 구분된다 (같은 내용이어도)', () => {
    const t = domToVNode(document.createTextNode('same'));
    const c = domToVNode(document.createComment('same'));
    expect(t.type).not.toBe(c.type);
  });
});

/* ───────────────────────── 3. Element: 태그 ───────────────────────── */

describe('domToVNode - Element 태그명', () => {
  it('태그명을 소문자로 반환한다', () => {
    expect(domToVNode(document.createElement('div')).tag).toBe('div');
  });

  it('createElement에 대문자를 넘겨도 소문자로 정규화된다', () => {
    expect(domToVNode(document.createElement('DIV')).tag).toBe('div');
    expect(domToVNode(document.createElement('SpAn')).tag).toBe('span');
  });

  it('HTML 소스의 대문자 태그(<DIV>)도 소문자로 변환된다', () => {
    expect(domToVNode(parseFirstNode('<DIV></DIV>')).tag).toBe('div');
  });

  it('하이픈이 있는 커스텀 엘리먼트를 지원한다', () => {
    expect(domToVNode(document.createElement('my-element')).tag).toBe('my-element');
  });

  it('SVG 요소의 camelCase 태그명은 대소문자를 유지한다', () => {
    const svg = parseFirstNode('<svg><foreignObject></foreignObject></svg>');
    expect(domToVNode(svg).children[0].tag).toBe('foreignObject');
  });

  it('SVG와 HTML이 섞여도 각각 변환된다', () => {
    const v = domToVNode(parseFirstNode('<svg viewBox="0 0 10 10"><circle r="1"/></svg>'));
    expect(v.tag).toBe('svg');
    expect(v.attrs.viewBox).toBe('0 0 10 10'); // 속성 camelCase 유지
    expect(v.children[0].tag).toBe('circle');
  });

  it('빈 요소는 attrs {} / children []를 가진다', () => {
    expect(domToVNode(document.createElement('div'))).toEqual(el('div'));
  });

  it('void 요소(br, img, input, hr)는 children이 빈 배열이다', () => {
    for (const html of ['<br>', '<img src="a.png">', '<input>', '<hr>']) {
      expect(domToVNode(parseFirstNode(html)).children).toEqual([]);
    }
  });
});

/* ───────────────────────── 4. Element: 속성 ───────────────────────── */

describe('domToVNode - Element 속성(attrs)', () => {
  it('일반 속성을 이름/값 쌍으로 수집한다', () => {
    const v = domToVNode(parseFirstNode('<a href="/home" id="x">go</a>'));
    expect(v.attrs).toEqual({ href: '/home', id: 'x' });
  });

  it('값 없는 boolean 속성은 빈 문자열 ""로 저장한다', () => {
    const v = domToVNode(parseFirstNode('<button disabled>ok</button>'));
    expect(v.attrs).toEqual({ disabled: '' });
    expect(v.attrs.disabled).not.toBe(true);
    expect('disabled' in v.attrs).toBe(true); // 값이 ''여도 키는 존재
  });

  it('빈 값 속성(value="")과 속성 없음을 구분한다', () => {
    const withEmpty = domToVNode(parseFirstNode('<input value="">'));
    const without = domToVNode(parseFirstNode('<input>'));
    expect('value' in withEmpty.attrs).toBe(true);
    expect('value' in without.attrs).toBe(false);
  });

  it('속성이 없으면 attrs는 빈 객체 {} 이다 (null/undefined 아님)', () => {
    const v = domToVNode(document.createElement('p'));
    expect(v.attrs).toEqual({});
    expect(v.attrs).not.toBeNull();
  });

  it('class 값의 공백을 정규화하지 않고 원문 그대로 둔다', () => {
    const v = domToVNode(parseFirstNode('<div class="  a   b  "></div>'));
    expect(v.attrs.class).toBe('  a   b  ');
  });

  it('style 속성은 문자열 그대로 저장한다', () => {
    const v = domToVNode(parseFirstNode('<div style="color: red;  margin:0"></div>'));
    expect(v.attrs.style).toBe('color: red;  margin:0');
  });

  it('data-* / aria-* 같은 하이픈 속성 이름을 지원한다', () => {
    const v = domToVNode(parseFirstNode('<div data-user-id="7" aria-label="닫기"></div>'));
    expect(v.attrs).toEqual({ 'data-user-id': '7', 'aria-label': '닫기' });
  });

  it('HTML 소스의 대문자 속성 이름은 소문자로 파싱된다', () => {
    const v = domToVNode(parseFirstNode('<div CLASS="a" ID="b"></div>'));
    expect(v.attrs).toEqual({ class: 'a', id: 'b' });
  });

  it('같은 속성이 중복되면 먼저 나온 값이 유지된다 (파서 규칙)', () => {
    const v = domToVNode(parseFirstNode('<div id="first" id="second"></div>'));
    expect(v.attrs.id).toBe('first');
  });

  it('속성 값의 따옴표/엔티티/꺾쇠를 디코딩된 값으로 담는다', () => {
    const v = domToVNode(
      parseFirstNode(`<div title='He said "hi"' data-x="a &amp; b" data-y="&lt;b&gt;"></div>`),
    );
    expect(v.attrs.title).toBe('He said "hi"');
    expect(v.attrs['data-x']).toBe('a & b');
    expect(v.attrs['data-y']).toBe('<b>');
  });

  it('속성 값의 개행/탭을 보존한다', () => {
    const div = document.createElement('div');
    div.setAttribute('data-x', 'a\nb\tc');
    expect(domToVNode(div).attrs['data-x']).toBe('a\nb\tc');
  });

  it('유니코드 속성 값을 보존한다', () => {
    const div = document.createElement('div');
    div.setAttribute('title', '한글 😀');
    expect(domToVNode(div).attrs.title).toBe('한글 😀');
  });

  it('SVG 네임스페이스 속성(xlink:href)의 이름을 그대로 담는다', () => {
    const v = domToVNode(parseFirstNode('<svg><use xlink:href="#a"></use></svg>'));
    expect(v.children[0].attrs['xlink:href']).toBe('#a');
  });

  it('속성 개수가 많아도(1000개) 전부 수집한다', () => {
    const div = document.createElement('div');
    for (let i = 0; i < 1000; i++) div.setAttribute(`data-k${i}`, String(i));
    const v = domToVNode(div);
    expect(Object.keys(v.attrs)).toHaveLength(1000);
    expect(v.attrs['data-k999']).toBe('999');
  });

  it('Object.prototype 이름과 겹치는 속성(constructor, toString 등)도 own property로 담는다', () => {
    const div = document.createElement('div');
    div.setAttribute('constructor', 'a');
    div.setAttribute('tostring', 'b'); // HTML 속성명은 소문자로 정규화됨
    div.setAttribute('hasownproperty', 'c');
    const v = domToVNode(div);
    expect(Object.hasOwn(v.attrs, 'constructor')).toBe(true);
    expect(v.attrs.constructor).toBe('a');
  });

  it('속성 이름이 "__proto__" 여도 유실되지 않는다', () => {
    const div = document.createElement('div');
    div.setAttribute('__proto__', 'x');
    const v = domToVNode(div);
    expect(Object.hasOwn(v.attrs, '__proto__')).toBe(true);
  });

  describe('속성 값은 항상 "문자열"이다 (타입 변환/부동소수점 방지)', () => {
    it('숫자 모양 값을 Number로 변환하지 않는다', () => {
      const div = document.createElement('div');
      div.setAttribute('data-a', '007');
      div.setAttribute('data-b', '1e3');
      div.setAttribute('data-c', '0.10');
      div.setAttribute('data-d', '9007199254740993'); // Number.MAX_SAFE_INTEGER 초과
      const { attrs } = domToVNode(div);
      expect(attrs['data-a']).toBe('007'); // 앞의 0 유지
      expect(attrs['data-b']).toBe('1e3'); // 지수 표기 유지
      expect(attrs['data-c']).toBe('0.10'); // 뒤의 0 유지
      expect(attrs['data-d']).toBe('9007199254740993'); // 정밀도 손실 없음
    });

    it('부동소수점 연산 결과를 setAttribute 해도 문자열 그대로 보존한다', () => {
      const div = document.createElement('div');
      div.setAttribute('width', 0.1 + 0.2); // 0.30000000000000004
      expect(domToVNode(div).attrs.width).toBe('0.30000000000000004');
    });

    it('"true"/"false"/"null"/"NaN" 문자열을 다른 타입으로 해석하지 않는다', () => {
      const div = document.createElement('div');
      for (const s of ['true', 'false', 'null', 'undefined', 'NaN']) {
        div.setAttribute(`data-${s}`, s);
      }
      const { attrs } = domToVNode(div);
      expect(attrs['data-true']).toBe('true');
      expect(attrs['data-false']).toBe('false');
      expect(attrs['data-null']).toBe('null');
      expect(attrs['data-undefined']).toBe('undefined');
      expect(attrs['data-nan']).toBe('NaN');
    });

    it('모든 속성 값의 typeof가 string이다', () => {
      assertPureData(domToVNode(parseFirstNode('<input type="number" value="1" disabled>')));
    });
  });

  describe('attribute vs property (현재 명세: attribute만 다룬다)', () => {
    it('사용자가 입력해 바뀐 input.value(property)는 반영되지 않는다', () => {
      const input = document.createElement('input');
      input.setAttribute('value', 'initial');
      input.value = 'typed by user'; // property 변경
      expect(domToVNode(input).attrs.value).toBe('initial');
    });

    it('checkbox의 checked property 변경은 반영되지 않는다', () => {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = true; // property만 변경, attribute 없음
      expect('checked' in domToVNode(input).attrs).toBe(false);
    });
  });
});

/* ───────────────────────── 5. children / 1:1 대응 ───────────────────────── */

describe('domToVNode - children (childNodes 1:1 대응)', () => {
  it('중첩 구조를 재귀적으로 변환한다', () => {
    expect(parseBox('<ul><li>A</li></ul>')).toEqual(
      el('div', {}, [el('ul', {}, [el('li', {}, [text('A')])])]),
    );
  });

  it('공백/개행 텍스트 노드를 버리지 않는다', () => {
    const v = parseBox('<ul>\n  <li>A</li>\n  <li>B</li>\n</ul>');
    const ul = v.children[0];
    expect(ul.children).toEqual([
      text('\n  '),
      el('li', {}, [text('A')]),
      text('\n  '),
      el('li', {}, [text('B')]),
      text('\n'),
    ]);
  });

  it('VNode.children.length === DOM.childNodes.length (모든 노드에서)', () => {
    const box = document.createElement('div');
    box.innerHTML = '<ul>\n <li>A</li>\n <!--c--> <li>B<b>x</b></li>\n</ul> tail';

    const walk = (domNode, vnode) => {
      if (vnode.type !== 'element') return;
      expect(vnode.children).toHaveLength(domNode.childNodes.length);
      domNode.childNodes.forEach((child, i) => walk(child, vnode.children[i]));
    };
    walk(box, domToVNode(box));
  });

  it('VNode.children[i] 의 종류가 DOM.childNodes[i] 와 항상 일치한다 (인덱스 정합성)', () => {
    const box = document.createElement('div');
    box.innerHTML = 'a<!--b--><p>c</p>d';
    const v = domToVNode(box);
    const expected = ['text', 'comment', 'element', 'text'];
    expect(v.children.map((c) => c.type)).toEqual(expected);
  });

  it('자식 순서를 유지한다', () => {
    const v = parseBox('<i>1</i><b>2</b><u>3</u>');
    expect(v.children.map((c) => c.tag)).toEqual(['i', 'b', 'u']);
  });

  it('text / comment / element 혼합 자식을 모두 변환한다', () => {
    const v = parseBox('t1<!--c1--><span>s</span>t2');
    expect(v.children).toEqual([
      text('t1'),
      comment('c1'),
      el('span', {}, [text('s')]),
      text('t2'),
    ]);
  });

  it('인접한 텍스트 노드를 병합(normalize)하지 않고 별개로 유지한다', () => {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode('a'));
    div.appendChild(document.createTextNode('b'));
    expect(domToVNode(div).children).toEqual([text('a'), text('b')]);
  });

  it('빈 텍스트 노드가 끼어 있어도 인덱스가 유지된다', () => {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(''));
    div.appendChild(document.createElement('p'));
    const v = domToVNode(div);
    expect(v.children).toHaveLength(2);
    expect(v.children[1].tag).toBe('p');
  });

  it('<textarea>의 내용은 text 자식으로 변환된다', () => {
    const v = domToVNode(parseFirstNode('<textarea>line1\nline2</textarea>'));
    expect(v.children).toEqual([text('line1\nline2')]);
  });

  it('<pre> 내부 공백/개행을 보존한다', () => {
    const v = domToVNode(parseFirstNode('<pre>  a\n    b</pre>'));
    expect(v.children).toEqual([text('  a\n    b')]);
  });

  it('<template>의 자식은 content에 있으므로 childNodes가 비어 children []가 된다', () => {
    // 현재 구현의 한계를 문서화하는 테스트
    const v = domToVNode(parseFirstNode('<template><p>hi</p></template>'));
    expect(v.children).toEqual([]);
  });

  it('Shadow DOM 내부는 변환 대상이 아니다 (childNodes에 없음)', () => {
    const host = document.createElement('div');
    host.attachShadow({ mode: 'open' }).innerHTML = '<p>shadow</p>';
    expect(domToVNode(host).children).toEqual([]);
  });

  it('깊은 중첩(깊이 500)을 스택 오버플로 없이 변환한다', () => {
    const root = document.createElement('div');
    let cur = root;
    for (let i = 0; i < 500; i++) {
      const next = document.createElement('div');
      cur.appendChild(next);
      cur = next;
    }
    let v = domToVNode(root);
    let depth = 0;
    while (v.children.length) {
      v = v.children[0];
      depth++;
    }
    expect(depth).toBe(500);
  });

  it('형제가 매우 많아도(10000개) 전부 변환하고 순서를 유지한다', () => {
    const ul = document.createElement('ul');
    for (let i = 0; i < 10_000; i++) {
      const li = document.createElement('li');
      li.textContent = String(i);
      ul.appendChild(li);
    }
    const v = domToVNode(ul);
    expect(v.children).toHaveLength(10_000);
    expect(v.children[0].children[0].text).toBe('0');
    expect(v.children[9999].children[0].text).toBe('9999');
  });
});

/* ───────────────────────── 6. 예외 처리 ───────────────────────── */

describe('domToVNode - 예외 처리 (지원하지 않는 입력)', () => {
  it('Document 노드(nodeType 9)는 에러를 던진다', () => {
    expect(() => domToVNode(document)).toThrow(/지원하지 않는 노드 타입/);
    expect(() => domToVNode(document)).toThrow(/nodeType=9/);
  });

  it('DocumentFragment(nodeType 11)는 에러를 던진다', () => {
    const frag = document.createDocumentFragment();
    expect(() => domToVNode(frag)).toThrow(/nodeType=11/);
  });

  it('DocumentType(nodeType 10)은 에러를 던진다', () => {
    const doctype = document.implementation.createDocumentType('html', '', '');
    expect(() => domToVNode(doctype)).toThrow(/nodeType=10/);
  });

  it('ProcessingInstruction(nodeType 7)은 에러를 던진다', () => {
    const xml = document.implementation.createDocument(null, 'root');
    const pi = xml.createProcessingInstruction('target', 'data');
    expect(() => domToVNode(pi)).toThrow(/nodeType=7/);
  });

  it('CDATASection(nodeType 4)은 에러를 던진다', () => {
    const xml = document.implementation.createDocument(null, 'root');
    const cdata = xml.createCDATASection('x');
    expect(() => domToVNode(cdata)).toThrow(/nodeType=4/);
  });

  it('자식 중에 지원하지 않는 노드가 있으면 전체 변환이 에러로 끝난다 (부분 결과 없음)', () => {
    const xml = document.implementation.createDocument(null, 'root');
    const root = xml.documentElement;
    root.appendChild(xml.createCDATASection('x'));
    expect(() => domToVNode(root)).toThrow(/nodeType=4/);
  });

  it('에러 객체는 Error 인스턴스다', () => {
    expect(() => domToVNode(document)).toThrow(Error);
  });

  it('null 을 넘기면 TypeError 를 던진다', () => {
    expect(() => domToVNode(null)).toThrow(TypeError);
  });

  it('undefined 를 넘기면 TypeError 를 던진다', () => {
    expect(() => domToVNode(undefined)).toThrow(TypeError);
  });

  it('DOM 노드가 아닌 일반 객체는 "지원하지 않는 노드 타입" 에러를 던진다', () => {
    expect(() => domToVNode({})).toThrow(/지원하지 않는 노드 타입/);
    expect(() => domToVNode({ nodeType: 99 })).toThrow(/nodeType=99/);
  });

  it('문자열(HTML 문자열)을 넘기면 에러를 던진다 (DOM 노드만 받는다)', () => {
    expect(() => domToVNode('<div></div>')).toThrow(/지원하지 않는 노드 타입/);
  });
});

/* ───────────────────────── 7. 순수성 / 불변성 / 스냅샷 ───────────────────────── */

describe('domToVNode - 순수성과 스냅샷 안정성', () => {
  it('변환 과정에서 원본 DOM을 수정하지 않는다', () => {
    const box = document.createElement('div');
    box.innerHTML = '<p class="a"> x </p><!--c-->';
    const before = box.innerHTML;
    domToVNode(box);
    expect(box.innerHTML).toBe(before);
  });

  it('같은 DOM을 두 번 변환하면 값은 같고 객체는 서로 다르다 (공유 참조 없음)', () => {
    const box = document.createElement('div');
    box.innerHTML = '<p id="a">x</p>';
    const v1 = domToVNode(box);
    const v2 = domToVNode(box);
    expect(v1).toEqual(v2);
    expect(v1).not.toBe(v2);
    expect(v1.children[0]).not.toBe(v2.children[0]);
    expect(v1.children[0].attrs).not.toBe(v2.children[0].attrs);
  });

  it('변환 후 DOM을 바꿔도 이미 만든 VNode는 변하지 않는다 (히스토리 스냅샷)', () => {
    const box = document.createElement('div');
    box.innerHTML = '<p id="a">x</p>';
    const snapshot = domToVNode(box);
    const frozenCopy = JSON.parse(JSON.stringify(snapshot));

    box.firstChild.setAttribute('id', 'changed');
    box.firstChild.textContent = 'changed';
    box.appendChild(document.createElement('span'));

    expect(snapshot).toEqual(frozenCopy);
  });

  it('VNode에 DOM 객체 참조가 섞여 있지 않은 순수 데이터다', () => {
    assertPureData(parseBox('<div id="a">t<!--c--><input disabled></div>'));
  });

  it('JSON 직렬화 후 복원해도 동일하다 (직렬화 가능)', () => {
    const v = parseBox('<ul><li class="x">A</li> <!--c--></ul>');
    expect(JSON.parse(JSON.stringify(v))).toEqual(v);
  });

  it('같은 HTML에서 만든 서로 다른 DOM은 동일한 VNode를 낳는다 (결정성)', () => {
    const html = '<div id="a"> <b>x</b> </div>';
    expect(parseBox(html)).toEqual(parseBox(html));
  });

  it('DOMParser로 만든 다른 document의 노드도 변환된다', () => {
    const doc = new DOMParser().parseFromString('<p id="x">hi</p>', 'text/html');
    expect(domToVNode(doc.body.firstChild)).toEqual(el('p', { id: 'x' }, [text('hi')]));
  });

  it('속성 순서가 달라도 attrs 내용이 같으면 동등하다', () => {
    const a = domToVNode(parseFirstNode('<div id="1" class="2"></div>'));
    const b = domToVNode(parseFirstNode('<div class="2" id="1"></div>'));
    expect(a).toEqual(b);
  });
});

/* ───────────────────────── 8. 통합 시나리오 ───────────────────────── */

describe('domToVNode - 실제 샘플 HTML 통합 시나리오', () => {
  it('Phase 1 샘플 영역 형태의 HTML을 정확히 변환한다', () => {
    const v = parseBox(`<h1 class="title">Hello</h1>
<ul>
  <li>A</li>
</ul>`);
    expect(v).toEqual(
      el('div', {}, [
        el('h1', { class: 'title' }, [text('Hello')]),
        text('\n'),
        el('ul', {}, [text('\n  '), el('li', {}, [text('A')]), text('\n')]),
      ]),
    );
  });

  it('형식만 다른 HTML(들여쓰기 유무)은 다른 VNode가 된다 (공백을 의미 있는 데이터로 취급)', () => {
    const compact = parseBox('<ul><li>A</li></ul>');
    const pretty = parseBox('<ul>\n  <li>A</li>\n</ul>');
    expect(compact).not.toEqual(pretty);
  });
});
