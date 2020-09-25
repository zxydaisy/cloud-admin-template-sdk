import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import { AtomTemplate, resolverAst } from "./parseArrowFun";
import { ResolverType } from "../dsl-to-gql/interfaceStructure";
import { getSuccessResponse } from "../dsl-to-gql/config";
import _get = require("lodash.get");
import visit from "../define/visit";
import generator from "@babel/generator";

// 参数里面指向的属性节点
type ProperNodeAST = {
  name: string;
  resolverName: string;
  type: string;
  resolvers: any[];
};

function getResovlerUUId(object: any) {
  const resolvers = object.resolvers || [];
  const resolver =
    resolvers.find((o: any) => {
      return o.name === object.resolverName;
    }) || {};
  const resolverUUID = resolver.uuid;
  return resolverUUID;
}

function findResolver(object: any) {
  const resolvers = object.resolvers || [];
  const resolver =
    resolvers.find((o: any) => {
      return o.name === object.resolverName;
    }) || {};
  return resolver;
}

function getRealCode(keyUUID: string, ast: any) {
  // MemberExpression
  visit(
    ast,
    {
      MemberExpression: (node: any) => {
        if (node.object.resolvers) {
          // 找到完全匹配的 resolver 和标记的 uuid
          const resolver = findResolver(node.object);
          const uuid = resolver.uuid;
          if (uuid === keyUUID) {
            // 如果和当前的 uuid 完全匹配的话，名字更新为 o
            node.object.name = "o";
          } else {
            // 不匹配的更新为当前的标记数据，但是只更新有引用源的数据
            node.object.name = `args.${uuid}_Data`;
          }
        }
        console.info("after change ", node);
      },
    },
    {}
  );

  return generator(ast).code;
}

const assignTemplate = [
  `function arrayTemplate(args, fn) {
    return Object.values(args.uuidData).map(fn)
  }`,
  `function objectTemplate(args, fn){
    return fn(args.uuidData);
  }`,
];

function ArrayAssign(uuidData: string, conbineStr: string) {
  return `arrayTemplate({
    uuidData: ${uuidData}
  }, (o = {}, index) => {
    return ${conbineStr}
  })
  `;
}

function ObjectAssign(uuidData: string, combineStr: string) {
  return `objectTemplate({
    uuidData: ${uuidData}
  }, (o = {}) => {
    return ${combineStr}
  })
  `;
}

const callArrayTemplate = (
  leftUUID: string,
  params: any[],
  rightUUID: string,
  leftCode: string // 因为结构返回的是有结构的数据，但是实际使用的时候需要根据接口结构的 code 提取
) => {
  const result = `function arrayCall${leftUUID}() {
    const data = [];
    Object.values(args.${rightUUID}_Data).forEach(async (o) => {
      const tempData = await resolvers.Query.${leftUUID}(null, ${
    params.length > 0 ? params.join(",") : "{}"
  });
      const realCode = _get(tempData, "${leftCode}");
       // 多个参数的返回结果
      data.push(realCode);
    })
    return data;
  }
  args.${leftUUID}_Data = arrayCall${leftUUID}() || {};
  `;
  return result;
};

/**
 *  通过 code 解析出真实返回结构里面的对象类型
 */
function CheckResolverReturnType(resolver: any) {
  if (resolver.type === ResolverType.INTERFACE) {
    // 解析了 $ref 之后的结构是包含 schema 的类型信息的
    const converSchema: any =
      getSuccessResponse(resolver.interface.responses) || {};
    return _get(
      {
        data: converSchema,
      },
      `${resolver.code.split(".").join(".properties.")}.type`
    );
  } else {
    return resolver.expression.type;
  }
}

