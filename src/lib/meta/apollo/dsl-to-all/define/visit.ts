/**
 * 这里不使用 babel/traverse 转化的原因是，这里传入 ast 包含了请求源等结构信息
 *
 * 所以需要用一个简单版的访问器去更新节点信息
 */

function isNode(node: any) {
  if (node == null) {
    return false;
  }
  return typeof node === "object" && typeof node.type === "string";
}
class Visitor {
  __fallback: any;
  __childVisitorKeys: any;
  __visitor: any;

  constructor(visitor: any, options?: any) {
    options = options || {};

    this.__visitor = visitor || this;
    if (options.fallback === "iteration") {
      this.__fallback = Object.keys;
    } else if (typeof options.fallback === "function") {
      this.__fallback = options.fallback;
    }
  }

  visitChildren = (node: any) => {
    let i, iz, j, jz, child;

    if (node == null) {
      return;
    }

    const children = this.__fallback(node);

    for (i = 0, iz = children.length; i < iz; ++i) {
      child = node[children[i]];
      if (child) {
        if (Array.isArray(child)) {
          for (j = 0, jz = child.length; j < jz; ++j) {
            if (child[j]) {
              if (isNode(child[j])) {
                this.visit(child[j]);
              }
            }
          }
        } else if (isNode(child)) {
          this.visit(child);
        }
      }
    }
  };

  visit = (node: any) => {
    if (node == null) {
      return;
    }

    const type = node.type;
    if (this.__visitor[type]) {
      this.__visitor[type].call(this, node);
      return;
    }
    this.visitChildren(node);
  };
}

export default function visit(node: any, visitor: any, options: any) {
  const v = new Visitor(visitor, options);
  v.visit(node);
}
