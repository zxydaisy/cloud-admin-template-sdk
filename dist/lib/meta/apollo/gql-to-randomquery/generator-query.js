"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRandomQuery = exports.generateRandomMutation = void 0;
const graphql_1 = require("graphql");
const provide_variables_1 = require("./provide-variables");
const tools_1 = require("./tools");
const DEFAULT_CONFIG = {
    depthProbability: 1,
    breadthProbability: 1,
    maxDepth: 5,
    ignoreOptionalArguments: false,
    argumentsToIgnore: [],
    argumentsToConsider: [],
    considerInterfaces: false,
    considerUnions: false,
    pickNestedQueryField: false,
    providePlaceholders: false,
    providerMap: {}
};
function considerArgument(arg, config) {
    const isArgumentToIgnore = config.argumentsToIgnore.includes(arg.name.value);
    const isArgumentToConsider = config.argumentsToConsider.includes(arg.name.value);
    const isMand = tools_1.isMandatoryType(arg.type);
    const isOptional = !isMand;
    // Check for consistency
    if (isMand && isArgumentToIgnore) {
        throw new Error(`Cannot ignore non-null argument "${arg.name.value}"`);
    }
    if (isArgumentToIgnore && isArgumentToConsider) {
        throw new Error(`Cannot ignore AND consider argument "${arg.name.value}"`);
    }
    // Return value based on options
    if (isMand) {
        return true;
    }
    if (isArgumentToConsider) {
        return true;
    }
    if (isArgumentToIgnore) {
        return false;
    }
    if (isOptional && config.ignoreOptionalArguments) {
        return false;
    }
    return true;
}
function getVariableDefinition(name, type) {
    return {
        kind: graphql_1.Kind.VARIABLE_DEFINITION,
        type: type,
        variable: {
            kind: graphql_1.Kind.VARIABLE,
            name: tools_1.getName(name)
        }
    };
}
/**
 * Returns the first slicing argument defined in the field's @listSize
 * directive, if:
 *  - The @listSize directive is indeed present, and defines slicing arguments
 *  - The requiredArguments do not already include any of the defined slicing
 *    arguments
 *  - The @listSize diretcive doesn't also set requireOneSlicingArgument to
 *    false
 *
 * TODO: add link to specification / documentation of @listSize directive
 */
