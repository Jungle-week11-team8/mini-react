import { describe, it, expect } from 'vitest';
import { diff } from '../src/index.js';

const text = (t) => ({ type: 'text', text: t });
const comment = (t) => ({ type: 'comment', text: t });

describe('diff', () => {
  describe('1단계: 잎 노드 (text · comment)', () => {
    // 같은 트리 체크
    it('같으면 빈 배열', () => {
      expect(diff(text('A'), text('A'))).toEqual([]);
    });

    // text 변경 체크
    it('text 내용이 다르면 SET_DATA', () => {
      expect(diff(text('A'), text('B'))).toEqual([{ type: 'SET_DATA', path: [0], value: 'B' }]);
    });

    // comment 변경 체크
    it('comment 내용이 다르면 SET_DATA', () => {
      expect(diff(comment('A'), comment('B'))).toEqual([
        { type: 'SET_DATA', path: [0], value: 'B' },
      ]);
    });

    // 종류 변경 체크
    it('type이 다르면 REPLACE', () => {
      expect(diff(text('A'), comment('A'))).toEqual([
        { type: 'REPLACE', path: [0], node: comment('A') },
      ]);
    });

    // 입력 불변 체크
    it('입력 VNode를 바꾸지 않음', () => {
      const oldVNode = text('A');
      const newVNode = comment('B');
      const snapshot = structuredClone([oldVNode, newVNode]);
      diff(oldVNode, newVNode);
      expect([oldVNode, newVNode]).toEqual(snapshot);
    });
  });

  describe('2단계: element 자신 (tag · attrs)', () => {
    const attrsPatch = (set, remove) => [{ type: 'UPDATE_ATTRS', path: [0], set, remove }];

    // 같은 element 체크
    it('tag·attrs가 같으면 빈 배열', () => {
      expect(diff(el('p'), el('p'))).toEqual([]);
    });

    // tag 변경 체크
    it('tag가 다르면 REPLACE', () => {
      expect(diff(el('p'), el('ul'))).toEqual([{ type: 'REPLACE', path: [0], node: el('ul') }]);
    });

    // 속성 추가 체크
    it('new에만 있는 속성은 set', () => {
      expect(diff(el('p'), el('p', { id: 'a' }))).toEqual(attrsPatch({ id: 'a' }, []));
    });

    // 속성 수정 체크
    it('값이 바뀐 속성은 set', () => {
      expect(diff(el('p', { id: 'a' }), el('p', { id: 'b' }))).toEqual(attrsPatch({ id: 'b' }, []));
    });

    // 속성 삭제 체크
    it('old에만 있는 속성은 remove', () => {
      expect(diff(el('p', { id: 'a' }), el('p'))).toEqual(attrsPatch({}, ['id']));
    });

    // 추가·수정·삭제 동시 체크
    it('추가·수정·삭제를 patch 하나에 담음', () => {
      const oldVNode = el('p', { id: 'a', class: 'x' });
      const newVNode = el('p', { id: 'b', title: 't' });
      expect(diff(oldVNode, newVNode)).toEqual(attrsPatch({ id: 'b', title: 't' }, ['class']));
    });

    // 같은 속성 체크
    it('속성이 같으면 UPDATE_ATTRS 없음', () => {
      expect(diff(el('p', { id: 'a' }), el('p', { id: 'a' }))).toEqual([]);
    });
  });

  describe('3단계: 자식 비교 (children)', () => {
    const p = (...children) => el('p', {}, children);

    // 자식 재귀 체크
    it('자식 text가 다르면 SET_DATA, path [0, 0]', () => {
      expect(diff(p(text('A')), p(text('B')))).toEqual([
        { type: 'SET_DATA', path: [0, 0], value: 'B' },
      ]);
    });

    // path 깊이 체크
    it('손자가 다르면 path [0, 1, 0]', () => {
      const oldVNode = p(text('x'), el('b', {}, [text('A')]));
      const newVNode = p(text('x'), el('b', {}, [text('B')]));
      expect(diff(oldVNode, newVNode)).toEqual([{ type: 'SET_DATA', path: [0, 1, 0], value: 'B' }]);
    });

    // 자식 추가 체크
    it('new에만 있는 자식은 INSERT (index는 new 기준)', () => {
      expect(diff(p(text('A')), p(text('A'), text('B')))).toEqual([
        { type: 'INSERT', parentPath: [0], index: 1, node: text('B') },
      ]);
    });

    // 자식 삭제 체크
    it('old에만 있는 자식은 REMOVE', () => {
      expect(diff(p(text('A'), text('B')), p(text('A')))).toEqual([
        { type: 'REMOVE', path: [0, 1] },
      ]);
    });

    // 여러 개 추가·삭제 체크
    it('INSERT·REMOVE 여러 개는 인덱스 오름차순', () => {
      expect(diff(p(), p(text('A'), text('B')))).toEqual([
        { type: 'INSERT', parentPath: [0], index: 0, node: text('A') },
        { type: 'INSERT', parentPath: [0], index: 1, node: text('B') },
      ]);
      expect(diff(p(text('A'), text('B')), p())).toEqual([
        { type: 'REMOVE', path: [0, 0] },
        { type: 'REMOVE', path: [0, 1] },
      ]);
    });

    // 형제 path 분리 체크
    it('형제가 모두 바뀌면 path가 각각 [0, 0], [0, 1]', () => {
      expect(diff(p(text('A'), text('B')), p(text('X'), text('Y')))).toEqual([
        { type: 'SET_DATA', path: [0, 0], value: 'X' },
        { type: 'SET_DATA', path: [0, 1], value: 'Y' },
      ]);
    });

    // 전위 순회 순서 체크
    it('부모 UPDATE_ATTRS가 자식 patch보다 먼저', () => {
      const oldVNode = el('p', { id: 'a' }, [text('A')]);
      const newVNode = el('p', { id: 'b' }, [text('B')]);
      expect(diff(oldVNode, newVNode)).toEqual([
        { type: 'UPDATE_ATTRS', path: [0], set: { id: 'b' }, remove: [] },
        { type: 'SET_DATA', path: [0, 0], value: 'B' },
      ]);
    });

    // key 없는 비교 한계 체크
    it('[A, B, C] → [B, C, D]는 같은 인덱스끼리 비교해 SET_DATA 3개', () => {
      const oldVNode = p(text('A'), text('B'), text('C'));
      const newVNode = p(text('B'), text('C'), text('D'));
      expect(diff(oldVNode, newVNode)).toEqual([
        { type: 'SET_DATA', path: [0, 0], value: 'B' },
        { type: 'SET_DATA', path: [0, 1], value: 'C' },
        { type: 'SET_DATA', path: [0, 2], value: 'D' },
      ]);
    });
  });

  // 자식 내용을 old와 new에서 다르게 둔다. 안쪽까지 비교하는 잘못된 구현이면 patch가 더 나와 실패한다.
  describe('4단계: REPLACE · INSERT · REMOVE 하위 트리에는 patch 없음', () => {
    // REPLACE 하위 체크
    it('tag가 바뀐 노드 안쪽은 비교하지 않음', () => {
      const oldVNode = el('p', {}, [text('A')]);
      const newVNode = el('div', {}, [text('B')]);
      expect(diff(oldVNode, newVNode)).toEqual([{ type: 'REPLACE', path: [0], node: newVNode }]);
    });

    // INSERT 하위 체크
    it('새로 넣는 노드 안쪽은 patch로 쪼개지 않음', () => {
      const added = el('b', { id: 'x' }, [text('B')]);
      expect(diff(el('p'), el('p', {}, [added]))).toEqual([
        { type: 'INSERT', parentPath: [0], index: 0, node: added },
      ]);
    });

    // REMOVE 하위 체크
    it('지우는 노드 안쪽은 patch로 쪼개지 않음', () => {
      const removed = el('b', { id: 'x' }, [text('A')]);
      expect(diff(el('p', {}, [removed]), el('p'))).toEqual([{ type: 'REMOVE', path: [0, 0] }]);
    });
  });
});

// element VNode를 만든다. 자식을 주지 않으면 빈 배열이다.
function el(tag, attrs = {}, children = []) {
  return { type: 'element', tag, attrs, children };
}
