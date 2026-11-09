import { describe, it, expect } from 'vitest';
import { domToVNode, diff, applyPatches } from '../src/index.js';
import { scenarios } from './fixtures/scenarios.js';

function containerOf(html) {
  const container = document.createElement('div');
  container.innerHTML = html;
  return container;
}

describe('공개 API 계약', () => {
  it.each(['domToVNode', 'diff', 'applyPatches'])(
    '%s를 src/index.js에서 공개한다',
    async (name) => {
      const api = await import('../src/index.js');
      expect(typeof api[name]).toBe('function');
    },
  );
});

// 인수 테스트: Phase 1 완료 기준이다. (docs/vnode-spec.md 6절)
// domToVNode · diff · applyPatches가 모두 구현되면 `.skip`을 지운다.
describe('인수 테스트: diff 후 patch하면 after와 같은 DOM이 된다', () => {
  it.each(scenarios)('$name', ({ before, after }) => {
    const container = containerOf(before);
    const oldVNode = domToVNode(container.childNodes[0]);
    const newVNode = domToVNode(containerOf(after).childNodes[0]);

    applyPatches(container, diff(oldVNode, newVNode));

    expect(container.innerHTML).toBe(after);
    expect(domToVNode(container.childNodes[0])).toEqual(newVNode);
  });

  it.each(scenarios)('$name: diff는 입력 VNode를 바꾸지 않는다', ({ before, after }) => {
    const oldVNode = domToVNode(containerOf(before).childNodes[0]);
    const newVNode = domToVNode(containerOf(after).childNodes[0]);
    const snapshot = structuredClone([oldVNode, newVNode]);

    diff(oldVNode, newVNode);

    expect([oldVNode, newVNode]).toEqual(snapshot);
  });
});
