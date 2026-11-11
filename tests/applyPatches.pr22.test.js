// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { applyPatches, diff, domToVNode } from '../src/index.js';

/* ───────────────────────── 헬퍼 ───────────────────────── */

const el = (tag, attrs = {}, children = []) => ({ type: 'element', tag, attrs, children });
const text = (t) => ({ type: 'text', text: t });
const comment = (t) => ({ type: 'comment', text: t });

const mounted = [];

/** HTML을 담은 container를 만든다. focus 같은 문서 의존 동작을 위해 body에 붙인다 */
function mount(html) {
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  mounted.push(container);
  return container;
}

afterEach(() => {
  while (mounted.length) mounted.pop().remove();
});

/** 직접 만든 patch 생성기 (diff에 의존하지 않고 applyPatches만 검증하기 위함) */
const P = {
  replace: (path, node) => ({ type: 'REPLACE', path, node }),
  setData: (path, value) => ({ type: 'SET_DATA', path, value }),
  attrs: (path, set = {}, remove = []) => ({ type: 'UPDATE_ATTRS', path, set, remove }),
  insert: (parentPath, index, node) => ({ type: 'INSERT', parentPath, index, node }),
  remove: (path) => ({ type: 'REMOVE', path }),
};

function deepFreeze(obj) {
  if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    Object.values(obj).forEach(deepFreeze);
  }
  return obj;
}

/** DOM 변경 기록을 동기적으로 받는다 (takeRecords) */
function observe(target) {
  const observer = new MutationObserver(() => {});
  observer.observe(target, {
    childList: true,
    attributes: true,
    characterData: true,
    subtree: true,
    attributeOldValue: true,
  });
  return {
    records: () => observer.takeRecords(),
    stop: () => observer.disconnect(),
  };
}

/* ───────────────────────── 1. 변경 없음 / 반환값 ───────────────────────── */

describe('applyPatches - 빈 patch', () => {
  it('빈 배열이면 DOM이 그대로다', () => {
    const c = mount('<p>hi</p>');
    const before = c.innerHTML;
    applyPatches(c, []);
    expect(c.innerHTML).toBe(before);
  });

  it('빈 배열이면 DOM 변경이 0건이다 (MutationObserver)', () => {
    const c = mount('<p class="a">hi</p>');
    const o = observe(c);
    applyPatches(c, []);
    expect(o.records()).toHaveLength(0);
  });

  it('빈 배열이면 container에 접근조차 하지 않는다 (null 이어도 에러 없음)', () => {
    expect(() => applyPatches(null, [])).not.toThrow();
  });

  it('반환값은 undefined 다', () => {
    const c = mount('<p></p>');
    expect(applyPatches(c, [])).toBeUndefined();
    expect(applyPatches(c, [P.attrs([0], { a: '1' })])).toBeUndefined();
  });
});

/* ───────────────────────── 2. SET_DATA ───────────────────────── */

