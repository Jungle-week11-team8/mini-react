import { describe, it, expect } from 'vitest';
import { domToVNode, diff, applyPatches } from '../src/index.js';
import { createRandom, randomTree, mutateTree, renderForTest } from './fixtures/randomTree.js';

// 랜덤 트리 테스트: 시나리오 목록에 없는 조합에서 누락된 케이스를 찾는다.
// 실패하면 테스트 이름의 seed로 재현한다:  SEED=123 npm test -- random
// 재현한 케이스는 tests/fixtures/scenarios.js나 단위 테스트에 회귀 테스트로 옮긴다.
const RUNS = Number(process.env.RANDOM_RUNS ?? 200);
const seeds = process.env.SEED
  ? [Number(process.env.SEED)]
  : Array.from({ length: RUNS }, (_, i) => i + 1);

function mount(vnode) {
  const container = document.createElement('div');
  container.appendChild(renderForTest(vnode));
  return container;
}

// 실패했을 때 어떤 입력이었는지 바로 보이도록 메시지에 트리를 함께 남긴다
function expectPatchedToEqual(oldVNode, newVNode) {
  const container = mount(oldVNode);
  const patches = diff(oldVNode, newVNode);
  applyPatches(container, patches);

  const context = JSON.stringify({ oldVNode, newVNode, patches }, null, 2);
  // innerHTML이 아니라 VNode로 비교한다. 인접 텍스트 노드 개수 차이까지 잡기 위해서다.
  expect(container.childNodes.length, context).toBe(1);
  expect(domToVNode(container.childNodes[0]), context).toEqual(newVNode);
}

describe('랜덤 트리: diff 후 patch하면 new 트리와 같은 DOM이 된다', () => {
  it.each(seeds)('조금 바뀐 트리 (seed %i)', (seed) => {
    const random = createRandom(seed);
    const oldVNode = randomTree(random);
    expectPatchedToEqual(oldVNode, mutateTree(random, oldVNode));
  });

  it.each(seeds)('완전히 다른 트리 (seed %i)', (seed) => {
    const random = createRandom(seed);
    expectPatchedToEqual(randomTree(random), randomTree(random));
  });

  it.each(seeds)('diff는 입력 VNode를 바꾸지 않는다 (seed %i)', (seed) => {
    const random = createRandom(seed);
    const oldVNode = randomTree(random);
    const newVNode = mutateTree(random, oldVNode);
    const snapshot = structuredClone([oldVNode, newVNode]);

    diff(oldVNode, newVNode);

    expect([oldVNode, newVNode]).toEqual(snapshot);
  });
});
