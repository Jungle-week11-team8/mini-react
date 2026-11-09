// @vitest-environment node
// ↑ 일부러 jsdom이 아닌 node 환경이다. diff가 DOM(document 등)을 건드리면
//   ReferenceError로 바로 실패하므로 "DOM 접근 없는 순수 함수" 계약을 강제한다.
import { describe, it, expect } from 'vitest';
import { diff } from '../src/index.js';

/* ───────────────────────── 헬퍼 ───────────────────────── */

const el = (tag, attrs = {}, children = []) => ({ type: 'element', tag, attrs, children });
const text = (t) => ({ type: 'text', text: t });
const comment = (t) => ({ type: 'comment', text: t });

/** 입력이 변경되면 (strict mode에서) 즉시 TypeError가 나도록 깊게 얼린다 */
function deepFreeze(obj) {
  if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    Object.values(obj).forEach(deepFreeze);
  }
  return obj;
}

/** n개의 <li>i</li> 형제 */
const items = (n) => Array.from({ length: n }, (_, i) => el('li', {}, [text(String(i))]));

/* ───────────────────────── 1. 변경 없음 ───────────────────────── */

describe('diff - 변경 없음 → 빈 배열', () => {
  it('똑같은 text 루트', () => {
    expect(diff(text('a'), text('a'))).toEqual([]);
  });

  it('똑같은 comment 루트', () => {
    expect(diff(comment('a'), comment('a'))).toEqual([]);
  });

  it('똑같은 빈 element', () => {
    expect(diff(el('div'), el('div'))).toEqual([]);
  });

  it('똑같은 속성/자식을 가진 중첩 트리', () => {
    const make = () =>
      el('div', { id: 'a' }, [el('p', { class: 'x' }, [text('hi'), comment('c')])]);
    expect(diff(make(), make())).toEqual([]);
  });

  it('동일 참조(같은 객체)를 두 번 넘겨도 []', () => {
    const tree = el('div', { a: '1' }, [text('x')]);
    expect(diff(tree, tree)).toEqual([]);
  });

  it('빈 문자열 텍스트끼리는 변경 없음', () => {
    expect(diff(text(''), text(''))).toEqual([]);
  });

  it('속성 선언 순서만 다르면 변경 없음', () => {
    expect(diff(el('div', { a: '1', b: '2' }), el('div', { b: '2', a: '1' }))).toEqual([]);
  });

  it('항상 새 배열을 반환한다 (내부 상태 공유 없음)', () => {
    const a = diff(el('div'), el('div'));
    const b = diff(el('div'), el('div'));
    expect(a).not.toBe(b);
  });
});

/* ───────────────────────── 2. 케이스 3: REPLACE ───────────────────────── */

