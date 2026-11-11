// 외부에 공개하는 API만 re-export한다.
export { domToVNode, h } from './vdom/index.js';
export { diff } from './diff/index.js';
export { applyPatches } from './patch/index.js';
export { FunctionComponent } from './component/index.js';
export { useState, useEffect, useMemo, useRef, areDepsEqual, depsChanged } from './hooks/index.js';
