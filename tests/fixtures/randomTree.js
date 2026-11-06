// 랜덤 트리 테스트용 VNode 생성기다. 테스트 전용이며 src/를 import하지 않는다.
// 같은 seed는 항상 같은 트리를 만든다. 실패한 seed로 그대로 재현할 수 있다.

// 값의 종류를 일부러 적게 둔다. 그래야 "같은 태그·같은 텍스트" 조합이 자주 나와서
// REPLACE만이 아니라 SET_DATA, UPDATE_ATTRS, 자식 비교 경로까지 골고루 지나간다.
const TAGS = ['div', 'p', 'span', 'ul', 'li'];
const ATTR_NAMES = ['id', 'class', 'title', 'data-x'];
const ATTR_VALUES = ['a', 'b', ''];
const TEXTS = ['a', 'b', 'hello', ' ', '\n  ', ''];
const MAX_DEPTH = 3;
const MAX_CHILDREN = 4;

/** mulberry32: 의존성 없이 쓸 수 있는 작은 seed 기반 난수 생성기 */
export function createRandom(seed) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (max) => Math.floor(next() * max),
    pick: (list) => list[Math.floor(next() * list.length)],
    chance: (p) => next() < p,
  };
}

function randomAttrs(random) {
  const attrs = {};
  for (const name of ATTR_NAMES) {
    if (random.chance(0.3)) attrs[name] = random.pick(ATTR_VALUES);
  }
  return attrs;
}

function randomLeaf(random) {
  return random.chance(0.85)
    ? { type: 'text', text: random.pick(TEXTS) }
    : { type: 'comment', text: random.pick(TEXTS) };
}

function randomNode(random, depth) {
  if (depth >= MAX_DEPTH || random.chance(0.35)) return randomLeaf(random);
  return randomElement(random, depth);
}

function randomElement(random, depth) {
  const children = [];
  const count = random.int(MAX_CHILDREN + 1);
  for (let i = 0; i < count; i += 1) children.push(randomNode(random, depth + 1));
  return { type: 'element', tag: random.pick(TAGS), attrs: randomAttrs(random), children };
}

/** 루트는 항상 element다. */
export function randomTree(random) {
  return randomElement(random, 0);
}

function mutateNode(random, node, depth) {
  // 낮은 확률로 노드를 통째로 바꾼다 (REPLACE 경로)
  if (random.chance(0.1)) return randomNode(random, depth);
  if (node.type !== 'element') {
    return random.chance(0.4) ? { ...node, text: random.pick(TEXTS) } : node;
  }

  const tag = random.chance(0.1) ? random.pick(TAGS) : node.tag;
  const attrs = random.chance(0.3) ? randomAttrs(random) : { ...node.attrs };
  let children = node.children.map((child) => mutateNode(random, child, depth + 1));

  // 앞 · 중간 · 뒤 어디서든 자식을 지우고 끼워 넣는다 (REMOVE · INSERT 경로)
  if (children.length > 0 && random.chance(0.3)) {
    children.splice(random.int(children.length), 1 + random.int(2));
  }
  if (depth < MAX_DEPTH && random.chance(0.3)) {
    const count = 1 + random.int(2);
    for (let i = 0; i < count; i += 1) {
      children.splice(random.int(children.length + 1), 0, randomNode(random, depth + 1));
    }
  }
  return { type: 'element', tag, attrs, children };
}

/** old 트리를 조금 바꾼 new 트리를 만든다. 실제 화면 변경과 비슷한 입력이다. */
export function mutateTree(random, tree) {
  const mutated = mutateNode(random, structuredClone(tree), 0);
  // 루트가 leaf로 바뀌면 루트는 element라는 전제가 깨지므로 다시 감싼다
  return mutated.type === 'element'
    ? mutated
    : { type: 'element', tag: tree.tag, attrs: {}, children: [mutated] };
}

/**
 * VNode를 실제 DOM으로 만든다. 테스트에서 "처음부터 렌더한 결과"를 만들 때만 쓴다.
 * innerHTML을 거치지 않으므로 인접 텍스트 노드나 빈 텍스트 노드도 그대로 남는다.
 */
export function renderForTest(vnode) {
  if (vnode.type === 'text') return document.createTextNode(vnode.text);
  if (vnode.type === 'comment') return document.createComment(vnode.text);
  const el = document.createElement(vnode.tag);
  for (const [name, value] of Object.entries(vnode.attrs)) el.setAttribute(name, value);
  for (const child of vnode.children) el.appendChild(renderForTest(child));
  return el;
}
