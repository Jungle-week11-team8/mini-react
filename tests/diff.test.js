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
});

// 자식 없는 element VNode를 만든다
function el(tag, attrs = {}) {
  return { type: 'element', tag, attrs, children: [] };
}