describe('diff - 케이스 3: REPLACE (type 또는 tag가 다름)', () => {
  it('tag가 다르면 루트 REPLACE (path [0])', () => {
    const n = el('span');
    expect(diff(el('div'), n)).toEqual([{ type: 'REPLACE', path: [0], node: n }]);
  });

  it('element → text', () => {
    expect(diff(el('div'), text('a'))).toEqual([{ type: 'REPLACE', path: [0], node: text('a') }]);
  });

  it('text → element', () => {
    expect(diff(text('a'), el('div'))).toEqual([{ type: 'REPLACE', path: [0], node: el('div') }]);
  });

  it('element → comment', () => {
    expect(diff(el('div'), comment('a'))).toEqual([
      { type: 'REPLACE', path: [0], node: comment('a') },
    ]);
  });

  it('text ↔ comment: 내용이 같아도 type이 다르면 REPLACE (SET_DATA 아님)', () => {
    expect(diff(text('same'), comment('same'))).toEqual([
      { type: 'REPLACE', path: [0], node: comment('same') },
    ]);
    expect(diff(comment('same'), text('same'))).toEqual([
      { type: 'REPLACE', path: [0], node: text('same') },
    ]);
  });

  it('태그 대소문자가 다르면 다른 태그로 본다 (소문자 정규화는 domToVNode의 책임)', () => {
    const patches = diff(el('div'), el('DIV'));
    expect(patches).toHaveLength(1);
    expect(patches[0].type).toBe('REPLACE');
  });

  it('REPLACE되는 노드의 자식/속성은 비교하지 않는다 (서브트리 통째로 교체, O(n) 가정)', () => {
    const oldTree = el('div', { id: 'a' }, [text('1'), text('2'), text('3')]);
    const newTree = el('section', { id: 'b' }, [text('x')]);
    const patches = diff(oldTree, newTree);
    expect(patches).toEqual([{ type: 'REPLACE', path: [0], node: newTree }]);
  });

  it('REPLACE의 node에는 새 서브트리 전체가 담긴다', () => {
    const n = el('ul', {}, items(3));
    const [p] = diff(el('ol'), n);
    expect(p.node).toEqual(n);
  });

  it('깊은 곳의 REPLACE는 정확한 path를 가진다', () => {
    const oldTree = el('div', {}, [text('a'), el('ul', {}, [el('li'), el('li')])]);
    const newTree = el('div', {}, [text('a'), el('ul', {}, [el('li'), el('p')])]);
    expect(diff(oldTree, newTree)).toEqual([{ type: 'REPLACE', path: [0, 1, 1], node: el('p') }]);
  });

  it('형제 중 하나만 REPLACE되면 나머지는 patch가 없다', () => {
    const oldTree = el('div', {}, [el('a'), el('b'), el('c')]);
    const newTree = el('div', {}, [el('a'), el('i'), el('c')]);
    const patches = diff(oldTree, newTree);
    expect(patches).toHaveLength(1);
    expect(patches[0].path).toEqual([0, 1]);
  });
});

/* ───────────────────────── 3. 케이스 4: SET_DATA ───────────────────────── */

describe('diff - 케이스 4: SET_DATA (text/comment 내용 변경)', () => {
  it('text 내용 변경', () => {
    expect(diff(text('a'), text('b'))).toEqual([{ type: 'SET_DATA', path: [0], value: 'b' }]);
  });

  it('comment 내용 변경', () => {
    expect(diff(comment('a'), comment('b'))).toEqual([{ type: 'SET_DATA', path: [0], value: 'b' }]);
  });

  it('빈 문자열 → 내용 / 내용 → 빈 문자열', () => {
    expect(diff(text(''), text('a'))).toEqual([{ type: 'SET_DATA', path: [0], value: 'a' }]);
    expect(diff(text('a'), text(''))).toEqual([{ type: 'SET_DATA', path: [0], value: '' }]);
  });

  it('공백 차이도 변경으로 본다 (trim/정규화 없음)', () => {
    expect(diff(text('a'), text('a '))).toHaveLength(1);
    expect(diff(text('a b'), text('a  b'))).toHaveLength(1);
    expect(diff(text('\n'), text(' '))).toHaveLength(1);
    expect(diff(text(' '), text('\u00a0'))).toHaveLength(1); // 일반 공백 vs &nbsp;
  });

  it('대소문자는 구분한다', () => {
    expect(diff(text('a'), text('A'))).toHaveLength(1);
  });

  it('SET_DATA는 value만 갖는다 (node 전체가 아님)', () => {
    const [p] = diff(text('a'), text('b'));
    expect(Object.keys(p).sort()).toEqual(['path', 'type', 'value']);
  });

  it('자식 text 변경의 path는 부모 경로 + 인덱스다', () => {
    const patches = diff(el('p', {}, [text('a')]), el('p', {}, [text('b')]));
    expect(patches).toEqual([{ type: 'SET_DATA', path: [0, 0], value: 'b' }]);
  });

  it('유니코드/이모지 값을 손상 없이 전달한다', () => {
    const [p] = diff(text('a'), text('👨‍👩‍👧 한글'));
    expect(p.value).toBe('👨‍👩‍👧 한글');
  });

  it('숫자처럼 보이는 문자열은 문자열 그대로 비교한다 ("1" vs "1.0", "0.1+0.2")', () => {
    expect(diff(text('1'), text('1.0'))).toHaveLength(1);
    expect(diff(text('0.30000000000000004'), text('0.3'))).toHaveLength(1);
    expect(diff(text('007'), text('7'))).toHaveLength(1);
  });
});