export function GenFullResolver(allEndpoints: any) {
  const allResolvers: {
    [fullResolverName: string]: string;
  } = {};

  Object.keys(allEndpoints).forEach((operationId: string) => {
    // 利用全量信息获得 resolver
    const endpoint: any = allEndpoints[operationId];
    const resolver = endpoint.resolver;

    function genSingleResolver(resolver: any) {
      const uuid = resolver.uuid;
      // 用于标记在单个 resolver 表达式中，某个接口是否已经发请求，并且求值
      const map: {
        [key: string]: any;
      } = {};

      // 分析返回表达式的类型
      function analysisExmpressForReturnData(expression: any) {
        const resultCode: any[] = [...assignTemplate];
        const parentType = expression.type;
        /**
         * 分析结构是数组还是对象，分别进行处理
         * 如果在解析的过程中发展复杂对象，进入对当前对象的进一步处理
         */
        function anlysisProperties(expression: any, parentType: any) {
          // 进入第二层分析的时候
          const { ast, properties, items, type } = expression;
          // 找到当前的数据源
          const parentResolver = findResolver(ast);

          function anlysisPropertiesTo(
            properties: any = [],
            parentType: string,
            parentResolver: any
          ) {
            const tempCode = ["{"];
            Object.keys(properties || []).forEach((properKey) => {
              const proper = properties[properKey];
              // 如果是个复杂的 proper
              if (proper.properties) {
                /**
                 * 结构继续进入复杂 proper 的分析
                 *
                 */
                tempCode.push(
                  `${properKey}: ${anlysisProperties(proper, parentType)},`
                );
              } else {
                console.info("proper", proper);
                // 如果式当前的，也就是 key 表示将的数据源结构
                const keyUUID = parentResolver.uuid;
                /**
                 *  proper 可能只是简单的表达式比如 Room.addressId
                 *  也可能式复杂的表达式，比如 'Employee.name + " " + Room.name'
                 *
                 *  因为如果是复杂的数据源，解析的时候需要根据请求源替换名字
                 */
                const code = getRealCode(keyUUID, proper.ast);
                tempCode.push(`${properKey}: ${code},`);
              }
            });
            tempCode.push("}");
            return tempCode.join("\n").toString();
          }

          const result = [];

          if (parentType === "array" && type === "object") {
            // 表达式匹配解析出来的是对象，但是父亲级别的是一个数组，其 `args.${getResovlerUUId(ast)}_Data` 的值其实是个数组，这个时候需要取匹配的值填充
            result.push(
              ObjectAssign(
                `args.${getResovlerUUId(ast)}_Data[index]`,
                anlysisPropertiesTo(properties, parentType, parentResolver)
              )
            );
          }

          if (parentType === "object" && type === "object") {
            // 如果是对象进入对象的赋值，并且赋值关系是从 properties 开始，通常当前原始的 ast 都标记了属于的来源
            result.push(
              ObjectAssign(
                `args.${getResovlerUUId(ast)}_Data`,
                anlysisPropertiesTo(properties, parentType, parentResolver)
              )
            );
          }

          if (type === "array") {
            // 如果数数组，进入数组的函数，并且复制关系是从 items 开始的
            result.push(
              ArrayAssign(
                `args.${getResovlerUUId(ast)}_Data`,
                anlysisPropertiesTo(
                  items.properties,
                  parentType,
                  parentResolver
                )
              )
            );
          }

          return result.join("\n").toString();
        }

        // 第一层表达 experssion 和当前对象的结构是一致的
        resultCode.push(`return ${anlysisProperties(expression, parentType)}`);

        return resultCode;
      }

      /**
       * 需要一个 source 队列维护解析顺序
       * 如果依赖请求都结构体已经存在，那么直接访问，否则进入访问队列，下次再访问
       */
      function VisitResource(resolver: any = {}) {
        const codeResult: any[] = [];
        let params: any[] = [];
        let rightResolverUUID = "";
        const sourceQueue = Object.values(resolver.source) || [];
        // expression 用来解析真实的返回结构
        while (sourceQueue.length) {
          const sourceItem: any = sourceQueue.shift();
          const { assignments } = sourceItem;
          let isVisitable = true;
          let arrayExpression = false;
          const uuid = getResovlerUUId(sourceItem);
          // 引用的请求源头解析出来 resolver 是包含 code 信息的
          const resolver = findResolver(sourceItem);
          /**
           * eg: data.Data
           *
           * 因为返回结构其实是包含解析结构里面默认的 data, 所以在这里去掉
           */
          const leftCode = resolver.code.replace(/^data\./, "");
          /**
           * 无论当前 source 结构是已经被定义，访问还是正常执行，但是依赖的参数如果没有已经被访问
           * 那么需要进入访问队列
           */
          if (Object.values(assignments || []).length > 0) {
            params = [];
            // 如果当前的数据源有参数
            assignments.some((assigntemp: any) => {
              const { right, left, ast, code } = assigntemp;
              if (right.includes("$params")) {
                /**
                 * 右侧参数需要通过 $params 替换求值
                 * stayRecord.id 先转化成下面的结构
                 */
                const leftName = ast.left.object.name;
                const resolverUUID = getResovlerUUId(ast.left.object);

                // 这里对 leftKey 的解析严格依赖当前的结构 uuid，因为下次也是会被当前的结构按照同样的方式去使用的
                const leftKey = left
                  .split(".")
                  .join("_")
                  .replace(new RegExp(`^${leftName}`), `args.${resolverUUID}`);
                codeResult.push(
                  `${leftKey} = ${right.replace("$params", "args")}`
                );

                // args 参数被用了
                map[leftKey] = true;
                params.push(leftKey);
              } else {
                /** 参数的 ast 结构，主要是为了解析出左侧的结构和右侧的结构
                 *  因为是参数，那么一定是分做和有的赋值结构，这个 ast 是否可能是 BinaryExpression
                 *  { type: 'AssignmentExpression',
                      left:
                      { type: 'MemberExpression',
                        object:
                          { type: 'Identifier',
                            name: 'Address',
                            resolverName: 'getAddress',
                            properties: [Object],
                            resolvers: [Array] },
                        property: { type: 'Identifier', name: 'id' } },
                      right:
                      { type: 'MemberExpression',
                        object:
                          { type: 'Identifier',
                            name: 'Room',
                            resolverName: 'getRoom',
                            properties: [Object],
                            resolvers: [Array] },
                        property: { type: 'Identifier', name: 'addressId' } },
                      operator: '=' }
                 */
                const resolverUUID = getResovlerUUId(ast.right.object);
                // 如果已经被求过值了，那么参数直接用，
                if (map[`${resolverUUID}_Data`]) {
                  /**
                   * 目前右侧是单个源，并且是 MemberExpression，所以可以找到匹配的名字
                   */
                  const rightName = ast.right.object.name;
                  // 检查这个右边的 resolver 的返回是否是数组
                  const rightResolverType = CheckResolverReturnType(
                    findResolver(ast.right.object)
                  );
                  const leftResolverType = CheckResolverReturnType(
                    findResolver(ast.left.object)
                  );

                  let paramName = "";
                  // 需要判断被赋值的参数, 目前测试，如果右侧返回的是 array，那么走遍历表达式的情况
                  if (rightResolverType === "array") {
                    // 因为参数如果是数组，要赋予值给左侧  string ，确实是需要循环处理的， 并且在循环处理的过程中还会用到这个结果数组
                    arrayExpression = true;
                    rightResolverUUID = resolverUUID;

                    paramName = right.replace(new RegExp(`^${rightName}`), `o`);
                  } else {
                    paramName = right.replace(
                      new RegExp(`^${rightName}`),
                      `(args.${resolverUUID}_Data || {})`
                    );
                  }
                  /**
                   * 因为 `${resolverUUID}_Data` 左侧的数据已经被求值过，所以直接根据右侧表达式取值
                   * right 表达式替换第一个标记实体，即 ast.right 里面定义指向的对象
                   */
                  params.push(paramName);
                } else {
                  // 如果一个 source 里面没有用到任何被求过值的参数，那么这个 source 被标记为当前不能访问，再次进入队列等待以后被求值
                  isVisitable = false;
                }
              }
            });
          }
          // 如果当前参数都已经被求过了，那么当前都就正常访问
          if (isVisitable) {
            map[`${uuid}_Data`] = true;

            if (arrayExpression) {
              // 如果是走数组表达式， 当前的标记对象也会被转化数组类型的结果
              codeResult.push(
                callArrayTemplate(uuid, params, rightResolverUUID, leftCode)
              );
            } else {
              /**
               * 这里的被赋值的结构，也是需要请求源的结构解析出来
               */
              codeResult.push(
                `args.${uuid}_Data = await resolvers.Query.${uuid}(null, ${
                  params.length > 0 ? params.join(",") : "{}"
                }) || {};
                 args.${uuid}_Data = _get(args.${uuid}_Data, "${leftCode}");
                `
              );
            }
          } else {
            /**
             * 当前算法时间复杂度依赖初始顺序
             */
            sourceQueue.push(sourceItem);
          }
        }
        return codeResult;
      }

      if (resolver.type === ResolverType.INTERFACE) {
        allResolvers[uuid] = AtomTemplate(resolver);
      } else {
        // 访问完全部的 source 以后，添加上表达式
        // 解析当前 resolve
        const codeResult = VisitResource(resolver);
        const returnStr = analysisExmpressForReturnData(resolver.expression)
          .join("\n")
          .toString();
        codeResult.push(returnStr);
        const wrapperStr = `async (parent, args = {}, context, info) => { ${codeResult
          .join("\n")
          .toString()} }`;

        allResolvers[uuid] = wrapperStr;
      }
    }

    genSingleResolver(resolver);
  });
  return allResolvers;
}

