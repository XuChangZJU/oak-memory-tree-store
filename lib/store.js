"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = require("oak-domain/lib/utils/lodash");
const assert_1 = require("oak-domain/lib/utils/assert");
const Entity_1 = require("oak-domain/lib/types/Entity");
const Demand_1 = require("oak-domain/lib/types/Demand");
const Exception_1 = require("oak-domain/lib/types/Exception");
const Demand_2 = require("oak-domain/lib/types/Demand");
const relation_1 = require("oak-domain/lib/store/relation");
const Expression_1 = require("oak-domain/lib/types/Expression");
const CascadeStore_1 = require("oak-domain/lib/store/CascadeStore");
const filter_1 = require("oak-domain/lib/store/filter");
;
;
function obscurePass(value, option) {
    return !!(option?.obscure && value === undefined);
}
class OakExpressionUnresolvedException extends Exception_1.OakException {
}
;
class TreeStore extends CascadeStore_1.CascadeStore {
    store;
    seq;
    activeTxnDict;
    stat;
    getNextSeq(entity) {
        if (this.seq[entity]) {
            const seq = this.seq[entity];
            this.seq[entity]++;
            return seq;
        }
        this.seq[entity] = 2;
        return 1;
    }
    setMaxSeq(entity, seq) {
        if (this.seq[entity]) {
            if (this.seq[entity] < seq) {
                this.seq[entity] = seq;
            }
        }
        else {
            this.seq[entity] = seq;
        }
    }
    /* treeStore改成同步以后不会再出现
     private async waitOnTxn(id: string, context: Cxt) {
        // 先检查自己的等待者中有没有id，以避免死锁
        const myId = context.getCurrentTxnId()!;
        const { waitList: myWaitList } = this.activeTxnDict[myId];
        if (myWaitList.find(
            ele => ele.id === id
        )) {
            throw new OakDeadlock();
        }
        const { waitList } = this.activeTxnDict[id];
        const p = new Promise(
            (resolve) => waitList.push({
                id: myId,
                fn: resolve,
            })
        );
        await p;
    } */
    supportMultipleCreate() {
        return false;
    }
    supportManyToOneJoin() {
        return false;
    }
    resetInitialData(data, stat) {
        this.store = {};
        const now = Date.now();
        for (const entity in data) {
            const { attributes } = this.getSchema()[entity];
            this.store[entity] = {};
            for (const row of data[entity]) {
                for (const key in attributes) {
                    if (row[key] === undefined) {
                        Object.assign(row, {
                            [key]: null,
                        });
                    }
                }
                /**
                 * 处理初始化数据
                 */
                if (!row.$$createAt$$) {
                    Object.assign(row, {
                        $$createAt$$: now,
                    });
                }
                if (!row.$$deleteAt$$) {
                    Object.assign(row, {
                        $$deleteAt$$: null,
                    });
                }
                if (!row.$$updateAt$$) {
                    Object.assign(row, {
                        $$updateAt$$: now,
                    });
                }
                if (!row.$$seq$$) {
                    const seq = this.getNextSeq(entity);
                    Object.assign(row, {
                        $$seq$$: seq,
                    });
                }
                else {
                    this.setMaxSeq(entity, row.$$seq$$);
                }
                (0, assert_1.assert)(row.id && !row.id.includes('.'));
                (0, lodash_1.set)(this.store, `${entity}.${row.id}.$current`, row);
            }
        }
        if (stat) {
            this.stat = stat;
        }
    }
    getCurrentData(keys) {
        const result = {};
        for (const entity in this.store) {
            if (keys && !keys.includes(entity)) {
                continue;
            }
            result[entity] = [];
            for (const rowId in this.store[entity]) {
                result[entity]?.push(this.store[entity][rowId]['$current']);
            }
        }
        return result;
    }
    constructor(storageSchema) {
        super(storageSchema);
        this.store = {};
        this.activeTxnDict = {};
        this.stat = {
            create: 0,
            update: 0,
            remove: 0,
            commit: 0,
        };
        this.seq = {};
    }
    constructRow(node, context, option) {
        let data = (0, lodash_1.cloneDeep)(node.$current);
        if (context.getCurrentTxnId() && node.$txnId === context.getCurrentTxnId()) {
            if (!node.$next) {
                // 如果要求返回delete数据，返回带$$deleteAt$$的行
                if (option?.includedDeleted) {
                    return Object.assign({}, data, {
                        [Entity_1.DeleteAtAttribute]: 1,
                    });
                }
                return null;
            }
            else if (!node.$current) {
                // 本事务创建的，$$createAt$$和$$updateAt$$置为1
                return Object.assign({}, data, node.$next, {
                    [Entity_1.CreateAtAttribute]: 1,
                    [Entity_1.UpdateAtAttribute]: 1,
                });
            }
            else {
                // 本事务更新的，$$updateAt$$置为1
                return Object.assign({}, data, node.$next, {
                    [Entity_1.UpdateAtAttribute]: 1,
                });
            }
        }
        return data;
    }
    testFilterFns(node, nodeDict, exprResolveFns, fns) {
        const { self, otm, mto } = fns;
        // 三种filterFn是and的关系，有一个失败就返回false，优先判断顺序：self -> mto -> otm
        for (const f of self) {
            if (!f(node, nodeDict, exprResolveFns)) {
                return false;
            }
        }
        for (const f of mto) {
            if (!f(node, nodeDict, exprResolveFns)) {
                return false;
            }
        }
        for (const f of otm) {
            if (!f(node, nodeDict, exprResolveFns)) {
                return false;
            }
        }
        return true;
    }
    translateLogicFilter(entity, projection, filter, attr, context, option) {
        const self = [];
        const otm = [];
        const mto = [];
        switch (attr) {
            case '$and': {
                const filters = filter[attr];
                const fns = filters.map((ele) => this.translateFilterInner(entity, projection, ele, context, option));
                self.push(...(fns.map(ele => ele.self).flat()));
                otm.push(...(fns.map(ele => ele.otm).flat()));
                mto.push(...(fns.map(ele => ele.mto).flat()));
                break;
            }
            case '$or': {
                const filters = filter[attr];
                const fns = filters.map((ele) => this.translateFilterInner(entity, projection, ele, context, option));
                /**
                 * 对于or的情况，按最坏的一种判定来计算，同时对所有的判定也可以排序，先计算代价最轻的
                 */
                fns.sort((ele1, ele2) => {
                    if (ele2.mto.length > 0) {
                        return -1;
                    }
                    else if (ele1.mto.length > 0) {
                        return 1;
                    }
                    else if (ele2.otm.length > 0) {
                        return -1;
                    }
                    else if (ele1.otm.length > 0) {
                        return 1;
                    }
                    return 0;
                });
                const fn = (node, nodeDict, exprResolveFns) => {
                    for (const fn of fns) {
                        if (this.testFilterFns(node, nodeDict, exprResolveFns, fn)) {
                            return true;
                        }
                    }
                    return false;
                };
                const last = fns[fns.length - 1];
                if (last.mto.length > 0) {
                    mto.push(fn);
                }
                else if (last.otm.length > 0) {
                    otm.push(fn);
                }
                else {
                    self.push(fn);
                }
                break;
            }
            case '$not': {
                const filter2 = filter[attr];
                const filterFn = this.translateFilterInner(entity, projection, filter2, context, option);
                const fn = (node, nodeDict, exprResolveFns) => {
                    if (this.testFilterFns(node, nodeDict, exprResolveFns, filterFn)) {
                        return false;
                    }
                    return true;
                };
                if (filterFn.otm.length > 0) {
                    otm.push(fn);
                }
                else if (filterFn.mto.length > 0) {
                    mto.push(fn);
                }
                else {
                    self.push(fn);
                }
                break;
            }
            default: {
                (0, assert_1.assert)(false, `${attr}算子暂不支持`);
            }
        }
        return {
            self,
            otm,
            mto,
        };
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
    translateExpressionNode(entity, expression, context, option) {
        if ((0, Expression_1.isExpression)(expression)) {
            const op = Object.keys(expression)[0];
            const option2 = expression[op];
            if ((0, Expression_1.opMultipleParams)(op)) {
                const paramsTranslated = option2.map(ele => this.translateExpressionNode(entity, ele, context, option2));
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
                        return (0, Expression_1.execOp)(op, results, option2.obscure);
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
                        return (0, Expression_1.execOp)(op, results, option && option.obscure);
                    };
                    return laterCheckFn;
                };
            }
            else {
                const paramsTranslated = this.translateExpressionNode(entity, option2, context, option2);
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
                        return (0, Expression_1.execOp)(op, result, option2.obscure);
                    };
                }
                else {
                    return () => {
                        return (0, Expression_1.execOp)(op, paramsTranslated, option2.obscure);
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
                    (0, assert_1.assert)(expression.hasOwnProperty('#refId'));
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
    translateExpression(entity, expression, context, option) {
        const expr = this.translateExpressionNode(entity, expression, context, option);
        return (row, nodeDict) => {
            if (typeof expr !== 'function') {
                return expr;
            }
            const result = expr(row, nodeDict);
            return result;
        };
    }
    translateFulltext(entity, filter, context, option) {
        // 全文索引查找
        const { [entity]: { indexes } } = this.getSchema();
        const fulltextIndex = indexes.find(ele => ele.config && ele.config.type === 'fulltext');
        const { attributes } = fulltextIndex;
        const { $search } = filter;
        return (node) => {
            const row = this.constructRow(node, context, option);
            for (const attr of attributes) {
                const { name } = attr;
                if (row && row[name] && (typeof row[name] === 'string' && row[name].includes($search) || obscurePass(row[name], option))) {
                    return true;
                }
            }
            return false;
        };
    }
    translatePredicate(path, predicate, value, option) {
        switch (predicate) {
            case '$gt': {
                return (row) => {
                    const data = (0, lodash_1.get)(row, path);
                    return ['number', 'string'].includes(typeof data) && data > value || obscurePass(data, option);
                };
            }
            case '$lt': {
                return (row) => {
                    const data = (0, lodash_1.get)(row, path);
                    return ['number', 'string'].includes(typeof data) && data < value || obscurePass(data, option);
                };
            }
            case '$gte': {
                return (row) => {
                    const data = (0, lodash_1.get)(row, path);
                    return ['number', 'string'].includes(typeof data) && data >= value || obscurePass(data, option);
                };
            }
            case '$lte': {
                return (row) => {
                    const data = (0, lodash_1.get)(row, path);
                    return ['number', 'string'].includes(typeof data) && data <= value || obscurePass(data, option);
                };
            }
            case '$eq': {
                return (row) => {
                    const data = (0, lodash_1.get)(row, path);
                    return ['number', 'string'].includes(typeof data) && data === value || obscurePass(data, option);
                };
            }
            case '$ne': {
                return (row) => {
                    const data = (0, lodash_1.get)(row, path);
                    return ['number', 'string'].includes(typeof data) && data !== value || obscurePass(data, option);
                };
            }
            case '$between': {
                return (row) => {
                    const data = (0, lodash_1.get)(row, path);
                    return ['number', 'string'].includes(typeof data) && data >= value[0] && data <= value[1] || obscurePass(data, option);
                };
            }
            case '$mod': {
                return (row) => {
                    const data = (0, lodash_1.get)(row, path);
                    return typeof data === 'number' && data % value[0] === value[1] || obscurePass(data, option);
                };
            }
            case '$startsWith': {
                return (row) => {
                    const data = (0, lodash_1.get)(row, path);
                    return ['string'].includes(typeof data) && data.startsWith(value) || obscurePass(data, option);
                };
            }
            case '$endsWith': {
                return (row) => {
                    const data = (0, lodash_1.get)(row, path);
                    return ['string'].includes(typeof data) && data.endsWith(value) || obscurePass(data, option);
                };
            }
            case '$includes': {
                return (row) => {
                    const data = (0, lodash_1.get)(row, path);
                    return ['string'].includes(typeof data) && data.includes(value) || obscurePass(data, option);
                };
            }
            case '$exists': {
                (0, assert_1.assert)(typeof value === 'boolean');
                return (row) => {
                    const data = (0, lodash_1.get)(row, path);
                    if (value) {
                        return ![null, undefined].includes(data) || obscurePass(data, option);
                    }
                    else {
                        return [null, undefined].includes(data) || obscurePass(data, option);
                    }
                };
            }
            case '$in': {
                (0, assert_1.assert)(value instanceof Array);
                return (row) => {
                    const data = (0, lodash_1.get)(row, path);
                    return value.includes(data) || obscurePass(data, option);
                };
            }
            case '$nin': {
                (0, assert_1.assert)(value instanceof Array);
                return (row) => {
                    const data = (0, lodash_1.get)(row, path);
                    return !value.includes(data) || obscurePass(data, option);
                };
            }
            case '$contains': {
                // json中的多值查询
                const array = value instanceof Array ? value : [value];
                return (row) => {
                    const data = path ? (0, lodash_1.get)(row, path) : row;
                    return (0, lodash_1.differenceBy)(array, data, (value) => {
                        if (typeof value === 'object') {
                            return JSON.stringify(value);
                        }
                        return value;
                    }).length === 0 || obscurePass(data, option);
                };
            }
            case '$overlaps': {
                // json中的多值查询
                const array = value instanceof Array ? value : [value];
                return (row) => {
                    const data = path ? (0, lodash_1.get)(row, path) : row;
                    return (0, lodash_1.intersectionBy)(array, data, (value) => {
                        if (typeof value === 'object') {
                            return JSON.stringify(value);
                        }
                        return value;
                    }).length > 0 || obscurePass(data, option);
                };
            }
            default: {
                throw new Error(`predicate ${predicate} is not recoganized`);
            }
        }
    }
    translateObjectPredicate(filter) {
        const fns = [];
        const translatePredicateInner = (p, path, fns2) => {
            if (p instanceof Array) {
                p.forEach((ele, idx) => {
                    const path2 = `${path}[${idx}]`;
                    if (typeof ele !== 'object') {
                        if (![null, undefined].includes(ele)) {
                            fns2.push(this.translatePredicate(path2, '$eq', ele));
                        }
                    }
                    else {
                        translatePredicateInner(ele, path2, fns2);
                    }
                });
            }
            else {
                for (const attr in p) {
                    if (attr === '$and') {
                        p[attr].forEach((p2) => translatePredicateInner(p2, path, fns2));
                    }
                    else if (attr === '$or') {
                        const fnsOr = [];
                        p[attr].forEach((p2) => translatePredicateInner(p2, path, fnsOr));
                        fns2.push((value) => {
                            for (const fnOr of fnsOr) {
                                if (fnOr(value)) {
                                    return true;
                                }
                            }
                            return false;
                        });
                    }
                    else if (attr.startsWith('$')) {
                        (0, assert_1.assert)(Object.keys(p).length === 1);
                        fns2.push(this.translatePredicate(path, attr, p[attr]));
                    }
                    else {
                        const attr2 = attr.startsWith('.') ? attr.slice(1) : attr;
                        const path2 = path ? `${path}.${attr2}` : attr2;
                        if (typeof p[attr] !== 'object') {
                            fns2.push(this.translatePredicate(path2, '$eq', p[attr]));
                        }
                        else {
                            translatePredicateInner(p[attr], path2, fns2);
                        }
                    }
                }
            }
        };
        translatePredicateInner(filter, '', fns);
        return (value) => {
            for (const fn of fns) {
                if (!fn(value)) {
                    return false;
                }
            }
            return true;
        };
    }
    translateAttribute(entity, filter, attr, context, option) {
        // 如果是模糊查询且该属性为undefined，说明没取到，返回true
        function obscurePassLocal(row) {
            return obscurePass(row[attr], option);
        }
        if (!['object', 'array'].includes(this.getSchema()[entity].attributes[attr]?.type)) {
            if (typeof filter !== 'object') {
                return (node) => {
                    const row = this.constructRow(node, context, option);
                    return row ? row[attr] === filter || obscurePassLocal(row) : false;
                };
            }
            else {
                const predicate = Object.keys(filter)[0];
                (0, assert_1.assert)(Object.keys(filter).length === 1 && predicate.startsWith('$'));
                if (['$in', '$nin'].includes(predicate) && !(filter[predicate] instanceof Array)) {
                    throw new Error('子查询已经改用一对多的外键连接方式');
                }
                else {
                    const fn = this.translatePredicate(attr, predicate, filter[predicate], option);
                    return (node) => {
                        const row = this.constructRow(node, context, option);
                        if (!row) {
                            return false;
                        }
                        return fn(row);
                    };
                }
            }
        }
        else {
            // 对象的内部查询
            if (typeof filter !== 'object') {
                // 支持filter全值相等的查询方式
                (0, assert_1.assert)(typeof filter === 'string');
                return (node) => {
                    const row = this.constructRow(node, context, option);
                    if (!row) {
                        return false;
                    }
                    return row.hasOwnProperty(attr) && JSON.stringify(row[attr]) === filter;
                };
            }
            else {
                const fn = this.translateObjectPredicate(filter);
                return (node) => {
                    const row = this.constructRow(node, context, option);
                    if (!row) {
                        return false;
                    }
                    return fn(row[attr]) || obscurePassLocal(row);
                };
            }
        }
    }
    translateFilterInner(entity, projection, filter, context, option) {
        const self = [];
        const otm = [];
        const mto = [];
        let nodeId;
        for (const attr in filter) {
            if (attr === '#id') {
                nodeId = filter['#id'];
            }
            else if (['$and', '$or', '$xor', '$not'].includes(attr)) {
                const filterFns = this.translateLogicFilter(entity, projection, filter, attr, context, option);
                self.push(...(filterFns.self));
                otm.push(...(filterFns.otm));
                mto.push(...(filterFns.mto));
            }
            else if (attr.toLowerCase().startsWith(Demand_1.EXPRESSION_PREFIX)) {
                const fn = this.translateExpression(entity, filter[attr], context, option);
                // expression上先假设大都是只查询自身和外层的属性，不一定对。by Xc 20230824
                self.push((node, nodeDict, exprResolveFns) => {
                    const row = this.constructRow(node, context, option);
                    if (!row) {
                        return false;
                    }
                    const result = fn(row, nodeDict);
                    if (typeof result === 'function') {
                        exprResolveFns.push(result);
                    }
                    return !!result;
                });
            }
            else if (attr.toLowerCase() === '$text') {
                self.push(this.translateFulltext(entity, filter[attr], context, option));
            }
            else {
                // 属性级过滤
                const relation = (0, relation_1.judgeRelation)(this.getSchema(), entity, attr);
                if (relation === 1) {
                    // 行本身的属性
                    self.push(this.translateAttribute(entity, filter[attr], attr, context, option));
                }
                else if (relation === 2) {
                    // 基于entity/entityId的指针
                    const filterFn = this.translateFilter(attr, projection[attr] || {}, filter[attr], context, option);
                    mto.push((node, nodeDict, exprResolveFns) => {
                        const row = this.constructRow(node, context, option);
                        if (!row) {
                            return false;
                        }
                        if (obscurePass(row.entity, option) || obscurePass(row.entityId, option)) {
                            return true;
                        }
                        if (row.entityId === undefined || row.entity === undefined) {
                            (0, assert_1.assert)(typeof projection[attr] === 'object');
                            if (option?.ignoreAttrMiss) {
                                if (process.env.NODE_ENV === 'development') {
                                    console.warn(`对象${entity}上的entity/entityId不能确定值，可能会影响判定结果`);
                                }
                                return false; // 若不能确定，认定为条件不满足                                    
                            }
                            throw new Exception_1.OakRowUnexistedException([{
                                    entity,
                                    selection: {
                                        data: projection,
                                        filter: {
                                            id: row.id,
                                        },
                                    },
                                }]);
                        }
                        if (row.entity !== attr) {
                            return false;
                        }
                        if (row.entityId === null) {
                            return false;
                        }
                        const node2 = (0, lodash_1.get)(this.store, `${attr}.${row.entityId}`);
                        if (!node2) {
                            if (option?.obscure) {
                                return true;
                            }
                            return false;
                        }
                        return filterFn(node2, nodeDict, exprResolveFns);
                    });
                }
                else if (typeof relation === 'string') {
                    // 只能是基于普通属性的外键
                    const filterFn = this.translateFilter(relation, projection[attr] || {}, filter[attr], context, option);
                    mto.push((node, nodeDict, exprResolveFns) => {
                        const row = this.constructRow(node, context, option);
                        if (!row) {
                            return false;
                        }
                        if (obscurePass(row[`${attr}Id`], option)) {
                            return true;
                        }
                        if (row[`${attr}Id`]) {
                            const node2 = (0, lodash_1.get)(this.store, `${relation}.${row[`${attr}Id`]}`);
                            if (!node2) {
                                if (option?.obscure) {
                                    return true;
                                }
                                return false;
                            }
                            return filterFn(node2, nodeDict, exprResolveFns);
                        }
                        if (row[`${attr}Id`] === undefined) {
                            // 说明一对多的外键没有取出来，需要抛出RowUnexists异常
                            (0, assert_1.assert)(typeof projection[attr] === 'object');
                            if (option?.ignoreAttrMiss) {
                                if (process.env.NODE_ENV === 'development') {
                                    console.warn(`对象${entity}上的${attr}Id不能确定值，可能会影响判定结果`);
                                }
                                return false; // 若不能确定，认定为条件不满足                                    
                            }
                            throw new Exception_1.OakRowUnexistedException([{
                                    entity,
                                    selection: {
                                        data: projection,
                                        filter: {
                                            id: row.id,
                                        },
                                    },
                                }]);
                        }
                        (0, assert_1.assert)(row[`${attr}Id`] === null);
                        return false;
                    });
                }
                else if (relation instanceof Array) {
                    // 一对多的子查询
                    const [otmEntity, otmForeignKey] = relation;
                    const predicate = filter[attr][Demand_1.SUB_QUERY_PREDICATE_KEYWORD] || 'in';
                    if (option?.obscure) {
                        // 如果是obscure，则返回的集合中有没有都不能否决“可能有”或“并不全部是”，所以可以直接返回true
                        if (['in', 'not all'].includes(predicate)) {
                            self.push(() => true);
                            continue;
                        }
                    }
                    const fk = otmForeignKey || 'entityId';
                    const otmProjection = {
                        id: 1,
                        [fk]: 1,
                    };
                    /**
                     * in代表外键连接后至少有一行数据
                     * not in代表外键连接后一行也不能有
                     * all代表反外键连接条件的一行也不能有（符合的是否至少要有一行？直觉上没这个限制）
                     * not all 代表反外键连接条件的至少有一行
                     *
                     * 此时还没有确定父行，只有查询中明确带有id的查询可以先执行，否则不执行，暂先这个逻辑 by Xc 20230725
                     */
                    const makeAfterLogic = () => {
                        otm.push((node, nodeDict) => {
                            const row = this.constructRow(node, context, option);
                            if (!row) {
                                return false;
                            }
                            /**
                             * in代表外键连接后至少有一行数据
                             * not in代表外键连接后一行也不能有
                             * all代表反外键连接条件的一行也不能有（符合的是否至少要有一行？直觉上没这个限制）
                             * not all 代表反外键连接条件的至少有一行
                             */
                            const otmFilter = !otmForeignKey ? Object.assign({
                                entity,
                            }, filter[attr]) : (0, lodash_1.cloneDeep)(filter[attr]);
                            if (['not in', 'in'].includes(predicate)) {
                                Object.assign(otmFilter, {
                                    [fk]: row.id,
                                });
                            }
                            else {
                                Object.assign(otmFilter, {
                                    [fk]: {
                                        $ne: row.id,
                                    }
                                });
                            }
                            const option2 = Object.assign({}, option, { nodeDict, dontCollect: true });
                            const subQuerySet = (this.selectAbjointRow(otmEntity, {
                                data: otmProjection,
                                filter: otmFilter,
                                indexFrom: 0,
                                count: 1,
                            }, context, option2)).map((ele) => {
                                return (ele)[fk];
                            });
                            switch (predicate) {
                                case 'in':
                                case 'not all': {
                                    return subQuerySet.length > 0;
                                }
                                case 'not in':
                                case 'all': {
                                    return subQuerySet.length === 0;
                                }
                                default: {
                                    throw new Error(`illegal sqp: ${predicate}`);
                                }
                            }
                        });
                    };
                    if (filter.id && typeof filter.id === 'string') {
                        const otmFilter = !otmForeignKey ? Object.assign({
                            entity,
                        }, filter[attr]) : (0, lodash_1.cloneDeep)(filter[attr]);
                        if (['not in', 'in'].includes(predicate)) {
                            Object.assign(otmFilter, {
                                [fk]: filter.id,
                            });
                        }
                        else {
                            Object.assign(otmFilter, {
                                [fk]: {
                                    $ne: filter.id,
                                }
                            });
                        }
                        try {
                            const subQuerySet = (this.selectAbjointRow(otmEntity, {
                                data: otmProjection,
                                filter: otmFilter,
                                indexFrom: 0,
                                count: 1,
                            }, context, { dontCollect: true })).map((ele) => {
                                return (ele)[fk];
                            });
                            self.push((node) => {
                                const row = this.constructRow(node, context, option);
                                if (!row) {
                                    return false;
                                }
                                switch (predicate) {
                                    case 'in':
                                    case 'not all': {
                                        return subQuerySet.length > 0;
                                    }
                                    case 'not in':
                                    case 'all': {
                                        return subQuerySet.length === 0;
                                    }
                                    default: {
                                        throw new Error(`illegal sqp: ${predicate}`);
                                    }
                                }
                            });
                        }
                        catch (err) {
                            if (err instanceof OakExpressionUnresolvedException) {
                                makeAfterLogic();
                            }
                            else {
                                throw err;
                            }
                        }
                    }
                    else if (!option?.disableSubQueryHashjoin) {
                        /**
                         * 尝试用hashjoin将内表数组取出，因为memory中的表都不会太大，且用不了索引（未来优化了可能可以用id直接取值），因而用hash应当会更快
                         */
                        const option2 = Object.assign({}, option, { dontCollect: true });
                        try {
                            const subQueryRows = this.selectAbjointRow(otmEntity, {
                                data: otmProjection,
                                filter: filter[attr],
                            }, context, option2);
                            const buckets = (0, lodash_1.groupBy)(subQueryRows, fk);
                            otm.push((node, nodeDict) => {
                                const row = this.constructRow(node, context, option);
                                if (!row) {
                                    return false;
                                }
                                switch (predicate) {
                                    case 'in': {
                                        return (buckets[row.id]?.length > 0);
                                    }
                                    case 'not in': {
                                        return (!buckets[row.id] || buckets[row.id].length === 0);
                                    }
                                    case 'all': {
                                        return (buckets[row.id]?.length > 0 && Object.keys(buckets).length === 1);
                                    }
                                    case 'not all': {
                                        return Object.keys(buckets).length > 1 || !buckets.hasOwnProperty(row.id);
                                    }
                                    default: {
                                        (0, assert_1.assert)(false, `unrecoganized sqp operator: ${predicate}`);
                                    }
                                }
                            });
                        }
                        catch (err) {
                            if (err instanceof OakExpressionUnresolvedException) {
                                makeAfterLogic();
                            }
                            else {
                                throw err;
                            }
                        }
                    }
                    else {
                        makeAfterLogic();
                    }
                }
                else {
                    // metadata
                    (0, assert_1.assert)(relation === 0);
                }
            }
        }
        return {
            self,
            otm,
            mto,
            nodeId,
        };
    }
    translateFilter(entity, projection, filter, context, option) {
        const filterFns = this.translateFilterInner(entity, projection, filter, context, option);
        const { nodeId } = filterFns;
        return (node, nodeDict, exprResolveFns) => {
            if (nodeId) {
                (0, assert_1.assert)(!nodeDict.hasOwnProperty(nodeId), `Filter中的nodeId「${nodeId}」出现了多次`);
                Object.assign(nodeDict, {
                    [nodeId]: this.constructRow(node, context, option),
                });
            }
            return this.testFilterFns(node, nodeDict, exprResolveFns, filterFns);
        };
    }
    translateSorter(entity, sorter, context, option) {
        const compare = (row1, row2, entity2, sortAttr, direction) => {
            const row11 = row1;
            const row22 = row2;
            (0, assert_1.assert)(Object.keys(sortAttr).length === 1);
            const attr = Object.keys(sortAttr)[0];
            const relation = (0, relation_1.judgeRelation)(this.getSchema(), entity2, attr);
            if (relation === 1 || relation === 0) {
                const getAttrOrExprValue = (r) => {
                    if (sortAttr[attr] === 1) {
                        return r[attr];
                    }
                    else {
                        // 改变策略，让所有需要获得的值在projection上取得
                        (0, assert_1.assert)(typeof sortAttr[attr] === 'string' && sortAttr[attr].startsWith('$expr'));
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
                const attrDef = this.getSchema()[entity2].attributes[attr];
                // 处理enum，现在enum是按定义enum的顺序从小到大排列
                if (attrDef?.type === 'enum') {
                    const enums = attrDef.enumeration;
                    const i1 = enums.indexOf(v1);
                    const i2 = enums.indexOf(v2);
                    (0, assert_1.assert)(i1 >= 0 && i2 >= 0);
                    return direction === 'asc' ? i1 - i2 : i2 - i1;
                }
                else {
                    // createAt为1时被认为是最大的（新建）
                    if (['$$createAt$$', '$$updateAt$$'].includes(attr)) {
                        if (v1 === 1) {
                            return direction === 'asc' ? 1 : -1;
                        }
                        else if (v2 === 1) {
                            return direction === 'asc' ? -1 : 1;
                        }
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
            }
            else {
                if (relation === 2) {
                    (0, assert_1.assert)(row11['entity'] === row22['entity']);
                    (0, assert_1.assert)(row11.entity === attr);
                    const node1 = this.store[row11.entity] && this.store[row11.entity][row11.entityId];
                    const node2 = this.store[row22.entity] && this.store[row22.entity][row22.entityId];
                    const row111 = node1 && this.constructRow(node1, context, option);
                    const row222 = node2 && this.constructRow(node2, context, option);
                    return compare(row111, row222, row11['entity'], sortAttr[attr], direction);
                }
                else {
                    (0, assert_1.assert)(typeof relation === 'string');
                    const node1 = this.store[relation] && this.store[relation][row11[`${attr}Id`]];
                    const node2 = this.store[relation] && this.store[relation][row22[`${attr}Id`]];
                    const row111 = node1 && this.constructRow(node1, context, option);
                    const row222 = node2 && this.constructRow(node2, context, option);
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
     * 目标行，如果有id过滤条件可直接取
     * @param entity
     * @param selection
     * @returns
     */
    getEntityNodes(entity, selection, context) {
        const { filter } = selection;
        const ids = (0, filter_1.getRelevantIds)(filter);
        if (this.store[entity]) {
            if (ids.length > 0) {
                const entityNodes = (0, lodash_1.pick)(this.store[entity], ids);
                return Object.values(entityNodes);
            }
            return Object.values(this.store[entity]);
        }
        return [];
    }
    selectAbjointRow(entity, selection, context, option) {
        const { data, filter } = selection;
        const nodeDict = option?.nodeDict;
        const filterFn = filter && this.translateFilter(entity, data, filter, context, option);
        const entityNodes = this.getEntityNodes(entity, selection, context);
        const nodes = [];
        for (const n of entityNodes) {
            if (n.$txnId && n.$txnId !== context.getCurrentTxnId() && n.$current === null) {
                continue;
            }
            (0, assert_1.assert)(!n.$txnId || n.$txnId === context.getCurrentTxnId());
            const exprResolveFns = [];
            const nodeDict2 = {};
            if (nodeDict) {
                Object.assign(nodeDict2, nodeDict);
            }
            // 如果没有filterFn，要保证行不为null(本事务remove的case)
            if (filterFn ? filterFn(n, nodeDict2, exprResolveFns) : this.constructRow(n, context, option)) {
                // 如果有延时处理的expression，在这里加以判断，此时所有在filter中的node应该都已经加以遍历了
                let exprResult = true;
                if (exprResolveFns.length > 0) {
                    for (const fn of exprResolveFns) {
                        const result = fn(nodeDict2);
                        if (typeof result === 'function') {
                            throw new OakExpressionUnresolvedException();
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
        const rows = nodes.map((node) => this.constructRow(node, context, option));
        const rows2 = this.formResult(entity, rows, selection, context, option);
        return rows2;
    }
    updateAbjointRow(entity, operation, context, option) {
        const { data, action, id: operId } = operation;
        switch (action) {
            case 'create': {
                const { id } = data;
                (0, assert_1.assert)(id);
                // const node = this.store[entity] && (this.store[entity]!)[id as string];
                // const row = node && this.constructRow(node, context) || {};
                /* if (row) {
                    throw new OakError(RowStore.$$LEVEL, RowStore.$$CODES.primaryKeyConfilict);
                } */
                if (this.store[entity] && (this.store[entity])[id]) {
                    const node = this.store[entity] && (this.store[entity])[id];
                    throw new Exception_1.OakCongruentRowExists(entity, this.constructRow(node, context, option));
                }
                if (!data.$$seq$$) {
                    const seq = this.getNextSeq(entity);
                    data.$$seq$$ = seq;
                }
                const node2 = {
                    $txnId: context.getCurrentTxnId(),
                    $current: null,
                    $next: data,
                    $path: `${entity}.${id}`,
                };
                if (!this.store[entity]) {
                    this.store[entity] = {};
                }
                (0, lodash_1.set)(this.store, `${entity}.${id}`, node2);
                this.addToTxnNode(node2, context, 'create');
                return 1;
            }
            default: {
                const selection = {
                    data: {
                        id: 1,
                    },
                    filter: operation.filter,
                    indexFrom: operation.indexFrom,
                    count: operation.count,
                };
                const rows = this.selectAbjointRow(entity, selection, context, { dontCollect: true });
                const ids = rows.map(ele => ele.id);
                for (const id of ids) {
                    let alreadyDirtyNode = false;
                    const node = (this.store[entity])[id];
                    (0, assert_1.assert)(node && (!node.$txnId || node.$txnId == context.getCurrentTxnId()));
                    if (!node.$txnId) {
                        node.$txnId = context.getCurrentTxnId();
                    }
                    else {
                        (0, assert_1.assert)(node.$txnId === context.getCurrentTxnId());
                        alreadyDirtyNode = true;
                    }
                    node.$path = `${entity}.${id}`;
                    if (action === 'remove') {
                        node.$next = null;
                        if (!alreadyDirtyNode) {
                            // 如果已经更新过的结点就不能再加了，会形成循环
                            this.addToTxnNode(node, context, 'remove');
                        }
                    }
                    else {
                        node.$next = Object.assign(node.$next || {}, data);
                        if (!alreadyDirtyNode) {
                            // 如果已经更新过的结点就不能再加了，会形成循环
                            this.addToTxnNode(node, context, 'update');
                        }
                    }
                }
                return rows.length;
            }
        }
    }
    async selectAbjointRowAsync(entity, selection, context, option) {
        return this.selectAbjointRow(entity, selection, context, option);
    }
    async updateAbjointRowAsync(entity, operation, context, option) {
        return this.updateAbjointRow(entity, operation, context, option);
    }
    operateSync(entity, operation, context, option) {
        (0, assert_1.assert)(context.getCurrentTxnId());
        return super.operateSync(entity, operation, context, option);
    }
    async operateAsync(entity, operation, context, option) {
        (0, assert_1.assert)(context.getCurrentTxnId());
        return super.operateAsync(entity, operation, context, option);
    }
    /**
     * 计算最终结果集当中的函数，这个函数可能测试不够充分
     * @param entity
     * @param projection
     * @param data
     * @param nodeDict
     * @param context
     */
    formExprInResult(entity, projection, data, nodeDict, context) {
        const laterExprDict = {};
        for (const attr in projection) {
            if (attr.startsWith(Demand_1.EXPRESSION_PREFIX)) {
                const ExprNodeTranslator = this.translateExpression(entity, projection[attr], context, {});
                const exprResult = ExprNodeTranslator(data, nodeDict);
                if (typeof exprResult === 'function') {
                    Object.assign(laterExprDict, {
                        [attr]: exprResult,
                    });
                }
                else {
                    Object.assign(data, {
                        [attr]: exprResult,
                    });
                }
            }
            else if (attr === '#id') {
                const nodeId = projection[attr];
                (0, assert_1.assert)(!nodeDict.hasOwnProperty(nodeId), `Filter中的nodeId「${nodeId}」出现了多次`);
                Object.assign(nodeDict, {
                    [nodeId]: data,
                });
            }
        }
        for (const attr in projection) {
            const rel = this.judgeRelation(entity, attr);
            if (rel === 1) {
            }
            else if (rel === 2) {
                if (data[attr]) {
                    this.formExprInResult(attr, projection[attr], data[attr], nodeDict, context);
                }
            }
            else if (typeof rel === 'string') {
                if (data[attr]) {
                    const result2 = {};
                    this.formExprInResult(rel, projection[attr], data[attr], nodeDict, context);
                }
            }
            else if (rel instanceof Array) {
                if (!attr.endsWith('$$aggr')) {
                    if (data[attr] && data[attr] instanceof Array) {
                        data[attr].map((ele) => this.formExprInResult(rel[0], projection[attr].data, ele, nodeDict, context));
                    }
                }
            }
        }
        for (const attr in laterExprDict) {
            const exprResult = laterExprDict[attr](nodeDict);
            // projection是不应出现计算不出来的情况
            (0, assert_1.assert)(typeof exprResult !== 'function', 'data中的expr无法计算，请检查命名与引用的一致性');
            Object.assign(data, {
                [attr]: exprResult,
            });
        }
    }
    formResult(entity, rows, selection, context, option) {
        const { data, sorter, indexFrom, count } = selection;
        const findAvailableExprName = (current) => {
            let counter = 1;
            while (counter < 20) {
                const exprName = `$expr${counter++}`;
                if (!current.includes(exprName)) {
                    return exprName;
                }
            }
            (0, assert_1.assert)(false, '找不到可用的expr命名');
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
                const rel = (0, relation_1.judgeRelation)(this.getSchema(), entity2, attr);
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
                    Object.assign(proj, {
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
        // 先计算projection，formResult只处理abjoint的行，不需要考虑expression和一对多多对一关系
        const rows2 = [];
        const incompletedRowIds = [];
        const { data: projection } = selection;
        for (const row of rows) {
            const result = {};
            for (const attr in projection) {
                const rel = this.judgeRelation(entity, attr);
                if (rel === 1) {
                    if (row[attr] === undefined) {
                        incompletedRowIds.push(row.id);
                        // break;
                    }
                    else if (typeof projection[attr] === 'number') {
                        Object.assign(result, {
                            [attr]: row[attr],
                        });
                    }
                    else {
                        // object数据的深层次select
                        Object.assign(result, {
                            [attr]: {},
                        });
                        const assignIner = (dest, proj, source) => {
                            if (proj instanceof Array) {
                                (0, assert_1.assert)(dest instanceof Array);
                                (0, assert_1.assert)(source instanceof Array);
                                proj.forEach((attr, idx) => {
                                    if (typeof attr === 'number') {
                                        dest[idx] = source[idx];
                                    }
                                    else if (typeof attr === 'object') {
                                        dest[idx] = {};
                                        assignIner(dest[idx], attr, source[idx]);
                                    }
                                });
                            }
                            else {
                                for (const attr in proj) {
                                    if (typeof proj[attr] === 'number') {
                                        dest[attr] = source[attr];
                                    }
                                    else if (typeof proj[attr] === 'object') {
                                        dest[attr] = proj[attr] instanceof Array ? [] : {};
                                        assignIner(dest[attr], proj[attr], source[attr]);
                                    }
                                }
                            }
                        };
                        assignIner(result[attr], projection[attr], row[attr]);
                    }
                }
            }
            // 这三个属性在前台cache中可能表达特殊语义的，需要返回
            if (row[Entity_1.DeleteAtAttribute]) {
                Object.assign(result, {
                    [Entity_1.DeleteAtAttribute]: row[Entity_1.DeleteAtAttribute],
                });
            }
            if (row[Entity_1.UpdateAtAttribute]) {
                Object.assign(result, {
                    [Entity_1.UpdateAtAttribute]: row[Entity_1.UpdateAtAttribute],
                });
            }
            if (row[Entity_1.CreateAtAttribute]) {
                Object.assign(result, {
                    [Entity_1.CreateAtAttribute]: row[Entity_1.CreateAtAttribute],
                });
            }
            rows2.push(result);
        }
        if (incompletedRowIds.length > 0) {
            // 如果有缺失属性的行，则报OakRowUnexistedException错误
            // fixed: 这里不报了。按约定框架应当保证取到要访问的属性
            // fixed: 和外键缺失一样，还是报，上层在知道框架会保证取到的情况下用allowMiss忽略此错误
            if (option?.ignoreAttrMiss) {
                if (process.env.NODE_ENV === 'development') {
                    console.warn(`对象${entity}上有属性缺失，可能会影响上层使用结果，请确定`);
                }
            }
            else {
                throw new Exception_1.OakRowUnexistedException([{
                        entity,
                        selection: {
                            data: projection,
                            filter: {
                                id: {
                                    $in: incompletedRowIds,
                                },
                            },
                        },
                    }]);
            }
        }
        // 再计算sorter
        if (sorter) {
            const sorterFn = this.translateSorter(entity, sorter, context, option);
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
    /**
     * 本函数把结果中的相应属性映射成一个字符串，用于GroupBy
     * @param entity
     * @param row
     * @param projection
     */
    mappingProjectionOnRow(entity, row, projection) {
        let key = '';
        let result = {};
        const values = [];
        const mappingIter = (entity2, row2, p2, result2) => {
            const keys = Object.keys(p2).sort((ele1, ele2) => ele1 < ele2 ? -1 : 1);
            for (const k of keys) {
                const rel = this.judgeRelation(entity2, k);
                if (rel === 2) {
                    result2[k] = {};
                    if (row2[k]) {
                        mappingIter(k, row2[k], p2[k], result2[k]);
                    }
                }
                else if (typeof rel === 'string') {
                    result2[k] = {};
                    if (row2[k]) {
                        mappingIter(rel, row2[k], p2[k], result2[k]);
                    }
                }
                else {
                    (0, assert_1.assert)([0, 1].includes(rel));
                    result2[k] = row2[k];
                    (0, assert_1.assert)(['string', 'number', 'boolean'].includes(typeof row2[k]));
                    key += `${row2[k]}`;
                    values.push(row2[k]);
                }
            }
        };
        mappingIter(entity, row, projection, result);
        return {
            result,
            key,
            values,
        };
    }
    calcAggregation(entity, rows, aggregationData) {
        const ops = Object.keys(aggregationData).filter(ele => ele !== '#aggr');
        const result = {};
        for (const row of rows) {
            for (const op of ops) {
                const { values } = this.mappingProjectionOnRow(entity, row, aggregationData[op]);
                (0, assert_1.assert)(values.length === 1, `聚合运算中，${op}的目标属性多于1个`);
                if (op.startsWith('#max')) {
                    if (![undefined, null].includes(values[0]) && (!result.hasOwnProperty(op) || result[op] < values[0])) {
                        result[op] = values[0];
                    }
                }
                else if (op.startsWith('#min')) {
                    if (![undefined, null].includes(values[0]) && (!result.hasOwnProperty(op) || result[op] > values[0])) {
                        result[op] = values[0];
                    }
                }
                else if (op.startsWith('#sum')) {
                    if (![undefined, null].includes(values[0])) {
                        (0, assert_1.assert)(typeof values[0] === 'number', '只有number类型的属性才可以计算sum');
                        if (!result.hasOwnProperty(op)) {
                            result[op] = values[0];
                        }
                        else {
                            result[op] += values[0];
                        }
                    }
                }
                else if (op.startsWith('#count')) {
                    if (![undefined, null].includes(values[0])) {
                        if (!result.hasOwnProperty(op)) {
                            result[op] = 1;
                        }
                        else {
                            result[op] += 1;
                        }
                    }
                }
                else {
                    (0, assert_1.assert)(op.startsWith('#avg'));
                    if (![undefined, null].includes(values[0])) {
                        (0, assert_1.assert)(typeof values[0] === 'number', '只有number类型的属性才可以计算avg');
                        if (!result.hasOwnProperty(op)) {
                            result[op] = {
                                total: values[0],
                                count: 1,
                            };
                        }
                        else {
                            result[op].total += values[0];
                            result[op].count += 1;
                        }
                    }
                }
            }
        }
        for (const op of ops) {
            if (!result[op]) {
                if (op.startsWith('#count')) {
                    result[op] = 0;
                }
                else {
                    result[op] = null;
                }
            }
            else if (op.startsWith('#avg')) {
                result[op] = result[op].total / result[op].count;
            }
        }
        return result;
    }
    formAggregation(entity, rows, aggregationData) {
        const { "#aggr": aggrExpr } = aggregationData;
        if (aggrExpr) {
            const groups = (0, lodash_1.groupBy)(rows, (row) => {
                const { key } = this.mappingProjectionOnRow(entity, row, aggrExpr);
                return key;
            });
            const result = Object.keys(groups).map((ele) => {
                const aggr = this.calcAggregation(entity, groups[ele], aggregationData);
                const { result: r } = this.mappingProjectionOnRow(entity, groups[ele][0], aggrExpr);
                aggr['#data'] = r;
                return aggr;
            });
            return result;
        }
        const aggr = this.calcAggregation(entity, rows, aggregationData);
        return [aggr];
    }
    selectSync(entity, selection, context, option) {
        (0, assert_1.assert)(context.getCurrentTxnId());
        const result = super.selectSync(entity, selection, context, option);
        // 在这里再计算所有的表达式
        result.forEach((ele) => this.formExprInResult(entity, selection.data, ele, {}, context));
        return result;
    }
    async selectAsync(entity, selection, context, option) {
        (0, assert_1.assert)(context.getCurrentTxnId());
        const result = await super.selectAsync(entity, selection, context, option);
        // 在这里再计算所有的表达式
        result.forEach((ele) => this.formExprInResult(entity, selection.data, ele, {}, context));
        return result;
    }
    aggregateAbjointRowSync(entity, aggregation, context, option) {
        (0, assert_1.assert)(context.getCurrentTxnId());
        const { data, filter, sorter, indexFrom, count } = aggregation;
        const p = {};
        for (const k in data) {
            Object.assign(p, (0, lodash_1.cloneDeep)(data[k]));
        }
        const selection = {
            data: p,
            filter,
            sorter,
            indexFrom,
            count,
        };
        const result = this.cascadeSelect(entity, selection, context, Object.assign({}, option, {
            dontCollect: true,
        }));
        // 在这里再计算所有的表达式
        result.forEach((ele) => this.formExprInResult(entity, selection.data, ele, {}, context));
        // 最后计算Aggregation
        return this.formAggregation(entity, result, aggregation.data);
    }
    async aggregateAbjointRowAsync(entity, aggregation, context, option) {
        (0, assert_1.assert)(context.getCurrentTxnId());
        const { data, filter, sorter, indexFrom, count } = aggregation;
        const p = {};
        for (const k in data) {
            Object.assign(p, (0, lodash_1.cloneDeep)(data[k]));
        }
        const selection = {
            data: p,
            filter,
            sorter,
            indexFrom,
            count,
        };
        const result = await this.cascadeSelectAsync(entity, selection, context, Object.assign({}, option, {
            dontCollect: true,
        }));
        // 在这里再计算所有的表达式
        result.forEach((ele) => this.formExprInResult(entity, selection.data, ele, {}, context));
        // 最后计算Aggregation
        return this.formAggregation(entity, result, aggregation.data);
    }
    countSync(entity, selection, context, option) {
        const selection2 = Object.assign({}, selection, {
            data: {
                id: 1,
            },
        });
        const result = this.selectSync(entity, selection2, context, Object.assign({}, option, {
            dontCollect: true,
        }));
        return typeof selection.count === 'number' ? Math.min(result.length, selection.count) : result.length;
    }
    async countAsync(entity, selection, context, option) {
        const selection2 = Object.assign({}, selection, {
            data: {
                id: 1,
            },
        });
        const result = await this.selectAsync(entity, selection2, context, Object.assign({}, option, {
            dontCollect: true,
        }));
        return typeof selection.count === 'number' && selection.count > 0 ? Math.min(result.length, selection.count) : result.length;
    }
    addToTxnNode(node, context, action) {
        const txnNode = this.activeTxnDict[context.getCurrentTxnId()];
        (0, assert_1.assert)(txnNode);
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
    beginSync() {
        const uuid = `${Math.random()}`;
        (0, assert_1.assert)(!this.activeTxnDict.hasOwnProperty(uuid));
        Object.assign(this.activeTxnDict, {
            [uuid]: {
                create: 0,
                update: 0,
                remove: 0,
                waitList: [],
            },
        });
        return uuid;
    }
    commitCallbacks = [];
    onCommit(callback) {
        this.commitCallbacks.push(callback);
        return () => (0, lodash_1.pull)(this.commitCallbacks, callback);
    }
    addToOperationResult(result, entity, action) {
        if (result[entity]) {
            if (result[entity][action]) {
                result[entity][action]++;
            }
            else {
                Object.assign(result[entity], {
                    [action]: 1,
                });
            }
        }
        else {
            Object.assign(result, {
                [entity]: {
                    [action]: 1,
                },
            });
        }
    }
    commitLogic(uuid) {
        (0, assert_1.assert)(this.activeTxnDict.hasOwnProperty(uuid), uuid);
        let node = this.activeTxnDict[uuid].nodeHeader;
        const result = {};
        while (node) {
            const node2 = node.$nextNode;
            if (node.$txnId === uuid) {
                (0, assert_1.assert)(node.$path);
                const entity = node.$path?.split('.')[0];
                if (node.$next) {
                    // create/update
                    node.$current = Object.assign(node.$current || {}, node.$next);
                    if (node.$current) {
                        this.addToOperationResult(result, entity, 'create');
                    }
                    else {
                        this.addToOperationResult(result, entity, 'update');
                    }
                    (0, lodash_1.unset)(node, '$txnId');
                    (0, lodash_1.unset)(node, '$next');
                    (0, lodash_1.unset)(node, '$path');
                    (0, lodash_1.unset)(node, '$nextNode');
                }
                else {
                    // remove
                    this.addToOperationResult(result, entity, 'remove');
                    (0, lodash_1.unset)(this.store, node.$path);
                    (0, lodash_1.unset)(node, '$txnId');
                }
            }
            else {
                // 同一行被同一事务更新多次
                (0, assert_1.assert)(node.$txnId === undefined);
            }
            node = node2;
        }
        if (this.activeTxnDict[uuid].create || this.activeTxnDict[uuid].update || this.activeTxnDict[uuid].remove) {
            this.stat.create += this.activeTxnDict[uuid].create;
            this.stat.update += this.activeTxnDict[uuid].update;
            this.stat.remove += this.activeTxnDict[uuid].remove;
            this.stat.commit++;
        }
        // 唤起等待者
        for (const waiter of this.activeTxnDict[uuid].waitList) {
            waiter.fn();
        }
        (0, lodash_1.unset)(this.activeTxnDict, uuid);
        return result;
    }
    commitSync(uuid) {
        const result = this.commitLogic(uuid);
        // 这里无法等待callback完成，callback最好自身保证顺序（前端cache应当具备的特征）
        this.commitCallbacks.forEach(callback => callback(result));
    }
    rollbackSync(uuid) {
        (0, assert_1.assert)(this.activeTxnDict.hasOwnProperty(uuid));
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
                    (0, assert_1.assert)(node.$path);
                    (0, lodash_1.unset)(this.store, node.$path);
                    (0, lodash_1.unset)(node, '$txnId');
                }
            }
            else {
                // 该结点被同一事务反复处理
                (0, assert_1.assert)(node.$txnId === undefined);
            }
            node = node2;
        }
        // 唤起等待者
        for (const waiter of this.activeTxnDict[uuid].waitList) {
            waiter.fn();
        }
        (0, lodash_1.unset)(this.activeTxnDict, uuid);
    }
    async beginAsync() {
        return this.beginSync();
    }
    async commitAsync(uuid) {
        const result = this.commitLogic(uuid);
        for (const fn of this.commitCallbacks) {
            await fn(result);
        }
    }
    async rollbackAsync(uuid) {
        return this.rollbackSync(uuid);
    }
    // 将输入的OpRecord同步到数据中
    sync(opRecords, context, option) {
        const option2 = Object.assign({}, option, {
            dontCollect: true,
            dontCreateOper: true,
        });
        const result = {};
        for (const record of opRecords) {
            switch (record.a) {
                case 'c': {
                    const { e, d } = record;
                    if (d instanceof Array) {
                        for (const dd of d) {
                            if (this.store[e] && this.store[e][dd.id]) {
                                this.updateAbjointRow(e, {
                                    id: 'dummy',
                                    action: 'update',
                                    data: dd,
                                    filter: {
                                        id: dd.id,
                                    },
                                }, context, option2);
                                this.addToOperationResult(result, e, 'update');
                            }
                            else {
                                this.updateAbjointRow(e, {
                                    id: 'dummy',
                                    action: 'create',
                                    data: dd,
                                }, context, option2);
                                this.addToOperationResult(result, e, 'create');
                            }
                        }
                    }
                    else {
                        if (this.store[e] && this.store[e][d.id]) {
                            this.updateAbjointRow(e, {
                                id: 'dummy',
                                action: 'update',
                                data: d,
                                filter: {
                                    id: d.id,
                                },
                            }, context, option2);
                            this.addToOperationResult(result, e, 'update');
                        }
                        else {
                            this.updateAbjointRow(e, {
                                id: 'dummy',
                                action: 'create',
                                data: d,
                            }, context, option2);
                            this.addToOperationResult(result, e, 'create');
                        }
                    }
                    break;
                }
                case 'u': {
                    const { e, d, f } = record;
                    this.updateAbjointRow(e, {
                        id: 'dummy',
                        action: 'update',
                        data: d,
                        filter: f,
                    }, context, option2);
                    this.addToOperationResult(result, e, 'update');
                    break;
                }
                case 'r': {
                    const { e, f } = record;
                    this.updateAbjointRow(e, {
                        id: 'dummy',
                        action: 'remove',
                        data: {},
                        filter: f,
                    }, context, option2);
                    this.addToOperationResult(result, e, 'remove');
                    break;
                }
                case 's': {
                    const { d } = record;
                    for (const entity in d) {
                        for (const id in d[entity]) {
                            if (this.store[entity] && this.store[entity][id]) {
                                this.updateAbjointRow(entity, {
                                    id: 'dummy',
                                    action: 'update',
                                    data: d[entity][id],
                                    filter: {
                                        id,
                                    },
                                }, context, option2);
                                this.addToOperationResult(result, entity, 'update');
                            }
                            else {
                                this.updateAbjointRow(entity, {
                                    id: 'dummy',
                                    action: 'create',
                                    data: d[entity][id],
                                }, context, option2);
                                this.addToOperationResult(result, entity, 'create');
                            }
                        }
                    }
                    break;
                }
                default: {
                    (0, assert_1.assert)(false);
                }
            }
        }
        // 在txn提交时应该call过了，这里看上去是多余的
        /*  this.commitCallbacks.forEach(
             callback => callback(result)
         ); */
    }
}
exports.default = TreeStore;