/* ───────────────────────── 4. 케이스 5: UPDATE_ATTRS ───────────────────────── */

describe('diff - 케이스 5: UPDATE_ATTRS (같은 tag, 속성 변경)', () => {
  it('속성 추가', () => {
    expect(diff(el('div'), el('div', { id: 'a' }))).toEqual([
      { type: 'UPDATE_ATTRS', path: [0], set: { id: 'a' }, remove: [] },
    ]);
  });

  it('속성 값 변경', () => {
    expect(diff(el('div', { id: 'a' }), el('div', { id: 'b' }))).toEqual([
      { type: 'UPDATE_ATTRS', path: [0], set: { id: 'b' }, remove: [] },
    ]);
  });

  it('속성 삭제', () => {
    expect(diff(el('div', { id: 'a' }), el('div'))).toEqual([
      { type: 'UPDATE_ATTRS', path: [0], set: {}, remove: ['id'] },
    ]);
  });

  it('추가 + 변경 + 삭제가 한 patch에 함께 담긴다', () => {
    const patches = diff(
      el('div', { keep: '1', change: 'a', drop: 'x' }),
      el('div', { keep: '1', change: 'b', add: 'n' }),
    );
    expect(patches).toEqual([
      { type: 'UPDATE_ATTRS', path: [0], set: { change: 'b', add: 'n' }, remove: ['drop'] },
    ]);
  });

  it('바뀌지 않은 속성은 set에 포함되지 않는다 (최소 변경)', () => {
    const [p] = diff(el('div', { a: '1', b: '2' }), el('div', { a: '1', b: '3' }));
    expect(p.set).toEqual({ b: '3' });
    expect('a' in p.set).toBe(false);
  });

  it('속성이 모두 같으면 patch를 만들지 않는다', () => {
    expect(diff(el('div', { a: '1' }), el('div', { a: '1' }))).toEqual([]);
  });

  it('모든 속성 삭제', () => {
    const [p] = diff(el('div', { a: '1', b: '2' }), el('div'));
    expect(p.set).toEqual({});
    expect(p.remove.sort()).toEqual(['a', 'b']);
  });

  it('boolean 속성: 속성 없음 → "" 는 추가로 본다', () => {
    expect(diff(el('button'), el('button', { disabled: '' }))).toEqual([
      { type: 'UPDATE_ATTRS', path: [0], set: { disabled: '' }, remove: [] },
    ]);
  });

  it('boolean 속성: "" → 속성 없음은 삭제로 본다', () => {
    expect(diff(el('button', { disabled: '' }), el('button'))).toEqual([
      { type: 'UPDATE_ATTRS', path: [0], set: {}, remove: ['disabled'] },
    ]);
  });

  it('값이 ""인 속성과 값이 "0"인 속성은 다르다 (falsy 혼동 방지)', () => {
    expect(diff(el('div', { a: '' }), el('div', { a: '0' }))).toHaveLength(1);
    expect(diff(el('div', { a: '0' }), el('div', { a: '' }))).toHaveLength(1);
  });

  it('"false"/"null"/"undefined" 문자열을 속성 부재로 오해하지 않는다', () => {
    expect(diff(el('div'), el('div', { a: 'false' }))).toEqual([
      { type: 'UPDATE_ATTRS', path: [0], set: { a: 'false' }, remove: [] },
    ]);
    expect(diff(el('div'), el('div', { a: 'undefined' }))).toHaveLength(1);
  });

  it('속성 값의 공백 차이도 변경으로 본다 (class "a b" → "a  b")', () => {
    expect(diff(el('div', { class: 'a b' }), el('div', { class: 'a  b' }))).toHaveLength(1);
  });

  it('숫자처럼 보이는 문자열 비교: "1" vs "1.0" 은 다르다', () => {
    expect(diff(el('div', { width: '1' }), el('div', { width: '1.0' }))).toHaveLength(1);
  });

  it('하이픈 속성(data-*, aria-*)을 지원한다', () => {
    const [p] = diff(el('div'), el('div', { 'data-user-id': '7' }));
    expect(p.set).toEqual({ 'data-user-id': '7' });
  });

  it('속성 1000개가 모두 바뀌어도 patch는 1개다', () => {
    const oldAttrs = {};
    const newAttrs = {};
    for (let i = 0; i < 1000; i++) {
      oldAttrs[`data-${i}`] = 'a';
      newAttrs[`data-${i}`] = 'b';
    }
    const patches = diff(el('div', oldAttrs), el('div', newAttrs));
    expect(patches).toHaveLength(1);
    expect(Object.keys(patches[0].set)).toHaveLength(1000);
  });

  it('UPDATE_ATTRS의 필드는 type/path/set/remove 뿐이다', () => {
    const [p] = diff(el('div'), el('div', { a: '1' }));
    expect(Object.keys(p).sort()).toEqual(['path', 'remove', 'set', 'type']);
  });

  it('자식 요소의 속성 변경은 자식 path를 가진다', () => {
    const patches = diff(
      el('ul', {}, [el('li', { class: 'a' })]),
      el('ul', {}, [el('li', { class: 'b' })]),
    );
    expect(patches).toEqual([
      { type: 'UPDATE_ATTRS', path: [0, 0], set: { class: 'b' }, remove: [] },
    ]);
  });

  /**
   * [알려진 취약점] diffAttrs는 `!(key in newAttrs)` 로 삭제를 판정한다.
   * `in` 은 프로토타입 체인까지 검사하므로 속성 이름이 "constructor" 이면
   * newAttrs에 없어도 true 가 되어 삭제가 누락된다.
   */
  it('속성 이름이 "constructor" 여도 삭제가 누락되지 않는다', () => {
    const patches = diff(el('div', { constructor: 'x' }), el('div'));
    expect(patches).toEqual([
      { type: 'UPDATE_ATTRS', path: [0], set: {}, remove: ['constructor'] },
    ]);
  });

  it('속성 이름이 "constructor"일 때 추가/변경은 정상 동작한다', () => {
    expect(diff(el('div'), el('div', { constructor: 'x' }))[0].set).toEqual({ constructor: 'x' });
    expect(diff(el('div', { constructor: 'x' }), el('div', { constructor: 'y' }))[0].set).toEqual({
      constructor: 'y',
    });
  });
});