//  genResolver in the end
function PathNodeUpdate(
  allEndpoints: any,
  isMutation: boolean,
  fullResolverTemplateGroup: any
) {
  const properties: any[] = [];
  Object.keys(allEndpoints).forEach((operationId: string) => {
    if (!!allEndpoints[operationId].mutation === !!isMutation) {
      const operateAST: any = {
        type: "ObjectProperty",
        key: {
          type: "Identifier",
          name: operationId,
        },
        value: resolverAst(fullResolverTemplateGroup[operationId]),
      };

      properties.push(operateAST);
    }
  });

  return properties;
}

// 输出为 js，所以还需要保留 js 的写法
const RootTemplete = `
import requester from './requester';
import _get from "lodash.get";

export const resolvers = {
  Query: {}
}
`;

/**
 *
 * export const resolvers = {
 *   Query: {
 *     [EntityName/SturctureName]: func
 *   }
 * }
 *
 */
export const ResolverAST = async (
  allEndpoints: any,
  fullResolverTemplateGroup: any
) => {
  // output resolver
  const ast = parser.parse(RootTemplete, {
    sourceType: "module",
  });

  traverse(ast, {
    ObjectProperty: {
      enter: (path) => {
        if (
          path.node.key.type === "Identifier" &&
          path.node.key.name === "Query"
        ) {
          if (path.node.value.type === "ObjectExpression") {
            const result = PathNodeUpdate(
              allEndpoints,
              false,
              fullResolverTemplateGroup
            );
            // 普通赋值可能更新不成功
            result.forEach((proper) => {
              const pathNodeValue: any = path.node.value;
              pathNodeValue.properties.push(proper);
            });
          }
        }

        if (
          path.node.key.type === "Identifier" &&
          path.node.key.name === "Mutation"
        ) {
          if (path.node.value.type === "ObjectExpression") {
            const result = PathNodeUpdate(
              allEndpoints,
              true,
              fullResolverTemplateGroup
            );
            result.forEach((proper) => {
              const pathNodeValue: any = path.node.value;
              pathNodeValue.properties.push(proper);
            });
          }
        }
      },
    },
  });

  return ast;
};
