"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = require("lodash");
const assert_1 = __importDefault(require("assert"));
const Demand_1 = require("oak-domain/lib/types/Demand");
const CascadeStore_1 = require("oak-domain/lib/store/CascadeStore");
const OakError_1 = require("oak-domain/lib/OakError");
const RowStore_1 = require("oak-domain/lib/types/RowStore");
const Demand_2 = require("oak-domain/lib/types/Demand");
const relation_1 = require("oak-domain/lib/store/relation");
const Expression_1 = require("oak-domain/lib/types/Expression");
;
;
function obscurePass(row, attr, params) {
    return !!(params.obscure && row[attr] === undefined);
}
class TreeStore extends CascadeStore_1.CascadeStore {
    store;
    activeTxnDict;
    stat;
    supportMultipleCreate() {
        return false;
    }
    supportManyToOneJoin() {
        return false;
    }
    setInitialData(data) {
        for (const entity in data) {
            if (!this.store[entity]) {
                this.store[entity] = {};
            }
            for (const rowId in data[entity]) {
                (0, lodash_1.set)(this.store, `${entity}.${rowId}.$current`, data[entity][rowId]);
            }
        }
    }
    getCurrentData() {
        const result = {};
        for (const entity in this.store) {
            result[entity] = {};
            for (const rowId in this.store[entity]) {
                (0, lodash_1.set)(result, `${entity}.${rowId}`, this.store[entity][rowId]['$current']);
            }
        }
        return result;
    }
    constructor(storageSchema, initialData, stat) {
        super(storageSchema);
        this.store = {};
        if (initialData) {
            this.setInitialData(initialData);
        }
        this.activeTxnDict = {};
        this.stat = stat || {
            create: 0,
            update: 0,
            remove: 0,
            commit: 0,
        };
    }
    constructRow(node, context) {
        let data = (0, lodash_1.cloneDeep)(node.$current);
        if (context.getCurrentTxnId() && node.$txnId === context.getCurrentTxnId()) {
            if (!node.$next) {
                return null;
            }
            else {
                return (0, lodash_1.assign)({}, data, node.$next);
            }
        }
        return data;
    }
    translateLogicFilter(entity, filter, attr, context, params) {
        switch (attr) {
            case '$and': {
                const filters = filter[attr];
                const fns = filters.map(ele => this.translateFilter(entity, ele, context, params));
                return async (node, nodeDict, exprResolveFns) => {
                    for (const fn of fns) {
                        if (!await (await fn)(node, nodeDict, exprResolveFns)) {
                            return false;
                        }
                    }
                    return true;
                };
            }
            case '$or': {
                const filters = filter[attr];
                const fns = filters.map(ele => this.translateFilter(entity, ele, context, params));
                return async (node, nodeDict, exprResolveFns) => {
                    for (const fn of fns) {
                        if (await (await fn)(node, nodeDict, exprResolveFns)) {
                            return true;
                        }
                    }
                    return false;
                };
            }
            case '$not': {
                const filter2 = filter[attr];
                const fn = this.translateFilter(entity, filter2, context, params);
                return async (node, nodeDict, exprResolveFns) => {
                    if (await (await fn)(node, nodeDict, exprResolveFns)) {
                        return false;
                    }
                    return true;
                };
            }
            default: {
                (0, assert_1.default)(false, `${attr}算子暂不支持`);
            }
        }
    }
    /**
     * 对表达式中某个结点的翻译，有三种情况：
     * 1、结点是一个表达式，此时递归翻译其子结点
     * 2、结点是一个常量，直接返回
     * 3、结点引用了某个属性，此时返回一个函数（ExprNodeTranslator），该函数在实际执行时对某行进行处理，又可能有两种case：
     *   3.1、得到结果，此时返回结果的值（常量）
     *   3.2、还欠缺某些外部结点的值才能得到结果，此时返回一个函数（ExprLaterCheckFn），此函数可以在执行中获得更多结点之后再调用并得到结果的值
     * @param entity
     * @param expression
     * @param context
     * @returns
     */
    translateExpressionNode(entity, expression, context, params2) {
        if ((0, Expression_1.isExpression)(expression)) {
            const op = Object.keys(expression)[0];
            const params = expression[op];
            if ((0, Expression_1.opMultipleParams)(op)) {
                const paramsTranslated = params.map(ele => this.translateExpressionNode(entity, ele, context, params));
                return (row, nodeDict) => {
                    let later = false;
                    let results = paramsTranslated.map((ele) => {
                        if (typeof ele === 'function') {
                            const r = ele(row, nodeDict);
                            if (typeof r === 'function') {
                                later = true;
                            }
                            return r;
                        }
                        return ele;
                    });
                    if (!later) {
                        return (0, Expression_1.execOp)(op, results, params.obscure);
                    }
                    const laterCheckFn = (nodeDict2) => {
                        results = results.map((ele) => {
                            if (typeof ele === 'function') {
                                const r = ele(nodeDict2);
                                return r;
                            }
                            return ele;
                        });
                        if (results.find(ele => typeof ele === 'function')) {
                            return laterCheckFn;
                        }
                        return (0, Expression_1.execOp)(op, results, params2 && params2.obscure);
                    };
                    return laterCheckFn;
                };
            }
            else {
                const paramsTranslated = this.translateExpressionNode(entity, params, context, params);
                if (typeof paramsTranslated === 'function') {
                    return (row, nodeDict) => {
                        let result = paramsTranslated(row, nodeDict);
                        if (typeof result === 'function') {
                            const laterCheckFn = (nodeDict2) => {
                                result = result(nodeDict2);
                                if (typeof result === 'function') {
                                    return laterCheckFn;
                                }
                                return result;
                            };
                            return laterCheckFn;
                        }
                        return (0, Expression_1.execOp)(op, result, params.obscure);
                    };
                }
                else {
                    return () => {
                        return (0, Expression_1.execOp)(op, paramsTranslated, params.obscure);
                    };
                }
            }
        }
        else if ((0, Demand_2.isRefAttrNode)(expression)) {
            // 是RefAttr结点
            return (row, nodeDict) => {
                if (expression.hasOwnProperty('#attr')) {
                    // 说明是本结点的属性;
                    return row[expression['#attr']];
                }
                else {
                    (0, assert_1.default)(expression.hasOwnProperty('#refId'));
                    const { ['#refId']: refId, ['#refAttr']: refAttr } = expression;
                    if (nodeDict.hasOwnProperty(refId)) {
                        return nodeDict[refId][refAttr];
                    }
                    // 引用的结点还没有取到，此时需要在未来的某个时刻再检查
                    const laterCheckFn = (nodeDict2) => {
                        if (nodeDict2.hasOwnProperty(refId)) {
                            return nodeDict2[refId][refAttr];
                        }
                        return laterCheckFn;
                    };
                    return laterCheckFn;
                }
            };
        }
        else {
            // 是常量结点
            return expression;
        }
    }
    translateExpression(entity, expression, context, params) {
        const expr = this.translateExpressionNode(entity, expression, context, params);
        return async (row, nodeDict) => {
            if (typeof expr !== 'function') {
                return expr;
            }
            const result = expr(row, nodeDict);
            return result;
        };
    }
    translateFulltext(entity, filter, context, params) {
        // 全文索引查找
        const { [entity]: { indexes } } = this.storageSchema;
        const fulltextIndex = indexes.find(ele => ele.config && ele.config.type === 'fulltext');
        const { attributes } = fulltextIndex;
        const { $search } = filter;
        return async (node) => {
            const row = this.constructRow(node, context);
            for (const attr of attributes) {
                const { name } = attr;
                if (row && row[name] && (typeof row[name] === 'string' && row[name].contains($search) || obscurePass(row, name, params))) {
                    return true;
                }
            }
            return false;
        };
    }
    async translateAttribute(filter, attr, context, params) {
        // 如果是模糊查询且该属性为undefined，说明没取到，返回true
        function obscurePassLocal(row) {
            return obscurePass(row, attr, params);
        }
        if (typeof filter !== 'object') {
            return async (node) => {
                const row = this.constructRow(node, context);
                return row ? row[attr] === filter || obscurePassLocal(row) : false;
            };
        }
        const fns = [];
        for (const op in filter) {
            switch (op) {
                case '$gt': {
                    fns.push(async (row) => row && (row[attr] > filter[op]) || obscurePassLocal(row));
                    break;
                }
                case '$lt': {
                    fns.push(async (row) => row && (row[attr] < filter[op]) || obscurePassLocal(row));
                    break;
                }
                case '$gte': {
                    fns.push(async (row) => row && (row[attr] >= filter[op]) || obscurePassLocal(row));
                    break;
                }
                case '$lte': {
                    fns.push(async (row) => row && (row[attr] <= filter[op]) || obscurePassLocal(row));
                    break;
                }
                case '$eq': {
                    fns.push(async (row) => row && (row[attr] === filter[op]) || obscurePassLocal(row));
                    break;
                }
                case '$ne': {
                    fns.push(async (row) => row && (row[attr] !== filter[op]) || obscurePassLocal(row));
                    break;
                }
                case '$between': {
                    fns.push(async (row) => {
                        return row && (row[attr] >= filter[op][0] && row[attr] <= filter[op][1] || obscurePassLocal(row));
                    });
                    break;
                }
                case '$startsWith': {
                    fns.push(async (row) => {
                        return row && (row[attr]?.startsWith(filter[op]) || obscurePassLocal(row));
                    });
                    break;
                }
                case '$endsWith': {
                    fns.push(async (row) => {
                        return row && (row[attr]?.$endsWith(filter[op]) || obscurePassLocal(row));
                    });
                    break;
                }
                case '$includes': {
                    fns.push(async (row) => {
                        return row && (row[attr]?.includes(filter[op]) || obscurePassLocal(row));
                    });
                    break;
                }
                case '$exists': {
                    const exists = filter[op];
                    (0, assert_1.default)(typeof exists === 'boolean');
                    fns.push(async (row) => {
                        if (exists) {
                            return [null].includes(row[attr]) || obscurePassLocal(row);
                        }
                        else {
                            return ![null, undefined].includes(row[attr]) || obscurePassLocal(row);
                        }
                    });
                    break;
                }
                case '$in': {
                    const inData = filter[op];
                    (0, assert_1.default)(typeof inData === 'object');
                    if (inData instanceof Array) {
                        fns.push(async (row) => inData.includes(row[attr]) || obscurePassLocal(row));
                    }
                    else {
                        // 如果是obscure，则返回的集合中有没有都不能否决“可能有”，所以可以直接返回true
                        if (params.obscure) {
                            fns.push(async () => true);
                        }
                        else {
                            // 这里只有当子查询中的filter不包含引用外部的子查询时才可以提前计算，否则必须等到执行时再计算
                            try {
                                const legalSets = (await this.selectAbjointRow(inData.entity, inData, context, params)).map((ele) => {
                                    const { data } = inData;
                                    const key = Object.keys(data)[0];
                                    return ele[key];
                                });
                                fns.push(async (row) => legalSets.includes(row[attr]));
                            }
                            catch (err) {
                                if (err instanceof OakError_1.OakError && err.$$code === RowStore_1.RowStore.$$CODES.expressionUnresolved[0]) {
                                    fns.push(async (row, nodeDict) => {
                                        (0, lodash_1.assign)(params, {
                                            nodeDict,
                                        });
                                        const legalSets = (await this.selectAbjointRow(inData.entity, inData, context, params)).map((ele) => {
                                            const { data } = inData;
                                            const key = Object.keys(data)[0];
                                            return ele[key];
                                        });
                                        (0, lodash_1.unset)(params, 'nodeDict');
                                        return legalSets.includes(row[attr]);
                                    });
                                }
                                else {
                                    throw err;
                                }
                            }
                        }
                    }
                    break;
                }
                case '$nin': {
                    const inData = filter[op];
                    (0, assert_1.default)(typeof inData === 'object');
                    if (inData instanceof Array) {
                        fns.push(async (row) => !inData.includes(row[attr]) || obscurePassLocal(row));
                    }
                    else {
                        // obscure对nin没有影响，如果返回的子查询结果中包含此行就一定是false，否则一定为true（obscure只考虑数据不完整，不考虑不准确），但若相应属性为undefined则任然可以认为true
                        // 这里只有当子查询中的filter不包含引用外部的子查询时才可以提前计算，否则必须等到执行时再计算
                        try {
                            const legalSets = (await this.selectAbjointRow(inData.entity, inData, context, params)).map((ele) => {
                                const { data } = inData;
                                const key = Object.keys(data)[0];
                                return ele[key];
                            });
                            fns.push(async (row) => !legalSets.includes(row[attr]) || obscurePassLocal(row));
                        }
                        catch (err) {
                            if (err instanceof OakError_1.OakError && err.$$code === RowStore_1.RowStore.$$CODES.expressionUnresolved[0]) {
                                fns.push(async (row, nodeDict) => {
                                    (0, lodash_1.assign)(params, {
                                        nodeDict,
                                    });
                                    const legalSets = (await this.selectAbjointRow(inData.entity, inData, context, params)).map((ele) => {
                                        const { data } = inData;
                                        const key = Object.keys(data)[0];
                                        return ele[key];
                                    });
                                    (0, lodash_1.unset)(params, 'nodeDict');
                                    return !legalSets.includes(row[attr]) || obscurePassLocal(row);
                                });
                            }
                            else {
                                throw err;
                            }
                        }
                    }
                    break;
                }
                default:
                    break;
            }
        }
        return async (node, nodeDict, exprResolveFns) => {
            const row = this.constructRow(node, context);
            if (!row) {
                return false;
            }
            for (const fn of fns) {
                if (await fn(row, nodeDict, exprResolveFns) === false) {
                    return false;
                }
            }
            return true;
        };
    }
    async translateFilter(entity, filter, context, params) {
        const fns = [];
        let nodeId;
        for (const attr in filter) {
            if (attr === '#id') {
                nodeId = filter['#id'];
            }
            else if (['$and', '$or', '$xor', '$not'].includes(attr)) {
                fns.push(this.translateLogicFilter(entity, filter, attr, context, params));
            }
            else if (attr.toLowerCase().startsWith(Demand_1.EXPRESSION_PREFIX)) {
                const fn = this.translateExpression(entity, filter[attr], context, params);
                fns.push(async (node, nodeDict, exprResolveFns) => {
                    const row = this.constructRow(node, context);
                    if (!row) {
                        return false;
                    }
                    const result = await fn(row, nodeDict);
                    if (typeof result === 'function') {
                        exprResolveFns.push(result);
                    }
                    return !!result;
                });
            }
            else if (attr.toLowerCase() === '$text') {
                fns.push(this.translateFulltext(entity, filter[attr], context, params));
            }
            else {
                // 属性级过滤
                const relation = (0, relation_1.judgeRelation)(this.storageSchema, entity, attr);
                if (relation === 1) {
                    // 行本身的属性
                    fns.push(await this.translateAttribute(filter[attr], attr, context, params));
                }
                else if (relation === 2) {
                    // 基于entity/entityId的指针
                    const fn = await this.translateFilter(attr, filter[attr], context, params);
                    fns.push(async (node, nodeDict, exprResolveFns) => {
                        const row = this.constructRow(node, context);
                        if (obscurePass(row, 'entity', params) || obscurePass(row, 'entityId', params)) {
                            return true;
                        }
                        if (row.entity !== attr || row.entityId) {
                            return false;
                        }
                        const node2 = (0, lodash_1.get)(this.store, `${attr}.${row.entityId}`);
                        if (!node2) {
                            if (params.obscure) {
                                return true;
                            }
                            return false;
                        }
                        return fn(node2, nodeDict, exprResolveFns);
                    });
                }
                else {
                    (0, assert_1.default)(typeof relation === 'string');
                    // 只能是基于普通属性的外键
                    const fn = await this.translateFilter(relation, filter[attr], context, params);
                    fns.push(async (node, nodeDict, exprResolveFns) => {
                        const row = this.constructRow(node, context);
                        if (obscurePass(row, `${attr}Id`, params)) {
                            return true;
                        }
                        if (row[`${attr}Id`]) {
                            const node2 = (0, lodash_1.get)(this.store, `${relation}.${row[`${attr}Id`]}`);
                            if (!node2) {
                                if (params.obscure) {
                                    return true;
                                }
                                return false;
                            }
                            return fn(node2, nodeDict, exprResolveFns);
                        }
                        return false;
                    });
                }
            }
        }
        return async (node, nodeDict, exprResolveFns) => {
            if (nodeId) {
                (0, assert_1.default)(!nodeDict.hasOwnProperty(nodeId), new OakError_1.OakError(RowStore_1.RowStore.$$LEVEL, RowStore_1.RowStore.$$CODES.nodeIdRepeated, `Filter中的nodeId「${nodeId}」出现了多次`));
                (0, lodash_1.assign)(nodeDict, {
                    [nodeId]: this.constructRow(node, context),
                });
            }
            const row = this.constructRow(node, context);
            if (!row) {
                return false;
            }
            for (const fn of fns) {
                if (!await fn(node, nodeDict, exprResolveFns)) {
                    return false;
                }
            }
            return true;
        };
    }
    translateSorter(entity, sorter, context, params) {
        const compare = (row1, row2, entity2, sortAttr, direction) => {
            const row11 = row1;
            const row22 = row2;
            (0, assert_1.default)(Object.keys(sortAttr).length === 1);
            const attr = Object.keys(sortAttr)[0];
            const relation = (0, relation_1.judgeRelation)(this.storageSchema, entity2, attr);
            if (relation === 1 || relation === 0) {
                const getAttrOrExprValue = (r) => {
                    if (sortAttr[attr] === 1) {
                        return r[attr];
                    }
                    else {
                        // 改变策略，让所有需要获得的值在projection上取得
                        (0, assert_1.default)(typeof sortAttr[attr] === 'string' && sortAttr[attr].startsWith('$expr'));
                        return r[sortAttr[attr]];
                    }
                };
                const v1 = row1 && getAttrOrExprValue(row11);
                const v2 = row2 && getAttrOrExprValue(row22);
                if ([null, undefined].includes(v1) || [null, undefined].includes(v2)) {
                    if ([null, undefined].includes(v1) && [null, undefined].includes(v2)) {
                        return 0;
                    }
                    if ([null, undefined].includes(v1)) {
                        if (direction === 'asc') {
                            return -1;
                        }
                        return 1;
                    }
                    if (direction === 'desc') {
                        return 1;
                    }
                    return -1;
                }
                if (v1 > v2) {
                    if (direction === 'desc') {
                        return -1;
                    }
                    else {
                        return 1;
                    }
                }
                else if (v1 < v2) {
                    if (direction === 'desc') {
                        return 1;
                    }
                    else {
                        return -1;
                    }
                }
                else {
                    return 0;
                }
            }
            else {
                if (relation === 2) {
                    (0, assert_1.default)(row11['entity'] === row22['entity']);
                    (0, assert_1.default)(row11.entity === attr);
                    const node1 = this.store[row11.entity] && this.store[row11.entity][row11.entityId];
                    const node2 = this.store[row22.entity] && this.store[row22.entity][row22.entityId];
                    const row111 = node1 && this.constructRow(node1, context);
                    const row222 = node2 && this.constructRow(node2, context);
                    return compare(row111, row222, row11['entity'], sortAttr[attr], direction);
                }
                else {
                    (0, assert_1.default)(typeof relation === 'string');
                    const node1 = this.store[relation] && this.store[relation][row11[`${attr}Id`]];
                    const node2 = this.store[relation] && this.store[relation][row22[`${attr}Id`]];
                    const row111 = node1 && this.constructRow(node1, context);
                    const row222 = node2 && this.constructRow(node2, context);
                    return compare(row111, row222, relation, sortAttr[attr], direction);
                }
            }
        };
        return (row1, row2) => {
            for (const sorterElement of sorter) {
                const { $attr, $direction } = sorterElement;
                const result = compare(row1, row2, entity, $attr, $direction);
                if (result !== 0) {
                    return result;
                }
            }
            return 0;
        };
    }
    /**
     * 将一次查询的结果集加入result
     * @param entity
     * @param rows
     * @param context
     */
    addToResultSelections(entity, rows, context) {
        const { opRecords } = context;
        let lastOperation = (0, lodash_1.last)(opRecords);
        if (lastOperation && lastOperation.a === 's') {
            const entityBranch = lastOperation.d[entity];
            if (entityBranch) {
                rows.forEach((row) => {
                    const { id } = row;
                    if (!entityBranch[id]) {
                        (0, lodash_1.assign)(entityBranch, {
                            [id]: (0, lodash_1.cloneDeep)(row),
                        });
                    }
                });
                return;
            }
        }
        else {
            lastOperation = {
                a: 's',
                d: {},
            };
            opRecords.push(lastOperation);
        }
        const entityBranch = {};
        rows.forEach((row) => {
            const { id } = row;
            (0, lodash_1.assign)(entityBranch, {
                [id]: (0, lodash_1.cloneDeep)(row),
            });
        });
        (0, lodash_1.assign)(lastOperation.d, {
            [entity]: entityBranch,
        });
    }
    async selectAbjointRow(entity, selection, context, params = {}) {
        const { filter } = selection;
        const { nodeDict } = params;
        const filterFn = filter && this.translateFilter(entity, filter, context, params);
        const entityNodes = this.store[entity] ? Object.values(this.store[entity]) : [];
        const nodes = [];
        for (const n of entityNodes) {
            const nodeDict2 = {};
            if (nodeDict) {
                (0, lodash_1.assign)(nodeDict2, nodeDict);
            }
            const exprResolveFns = [];
            if (!filterFn || await (await filterFn)(n, nodeDict2, exprResolveFns)) {
                // 如果有延时处理的expression，在这里加以判断，此时所有在filter中的node应该都已经加以遍历了
                let exprResult = true;
                if (exprResolveFns.length > 0) {
                    for (const fn of exprResolveFns) {
                        const result = fn(nodeDict2);
                        if (typeof result === 'function') {
                            throw new OakError_1.OakError(RowStore_1.RowStore.$$LEVEL, RowStore_1.RowStore.$$CODES.expressionUnresolved, `表达式计算失败，请检查Filter中的结点编号和引用是否一致`);
                        }
                        if (!!!result) {
                            exprResult = false;
                            break;
                        }
                    }
                }
                if (exprResult) {
                    nodes.push(n);
                }
            }
        }
        const rows = nodes.map((node) => this.constructRow(node, context));
        this.addToResultSelections(entity, rows, context);
        const rows2 = await this.formResult(entity, rows, selection, context, params);
        return rows2;
    }
    async updateAbjointRow(entity, operation, context, params) {
        const { data, action } = operation;
        const now = Date.now();
        switch (action) {
            case 'create': {
                const { id } = data;
                // const node = this.store[entity] && (this.store[entity]!)[id as string];
                // const row = node && this.constructRow(node, context) || {};
                /* if (row) {
                    throw new OakError(RowStore.$$LEVEL, RowStore.$$CODES.primaryKeyConfilict);
                } */
                const data2 = (0, lodash_1.assign)(data, {
                    $$createAt$$: data.$$createAt$$ || now,
                    $$updateAt$$: data.$$updateAt$$ || now,
                });
                const node2 = {
                    $txnId: context.getCurrentTxnId(),
                    $current: null,
                    $next: data2,
                    $path: `${entity}.${id}`,
                };
                if (!this.store[entity]) {
                    this.store[entity] = {};
                }
                (0, lodash_1.set)(this.store, `${entity}.${id}`, node2);
                this.addToTxnNode(node2, context, 'create');
                if (!params || !params.notCollect) {
                    context.opRecords.push({
                        a: 'c',
                        e: entity,
                        d: data2,
                    });
                }
                return 1;
            }
            default: {
                const selection = (0, lodash_1.assign)({}, operation, {
                    data: {
                        id: 1,
                    },
                    action: 'select',
                });
                const rows = await this.selectAbjointRow(entity, selection, context, params);
                const ids = rows.map(ele => ele.id);
                ids.forEach((id) => {
                    let alreadyDirtyNode = false;
                    const node = (this.store[entity])[id];
                    (0, assert_1.default)(node);
                    if (!node.$txnId) {
                        node.$txnId = context.getCurrentTxnId();
                    }
                    else {
                        (0, assert_1.default)(node.$txnId === context.getCurrentTxnId());
                        alreadyDirtyNode = true;
                    }
                    if (action === 'remove') {
                        node.$next = null;
                        node.$path = `${entity}.${id}`;
                        if (!alreadyDirtyNode) {
                            // 如果已经更新过的结点就不能再加了，会形成循环
                            this.addToTxnNode(node, context, 'remove');
                        }
                        if (!params || !params.notCollect) {
                            context.opRecords.push({
                                a: 'r',
                                e: entity,
                                f: operation.filter,
                            });
                        }
                    }
                    else {
                        const row = node && this.constructRow(node, context) || {};
                        const data2 = (0, lodash_1.assign)(data, {
                            $$updateAt$$: data.$$updateAt$$ || now,
                        });
                        const data3 = (0, lodash_1.assign)(row, data2);
                        node.$next = data3;
                        if (!alreadyDirtyNode) {
                            // 如果已经更新过的结点就不能再加了，会形成循环
                            this.addToTxnNode(node, context, 'remove');
                        }
                        if (!params || !params.notCollect) {
                            context.opRecords.push({
                                a: 'u',
                                e: entity,
                                d: data2,
                                f: operation.filter,
                            });
                        }
                    }
                });
                return rows.length;
            }
        }
    }
    async doOperation(entity, operation, context, params) {
        const { action } = operation;
        if (action === 'select') {
            /* const rows = await this.cascadeSelect(entity, operation as any, context, params);

            const result = await this.formResult(entity, rows, operation as any, context, params);
           
            const operationResult: OperationResult<ED> = {};
            assign(operationResult, {
                [entity]: {
                    select: result.length,
                }
            });
            
            return operationResult; */
            throw new Error('现在不支持使用select operation');
        }
        else {
            return await this.cascadeUpdate(entity, operation, context, params);
        }
    }
    async operate(entity, operation, context, params) {
        (0, assert_1.default)(context.getCurrentTxnId());
        return await this.doOperation(entity, operation, context, params);
    }
    async formProjection(entity, row, data, result, nodeDict, context) {
        const row2 = row;
        const data2 = data;
        const laterExprDict = {};
        for (const attr in data) {
            if (attr.startsWith(Demand_1.EXPRESSION_PREFIX)) {
                const ExprNodeTranslator = this.translateExpression(entity, data2[attr], context, {});
                const exprResult = await ExprNodeTranslator(row, nodeDict);
                if (typeof exprResult === 'function') {
                    (0, lodash_1.assign)(laterExprDict, {
                        [attr]: exprResult,
                    });
                }
                else {
                    (0, lodash_1.assign)(result, {
                        [attr]: exprResult,
                    });
                }
            }
            else if (attr === '#id') {
                const nodeId = data[attr];
                (0, assert_1.default)(!nodeDict.hasOwnProperty(nodeId), new OakError_1.OakError(RowStore_1.RowStore.$$LEVEL, RowStore_1.RowStore.$$CODES.nodeIdRepeated, `Filter中的nodeId「${nodeId}」出现了多次`));
                (0, lodash_1.assign)(nodeDict, {
                    [nodeId]: row,
                });
            }
        }
        for (const attr in data) {
            if (!attr.startsWith(Demand_1.EXPRESSION_PREFIX) && attr !== '#id') {
                const relation = (0, relation_1.judgeRelation)(this.storageSchema, entity, attr);
                if (relation === 1) {
                    (0, lodash_1.assign)(result, {
                        [attr]: row2[attr],
                    });
                }
                else if (relation === 2) {
                    if (row2[attr]) {
                        const result2 = {};
                        const { entity, entityId } = row2;
                        await this.formProjection(attr, row2[attr], data2[attr], result2, nodeDict, context);
                        (0, lodash_1.assign)(result, {
                            [attr]: result2,
                            entity,
                            entityId,
                        });
                    }
                }
                else if (typeof relation === 'string') {
                    if (row2[attr]) {
                        const result2 = {};
                        await this.formProjection(relation, row2[attr], data2[attr], result2, nodeDict, context);
                        (0, lodash_1.assign)(result, {
                            [attr]: result2,
                        });
                    }
                }
                else {
                    (0, assert_1.default)(relation instanceof Array);
                    if (row2[attr] instanceof Array) {
                        const result2 = await this.formResult(relation[0], row2[attr], data2[attr], context, nodeDict);
                        (0, lodash_1.assign)(result, {
                            [attr]: result2,
                        });
                    }
                }
            }
        }
        for (const attr in laterExprDict) {
            const exprResult = laterExprDict[attr](nodeDict);
            // projection是不应出现计算不出来的情况
            (0, assert_1.default)(typeof exprResult !== 'function', new OakError_1.OakError(RowStore_1.RowStore.$$LEVEL, RowStore_1.RowStore.$$CODES.expressionUnresolved, 'data中的expr无法计算，请检查命名与引用的一致性'));
            (0, lodash_1.assign)(result, {
                [attr]: exprResult,
            });
        }
    }
    async formResult(entity, rows, selection, context, params, nodeDict) {
        const { data, sorter, indexFrom, count } = selection;
        const findAvailableExprName = (current) => {
            let counter = 1;
            while (counter < 20) {
                const exprName = `$expr${counter++}`;
                if (!current.includes(exprName)) {
                    return exprName;
                }
            }
            (0, assert_1.default)(false, '找不到可用的expr命名');
        };
        const sortToProjection = (entity2, proj, sort) => {
            Object.keys(sort).forEach((attr) => {
                // 要把sorter中的expr运算提到这里做掉，否则异步运算无法排序        
                if (attr.startsWith('$expr') && typeof sort[attr] === 'object') {
                    const attrName = findAvailableExprName(Object.keys(proj));
                    Object.assign(proj, {
                        [attrName]: sort[attr],
                    });
                    Object.assign(sort, {
                        [attr]: attrName,
                    });
                }
                const rel = (0, relation_1.judgeRelation)(this.storageSchema, entity2, attr);
                if (rel === 2 || typeof rel === 'string') {
                    if (!proj[attr]) {
                        Object.assign(proj, {
                            [attr]: {},
                        });
                    }
                    const entity3 = typeof rel === 'string' ? rel : attr;
                    sortToProjection(entity3, proj[attr], sort[attr]);
                }
                else if (rel === 1) {
                    (0, lodash_1.assign)(proj, {
                        [attr]: 1,
                    });
                }
            });
        };
        if (sorter) {
            sorter.forEach((ele) => {
                sortToProjection(entity, data, ele.$attr);
            });
        }
        // 先计算projection
        const rows2 = [];
        for (const row of rows) {
            const result = {};
            const nodeDict2 = {};
            if (nodeDict) {
                (0, lodash_1.assign)(nodeDict2, nodeDict);
            }
            await this.formProjection(entity, row, data, result, nodeDict2, context);
            rows2.push(result);
        }
        // 再计算sorter
        if (sorter) {
            const sorterFn = this.translateSorter(entity, sorter, context, params);
            rows2.sort(sorterFn);
        }
        // 最后用indexFrom和count来截断
        if (typeof indexFrom === 'number') {
            return rows2.slice(indexFrom, indexFrom + count);
        }
        else {
            return rows2;
        }
    }
    async select(entity, selection, context, params) {
        (0, assert_1.default)(context.getCurrentTxnId());
        const result = await this.cascadeSelect(entity, selection, context, params);
        return {
            result,
            // stats,
        };
    }
    async count(entity, selection, context, params) {
        const { result } = await this.select(entity, (0, lodash_1.assign)({}, selection, {
            data: {
                id: 1,
            }
        }), context, params);
        return result.length;
    }
    addToTxnNode(node, context, action) {
        const txnNode = this.activeTxnDict[context.getCurrentTxnId()];
        (0, assert_1.default)(txnNode);
        if (!node.$nextNode) {
            // 如果nextNode有值，说明这个结点已经在链表中了
            if (txnNode.nodeHeader) {
                node.$nextNode = txnNode.nodeHeader;
                txnNode.nodeHeader = node;
            }
            else {
                txnNode.nodeHeader = node;
            }
        }
        txnNode[action]++;
    }
    getStat() {
        return this.stat;
    }
    async begin() {
        const uuid = `${Math.random()}`;
        (0, assert_1.default)(!this.activeTxnDict.hasOwnProperty(uuid));
        (0, lodash_1.assign)(this.activeTxnDict, {
            [uuid]: {
                create: 0,
                update: 0,
                remove: 0,
            },
        });
        return uuid;
    }
    async commit(uuid) {
        (0, assert_1.default)(this.activeTxnDict.hasOwnProperty(uuid), uuid);
        let node = this.activeTxnDict[uuid].nodeHeader;
        while (node) {
            const node2 = node.$nextNode;
            if (node.$txnId === uuid) {
                if (node.$next) {
                    // create/update
                    node.$current = (0, lodash_1.assign)(node.$current, node.$next);
                    (0, lodash_1.unset)(node, '$txnId');
                    (0, lodash_1.unset)(node, '$next');
                    (0, lodash_1.unset)(node, '$path');
                    (0, lodash_1.unset)(node, '$nextNode');
                }
                else {
                    // remove
                    (0, assert_1.default)(node.$path);
                    (0, lodash_1.unset)(this.store, node.$path);
                    (0, lodash_1.unset)(node, '$txnId');
                }
            }
            else {
                // 同一行被同一事务更新多次
                (0, assert_1.default)(node.$txnId === undefined);
            }
            node = node2;
        }
        if (this.activeTxnDict[uuid].create || this.activeTxnDict[uuid].update || this.activeTxnDict[uuid].remove) {
            this.stat.create += this.activeTxnDict[uuid].create;
            this.stat.update += this.activeTxnDict[uuid].update;
            this.stat.remove += this.activeTxnDict[uuid].remove;
            this.stat.commit++;
        }
        (0, lodash_1.unset)(this.activeTxnDict, uuid);
    }
    async rollback(uuid) {
        (0, assert_1.default)(this.activeTxnDict.hasOwnProperty(uuid));
        let node = this.activeTxnDict[uuid].nodeHeader;
        while (node) {
            const node2 = node.$nextNode;
            if (node.$txnId === uuid) {
                if (node.$current) {
                    // update/remove
                    (0, lodash_1.unset)(node, '$txnId');
                    (0, lodash_1.unset)(node, '$next');
                    (0, lodash_1.unset)(node, '$path');
                    (0, lodash_1.unset)(node, '$nextNode');
                }
                else {
                    // create
                    (0, assert_1.default)(node.$path);
                    (0, lodash_1.unset)(this.store, node.$path);
                    (0, lodash_1.unset)(node, '$txnId');
                }
            }
            else {
                // 该结点被同一事务反复处理
                (0, assert_1.default)(node.$txnId === undefined);
            }
            node = node2;
        }
        (0, lodash_1.unset)(this.activeTxnDict, uuid);
    }
    // 将输入的OpRecord同步到数据中
    async sync(opRecords, context) {
        (0, assert_1.default)(context.getCurrentTxnId());
        for (const record of opRecords) {
            switch (record.a) {
                case 'c': {
                    const { e, d } = record;
                    await this.doOperation(e, {
                        action: 'create',
                        data: d,
                    }, context, {
                        notCollect: true,
                    });
                    break;
                }
                case 'u': {
                    const { e, d, f } = record;
                    await this.doOperation(e, {
                        action: 'update',
                        data: d,
                        filter: f,
                    }, context, {
                        notCollect: true,
                    });
                    break;
                }
                case 'r': {
                    const { e, f } = record;
                    await this.doOperation(e, {
                        action: 'remove',
                        data: {},
                        filter: f,
                    }, context, {
                        notCollect: true,
                    });
                    break;
                }
                case 's': {
                    const { d } = record;
                    for (const entity in d) {
                        for (const id in d[entity]) {
                            await this.doOperation(entity, {
                                action: 'create',
                                data: d[entity][id],
                            }, context, {
                                notCollect: true,
                            });
                        }
                    }
                    break;
                }
                default: {
                    (0, assert_1.default)(false);
                }
            }
        }
    }
}
exports.default = TreeStore;