/* ───────────────────────── 5. 케이스 1: INSERT ───────────────────────── */

describe('diff - 케이스 1: INSERT (new에만 있는 자식)', () => {
  it('빈 부모에 자식 하나 추가', () => {
    expect(diff(el('ul'), el('ul', {}, [el('li')]))).toEqual([
      { type: 'INSERT', parentPath: [0], index: 0, node: el('li') },
    ]);
  });

  it('끝에 추가: 기존 자식은 건드리지 않는다', () => {
    const patches = diff(el('ul', {}, items(2)), el('ul', {}, items(3)));
    expect(patches).toEqual([{ type: 'INSERT', parentPath: [0], index: 2, node: items(3)[2] }]);
  });

  it('여러 개 추가하면 index 오름차순으로 patch가 나온다', () => {
    const patches = diff(el('ul', {}, items(1)), el('ul', {}, items(4)));
    expect(patches.map((p) => p.type)).toEqual(['INSERT', 'INSERT', 'INSERT']);
    expect(patches.map((p) => p.index)).toEqual([1, 2, 3]);
  });

  it('INSERT 하나에 서브트리 전체가 담긴다 (자식별로 쪼개지 않음)', () => {
    const subtree = el('li', { class: 'x' }, [el('b', {}, [text('deep')]), comment('c')]);
    const patches = diff(el('ul'), el('ul', {}, [subtree]));
    expect(patches).toHaveLength(1);
    expect(patches[0].node).toEqual(subtree);
  });

  it('INSERT는 path가 아니라 parentPath + index를 쓴다', () => {
    const [p] = diff(el('ul'), el('ul', {}, [el('li')]));
    expect(Object.keys(p).sort()).toEqual(['index', 'node', 'parentPath', 'type']);
    expect('path' in p).toBe(false);
  });

  it('깊은 부모의 INSERT는 정확한 parentPath를 가진다', () => {
    const oldTree = el('div', {}, [el('section', {}, [el('ul')])]);
    const newTree = el('div', {}, [el('section', {}, [el('ul', {}, [el('li')])])]);
    expect(diff(oldTree, newTree)).toEqual([
      { type: 'INSERT', parentPath: [0, 0, 0], index: 0, node: el('li') },
    ]);
  });

  it('text/comment 노드도 INSERT 대상이다', () => {
    const patches = diff(el('p'), el('p', {}, [text('a'), comment('b')]));
    expect(patches.map((p) => p.node.type)).toEqual(['text', 'comment']);
  });

  it('빈 문자열 text 노드 추가도 INSERT로 잡는다', () => {
    expect(diff(el('p'), el('p', {}, [text('')]))).toHaveLength(1);
  });
});