describe('applyPatches - SET_DATA', () => {
  it('text 노드 내용을 바꾼다', () => {
    const c = mount('<p>a</p>');
    applyPatches(c, [P.setData([0, 0], 'b')]);
    expect(c.innerHTML).toBe('<p>b</p>');
  });

  it('comment 노드 내용을 바꾼다', () => {
    const c = mount('<p><!--a--></p>');
    applyPatches(c, [P.setData([0, 0], 'b')]);
    expect(c.innerHTML).toBe('<p><!--b--></p>');
  });

  it('루트가 text 노드여도 바꾼다 (path [0])', () => {
    const c = document.createElement('div');
    c.appendChild(document.createTextNode('a'));
    applyPatches(c, [P.setData([0], 'b')]);
    expect(c.textContent).toBe('b');
  });

  it('빈 문자열로 바꿔도 노드는 남는다 (제거되지 않음)', () => {
    const c = mount('<p>a</p>');
    applyPatches(c, [P.setData([0, 0], '')]);
    expect(c.firstChild.childNodes).toHaveLength(1);
    expect(c.firstChild.firstChild.nodeValue).toBe('');
  });

  it('같은 text 노드 객체를 재사용한다 (새로 만들지 않음)', () => {
    const c = mount('<p>a</p>');
    const textNode = c.firstChild.firstChild;
    applyPatches(c, [P.setData([0, 0], 'b')]);
    expect(c.firstChild.firstChild).toBe(textNode);
  });

  it('HTML 문자열을 값으로 줘도 태그로 해석되지 않는다 (XSS 방어)', () => {
    const c = mount('<p>a</p>');
    applyPatches(c, [P.setData([0, 0], '<img src=x onerror=alert(1)>')]);
    expect(c.querySelector('img')).toBeNull();
    expect(c.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('공백/개행/nbsp/이모지를 그대로 반영한다', () => {
    const c = mount('<p>a</p>');
    applyPatches(c, [P.setData([0, 0], ' \n\u00a0👨‍👩‍👧 ')]);
    expect(c.firstChild.firstChild.nodeValue).toBe(' \n\u00a0👨‍👩‍👧 ');
  });

  it('DOM 변경은 정확히 characterData 1건이다 (최소 변경)', () => {
    const c = mount('<p>a</p><p>b</p>');
    const o = observe(c);
    applyPatches(c, [P.setData([0, 0], 'X')]);
    const recs = o.records();
    expect(recs).toHaveLength(1);
    expect(recs[0].type).toBe('characterData');
  });
});

/* ───────────────────────── 3. UPDATE_ATTRS ───────────────────────── */

describe('applyPatches - UPDATE_ATTRS', () => {
  it('속성을 추가한다', () => {
    const c = mount('<div></div>');
    applyPatches(c, [P.attrs([0], { id: 'a' })]);
    expect(c.firstChild.getAttribute('id')).toBe('a');
  });

  it('속성 값을 변경한다', () => {
    const c = mount('<div id="a"></div>');
    applyPatches(c, [P.attrs([0], { id: 'b' })]);
    expect(c.firstChild.id).toBe('b');
  });

  it('속성을 삭제한다', () => {
    const c = mount('<div id="a" class="x"></div>');
    applyPatches(c, [P.attrs([0], {}, ['id'])]);
    expect(c.firstChild.hasAttribute('id')).toBe(false);
    expect(c.firstChild.getAttribute('class')).toBe('x'); // 나머지는 유지
  });

  it('추가 + 변경 + 삭제를 한 patch로 처리한다', () => {
    const c = mount('<div keep="1" change="a" drop="x"></div>');
    applyPatches(c, [P.attrs([0], { change: 'b', add: 'n' }, ['drop'])]);
    const div = c.firstChild;
    expect(div.getAttribute('keep')).toBe('1');
    expect(div.getAttribute('change')).toBe('b');
    expect(div.getAttribute('add')).toBe('n');
    expect(div.hasAttribute('drop')).toBe(false);
  });

  it('boolean 속성: "" 로 추가하면 켜지고, 삭제하면 꺼진다', () => {
    const c = mount('<button>ok</button>');
    const btn = c.firstChild;
    applyPatches(c, [P.attrs([0], { disabled: '' })]);
    expect(btn.disabled).toBe(true);
    applyPatches(c, [P.attrs([0], {}, ['disabled'])]);
    expect(btn.disabled).toBe(false);
  });

  it('존재하지 않는 속성을 삭제해도 에러 없다', () => {
    const c = mount('<div></div>');
    expect(() => applyPatches(c, [P.attrs([0], {}, ['nope'])])).not.toThrow();
  });

  it('같은 element 객체를 재사용한다', () => {
    const c = mount('<div id="a"></div>');
    const div = c.firstChild;
    applyPatches(c, [P.attrs([0], { id: 'b' })]);
    expect(c.firstChild).toBe(div);
  });

  it('속성만 바꿔도 자식 DOM 노드는 모두 재사용된다', () => {
    const c = mount('<ul id="a"><li>1</li><li>2</li></ul>');
    const [li1, li2] = c.firstChild.children;
    applyPatches(c, [P.attrs([0], { id: 'b' })]);
    expect(c.firstChild.children[0]).toBe(li1);
    expect(c.firstChild.children[1]).toBe(li2);
  });

  it('속성 값의 따옴표/꺾쇠/개행/유니코드를 그대로 설정한다', () => {
    const c = mount('<div></div>');
    applyPatches(c, [P.attrs([0], { title: 'He said "hi" <b>\n한글😀' })]);
    expect(c.firstChild.getAttribute('title')).toBe('He said "hi" <b>\n한글😀');
  });

  it('문자열 값을 변환 없이 설정한다 (007, 0.30000000000000004)', () => {
    const c = mount('<div></div>');
    applyPatches(c, [P.attrs([0], { 'data-a': '007', 'data-b': '0.30000000000000004' })]);
    expect(c.firstChild.getAttribute('data-a')).toBe('007');
    expect(c.firstChild.getAttribute('data-b')).toBe('0.30000000000000004');
  });

  it('하이픈 속성(data-*, aria-*)을 지원한다', () => {
    const c = mount('<div></div>');
    applyPatches(c, [P.attrs([0], { 'data-user-id': '7', 'aria-label': '닫기' })]);
    expect(c.firstChild.dataset.userId).toBe('7');
  });

  it('바뀌는 속성 수만큼만 attributes 변경이 일어난다 (최소 변경)', () => {
    const c = mount('<div a="1" b="2" c="3"></div>');
    const o = observe(c);
    applyPatches(c, [P.attrs([0], { b: '9' })]);
    const recs = o.records();
    expect(recs).toHaveLength(1);
    expect(recs[0].attributeName).toBe('b');
  });

  it('이벤트 리스너가 속성 변경 후에도 유지된다', () => {
    const c = mount('<button class="a">x</button>');
    let clicks = 0;
    c.firstChild.addEventListener('click', () => clicks++);
    applyPatches(c, [P.attrs([0], { class: 'b' })]);
    c.firstChild.click();
    expect(clicks).toBe(1);
  });
});

/* ───────────────────────── 4. REPLACE ───────────────────────── */

describe('applyPatches - REPLACE', () => {
  it('태그를 교체한다', () => {
    const c = mount('<div>a</div>');
    applyPatches(c, [P.replace([0], el('span', {}, [text('b')]))]);
    expect(c.innerHTML).toBe('<span>b</span>');
  });

  it('루트 교체 후에도 container의 자식은 1개다', () => {
    const c = mount('<div></div>');
    applyPatches(c, [P.replace([0], el('p'))]);
    expect(c.childNodes).toHaveLength(1);
  });

  it('element → text / text → element / element → comment', () => {
    const c = mount('<div></div>');
    applyPatches(c, [P.replace([0], text('t'))]);
    expect(c.innerHTML).toBe('t');
    applyPatches(c, [P.replace([0], el('p'))]);
    expect(c.innerHTML).toBe('<p></p>');
    applyPatches(c, [P.replace([0], comment('c'))]);
    expect(c.innerHTML).toBe('<!--c-->');
  });

  it('깊은 위치의 노드를 교체하고 나머지는 재사용한다', () => {
    const c = mount('<ul><li>1</li><li>2</li><li>3</li></ul>');
    const [li1, , li3] = c.firstChild.children;
    applyPatches(c, [P.replace([0, 1], el('p', {}, [text('x')]))]);
    expect(c.innerHTML).toBe('<ul><li>1</li><p>x</p><li>3</li></ul>');
    expect(c.firstChild.children[0]).toBe(li1);
    expect(c.firstChild.children[2]).toBe(li3);
  });

  it('새 서브트리(속성, 중첩 자식, 주석)를 통째로 만든다', () => {
    const c = mount('<div></div>');
    const node = el('ul', { class: 'x' }, [el('li', { id: '1' }, [text('A'), comment('c')])]);
    applyPatches(c, [P.replace([0], node)]);
    expect(c.innerHTML).toBe('<ul class="x"><li id="1">A<!--c--></li></ul>');
  });

  it('교체된 이전 노드는 문서에서 분리된다', () => {
    const c = mount('<div></div>');
    const old = c.firstChild;
    applyPatches(c, [P.replace([0], el('p'))]);
    expect(old.parentNode).toBeNull();
    expect(c.contains(old)).toBe(false);
  });

  it('교체된 새 노드는 vnode와 별개의 DOM 객체이며, 이후 vnode 변경이 DOM에 영향을 주지 않는다', () => {
    const c = mount('<div></div>');
    const node = el('p', { id: 'a' }, [text('x')]);
    applyPatches(c, [P.replace([0], node)]);
    node.attrs.id = 'HACKED';
    node.children[0].text = 'HACKED';
    expect(c.innerHTML).toBe('<p id="a">x</p>');
  });

  it('교체 후 이전 노드에 달린 이벤트 리스너는 새 노드에 없다', () => {
    const c = mount('<button>x</button>');
    let clicks = 0;
    c.firstChild.addEventListener('click', () => clicks++);
    applyPatches(c, [P.replace([0], el('button', {}, [text('x')]))]);
    c.firstChild.click();
    expect(clicks).toBe(0);
  });

  it('DOM 변경은 childList 1건이며 이전/새 노드가 정확히 기록된다', () => {
    const c = mount('<div></div><!--x-->'.slice(0, 11));
    const old = c.firstChild;
    const o = observe(c);
    applyPatches(c, [P.replace([0], el('p'))]);
    const recs = o.records();
    expect(recs).toHaveLength(1);
    expect(recs[0].removedNodes[0]).toBe(old);
    expect(recs[0].addedNodes[0].nodeName).toBe('P');
  });

  /**
   * [알려진 한계] createDomFromVNode 는 document.createElement 만 쓰므로
   * SVG 요소가 HTML 네임스페이스로 만들어져 화면에 그려지지 않는다.
   * VNode 에 namespace 정보가 없으므로, 부모가 <svg> 이면 createElementNS 를 쓰는
   * 식의 규칙이 필요하다.
   */
  /*
    it.fails('SVG 요소는 SVG 네임스페이스로 만들어진다', () => {
        const c = mount('<div></div>');
        applyPatches(c, [P.replace([0], el('svg', {}, [el('circle', { r: '1' })]))]);
        const circle = c.querySelector('circle');
        expect(circle.namespaceURI).toBe('http://www.w3.org/2000/svg');
    });
    */
});

/* ───────────────────────── 5. INSERT ───────────────────────── */

describe('applyPatches - INSERT', () => {
  it('빈 부모에 자식을 넣는다', () => {
    const c = mount('<ul></ul>');
    applyPatches(c, [P.insert([0], 0, el('li', {}, [text('A')]))]);
    expect(c.innerHTML).toBe('<ul><li>A</li></ul>');
  });

  it('끝에 추가한다 (index == childNodes.length)', () => {
    const c = mount('<ul><li>1</li></ul>');
    applyPatches(c, [P.insert([0], 1, el('li', {}, [text('2')]))]);
    expect(c.innerHTML).toBe('<ul><li>1</li><li>2</li></ul>');
  });

  it('중간에 끼워 넣는다 (index 앞에 삽입)', () => {
    const c = mount('<ul><li>1</li><li>3</li></ul>');
    applyPatches(c, [P.insert([0], 1, el('li', {}, [text('2')]))]);
    expect(c.innerHTML).toBe('<ul><li>1</li><li>2</li><li>3</li></ul>');
  });

  it('맨 앞(index 0)에 삽입한다', () => {
    const c = mount('<ul><li>2</li></ul>');
    applyPatches(c, [P.insert([0], 0, el('li', {}, [text('1')]))]);
    expect(c.innerHTML).toBe('<ul><li>1</li><li>2</li></ul>');
  });

  it('index가 길이를 넘어도 끝에 붙는다', () => {
    const c = mount('<ul><li>1</li></ul>');
    applyPatches(c, [P.insert([0], 99, el('li', {}, [text('2')]))]);
    expect(c.innerHTML).toBe('<ul><li>1</li><li>2</li></ul>');
  });

  it('여러 INSERT를 오름차순으로 적용한다', () => {
    const c = mount('<ul></ul>');
    applyPatches(c, [
      P.insert([0], 0, el('li', {}, [text('A')])),
      P.insert([0], 1, el('li', {}, [text('B')])),
      P.insert([0], 2, el('li', {}, [text('C')])),
    ]);
    expect(c.innerHTML).toBe('<ul><li>A</li><li>B</li><li>C</li></ul>');
  });

  it('INSERT가 내림차순으로 들어와도 index 기준으로 정렬해 적용한다', () => {
    const c = mount('<ul></ul>');
    applyPatches(c, [
      P.insert([0], 2, el('li', {}, [text('C')])),
      P.insert([0], 0, el('li', {}, [text('A')])),
      P.insert([0], 1, el('li', {}, [text('B')])),
    ]);
    expect(c.innerHTML).toBe('<ul><li>A</li><li>B</li><li>C</li></ul>');
  });

  it('서로 다른 부모에 대한 INSERT 를 각각 처리한다', () => {
    const c = mount('<div><ul></ul><ol></ol></div>');
    applyPatches(c, [
      P.insert([0, 0], 0, el('li', {}, [text('u')])),
      P.insert([0, 1], 0, el('li', {}, [text('o')])),
    ]);
    expect(c.innerHTML).toBe('<div><ul><li>u</li></ul><ol><li>o</li></ol></div>');
  });

  it('text / comment 노드도 삽입한다', () => {
    const c = mount('<p></p>');
    applyPatches(c, [P.insert([0], 0, text('t')), P.insert([0], 1, comment('c'))]);
    expect(c.innerHTML).toBe('<p>t<!--c--></p>');
  });

  it('빈 문자열 text 노드도 실제 노드로 삽입된다', () => {
    const c = mount('<p></p>');
    applyPatches(c, [P.insert([0], 0, text(''))]);
    expect(c.firstChild.childNodes).toHaveLength(1);
  });

  it('깊은 서브트리를 한 번에 만든다', () => {
    const c = mount('<div></div>');
    const subtree = el('section', { class: 'x' }, [
      el('ul', {}, [el('li', {}, [text('1')]), el('li', {}, [text('2')])]),
    ]);
    applyPatches(c, [P.insert([0], 0, subtree)]);
    expect(c.innerHTML).toBe(
      '<div><section class="x"><ul><li>1</li><li>2</li></ul></section></div>',
    );
  });

  it('기존 형제 노드는 모두 재사용된다', () => {
    const c = mount('<ul><li>1</li><li>2</li></ul>');
    const [a, b] = c.firstChild.children;
    applyPatches(c, [P.insert([0], 2, el('li')), P.insert([0], 3, el('li'))]);
    expect(c.firstChild.children[0]).toBe(a);
    expect(c.firstChild.children[1]).toBe(b);
  });

  it('공백 텍스트 노드가 있는 부모에서도 childNodes 인덱스로 삽입한다', () => {
    const c = mount('<ul>\n<li>1</li>\n</ul>'); // childNodes: [text, li, text]
    applyPatches(c, [P.insert([0], 3, el('li', {}, [text('2')]))]);
    expect(c.innerHTML).toBe('<ul>\n<li>1</li>\n<li>2</li></ul>');
  });

  it('삽입한 텍스트의 HTML 문자열은 태그로 해석되지 않는다 (XSS 방어)', () => {
    const c = mount('<p></p>');
    applyPatches(c, [P.insert([0], 0, text('<script>alert(1)</script>'))]);
    expect(c.querySelector('script')).toBeNull();
  });

  it('삽입한 노드의 속성 값에 든 HTML 도 태그로 해석되지 않는다', () => {
    const c = mount('<p></p>');
    applyPatches(c, [P.insert([0], 0, el('a', { href: '"><img src=x>' }))]);
    expect(c.querySelector('img')).toBeNull();
    expect(c.querySelector('a').getAttribute('href')).toBe('"><img src=x>');
  });

  it('DOM 변경은 INSERT 1건당 childList 1건이다', () => {
    const c = mount('<ul><li>1</li></ul>');
    const o = observe(c);
    applyPatches(c, [P.insert([0], 1, el('li')), P.insert([0], 2, el('li'))]);
    const recs = o.records();
    expect(recs).toHaveLength(2);
    expect(recs.every((r) => r.type === 'childList')).toBe(true);
  });

  it('잘못된 vnode(attrs 없음)를 넣으면 오류', () => {
    const c = mount('<p></p>');
    expect(() => applyPatches(c, [P.insert([0], 0, { type: 'element', tag: 'b' })])).toThrow();
  });
});

/* ───────────────────────── 6. REMOVE ───────────────────────── */

describe('applyPatches - REMOVE', () => {
  it('자식을 삭제한다', () => {
    const c = mount('<ul><li>1</li><li>2</li></ul>');
    applyPatches(c, [P.remove([0, 1])]);
    expect(c.innerHTML).toBe('<ul><li>1</li></ul>');
  });

  it('루트를 삭제하면 container 가 비어 있다', () => {
    const c = mount('<div></div>');
    applyPatches(c, [P.remove([0])]);
    expect(c.childNodes).toHaveLength(0);
  });

  it('같은 부모의 여러 자식을 삭제해도 인덱스가 밀리지 않는다 (참조를 먼저 확보)', () => {
    const c = mount('<ul><li>1</li><li>2</li><li>3</li><li>4</li></ul>');
    applyPatches(c, [P.remove([0, 1]), P.remove([0, 2]), P.remove([0, 3])]);
    expect(c.innerHTML).toBe('<ul><li>1</li></ul>');
  });

  it('REMOVE 의 나열 순서와 무관하게 같은 결과다 (오름차순/내림차순/섞임)', () => {
    const html = '<ul><li>1</li><li>2</li><li>3</li><li>4</li></ul>';
    const orders = [
      [1, 2, 3],
      [3, 2, 1],
      [2, 1, 3],
    ];
    for (const order of orders) {
      const c = mount(html);
      applyPatches(
        c,
        order.map((i) => P.remove([0, i])),
      );
      expect(c.innerHTML).toBe('<ul><li>1</li></ul>');
    }
  });

  it('삭제된 노드는 문서에서 분리된다', () => {
    const c = mount('<ul><li>1</li><li>2</li></ul>');
    const li2 = c.firstChild.children[1];
    applyPatches(c, [P.remove([0, 1])]);
    expect(li2.parentNode).toBeNull();
  });

  it('남은 형제 노드는 재사용된다', () => {
    const c = mount('<ul><li>1</li><li>2</li></ul>');
    const li1 = c.firstChild.children[0];
    applyPatches(c, [P.remove([0, 1])]);
    expect(c.firstChild.children[0]).toBe(li1);
  });

  it('공백 텍스트/주석 노드도 삭제한다', () => {
    const c = mount('<p>\n<!--c--></p>');
    applyPatches(c, [P.remove([0, 0]), P.remove([0, 1])]);
    expect(c.firstChild.childNodes).toHaveLength(0);
  });

  it('서로 다른 부모에서 동시에 삭제한다', () => {
    const c = mount('<div><ul><li>1</li><li>2</li></ul><ol><li>a</li><li>b</li></ol></div>');
    applyPatches(c, [P.remove([0, 0, 1]), P.remove([0, 1, 0])]);
    expect(c.innerHTML).toBe('<div><ul><li>1</li></ul><ol><li>b</li></ol></div>');
  });

  it('삭제 서브트리 내부는 건드리지 않고 childList 1건만 일어난다', () => {
    const c = mount('<ul><li><b>deep</b></li></ul>');
    const o = observe(c);
    applyPatches(c, [P.remove([0, 0])]);
    expect(o.records()).toHaveLength(1);
  });
});

/* ───────────────────────── 7. 적용 순서 / 복합 patch ───────────────────────── */

describe('applyPatches - 복합 patch와 적용 순서', () => {
  it('REMOVE 후 인덱스가 바뀌어도 다른 patch 의 대상은 old 기준으로 찾는다', () => {
    // old: [p0, p1, p2]. p0 삭제 + (old 기준) p2 의 속성 변경
    const c = mount('<div><p>0</p><p>1</p><p>2</p></div>');
    const p2 = c.firstChild.children[2];
    applyPatches(c, [P.remove([0, 0]), P.attrs([0, 2], { id: 'x' })]);
    expect(p2.id).toBe('x'); // 인덱스가 밀렸어도 올바른 노드를 수정
    expect(c.innerHTML).toBe('<div><p>1</p><p id="x">2</p></div>');
  });

  it('REMOVE 와 SET_DATA 가 섞여도 old 기준 참조로 올바른 노드를 바꾼다', () => {
    const c = mount('<div><p>a</p><p>b</p><p>c</p></div>');
    applyPatches(c, [P.remove([0, 0]), P.setData([0, 2, 0], 'C')]);
    expect(c.innerHTML).toBe('<div><p>b</p><p>C</p></div>');
  });

  it('REPLACE + INSERT 가 한 번에 적용된다', () => {
    const c = mount('<ul><li>1</li></ul>');
    applyPatches(c, [P.replace([0, 0], el('p')), P.insert([0], 1, el('li', {}, [text('2')]))]);
    expect(c.innerHTML).toBe('<ul><p></p><li>2</li></ul>');
  });

  it('REMOVE 와 REPLACE 가 한 번에 적용된다', () => {
    const c = mount('<ul><li>1</li><li>2</li><li>3</li></ul>');
    applyPatches(c, [P.replace([0, 0], el('p')), P.remove([0, 2])]);
    expect(c.innerHTML).toBe('<ul><p></p><li>2</li></ul>');
  });

  it('patch 배열의 순서를 섞어도 결과가 같다 (서로 독립적인 patch)', () => {
    const patches = [
      P.attrs([0], { id: 'r' }),
      P.setData([0, 0, 0], 'X'),
      P.remove([0, 2]),
      P.insert([0], 3, el('i')),
    ];
    const run = (list) => {
      const c = mount('<div><p>a</p><p>b</p><p>c</p></div>');
      applyPatches(c, list);
      return c.innerHTML;
    };
    const base = run(patches);
    expect(run([...patches].reverse())).toBe(base);
    expect(run([patches[2], patches[0], patches[3], patches[1]])).toBe(base);
  });

  it('여러 종류의 변경이 서로 다른 위치에서 동시에 적용된다', () => {
    const c = mount('<div class="a"><h1>t</h1><ul><li>1</li><li>2</li></ul></div>');
    applyPatches(c, [
      P.attrs([0], { class: 'b' }),
      P.setData([0, 0, 0], 'T'),
      P.remove([0, 1, 1]),
      P.insert([0], 2, el('p', {}, [text('end')])),
    ]);
    expect(c.innerHTML).toBe('<div class="b"><h1>T</h1><ul><li>1</li></ul><p>end</p></div>');
  });

  it('같은 patch 목록을 새 container 에 적용해도 같은 결과다 (결정성)', () => {
    const patches = [P.setData([0, 0], 'z'), P.attrs([0], { a: '1' })];
    const a = mount('<p>x</p>');
    const b = mount('<p>x</p>');
    applyPatches(a, patches);
    applyPatches(b, patches);
    expect(a.innerHTML).toBe(b.innerHTML);
  });
});

/* ───────────────────────── 8. DOM 재사용 / 부작용 보존 (핵심 요구사항) ───────────────────────── */

describe('applyPatches - 변경되지 않은 DOM은 그대로 유지된다', () => {
  it('변경이 없는 노드 전부가 같은 객체다 (diff + apply 통합)', () => {
    const c = mount('<div><h1>t</h1><ul><li>1</li><li>2</li></ul><p>x</p></div>');
    const before = [...c.querySelectorAll('*')];
    const oldV = domToVNode(c.firstChild);
    const newBox = document.createElement('div');
    newBox.innerHTML = '<div><h1>t</h1><ul><li>1</li><li>CHANGED</li></ul><p>x</p></div>';
    applyPatches(c, diff(oldV, domToVNode(newBox.firstChild)));
    const after = [...c.querySelectorAll('*')];
    expect(after).toHaveLength(before.length);
    after.forEach((node, i) => expect(node).toBe(before[i])); // 요소 전부 동일 객체
  });

  it('input 의 포커스가 유지된다 (innerHTML 통째 교체와의 핵심 차이)', () => {
    const c = mount('<div><input id="name"><p>a</p></div>');
    const input = c.querySelector('input');
    input.focus();
    expect(document.activeElement).toBe(input);
    applyPatches(c, [P.setData([0, 1, 0], 'b')]); // 다른 곳만 변경
    expect(document.activeElement).toBe(input);
  });

  it('사용자가 입력한 input.value(property)가 다른 곳의 변경 후에도 유지된다', () => {
    const c = mount('<div><input id="name"><p>a</p></div>');
    const input = c.querySelector('input');
    input.value = '사용자가 입력함';
    applyPatches(c, [P.setData([0, 1, 0], 'b')]);
    expect(input.value).toBe('사용자가 입력함');
  });

  it('input 이 속한 부모의 속성이 바뀌어도 입력값이 유지된다', () => {
    const c = mount('<form class="a"><input></form>');
    const input = c.querySelector('input');
    input.value = 'typed';
    applyPatches(c, [P.attrs([0], { class: 'b' })]);
    expect(input.value).toBe('typed');
  });

  it('체크박스 checked 상태가 다른 곳의 변경 후에도 유지된다', () => {
    const c = mount('<div><input type="checkbox"><span>a</span></div>');
    const box = c.querySelector('input');
    box.checked = true;
    applyPatches(c, [P.setData([0, 1, 0], 'b')]);
    expect(box.checked).toBe(true);
  });

  it('스크롤 위치/커스텀 JS 프로퍼티가 재사용된 노드에 남아 있다', () => {
    const c = mount('<div><p>a</p></div>');
    const p = c.querySelector('p');
    p.__custom = 'alive';
    applyPatches(c, [P.setData([0, 0, 0], 'b')]);
    expect(c.querySelector('p').__custom).toBe('alive');
  });

  it('REPLACE 된 노드의 커스텀 프로퍼티는 새 노드에 없다 (교체 = 새 객체)', () => {
    const c = mount('<div></div>');
    c.firstChild.__custom = 'old';
    applyPatches(c, [P.replace([0], el('div'))]);
    expect(c.firstChild.__custom).toBeUndefined();
  });

  it('이벤트 리스너가 형제 INSERT/REMOVE 와 무관하게 유지된다', () => {
    const c = mount('<ul><li id="a">A</li><li id="b">B</li></ul>');
    let clicks = 0;
    c.querySelector('#a').addEventListener('click', () => clicks++);
    applyPatches(c, [P.remove([0, 1]), P.insert([0], 2, el('li'))]);
    c.querySelector('#a').click();
    expect(clicks).toBe(1);
  });

  it('container 바깥의 DOM 은 건드리지 않는다', () => {
    const outside = document.createElement('div');
    outside.innerHTML = '<p>keep</p>';
    document.body.appendChild(outside);
    mounted.push(outside);
    const c = mount('<p>a</p>');
    const o = observe(document.body);
    applyPatches(c, [P.setData([0, 0], 'b')]);
    const targets = o.records().map((r) => r.target);
    expect(targets.every((t) => c.contains(t))).toBe(true);
    expect(outside.innerHTML).toBe('<p>keep</p>');
  });
});

/* ───────────────────────── 9. 불변성 / 순수 입력 ───────────────────────── */

describe('applyPatches - 입력 patch 를 변경하지 않는다', () => {
  it('깊게 얼린 patch 배열에도 에러 없이 동작한다', () => {
    const c = mount('<ul><li>1</li></ul>');
    const patches = deepFreeze([
      P.attrs([0], { id: 'a' }, ['x']),
      P.setData([0, 0, 0], 'z'),
      P.insert([0], 1, el('li', { a: '1' }, [text('n')])),
      P.replace([0, 0], el('p')),
    ]);
    expect(() => applyPatches(c, patches)).not.toThrow();
  });

  it('호출 전후로 patch 가 deep equal 하다', () => {
    const c = mount('<ul><li>1</li><li>2</li></ul>');
    const patches = [P.remove([0, 1]), P.insert([0], 1, el('li', {}, [text('n')]))];
    const snapshot = structuredClone(patches);
    applyPatches(c, patches);
    expect(patches).toEqual(snapshot);
  });

  it('patch 배열 자체의 순서도 바꾸지 않는다 (정렬은 복사본에서)', () => {
    const c = mount('<ul></ul>');
    const patches = [
      P.insert([0], 2, el('li')),
      P.insert([0], 0, el('li')),
      P.insert([0], 1, el('li')),
    ];
    applyPatches(c, patches);
    expect(patches.map((p) => p.index)).toEqual([2, 0, 1]);
  });
});

/* ───────────────────────── 10. 예외 / 방어 ───────────────────────── */

describe('applyPatches - 잘못된 입력', () => {
  it('container 가 null 이고 patch 가 있으면 오류', () => {
    expect(() => applyPatches(null, [P.setData([0], 'a')])).toThrow();
  });

  it('patches 가 undefined 이면 오류', () => {
    const c = mount('<p></p>');
    expect(() => applyPatches(c, undefined)).toThrow();
  });

  it('중간 경로가 존재하지 않으면 오류, 그리고 DOM 은 하나도 바뀌지 않는다 (resolve 단계에서 실패)', () => {
    const c = mount('<div><p>a</p></div>');
    const before = c.innerHTML;
    // 첫 patch 는 유효, 두 번째는 [0,5,0] → childNodes[5] 가 undefined 인 상태에서 접근
    expect(() => applyPatches(c, [P.attrs([0], { id: 'x' }), P.setData([0, 5, 0], 'z')])).toThrow();
    expect(c.innerHTML).toBe(before);
  });

  it('마지막 인덱스가 없는 path 는 명확한 에러로 실패한다', () => {
    const c = mount('<div><p>a</p></div>');
    expect(() => applyPatches(c, [P.setData([0, 9], 'z')])).toThrow();
  });

  it('마지막 인덱스가 틀린 path 가 섞여도 DOM 은 부분 적용되지 않는다 (원자성)', () => {
    const c = mount('<ul><li>1</li><li>2</li></ul>');
    const before = c.innerHTML;
    try {
      applyPatches(c, [P.remove([0, 0]), P.attrs([0, 9], { id: 'x' })]);
    } catch {
      /* 에러는 기대함 */
    }
    expect(c.innerHTML).toBe(before);
  });

  it('INSERT 의 parentPath 가 틀리면 명확한 에러로 실패한다', () => {
    const c = mount('<div></div>');
    expect(() => applyPatches(c, [P.insert([0, 3], 0, el('p'))])).toThrow();
  });

  it('알 수 없는 patch type 은 조용히 무시된다 (현재 동작 기록)', () => {
    const c = mount('<p>a</p>');
    const before = c.innerHTML;
    expect(() => applyPatches(c, [{ type: 'UNKNOWN', path: [0] }])).not.toThrow();
    expect(c.innerHTML).toBe(before);
  });
});

/* ───────────────────────── 11. 규모 ───────────────────────── */

describe('applyPatches - 규모', () => {
  it('자식 10000개를 INSERT 해도 순서가 유지된다', () => {
    const c = mount('<ul></ul>');
    const patches = Array.from({ length: 10_000 }, (_, i) =>
      P.insert([0], i, el('li', {}, [text(String(i))])),
    );
    applyPatches(c, patches);
    const lis = c.firstChild.children;
    expect(lis).toHaveLength(10_000);
    expect(lis[0].textContent).toBe('0');
    expect(lis[9999].textContent).toBe('9999');
  });

  it('자식 10000개를 REMOVE 해도 인덱스가 밀리지 않고 전부 삭제된다', () => {
    const items = Array.from({ length: 10_000 }, (_, i) => `<li>${i}</li>`).join('');
    const c = mount(`<ul>${items}</ul>`);
    const patches = Array.from({ length: 10_000 }, (_, i) => P.remove([0, i]));
    applyPatches(c, patches);
    expect(c.firstChild.childNodes).toHaveLength(0);
  });

  it('깊이 500 의 중첩 노드를 INSERT 해도 스택 오버플로가 없다', () => {
    let node = text('leaf');
    for (let i = 0; i < 500; i++) node = el('div', {}, [node]);
    const c = mount('<p></p>');
    expect(() => applyPatches(c, [P.insert([0], 0, node)])).not.toThrow();
    expect(c.querySelectorAll('div')).toHaveLength(500);
  });
});

/* ───────────────────────── 12. diff 와의 계약 (통합) ───────────────────────── */

describe('applyPatches - diff 와의 계약', () => {
  const roundTrip = (beforeHtml, afterHtml) => {
    const c = mount(beforeHtml);
    const other = document.createElement('div');
    other.innerHTML = afterHtml;
    applyPatches(c, diff(domToVNode(c.firstChild), domToVNode(other.firstChild)));
    return c;
  };

  it.each([
    ['텍스트 변경', '<p>a</p>', '<p>b</p>'],
    ['속성 추가/삭제', '<p id="a">x</p>', '<p class="b">x</p>'],
    ['태그 교체', '<div>x</div>', '<section>x</section>'],
    ['자식 추가', '<ul><li>1</li></ul>', '<ul><li>1</li><li>2</li></ul>'],
    ['자식 삭제', '<ul><li>1</li><li>2</li></ul>', '<ul><li>1</li></ul>'],
    ['공백 포함 구조', '<ul>\n  <li>A</li>\n</ul>', '<ul>\n  <li>B</li>\n  <li>C</li>\n</ul>'],
    ['주석 변경', '<div><!--a--></div>', '<div><!--b--></div>'],
    ['깊은 변경', '<a><b><c>1</c></b></a>', '<a><b><c>2</c><d></d></b></a>'],
  ])('%s: apply 후 innerHTML 이 after 와 같다', (_n, before, after) => {
    expect(roundTrip(before, after).innerHTML).toBe(after);
  });

  it('인덱스 비교 한계 ([A,B,C]→[B,C]) 에서도 결과 DOM 은 정확하다', () => {
    const c = roundTrip('<ul><li>A</li><li>B</li><li>C</li></ul>', '<ul><li>B</li><li>C</li></ul>');
    expect(c.innerHTML).toBe('<ul><li>B</li><li>C</li></ul>');
  });

  it('apply 후 domToVNode 결과가 new VNode 와 같다 (왕복 일관성)', () => {
    const c = mount('<div id="a"><p>x</p></div>');
    const other = document.createElement('div');
    other.innerHTML = '<div id="b"><p>y</p><i></i></div>';
    const newV = domToVNode(other.firstChild);
    applyPatches(c, diff(domToVNode(c.firstChild), newV));
    expect(domToVNode(c.firstChild)).toEqual(newV);
  });

  it('같은 HTML 이면 patch 가 없고 DOM 변경도 0건이다', () => {
    const c = mount('<ul><li>1</li></ul>');
    const o = observe(c);
    const same = document.createElement('div');
    same.innerHTML = '<ul><li>1</li></ul>';
    applyPatches(c, diff(domToVNode(c.firstChild), domToVNode(same.firstChild)));
    expect(o.records()).toHaveLength(0);
  });

  it('텍스트 하나만 바뀌면 전체 DOM 변경이 정확히 1건이다 (최소 변경 증명)', () => {
    const c = mount('<div><h1>t</h1><ul><li>1</li><li>2</li><li>3</li></ul></div>');
    const other = document.createElement('div');
    other.innerHTML = '<div><h1>t</h1><ul><li>1</li><li>X</li><li>3</li></ul></div>';
    const o = observe(c);
    applyPatches(c, diff(domToVNode(c.firstChild), domToVNode(other.firstChild)));
    const recs = o.records();
    expect(recs).toHaveLength(1);
    expect(recs[0].type).toBe('characterData');
  });
});
