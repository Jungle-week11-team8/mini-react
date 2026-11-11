import { diff } from '../diff/index.js';
import { applyPatches } from '../patch/index.js';

// 훅은 인자로 컴포넌트를 받지 않으므로, 지금 렌더 중인 컴포넌트를 여기서 알려 준다
// 훅이 어느 컴포넌트의 상태를 읽고 써야 하는지, 렌더러가 미리 표시해 둔다_
/** @type {FunctionComponent | null} */
let currentComponent = null;

// effect 안 setState가 끝없이 렌더를 부르는 실수를 에러로 드러내기 위한 상한
// 최대 50번 렌더를 부를 수 있음. 상한을 안 두면 어떤 문제가 발생하지?
// => 상한이 없으면 effect가 자기 자신을 다시 실행시키는 렌더를 계속 예약해서 탭이 멈춘 것처럼 보일 수 있음
const MAX_EFFECT_RENDERS = 50;

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
    this.isMounted = false;
    this.fn = fn;
    this.props = props;
    // 함수는 실행이 끝나면 지역 변수를 잃으므로, 훅의 값은 인스턴스가 대신 기억한다
    this.hooks = [];
    // 훅은 이름이 없어서 호출 순서로 자기 칸을 찾는다
    this.hookIndex = 0;
    // 렌더 예약이 겹치지 않게, 예약 중인지 표시한다
    this.updateScheduled = false;
    // effect는 DOM 반영 뒤에 실행해야 하므로, 렌더 중에는 모아 두기만 한다
    this.pendingEffects = [];
    // effect 실행 중에 예약된 렌더인지 알아야 연속 횟수를 셀 수 있다
    this.isRunningEffects = false;
    this.effectRenderCount = 0;
  }

  // 화면에 무엇을 그릴지 계산
  /**
   * 컴포넌트 함수를 실행해 VNode를 만든다.
   * @returns {import('../vdom/types.js').VNode}
   */
  render() {
    // 훅은 매 렌더 같은 순서로 호출되므로, 첫 칸부터 다시 읽게 책갈피를 되돌린다
    this.hookIndex = 0;
    this.pendingEffects = [];
    const previousComponent = currentComponent;
    currentComponent = this;
    try {
      return this.fn(this.props);
    } finally {
      // fn이 에러를 던져도 렌더가 끝났다고 표시해야 렌더 밖 훅 호출을 막을 수 있다
      currentComponent = previousComponent;
    }
  }

  /**
   * container 안에 컴포넌트를 처음 그린다.
   * @param {Element} container
   */
  mount(container) {
    if (this.isMounted || container.childNodes.length !== 0) {
      throw new Error('mount()는 빈 컨테이너에서 처음 한 번만 호출할 수 있습니다.');
    }
    const vnode = this.render();
    applyPatches(container, [{ type: 'INSERT', parentPath: [], index: 0, node: vnode }]);
    this.container = container;
    this.vnode = vnode;
    this.isMounted = true;
    this.runEffects();
  }

  /**
   * 다시 렌더해서 이전 VNode와 비교하고, 바뀐 곳만 실제 DOM에 반영한다.
   */
  update() {
    if (!this.isMounted) throw new Error('update() 전에 mount()를 호출해야 합니다.');
    // 실행 중인 effect의 cleanup과 의존성을 저장한 뒤 다음 렌더를 시작한다.
    if (this.isRunningEffects) {
      this.scheduleUpdate();
      return;
    }
    const nextVNode = this.render();
    applyPatches(this.container, diff(this.vnode, nextVNode));
    // 다음 update는 지금 화면과 비교해야 하므로 기준을 바꿔 둔다
    this.vnode = nextVNode;
    this.runEffects();
  }

  /**
   * 렌더 중에 모아 둔 effect를 호출 순서대로 실행한다.
   */
  runEffects() {
    const effects = this.pendingEffects;
    this.pendingEffects = [];
    this.isRunningEffects = true;
    try {
      for (const { hook, effect, deps } of effects) {
        // 새 effect가 이전 effect의 흔적 위에서 돌지 않도록 먼저 정리한다
        const previousCleanup = hook.cleanup;
        // 실패한 effect는 재시도하되, 이미 호출한 cleanup은 다시 실행하지 않는다.
        hook.cleanup = undefined;
        hook.deps = undefined;
        if (previousCleanup) previousCleanup();
        const cleanup = effect();
        hook.deps = deps;
        hook.cleanup = typeof cleanup === 'function' ? cleanup : undefined;
      }
    } finally {
      this.isRunningEffects = false;
    }
  }

  /**
   * 지금 실행 중인 코드가 끝난 뒤 update를 한 번만 하도록 예약한다.
   */
  scheduleUpdate() {
    // 이미 예약했다면 여러 번 바뀐 상태를 다음 렌더 한 번에 함께 반영한다
    if (this.updateScheduled) return;
    this.updateScheduled = true;
    const fromEffect = this.isRunningEffects;
    queueMicrotask(() => {
      this.updateScheduled = false;
      // effect가 부른 렌더만 이어서 세고, 사용자 동작 같은 다른 렌더가 오면 다시 0부터 센다
      this.effectRenderCount = fromEffect ? this.effectRenderCount + 1 : 0;
      if (this.effectRenderCount > MAX_EFFECT_RENDERS) {
        throw new Error(`effect 안의 setState로 렌더가 ${MAX_EFFECT_RENDERS}번 넘게 이어졌습니다.`);
      }
      this.update();
    });
  }
}