/* ───────────────────────── 6. 케이스 2: REMOVE ───────────────────────── */

describe('diff - 케이스 2: REMOVE (old에만 있는 자식)', () => {
  it('유일한 자식 삭제', () => {
    expect(diff(el('ul', {}, [el('li')]), el('ul'))).toEqual([{ type: 'REMOVE', path: [0, 0] }]);
  });

  it('끝 자식 삭제: 기존 자식은 건드리지 않는다', () => {
    expect(diff(el('ul', {}, items(3)), el('ul', {}, items(2)))).toEqual([
      { type: 'REMOVE', path: [0, 2] },
    ]);
  });

  it('여러 개 삭제하면 index 오름차순 path로 나온다', () => {
    const patches = diff(el('ul', {}, items(4)), el('ul', {}, items(1)));
    expect(patches).toEqual([
      { type: 'REMOVE', path: [0, 1] },
      { type: 'REMOVE', path: [0, 2] },
      { type: 'REMOVE', path: [0, 3] },
    ]);
  });

  it('모든 자식 삭제', () => {
    expect(diff(el('ul', {}, items(3)), el('ul'))).toHaveLength(3);
  });

  it('REMOVE는 path만 갖는다', () => {
    const [p] = diff(el('ul', {}, items(1)), el('ul'));
    expect(Object.keys(p).sort()).toEqual(['path', 'type']);
  });

  it('삭제되는 서브트리 내부는 비교하지 않는다 (patch 1개)', () => {
    const deep = el('li', { a: '1' }, [el('b', {}, [text('x'), text('y')])]);
    expect(diff(el('ul', {}, [deep]), el('ul'))).toHaveLength(1);
  });

  it('공백 텍스트 노드의 삭제도 REMOVE로 잡는다', () => {
    expect(diff(el('ul', {}, [text('\n')]), el('ul'))).toEqual([{ type: 'REMOVE', path: [0, 0] }]);
  });
});

/* ───────────────────────── 7. 인덱스 기반 비교의 한계 (현재 동작 고정) ───────────────────────── */

describe('diff - 인덱스 기반 비교의 특성 (key 없음)', () => {
  it('[A,B,C] → [B,C]: "A 삭제"가 아니라 "0,1번 변경 + 2번 삭제"가 된다', () => {
    const A = el('li', {}, [text('A')]);
    const B = el('li', {}, [text('B')]);
    const C = el('li', {}, [text('C')]);
    const patches = diff(el('ul', {}, [A, B, C]), el('ul', {}, [B, C]));
    expect(patches).toEqual([
      { type: 'SET_DATA', path: [0, 0, 0], value: 'B' },
      { type: 'SET_DATA', path: [0, 1, 0], value: 'C' },
      { type: 'REMOVE', path: [0, 2] },
    ]);
  });

  it('[A,B] → [X,A,B]: 앞에 삽입하면 전부 밀려 2개 변경 + 1개 INSERT 가 된다', () => {
    const li = (t) => el('li', {}, [text(t)]);
    const patches = diff(
      el('ul', {}, [li('A'), li('B')]),
      el('ul', {}, [li('X'), li('A'), li('B')]),
    );
    expect(patches.map((p) => p.type)).toEqual(['SET_DATA', 'SET_DATA', 'INSERT']);
  });

  it('순서만 바뀌어도(swap) 각 위치별 변경으로 처리된다', () => {
    const li = (t) => el('li', {}, [text(t)]);
    const patches = diff(el('ul', {}, [li('A'), li('B')]), el('ul', {}, [li('B'), li('A')]));
    expect(patches).toEqual([
      { type: 'SET_DATA', path: [0, 0, 0], value: 'B' },
      { type: 'SET_DATA', path: [0, 1, 0], value: 'A' },
    ]);
  });

  it('같은 레벨만 비교한다: 깊이를 넘어간 이동은 추적하지 않는다', () => {
    // <div><p/></div>  →  <div><section><p/></section></div> : p는 "이동"이 아니라 REPLACE
    const patches = diff(el('div', {}, [el('p')]), el('div', {}, [el('section', {}, [el('p')])]));
    expect(patches).toEqual([
      { type: 'REPLACE', path: [0, 0], node: el('section', {}, [el('p')]) },
    ]);
  });

  it('공통 구간의 자식 변경과 길이 차이(INSERT)가 함께 나온다', () => {
    const patches = diff(
      el('ul', {}, [el('li', { c: '1' })]),
      el('ul', {}, [el('li', { c: '2' }), el('li')]),
    );
    expect(patches.map((p) => p.type)).toEqual(['UPDATE_ATTRS', 'INSERT']);
  });
});