function getMissingSlicingArg(requiredArguments, field) {
    // Return null if there is no @listSize directive:
    const listSizeDirective = field.directives.find((dir) => dir.name.value === 'listSize');
    if (typeof listSizeDirective === 'undefined')
        return null;
    // Return null if @listSize directive defines no slicing arguments:
    const slicingArgumentsArg = listSizeDirective.arguments.find((arg) => arg.name.value === 'slicingArguments');
    if (typeof slicingArgumentsArg === 'undefined' ||
        slicingArgumentsArg.value.kind !== 'ListValue')
        return null;
    // Return null if requireOneSlicingArgument is set to false:
    const requireOneSlicingArg = listSizeDirective.arguments.find((arg) => arg.name.value === 'requireOneSlicingArgument');
    if (typeof requireOneSlicingArg !== 'undefined' &&
        requireOneSlicingArg.value.kind === 'BooleanValue' &&
        requireOneSlicingArg.value.value === false)
        return null;
    // Return null if a slicing argument is already used:
    const slicingArguments = slicingArgumentsArg.value.values
        .filter((value) => value.kind === 'StringValue')
        .map((value) => value.value);
    const usesSlicingArg = slicingArguments.some((slicingArg) => requiredArguments
        .map((existing) => existing.name.value)
        .includes(slicingArg));
    if (usesSlicingArg)
        return null;
    // Return the first slicing arguments:
    return field.arguments.find((arg) => slicingArguments.includes(arg.name.value));
}
function getArgsAndVars(field, nodeName, config, schema, providedValues) {
    const fieldName = field.name.value;
    const allArgs = field.arguments;
    const args = [];
    const variableDefinitionsMap = {};
    const requiredArguments = allArgs.filter((arg) => considerArgument(arg, config));
    // Check for slicing arguments defined in a @listSize directive that should
    // be present:
    const missingSlicingArg = getMissingSlicingArg(requiredArguments, field);
    if (missingSlicingArg)
        requiredArguments.push(missingSlicingArg);
    requiredArguments.forEach((arg) => {
        const varName = `${nodeName}__${fieldName}__${arg.name.value}`;
        args.push(tools_1.getVariable(arg.name.value, varName));
        variableDefinitionsMap[varName] = getVariableDefinition(varName, arg.type);
    });
    const variableValues = {};
    // First, check for providers based on type__field query
    // (Note: such a provider must return a value which is an object)
    const { providerFound, value } = provide_variables_1.getProviderValue(`${nodeName}__${fieldName}`, config, providedValues);
    if (providerFound && typeof value === 'object') {
        Object.entries(value).forEach(([argName, value]) => {
            const varName = `${nodeName}__${fieldName}__${argName}`;
            // Only consider required arguments (provider can provide more than necessary)
            if (Object.keys(variableDefinitionsMap).includes(varName)) {
                variableValues[varName] = value;
            }
        });
    }
    // Second, check for providers based on type__field__argument query
    // (Note: they overwrite possibly already provided values)
    requiredArguments.forEach((arg) => {
        const varName = `${nodeName}__${fieldName}__${arg.name.value}`;
        const argType = schema.getType(tools_1.getTypeName(arg.type));
        const { providerFound, value } = provide_variables_1.getProviderValue(varName, config, Object.assign(Object.assign({}, variableValues), providedValues), // pass already used variable values
        argType);
        if (providerFound) {
            variableValues[varName] = value;
        }
    });
    // Third, populate all so-far neglected require variables with defaults or null
    requiredArguments.forEach((arg) => {
        const varName = `${nodeName}__${fieldName}__${arg.name.value}`;
        const argType = schema.getType(tools_1.getTypeName(arg.type));
        if (typeof variableValues[varName] === 'undefined') {
            if (provide_variables_1.isEnumType(argType)) {
                variableValues[varName] = provide_variables_1.getRandomEnum(argType);
            }
            else if (config.providePlaceholders) {
                variableValues[varName] = provide_variables_1.getDefaultArgValue(arg.type);
            }
            else if (arg.type.kind === 'NonNullType') {
                throw new Error(`Missing provider for non-null variable "${varName}" of type "${graphql_1.print(arg.type)}". ` +
                    `Either add a provider (e.g., using a wildcard "*__*" or "*__*__*"), ` +
                    `or set providePlaceholders configuration option to true.`);
            }
            else {
                variableValues[varName] = null;
            }
        }
    });
    return {
        args,
        variableDefinitionsMap,
        variableValues
    };
}
function getSelectionSetAndVars(schema, node, config, depth = 0) {
    const selections = [];
    let variableDefinitionsMap = {};
    let variableValues = {};
    // Abort at leaf nodes:
    if (depth === config.maxDepth) {
        return {
            selectionSet: undefined,
            variableDefinitionsMap,
            variableValues
        };
    }
    if (node.kind === graphql_1.Kind.OBJECT_TYPE_DEFINITION) {
        const fields = tools_1.getRandomFields(node.fields, config, schema, depth);
        fields.forEach((field) => {
            // Recurse, if field has children:
            const nextNode = schema.getType(tools_1.getTypeName(field.type)).astNode;
            let selectionSet = undefined;
            if (typeof nextNode !== 'undefined') {
                const res = getSelectionSetAndVars(schema, nextNode, config, depth + 1);
                // Update counts and nodeFactor:
                config.resolveCount += config.nodeFactor;
                config.nodeFactor *= tools_1.getNextNodefactor(res.variableValues);
                config.typeCount += config.nodeFactor;
                selectionSet = res.selectionSet;
                variableDefinitionsMap = Object.assign(Object.assign({}, variableDefinitionsMap), res.variableDefinitionsMap);
                variableValues = Object.assign(Object.assign({}, variableValues), res.variableValues);
            }
            const avs = getArgsAndVars(field, node.name.value, config, schema, variableValues);
            variableDefinitionsMap = Object.assign(Object.assign({}, variableDefinitionsMap), avs.variableDefinitionsMap);
            variableValues = Object.assign(Object.assign({}, variableValues), avs.variableValues);
            selections.push({
                kind: graphql_1.Kind.FIELD,
                name: tools_1.getName(field.name.value),
                selectionSet,
                arguments: avs.args
            });
        });
    }
    else if (node.kind === graphql_1.Kind.INTERFACE_TYPE_DEFINITION) {
        const fields = tools_1.getRandomFields(node.fields, config, schema, depth);
        fields.forEach((field) => {
            // Recurse, if field has children:
            const nextNode = schema.getType(tools_1.getTypeName(field.type)).astNode;
            let selectionSet = undefined;
            if (typeof nextNode !== 'undefined') {
                const res = getSelectionSetAndVars(schema, nextNode, config, depth + 1);
                // Update counts and nodeFactor:
                config.resolveCount += config.nodeFactor;
                config.nodeFactor *= tools_1.getNextNodefactor(res.variableValues);
                config.typeCount += config.nodeFactor;
                selectionSet = res.selectionSet;
                variableDefinitionsMap = Object.assign(Object.assign({}, variableDefinitionsMap), res.variableDefinitionsMap);
                variableValues = Object.assign(Object.assign({}, variableValues), res.variableValues);
            }
            const avs = getArgsAndVars(field, node.name.value, config, schema, variableValues);
            variableDefinitionsMap = Object.assign(Object.assign({}, variableDefinitionsMap), avs.variableDefinitionsMap);
            variableValues = Object.assign(Object.assign({}, variableValues), avs.variableValues);
            selections.push({
                kind: graphql_1.Kind.FIELD,
                name: tools_1.getName(field.name.value),
                selectionSet,
                arguments: avs.args
            });
        });
        // Get all objects that implement an interface
        const objectsImplementingInterface = Object.values(schema.getTypeMap()).filter((namedType) => {
            if (namedType.astNode &&
                namedType.astNode.kind === 'ObjectTypeDefinition') {
                const interfaceNames = namedType.astNode.interfaces.map((interfaceNamedType) => {
                    return interfaceNamedType.name.value;
                });
                if (interfaceNames.includes(node.name.value)) {
                    return true;
                }
            }
            return false;
        });
        // Randomly select named types from the union
        const pickObjectsImplementingInterface = objectsImplementingInterface.filter(() => {
            if (typeof config.breadthProbability === 'number') {
                return tools_1.random(config) <= config.breadthProbability;
            }
            else {
                return tools_1.random(config) <= config.breadthProbability(depth);
            }
        });
        // If no named types are selected, select any one
        if (pickObjectsImplementingInterface.length === 0) {
            const forcedCleanIndex = Math.floor(tools_1.random(config) * objectsImplementingInterface.length);
            pickObjectsImplementingInterface.push(objectsImplementingInterface[forcedCleanIndex]);
        }
        pickObjectsImplementingInterface.forEach((namedType) => {
            if (namedType.astNode) {
                const type = namedType.astNode;
                // Unions can only contain objects
                if (type.kind === graphql_1.Kind.OBJECT_TYPE_DEFINITION) {
                    // Get selections
                    let selectionSet = undefined;
                    const res = getSelectionSetAndVars(schema, type, config, depth);
                    selectionSet = res.selectionSet;
                    variableDefinitionsMap = Object.assign(Object.assign({}, variableDefinitionsMap), res.variableDefinitionsMap);
                    variableValues = Object.assign(Object.assign({}, variableValues), res.variableValues);
                    const fragment = {
                        kind: graphql_1.Kind.INLINE_FRAGMENT,
                        typeCondition: {
                            kind: graphql_1.Kind.NAMED_TYPE,
                            name: {
                                kind: graphql_1.Kind.NAME,
                                value: type.name.value
                            }
                        },
                        selectionSet: selectionSet
                    };
                    selections.push(fragment);
                }
                else {
                    throw Error(`There should only be object types ` +
                        `in the selectionSet but found: ` +
                        `"${JSON.stringify(type, null, 2)}"`);
                }
            }
            else {
                selections.push({
                    kind: graphql_1.Kind.FIELD,
                    name: {
                        kind: graphql_1.Kind.NAME,
                        value: namedType.name
                    }
                });
            }
        });
    }
    else if (node.kind === graphql_1.Kind.UNION_TYPE_DEFINITION) {
        // Get the named types in the union
        const unionNamedTypes = node.types.map((namedTypeNode) => {
            return schema.getType(namedTypeNode.name.value);
        });
        // Randomly select named types from the union
        const pickUnionNamedTypes = unionNamedTypes.filter(() => {
            if (typeof config.breadthProbability === 'number') {
                return tools_1.random(config) <= config.breadthProbability;
            }
            else {
                return tools_1.random(config) <= config.breadthProbability(depth);
            }
        });
        // If no named types are selected, select any one
        if (pickUnionNamedTypes.length === 0) {
            const forcedCleanIndex = Math.floor(tools_1.random(config) * unionNamedTypes.length);
            pickUnionNamedTypes.push(unionNamedTypes[forcedCleanIndex]);
        }
        pickUnionNamedTypes.forEach((namedType) => {
            if (namedType.astNode) {
                const type = namedType.astNode;
                // Unions can only contain objects
                if (type.kind === graphql_1.Kind.OBJECT_TYPE_DEFINITION) {
                    // Get selections
                    let selectionSet = undefined;
                    const res = getSelectionSetAndVars(schema, type, config, depth);
                    selectionSet = res.selectionSet;
                    variableDefinitionsMap = Object.assign(Object.assign({}, variableDefinitionsMap), res.variableDefinitionsMap);
                    variableValues = Object.assign(Object.assign({}, variableValues), res.variableValues);
                    const fragment = {
                        kind: graphql_1.Kind.INLINE_FRAGMENT,
                        typeCondition: {
                            kind: graphql_1.Kind.NAMED_TYPE,
                            name: {
                                kind: graphql_1.Kind.NAME,
                                value: type.name.value
                            }
                        },
                        selectionSet: selectionSet
                    };
                    selections.push(fragment);
                }
                else {
                    throw Error(`There should only be object types ` +
                        `in the selectionSet but found: ` +
                        `"${JSON.stringify(type, null, 2)}"`);
                }
            }
            else {
                selections.push({
                    kind: graphql_1.Kind.FIELD,
                    name: {
                        kind: graphql_1.Kind.NAME,
                        value: namedType.name
                    }
                });
            }
        });
    }
    const aliasIndexes = {};
    const cleanselections = [];
    // Ensure unique field names/aliases
    selections.forEach((selectionNode) => {
        if (selectionNode.kind === graphql_1.Kind.FIELD) {
            const fieldName = selectionNode.name.value;
            if (fieldName in aliasIndexes) {
                cleanselections.push(Object.assign(Object.assign({}, selectionNode), {
                    alias: {
                        kind: graphql_1.Kind.NAME,
                        value: `${fieldName}${aliasIndexes[fieldName]++}`
                    }
                }));
            }
            else {
                aliasIndexes[fieldName] = 2;
                cleanselections.push(selectionNode);
            }
        }
        else if (selectionNode.kind === graphql_1.Kind.INLINE_FRAGMENT) {
            const cleanFragmentSelections = [];
            selectionNode.selectionSet.selections.forEach((fragmentSelectionNode) => {
                if (fragmentSelectionNode.kind === graphql_1.Kind.FIELD) {
                    const fieldName = fragmentSelectionNode.name.value;
                    if (fieldName in aliasIndexes) {
                        cleanFragmentSelections.push(Object.assign(Object.assign({}, fragmentSelectionNode), {
                            alias: {
                                kind: graphql_1.Kind.NAME,
                                value: `${fieldName}${aliasIndexes[fieldName]++}`
                            }
                        }));
                    }
                    else {
                        aliasIndexes[fieldName] = 2;
                        cleanFragmentSelections.push(fragmentSelectionNode);
                    }
                }
            });
            selectionNode.selectionSet.selections = cleanFragmentSelections;
            cleanselections.push(selectionNode);
        }
        else {
            throw Error(`There should not be any fragment spreads in the selectionNode "${JSON.stringify(selectionNode, null, 2)}"`);
        }
    });
    return {
        selectionSet: cleanselections.length > 0
            ? {
                kind: graphql_1.Kind.SELECTION_SET,
                selections: cleanselections
            }
            : undefined,
        variableDefinitionsMap,
        variableValues
    };
}
function getDocumentDefinition(definitions) {
    return {
        kind: graphql_1.Kind.DOCUMENT,
        definitions,
        loc: tools_1.loc
    };
}
function getQueryOperationDefinition(schema, config) {
    const node = schema.getQueryType().astNode;
    const { selectionSet, variableDefinitionsMap, variableValues } = getSelectionSetAndVars(schema, node, config);
    // Throw error if query would be empty
    if (selectionSet.selections.length === 0) {
        throw new Error(`Could not create query - no selection was possible at the root level`);
    }
    return {
        queryDocument: {
            kind: graphql_1.Kind.OPERATION_DEFINITION,
            operation: 'query',
            selectionSet,
            variableDefinitions: Object.values(variableDefinitionsMap),
            loc: tools_1.loc,
            name: tools_1.getName('RandomQuery')
        },
        variableValues
    };
}
function getMutationOperationDefinition(schema, config) {
    const node = schema.getMutationType().astNode;
    const { selectionSet, variableDefinitionsMap, variableValues } = getSelectionSetAndVars(schema, node, config);
    // Throw error if mutation would be empty
    if (selectionSet.selections.length === 0) {
        throw new Error(`Could not create mutation - no selection was possible at the root level`);
    }
    return {
        mutationDocument: {
            kind: graphql_1.Kind.OPERATION_DEFINITION,
            operation: 'mutation',
            selectionSet,
            variableDefinitions: Object.values(variableDefinitionsMap),
            loc: tools_1.loc,
            name: tools_1.getName('RandomMutation')
        },
        variableValues
    };
}
function generateRandomMutation(schema, config = {}) {
    const finalConfig = Object.assign(Object.assign(Object.assign({}, DEFAULT_CONFIG), config), { seed: typeof config.seed !== 'undefined' ? config.seed : Math.random(), nodeFactor: 1, typeCount: 0, resolveCount: 0 });
    const { mutationDocument, variableValues } = getMutationOperationDefinition(schema, finalConfig);
    const definitions = [mutationDocument];
    return {
        mutationDocument: getDocumentDefinition(definitions),
        variableValues,
        seed: finalConfig.seed,
        typeCount: finalConfig.typeCount,
        resolveCount: finalConfig.resolveCount
    };
}
exports.generateRandomMutation = generateRandomMutation;
function generateRandomQuery(schema, config = {}) {
    const finalConfig = Object.assign(Object.assign(Object.assign({}, DEFAULT_CONFIG), config), { seed: typeof config.seed !== 'undefined' ? config.seed : Math.random(), nodeFactor: 1, typeCount: 0, resolveCount: 0 });
    const { queryDocument, variableValues } = getQueryOperationDefinition(schema, finalConfig);
    const definitions = [queryDocument];
    return {
        queryDocument: getDocumentDefinition(definitions),
        variableValues,
        seed: finalConfig.seed,
        typeCount: finalConfig.typeCount,
        resolveCount: finalConfig.resolveCount
    };
}
exports.generateRandomQuery = generateRandomQuery;