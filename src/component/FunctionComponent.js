import { diff } from '../diff/index.js';
import { applyPatches, createNode } from '../patch/index.js';

// 훅은 인자로 컴포넌트를 받지 않으므로, 지금 렌더 중인 컴포넌트를 여기서 알려 준다
/** @type {FunctionComponent | null} */
let currentComponent = null;

/**
 * 지금 렌더 중인 컴포넌트를 돌려준다. 렌더 중이 아니면 null이다.
 * @returns {FunctionComponent | null}
 */
export function getCurrentComponent() {
  return currentComponent;
}

/**
 * 함수형 컴포넌트 하나와 그 컴포넌트의 상태를 담는 그릇이다.
 */
export class FunctionComponent {
  /**
   * @param {(props: object) => import('../vdom/types.js').VNode} fn
   * @param {object} [props]
   */
  constructor(fn, props = {}) {
    // 잘못된 값은 렌더 시점이 아니라 만드는 시점에 바로 드러나게 한다
    if (typeof fn !== 'function') {
      throw new TypeError('FunctionComponent의 첫 번째 인자는 함수여야 합니다.');
    }
    this.fn = fn;
    this.props = props;
    // 함수는 실행이 끝나면 지역 변수를 잃으므로, 훅의 값은 인스턴스가 대신 기억한다
    this.hooks = [];
    // 훅은 이름이 없어서 호출 순서로 자기 칸을 찾는다
    this.hookIndex = 0;
    // 렌더 예약이 겹치지 않게, 예약 중인지 표시한다
    this.updateScheduled = false;
  }

  /**
   * 컴포넌트 함수를 실행해 VNode를 만든다.
   * @returns {import('../vdom/types.js').VNode}
   */
  render() {
    // 훅은 매 렌더 같은 순서로 호출되므로, 첫 칸부터 다시 읽게 책갈피를 되돌린다
    this.hookIndex = 0;
    currentComponent = this;
    try {
      return this.fn(this.props);
    } finally {
      // fn이 에러를 던져도 렌더가 끝났다고 표시해야 렌더 밖 훅 호출을 막을 수 있다
      currentComponent = null;
    }
  }

  /**
   * container 안에 컴포넌트를 처음 그린다.
   * @param {Element} container
   */
  mount(container) {
    // update에서 같은 자리에 다시 그리고, 이전 VNode와 비교하려고 둘 다 기억한다
    this.container = container;
    this.vnode = this.render();
    // 실제 DOM 변경은 patch 모듈에만 둔다
    container.appendChild(createNode(this.vnode));
  }

  /**
   * 다시 렌더해서 이전 VNode와 비교하고, 바뀐 곳만 실제 DOM에 반영한다.
   */
  update() {
    const nextVNode = this.render();
    applyPatches(this.container, diff(this.vnode, nextVNode));
    // 다음 update는 지금 화면과 비교해야 하므로 기준을 바꿔 둔다
    this.vnode = nextVNode;
  }

  /**
   * 지금 실행 중인 코드가 끝난 뒤 update를 한 번만 하도록 예약한다.
   */
  scheduleUpdate() {
    // 이미 예약했다면 여러 번 바뀐 상태를 다음 렌더 한 번에 함께 반영한다
    if (this.updateScheduled) return;
    this.updateScheduled = true;
    queueMicrotask(() => {
      this.updateScheduled = false;
      this.update();
    });
  }
}