/* ───────────────────────── 8. patch 순서 (전위 순회) ───────────────────────── */

describe('diff - patch 순서: 전위 순회 (부모 → 자식 인덱스 오름차순)', () => {
  it('부모의 UPDATE_ATTRS가 자식 patch보다 먼저 나온다', () => {
    const patches = diff(el('div', { a: '1' }, [text('x')]), el('div', { a: '2' }, [text('y')]));
    expect(patches.map((p) => p.type)).toEqual(['UPDATE_ATTRS', 'SET_DATA']);
  });

  it('첫 번째 자식의 서브트리 patch가 두 번째 자식 patch보다 먼저 나온다 (DFS)', () => {
    const oldTree = el('div', {}, [el('a', {}, [text('1')]), el('b', {}, [text('2')])]);
    const newTree = el('div', {}, [el('a', {}, [text('X')]), el('b', {}, [text('Y')])]);
    expect(diff(oldTree, newTree).map((p) => p.path)).toEqual([
      [0, 0, 0],
      [0, 1, 0],
    ]);
  });

  it('공통 구간 patch → INSERT 순서', () => {
    const patches = diff(
      el('ul', {}, [text('a')]),
      el('ul', {}, [text('b'), text('c'), text('d')]),
    );
    expect(patches.map((p) => p.type)).toEqual(['SET_DATA', 'INSERT', 'INSERT']);
  });

  it('공통 구간 patch → REMOVE 순서', () => {
    const patches = diff(
      el('ul', {}, [text('a'), text('b'), text('c')]),
      el('ul', {}, [text('z')]),
    );
    expect(patches.map((p) => p.type)).toEqual(['SET_DATA', 'REMOVE', 'REMOVE']);
  });

  it('한 부모 아래에서 INSERT와 REMOVE가 동시에 나오지 않는다', () => {
    for (const [o, n] of [
      [0, 3],
      [3, 0],
      [2, 5],
      [5, 2],
      [3, 3],
    ]) {
      const types = new Set(
        diff(el('ul', {}, items(o)), el('ul', {}, items(n))).map((p) => p.type),
      );
      expect(types.has('INSERT') && types.has('REMOVE')).toBe(false);
    }
  });

  it('여러 부모에서 나온 patch가 문서 순서(전위)로 정렬된다', () => {
    const oldTree = el('div', {}, [el('ul', {}, items(1)), el('ol', {}, items(3))]);
    const newTree = el('div', {}, [el('ul', {}, items(2)), el('ol', {}, items(1))]);
    const patches = diff(oldTree, newTree);
    expect(patches).toEqual([
      { type: 'INSERT', parentPath: [0, 0], index: 1, node: items(2)[1] },
      { type: 'REMOVE', path: [0, 1, 1] },
      { type: 'REMOVE', path: [0, 1, 2] },
    ]);
  });
});

/* ───────────────────────── 9. path 정확성 ───────────────────────── */

