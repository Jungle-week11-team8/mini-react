import { diff } from '../diff/index.js';
import { applyPatches } from '../patch/index.js';

/** @typedef {Parameters<typeof diff>[0]} VNode */

/** @type {FunctionComponent | null} */
let currentComponent = null;

export function getCurrentComponent() {
  if (currentComponent === null) {
    throw new Error('Hook은 루트 컴포넌트의 렌더 중에만 호출할 수 있습니다.');
  }
  return currentComponent;
}

export class FunctionComponent {
  hooks = [];
  hookIndex = 0;

  #render;
  #container;
  #props;

  /** @type {VNode | null} */
  #vnode = null;

  /** @type {Array<() => void> | null} */
  #pendingEffects = null;
  #isFlushingEffects = false;
  #updateAfterEffects = false;

  /**
   * @param {(props: object) => VNode} render 루트 VNode 하나를 반환하는 함수
   * @param {Element} container 루트 VNode를 삽입할 빈 컨테이너
   * @param {object} props 렌더 함수에 전달할 값
   */
  constructor(render, container, props = {}) {
    this.#render = render;
    this.#container = container;
    this.#props = props;
  }

  mount() {
    // Phase 1의 경로는 컨테이너의 첫 번째 노드를 루트로 본다.
    if (this.#vnode !== null || this.#container.childNodes.length !== 0) {
      throw new Error('mount()는 빈 컨테이너에서 처음 한 번만 호출할 수 있습니다.');
    }

    const { vnode, effects } = this.#renderVNode();
    this.#commit(vnode, [{ type: 'INSERT', parentPath: [], index: 0, node: vnode }], effects);
    if (this.#updateAfterEffects) {
      this.update();
    }
  }

  /**
   * @param {number} slot 상태를 저장한 Hook의 인덱스
   * @param {unknown} nextValue 저장할 상태 값
   */
  setState(slot, nextValue) {
    // 렌더가 끝나기 전에 다시 렌더하거나 상태를 쓰면 진행 중인 계산과 어긋난다.
    if (currentComponent !== null) {
      throw new Error('렌더 중에는 상태를 변경할 수 없습니다.');
    }

    this.hooks[slot] = nextValue;
    this.update();
  }

  /** @param {() => void} effect DOM 반영 뒤 실행할 작업 */
  scheduleEffect(effect) {
    if (this.#pendingEffects === null) {
      throw new Error('Effect는 렌더 중에만 등록할 수 있습니다.');
    }
    this.#pendingEffects.push(effect);
  }

  update() {
    if (this.#vnode === null) {
      throw new Error('update() 전에 mount()를 호출해야 합니다.');
    }

    // 이전 렌더의 effect를 모두 실행한 뒤 다음 갱신을 시작한다.
    if (this.#isFlushingEffects) {
      this.#updateAfterEffects = true;
      return;
    }

    do {
      this.#updateAfterEffects = false;
      const { vnode, effects } = this.#renderVNode();
      this.#commit(vnode, diff(this.#vnode, vnode), effects);
    } while (this.#updateAfterEffects);
  }

  #commit(vnode, patches, effects) {
    applyPatches(this.#container, patches);
    this.#vnode = vnode;

    this.#isFlushingEffects = true;
    try {
      for (const effect of effects) {
        effect();
      }
    } finally {
      this.#isFlushingEffects = false;
    }
  }

  #renderVNode() {
    const previousComponent = currentComponent;
    const render = this.#render;
    const effects = [];
    currentComponent = this;
    this.#pendingEffects = effects;
    // 상태는 배열에 남기고, 같은 호출 순서로 다시 읽도록 인덱스만 초기화한다.
    this.hookIndex = 0;

    try {
      const vnode = render(this.#props);
      return { vnode, effects };
    } finally {
      // 렌더에서 오류가 나도 이후 Hook 호출에 이 인스턴스가 남지 않게 한다.
      this.#pendingEffects = null;
      currentComponent = previousComponent;
    }
  }
}
