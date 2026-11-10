import { createDom } from '../vdom/createDom.js';
import { diff } from '../diff/diff.js';
import { applyPatches } from '../patch/applyPatches.js';
import { setCurrentComponent } from '../hooks/current.js';

/**
 * 함수형 컴포넌트를 감싸서 상태(hooks)와 생명주기(mount, update)를 관리하는 클래스.
 *
 * 제약조건:
 * - 상태(State)와 Hook은 최상위(루트) 컴포넌트에서만 관리합니다.
 * - 자식 컴포넌트는 상태 없이 props만 받는 순수 함수입니다.
 */
export class FunctionComponent {
  /**
   * @param {(props: any) => import('../vdom/types.js').VNode} componentFn
   * @param {any} [props={}]
   * @param {Element} container - 루트 노드가 마운트될 부모 DOM 요소
   */

  // 인스턴스 초기화
  constructor(componentFn, props = {}, container) {
    if (typeof componentFn !== 'function') {
      throw new Error('FunctionComponent: componentFn은 함수여야 합니다.');
    }
    if (!container) {
      throw new Error('FunctionComponent: container DOM 요소가 필요합니다.');
    }

    this.componentFn = componentFn;
    this.props = props;
    this.container = container;

    this.hooks = []; // 함수가 다시 실행되어도 상태가 사라지지 않도록 하는 저장 공간
    this.hookIndex = 0; // 현재 어떤 Hook을 사용하고 있는지 구분하는 인덱스

    // 다음 화면과 비교할 수 있도록 이전 화면의 Virtual DOM을 기억 
    this.prevVdom = null;

    // useEffect에서 사용할 실행 대기 effect 큐
    this.pendingEffects = [];

    // 마운트 여부 플래그
    this.isMounted = false;
  }

  /**
   * 컴포넌트 함수를 실행하여 VNode 트리를 생성한다.
   * - 렌더 시작 시 hookIndex를 0으로 리셋한다.
   * - 렌더 동안만 currentComponent를 this로 설정하고,
   *   렌더 중 예외가 발생해도 finally에서 반드시 null로 해제한다.
   *
   * @returns {import('../vdom/types.js').VNode}
   */
  render() {
    this.hookIndex = 0;
    setCurrentComponent(this);
    try {
      return this.componentFn(this.props);
    } finally {
      setCurrentComponent(null);
    }
  }

  /**
   * 첫 번째 화면 렌더링을 수행한다.
   * 1. render(): 컴포넌트 함수를 실행해 초기 VNode를 얻는다.
   * 2. createDom(): VNode로부터 실제 DOM 노드를 생성한다.
   * 3. container.appendChild(): 실제 DOM에 삽입한다.
   * 4. prevVdom에 현재 VNode를 저장한다.
   * 5. 등록된 Effect들을 실행한다.
   */
  mount() {
    if (this.isMounted) {
      throw new Error('FunctionComponent: 이미 마운트된 컴포넌트입니다.');
    }

    const vnode = this.render();
    this.prevVdom = vnode;

    const dom = createDom(vnode);
    this.container.appendChild(dom);
    this.isMounted = true;

    this.flushEffects();
  }

  /**
   * 상태 변경 또는 props 변경 시 다시 렌더링한다.
   * 1. render(): 컴포넌트 함수를 다시 실행해 새 VNode를 얻는다.
   * 2. diff(): 이전 VNode(prevVdom)와 새 VNode를 비교해 patches를 생성한다.
   * 3. applyPatches(): 변경된 부분만 실제 DOM에 반영한다.
   * 4. prevVdom을 새 VNode로 교체한다 
   * 5. 등록된 Effect들을 실행한다.
   */
  update() {
    if (!this.isMounted) {
      throw new Error('FunctionComponent: 마운트되지 않은 컴포넌트는 update할 수 없습니다.');
    }

    const nextVdom = this.render();
    const patches = diff(this.prevVdom, nextVdom);

    applyPatches(this.container, patches);
    this.prevVdom = nextVdom;

    this.flushEffects();
  }

  /**
   * 렌더링 도중 useEffect로 예약된 부수 효과들을 실행한다. 
   */
  flushEffects() {
    if (this.pendingEffects.length === 0) return;

    const effects = this.pendingEffects;
    this.pendingEffects = [];

    for (const effectFn of effects) {
      effectFn();
    }
  }
}