describe('diff - path 규칙', () => {
  it('루트 path는 항상 [0] 에서 시작한다', () => {
    expect(diff(text('a'), text('b'))[0].path).toEqual([0]);
    expect(diff(el('a'), el('b'))[0].path).toEqual([0]);
    expect(diff(el('a'), el('a', { x: '1' }))[0].path).toEqual([0]);
  });

  it('path 의 모든 원소는 0 이상의 정수다', () => {
    const oldTree = el('div', {}, [el('p', {}, [text('a')]), el('p', {}, [text('b')])]);
    const newTree = el('div', {}, [el('p', {}, [text('x')]), el('span', {}, [text('y')])]);
    for (const p of diff(oldTree, newTree)) {
      for (const i of p.path ?? p.parentPath) {
        expect(Number.isInteger(i) && i >= 0).toBe(true);
      }
    }
  });

  it('공백 텍스트 노드도 인덱스를 차지한다 (childNodes 1:1)', () => {
    const oldTree = el('ul', {}, [text('\n'), el('li', {}, [text('A')]), text('\n')]);
    const newTree = el('ul', {}, [text('\n'), el('li', {}, [text('B')]), text('\n')]);
    expect(diff(oldTree, newTree)).toEqual([{ type: 'SET_DATA', path: [0, 1, 0], value: 'B' }]);
  });

  it('patch끼리 path 배열 참조를 공유하지 않는다', () => {
    const patches = diff(el('div', { a: '1' }, [text('x')]), el('div', { a: '2' }, [text('y')]));
    patches[0].path.push(999);
    expect(patches[1].path).toEqual([0, 0]);
  });

  it('깊이 500의 변경도 정확한 path를 만든다 (스택 오버플로 없음)', () => {
    const build = (leaf) => {
      let node = text(leaf);
      for (let i = 0; i < 500; i++) node = el('div', {}, [node]);
      return node;
    };
    const [p] = diff(build('a'), build('b'));
    expect(p.type).toBe('SET_DATA');
    expect(p.path).toHaveLength(501);
    expect(p.path.every((i) => i === 0)).toBe(true);
  });
});

/* ───────────────────────── 10. 순수성 / 불변성 ───────────────────────── */

describe('diff - 순수 함수 계약', () => {
  it('깊게 얼린(frozen) 입력에도 에러 없이 동작한다 = 입력을 변경하지 않는다', () => {
    const oldTree = deepFreeze(el('div', { a: '1', b: '2' }, [text('x'), el('p', { c: '3' })]));
    const newTree = deepFreeze(el('div', { a: '9' }, [text('y'), el('p'), el('i')]));
    expect(() => diff(oldTree, newTree)).not.toThrow();
  });

  it('호출 전후로 입력 값이 deep equal 하다', () => {
    const oldTree = el('div', { a: '1' }, [text('x'), el('p')]);
    const newTree = el('section', { b: '2' }, [text('y')]);
    const snapshot = structuredClone([oldTree, newTree]);
    diff(oldTree, newTree);
    expect([oldTree, newTree]).toEqual(snapshot);
  });

  it('같은 입력이면 항상 같은 결과다 (결정성)', () => {
    const oldTree = el('ul', {}, items(3));
    const newTree = el('ul', { a: '1' }, items(5));
    expect(diff(oldTree, newTree)).toEqual(diff(oldTree, newTree));
  });

  it('호출 순서/횟수가 결과에 영향을 주지 않는다 (숨은 상태 없음)', () => {
    const a = [el('div'), el('span')];
    const first = diff(a[0], a[1]);
    diff(el('x'), el('y')); // 중간에 다른 호출
    expect(diff(a[0], a[1])).toEqual(first);
  });

  it('결과는 JSON 직렬화 가능한 순수 데이터다', () => {
    const patches = diff(
      el('div', { a: '1' }, [text('x')]),
      el('div', { b: '2' }, [text('y'), el('p')]),
    );
    expect(JSON.parse(JSON.stringify(patches))).toEqual(patches);
  });

  it('DOM 환경(document/window) 없이 동작한다 (node 환경에서 실행 중)', () => {
    expect(typeof document).toBe('undefined');
    expect(() => diff(el('a'), el('b'))).not.toThrow();
  });

  it('INSERT/REPLACE의 node는 new 트리 내용과 동일하다 (값 보존)', () => {
    const newChild = el('li', { x: '1' }, [text('t')]);
    const [p] = diff(el('ul'), el('ul', {}, [newChild]));
    expect(p.node).toEqual(newChild);
  });

  it('diff 결과를 변경해도 입력 트리의 attrs/children 에는 영향이 없다 (set/remove 는 새 객체)', () => {
    const oldTree = el('div', { a: '1' });
    const newTree = el('div', { a: '2' });
    const [p] = diff(oldTree, newTree);
    p.set.a = 'HACKED';
    p.remove.push('zzz');
    expect(newTree.attrs).toEqual({ a: '2' });
    expect(oldTree.attrs).toEqual({ a: '1' });
  });
});

/* ───────────────────────── 11. 예외 / 방어 ───────────────────────── */

describe('diff - 예외 입력 (현재 명세: 루트는 항상 존재)', () => {
  it('old 가 null/undefined 이면 TypeError', () => {
    expect(() => diff(null, el('div'))).toThrow(TypeError);
    expect(() => diff(undefined, el('div'))).toThrow(TypeError);
  });

  it('new 가 null/undefined 이면 TypeError', () => {
    expect(() => diff(el('div'), null)).toThrow(TypeError);
    expect(() => diff(el('div'), undefined)).toThrow(TypeError);
  });

  it('인자를 하나도 안 넘기면 TypeError', () => {
    expect(() => diff()).toThrow(TypeError);
  });

  it('에러가 나도 부분 결과가 외부로 새지 않는다 (예외 = 반환값 없음)', () => {
    let result;
    try {
      result = diff(null, el('div'));
    } catch {
      /* noop */
    }
    expect(result).toBeUndefined();
  });
});

/* ───────────────────────── 12. 규모 / 성능 가드 ───────────────────────── */

describe('diff - 규모', () => {
  it('똑같은 10000개 자식 트리는 patch 0개', () => {
    expect(diff(el('ul', {}, items(10_000)), el('ul', {}, items(10_000)))).toEqual([]);
  });

  it('0개 → 10000개: INSERT 10000개, index 가 0..9999 순서', () => {
    const patches = diff(el('ul'), el('ul', {}, items(10_000)));
    expect(patches).toHaveLength(10_000);
    expect(patches[0].index).toBe(0);
    expect(patches[9999].index).toBe(9999);
  });

  it('10000개 중 딱 하나만 바뀌면 patch 는 정확히 1개 (최소 변경)', () => {
    const before = items(10_000);
    const after = items(10_000);
    after[5000] = el('li', {}, [text('CHANGED')]);
    const patches = diff(el('ul', {}, before), el('ul', {}, after));
    expect(patches).toEqual([{ type: 'SET_DATA', path: [0, 5000, 0], value: 'CHANGED' }]);
  });

  it('노드 수에 선형으로 동작한다 (노드 10만 개를 1초 안에)', () => {
    const big = () =>
      el(
        'div',
        {},
        Array.from({ length: 1000 }, () => el('ul', {}, items(100))),
      );
    const a = big();
    const b = big();
    const start = performance.now();
    const patches = diff(a, b);
    const elapsed = performance.now() - start;
    expect(patches).toEqual([]);
    expect(elapsed).toBeLessThan(1000);
  });
});

/* ───────────────────────── 13. 5가지 케이스 한눈에 (명세 회귀) ───────────────────────── */

describe('diff - 5가지 핵심 케이스 대표 시나리오', () => {
  const cases = [
    ['1. INSERT', el('p'), el('p', {}, [text('a')]), 'INSERT'],
    ['2. REMOVE', el('p', {}, [text('a')]), el('p'), 'REMOVE'],
    ['3. REPLACE', el('p'), el('h1'), 'REPLACE'],
    ['4. SET_DATA', text('a'), text('b'), 'SET_DATA'],
    ['5. UPDATE_ATTRS', el('p'), el('p', { id: 'x' }), 'UPDATE_ATTRS'],
  ];

  it.each(cases)('%s → patch 1개, 종류 %s', (_name, before, after, expected) => {
    const patches = diff(before, after);
    expect(patches).toHaveLength(1);
    expect(patches[0].type).toBe(expected);
  });
});
