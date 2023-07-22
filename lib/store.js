"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var lodash_1 = require("oak-domain/lib/utils/lodash");
var assert_1 = require("oak-domain/lib/utils/assert");
var Entity_1 = require("oak-domain/lib/types/Entity");
var Demand_1 = require("oak-domain/lib/types/Demand");
var Exception_1 = require("oak-domain/lib/types/Exception");
var Demand_2 = require("oak-domain/lib/types/Demand");
var relation_1 = require("oak-domain/lib/store/relation");
var Expression_1 = require("oak-domain/lib/types/Expression");
var CascadeStore_1 = require("oak-domain/lib/store/CascadeStore");
;
;
function obscurePass(value, option) {
    return !!((option === null || option === void 0 ? void 0 : option.obscure) && value === undefined);
}
var OakExpressionUnresolvedException = /** @class */ (function (_super) {
    tslib_1.__extends(OakExpressionUnresolvedException, _super);
    function OakExpressionUnresolvedException() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    return OakExpressionUnresolvedException;
}(Exception_1.OakException));
;
var TreeStore = /** @class */ (function (_super) {
    tslib_1.__extends(TreeStore, _super);
    function TreeStore(storageSchema) {
        var _this = _super.call(this, storageSchema) || this;
        _this.store = {};
        _this.activeTxnDict = {};
        _this.stat = {
            create: 0,
            update: 0,
            remove: 0,
            commit: 0,
        };
        return _this;
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
    TreeStore.prototype.supportMultipleCreate = function () {
        return false;
    };
    TreeStore.prototype.supportManyToOneJoin = function () {
        return false;
    };
    TreeStore.prototype.resetInitialData = function (data, stat) {
        var e_1, _a, _b;
        this.store = {};
        var now = Date.now();
        for (var entity in data) {
            var attributes = this.getSchema()[entity].attributes;
            this.store[entity] = {};
            try {
                for (var _c = (e_1 = void 0, tslib_1.__values(data[entity])), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var row = _d.value;
                    for (var key in attributes) {
                        if (row[key] === undefined) {
                            Object.assign(row, (_b = {},
                                _b[key] = null,
                                _b));
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
                        Object.assign(row, {
                            $$seq$$: "".concat(Math.ceil((Math.random() + 1000) * 100)),
                        });
                    }
                    (0, assert_1.assert)(row.id && !row.id.includes('.'));
                    (0, lodash_1.set)(this.store, "".concat(entity, ".").concat(row.id, ".$current"), row);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                }
                finally { if (e_1) throw e_1.error; }
            }
        }
        if (stat) {
            this.stat = stat;
        }
    };
    TreeStore.prototype.getCurrentData = function () {
        var _a;
        var result = {};
        for (var entity in this.store) {
            result[entity] = [];
            for (var rowId in this.store[entity]) {
                (_a = result[entity]) === null || _a === void 0 ? void 0 : _a.push(this.store[entity][rowId]['$current']);
            }
        }
        return result;
    };
    TreeStore.prototype.constructRow = function (node, context, option) {
        var _a, _b, _c;
        var data = (0, lodash_1.cloneDeep)(node.$current);
        if (context.getCurrentTxnId() && node.$txnId === context.getCurrentTxnId()) {
            if (!node.$next) {
                // 如果要求返回delete数据，返回带$$deleteAt$$的行
                if (option === null || option === void 0 ? void 0 : option.includedDeleted) {
                    return Object.assign({}, data, (_a = {},
                        _a[Entity_1.DeleteAtAttribute] = 1,
                        _a));
                }
                return null;
            }
            else if (!node.$current) {
                // 本事务创建的，$$createAt$$和$$updateAt$$置为1
                return Object.assign({}, data, node.$next, (_b = {},
                    _b[Entity_1.CreateAtAttribute] = 1,
                    _b[Entity_1.UpdateAtAttribute] = 1,
                    _b));
            }
            else {
                // 本事务更新的，$$updateAt$$置为1
                return Object.assign({}, data, node.$next, (_c = {},
                    _c[Entity_1.UpdateAtAttribute] = 1,
                    _c));
            }
        }
        return data;
    };
    TreeStore.prototype.translateLogicFilter = function (entity, filter, attr, context, option) {
        var _this = this;
        switch (attr) {
            case '$and': {
                var filters = filter[attr];
                var fns_1 = filters.map(function (ele) { return _this.translateFilter(entity, ele, context, option); });
                return function (node, nodeDict, exprResolveFns) {
                    var e_2, _a;
                    try {
                        for (var fns_2 = tslib_1.__values(fns_1), fns_2_1 = fns_2.next(); !fns_2_1.done; fns_2_1 = fns_2.next()) {
                            var fn = fns_2_1.value;
                            if (!fn(node, nodeDict, exprResolveFns)) {
                                return false;
                            }
                        }
                    }
                    catch (e_2_1) { e_2 = { error: e_2_1 }; }
                    finally {
                        try {
                            if (fns_2_1 && !fns_2_1.done && (_a = fns_2.return)) _a.call(fns_2);
                        }
                        finally { if (e_2) throw e_2.error; }
                    }
                    return true;
                };
            }
            case '$or': {
                var filters = filter[attr];
                var fns_3 = filters.map(function (ele) { return _this.translateFilter(entity, ele, context, option); });
                return function (node, nodeDict, exprResolveFns) {
                    var e_3, _a;
                    try {
                        for (var fns_4 = tslib_1.__values(fns_3), fns_4_1 = fns_4.next(); !fns_4_1.done; fns_4_1 = fns_4.next()) {
                            var fn = fns_4_1.value;
                            if (fn(node, nodeDict, exprResolveFns)) {
                                return true;
                            }
                        }
                    }
                    catch (e_3_1) { e_3 = { error: e_3_1 }; }
                    finally {
                        try {
                            if (fns_4_1 && !fns_4_1.done && (_a = fns_4.return)) _a.call(fns_4);
                        }
                        finally { if (e_3) throw e_3.error; }
                    }
                    return false;
                };
            }
            case '$not': {
                var filter2 = filter[attr];
                var fn_1 = this.translateFilter(entity, filter2, context, option);
                return function (node, nodeDict, exprResolveFns) {
                    if (fn_1(node, nodeDict, exprResolveFns)) {
                        return false;
                    }
                    return true;
                };
            }
            default: {
                (0, assert_1.assert)(false, "".concat(attr, "\u7B97\u5B50\u6682\u4E0D\u652F\u6301"));
            }
        }
    };
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
    TreeStore.prototype.translateExpressionNode = function (entity, expression, context, option) {
        var _this = this;
        if ((0, Expression_1.isExpression)(expression)) {
            var op_1 = Object.keys(expression)[0];
            var option2_1 = expression[op_1];
            if ((0, Expression_1.opMultipleParams)(op_1)) {
                var paramsTranslated_1 = option2_1.map(function (ele) { return _this.translateExpressionNode(entity, ele, context, option2_1); });
                return function (row, nodeDict) {
                    var later = false;
                    var results = paramsTranslated_1.map(function (ele) {
                        if (typeof ele === 'function') {
                            var r = ele(row, nodeDict);
                            if (typeof r === 'function') {
                                later = true;
                            }
                            return r;
                        }
                        return ele;
                    });
                    if (!later) {
                        return (0, Expression_1.execOp)(op_1, results, option2_1.obscure);
                    }
                    var laterCheckFn = function (nodeDict2) {
                        results = results.map(function (ele) {
                            if (typeof ele === 'function') {
                                var r = ele(nodeDict2);
                                return r;
                            }
                            return ele;
                        });
                        if (results.find(function (ele) { return typeof ele === 'function'; })) {
                            return laterCheckFn;
                        }
                        return (0, Expression_1.execOp)(op_1, results, option && option.obscure);
                    };
                    return laterCheckFn;
                };
            }
            else {
                var paramsTranslated_2 = this.translateExpressionNode(entity, option2_1, context, option2_1);
                if (typeof paramsTranslated_2 === 'function') {
                    return function (row, nodeDict) {
                        var result = paramsTranslated_2(row, nodeDict);
                        if (typeof result === 'function') {
                            var laterCheckFn_1 = function (nodeDict2) {
                                result = result(nodeDict2);
                                if (typeof result === 'function') {
                                    return laterCheckFn_1;
                                }
                                return result;
                            };
                            return laterCheckFn_1;
                        }
                        return (0, Expression_1.execOp)(op_1, result, option2_1.obscure);
                    };
                }
                else {
                    return function () {
                        return (0, Expression_1.execOp)(op_1, paramsTranslated_2, option2_1.obscure);
                    };
                }
            }
        }
        else if ((0, Demand_2.isRefAttrNode)(expression)) {
            // 是RefAttr结点
            return function (row, nodeDict) {
                if (expression.hasOwnProperty('#attr')) {
                    // 说明是本结点的属性;
                    return row[expression['#attr']];
                }
                else {
                    (0, assert_1.assert)(expression.hasOwnProperty('#refId'));
                    var _a = expression, refId_1 = _a["#refId"], refAttr_1 = _a["#refAttr"];
                    if (nodeDict.hasOwnProperty(refId_1)) {
                        return nodeDict[refId_1][refAttr_1];
                    }
                    // 引用的结点还没有取到，此时需要在未来的某个时刻再检查
                    var laterCheckFn_2 = function (nodeDict2) {
                        if (nodeDict2.hasOwnProperty(refId_1)) {
                            return nodeDict2[refId_1][refAttr_1];
                        }
                        return laterCheckFn_2;
                    };
                    return laterCheckFn_2;
                }
            };
        }
        else {
            // 是常量结点
            return expression;
        }
    };
    TreeStore.prototype.translateExpression = function (entity, expression, context, option) {
        var expr = this.translateExpressionNode(entity, expression, context, option);
        return function (row, nodeDict) {
            if (typeof expr !== 'function') {
                return expr;
            }
            var result = expr(row, nodeDict);
            return result;
        };
    };
    TreeStore.prototype.translateFulltext = function (entity, filter, context, option) {
        var _this = this;
        // 全文索引查找
        var _a = this.getSchema(), _b = entity, indexes = _a[_b].indexes;
        var fulltextIndex = indexes.find(function (ele) { return ele.config && ele.config.type === 'fulltext'; });
        var attributes = fulltextIndex.attributes;
        var $search = filter.$search;
        return function (node) {
            var e_4, _a;
            var row = _this.constructRow(node, context, option);
            try {
                for (var attributes_1 = tslib_1.__values(attributes), attributes_1_1 = attributes_1.next(); !attributes_1_1.done; attributes_1_1 = attributes_1.next()) {
                    var attr = attributes_1_1.value;
                    var name_1 = attr.name;
                    if (row && row[name_1] && (typeof row[name_1] === 'string' && row[name_1].includes($search) || obscurePass(row[name_1], option))) {
                        return true;
                    }
                }
            }
            catch (e_4_1) { e_4 = { error: e_4_1 }; }
            finally {
                try {
                    if (attributes_1_1 && !attributes_1_1.done && (_a = attributes_1.return)) _a.call(attributes_1);
                }
                finally { if (e_4) throw e_4.error; }
            }
            return false;
        };
    };
    TreeStore.prototype.translatePredicate = function (path, predicate, value, option) {
        switch (predicate) {
            case '$gt': {
                return function (row) {
                    var data = (0, lodash_1.get)(row, path);
                    return data > value || obscurePass(data, option);
                };
            }
            case '$lt': {
                return function (row) {
                    var data = (0, lodash_1.get)(row, path);
                    return data < value || obscurePass(data, option);
                };
            }
            case '$gte': {
                return function (row) {
                    var data = (0, lodash_1.get)(row, path);
                    return data >= value || obscurePass(data, option);
                };
            }
            case '$lte': {
                return function (row) {
                    var data = (0, lodash_1.get)(row, path);
                    return data <= value || obscurePass(data, option);
                };
            }
            case '$eq': {
                return function (row) {
                    var data = (0, lodash_1.get)(row, path);
                    return data === value || obscurePass(data, option);
                };
            }
            case '$ne': {
                return function (row) {
                    var data = (0, lodash_1.get)(row, path);
                    return data !== value || obscurePass(data, option);
                };
            }
            case '$between': {
                return function (row) {
                    var data = (0, lodash_1.get)(row, path);
                    return data >= value[0] && data <= value[1] || obscurePass(data, option);
                };
            }
            case '$startsWith': {
                return function (row) {
                    var data = (0, lodash_1.get)(row, path);
                    return data.startsWith(value) || obscurePass(data, option);
                };
            }
            case '$endsWith': {
                return function (row) {
                    var data = (0, lodash_1.get)(row, path);
                    return data.endsWith(value) || obscurePass(data, option);
                };
            }
            case '$includes': {
                return function (row) {
                    var data = (0, lodash_1.get)(row, path);
                    return data.includes(value) || obscurePass(data, option);
                };
            }
            case '$exists': {
                (0, assert_1.assert)(typeof value === 'boolean');
                return function (row) {
                    var data = (0, lodash_1.get)(row, path);
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
                return function (row) {
                    var data = (0, lodash_1.get)(row, path);
                    return value.includes(data) || obscurePass(data, option);
                };
            }
            case '$nin': {
                (0, assert_1.assert)(value instanceof Array);
                return function (row) {
                    var data = (0, lodash_1.get)(row, path);
                    return !value.includes(data) || obscurePass(data, option);
                };
            }
            case '$contains': {
                // json中的多值查询
                var array_1 = value instanceof Array ? value : [value];
                return function (row) {
                    var data = (0, lodash_1.get)(row, path);
                    return (0, lodash_1.difference)(array_1, data).length === 0 || obscurePass(data, option);
                };
            }
            case '$overlaps': {
                // json中的多值查询
                var array_2 = value instanceof Array ? value : [value];
                return function (row) {
                    var data = (0, lodash_1.get)(row, path);
                    return (0, lodash_1.intersection)(array_2, data).length > 0 || obscurePass(data, option);
                };
            }
            default: {
                throw new Error("predicate ".concat(predicate, " is not recoganized"));
            }
        }
    };
    TreeStore.prototype.translateObjectPredicate = function (filter) {
        var _this = this;
        var fns = [];
        var translatePredicateInner = function (p, path) {
            var predicate = Object.keys(p)[0];
            if (predicate.startsWith('$')) {
                (0, assert_1.assert)(Object.keys(p).length === 1);
                fns.push(_this.translatePredicate(path, predicate, p[predicate]));
            }
            else {
                if (p instanceof Array) {
                    p.forEach(function (ele, idx) {
                        var path2 = "".concat(path, "[").concat(idx, "]");
                        if (typeof ele !== 'object') {
                            if (![null, undefined].includes(ele)) {
                                fns.push(_this.translatePredicate(path2, '$eq', ele));
                            }
                        }
                        else {
                            translatePredicateInner(ele, path2);
                        }
                    });
                }
                else {
                    for (var attr in p) {
                        var path2 = path ? "".concat(path, ".").concat(attr) : attr;
                        if (typeof p[attr] !== 'object') {
                            fns.push(_this.translatePredicate(path2, '$eq', filter[attr]));
                        }
                        else {
                            translatePredicateInner(p[attr], path2);
                        }
                    }
                }
            }
        };
        translatePredicateInner(filter, '');
        return function (value) {
            var e_5, _a;
            try {
                for (var fns_5 = tslib_1.__values(fns), fns_5_1 = fns_5.next(); !fns_5_1.done; fns_5_1 = fns_5.next()) {
                    var fn = fns_5_1.value;
                    if (!fn(value)) {
                        return false;
                    }
                }
            }
            catch (e_5_1) { e_5 = { error: e_5_1 }; }
            finally {
                try {
                    if (fns_5_1 && !fns_5_1.done && (_a = fns_5.return)) _a.call(fns_5);
                }
                finally { if (e_5) throw e_5.error; }
            }
            return true;
        };
    };
    TreeStore.prototype.translateAttribute = function (entity, filter, attr, context, option) {
        var _this = this;
        var _a;
        // 如果是模糊查询且该属性为undefined，说明没取到，返回true
        function obscurePassLocal(row) {
            return obscurePass(row[attr], option);
        }
        if (typeof filter !== 'object') {
            return function (node) {
                var row = _this.constructRow(node, context, option);
                return row ? row[attr] === filter || obscurePassLocal(row) : false;
            };
        }
        else {
            var predicate = Object.keys(filter)[0];
            if (predicate.startsWith('$')) {
                if (['$in', '$nin'].includes(predicate) && !(filter[predicate] instanceof Array)) {
                    throw new Error('子查询已经改用一对多的外键连接方式');
                    var inData_1 = filter[predicate];
                    if (predicate === '$in') {
                        // 如果是obscure，则返回的集合中有没有都不能否决“可能有”，所以可以直接返回true
                        if (option === null || option === void 0 ? void 0 : option.obscure) {
                            return function () { return true; };
                        }
                        else {
                            // 这里只有当子查询中的filter不包含引用外部的子查询时才可以提前计算，否则必须等到执行时再计算
                            // 子查询查询的行不用返回，和数据库的行为保持一致
                            try {
                                var legalSets_1 = (this.selectAbjointRow(inData_1.entity, inData_1, context, { dontCollect: true })).map(function (ele) {
                                    var data = inData_1.data;
                                    var key = Object.keys(data)[0];
                                    return ele[key];
                                });
                                return function (node) {
                                    var row = _this.constructRow(node, context, option);
                                    if (!row) {
                                        return false;
                                    }
                                    return legalSets_1.includes(row[attr]);
                                };
                            }
                            catch (err) {
                                if (err instanceof OakExpressionUnresolvedException) {
                                    return function (node, nodeDict) {
                                        var row = _this.constructRow(node, context, option);
                                        if (!row) {
                                            return false;
                                        }
                                        var option2 = Object.assign({}, option, { nodeDict: nodeDict });
                                        var legalSets = _this.selectAbjointRow(inData_1.entity, inData_1, context, option2).map(function (ele) {
                                            var data = inData_1.data;
                                            var key = Object.keys(data)[0];
                                            return ele[key];
                                        });
                                        return legalSets.includes(row[attr]);
                                    };
                                }
                                else {
                                    throw err;
                                }
                            }
                        }
                    }
                    else {
                        // obscure对nin没有影响，如果返回的子查询结果中包含此行就一定是false，否则一定为true（obscure只考虑数据不完整，不考虑不准确），但若相应属性为undefined则任然可以认为true
                        // 这里只有当子查询中的filter不包含引用外部的子查询时才可以提前计算，否则必须等到执行时再计算
                        // 子查询查询的行不用返回，和数据库的行为保持一致
                        try {
                            var legalSets_2 = this.selectAbjointRow(inData_1.entity, inData_1, context, { dontCollect: true }).map(function (ele) {
                                var data = inData_1.data;
                                var key = Object.keys(data)[0];
                                return ele[key];
                            });
                            return function (node) {
                                var row = _this.constructRow(node, context, option);
                                if (!row) {
                                    return false;
                                }
                                return !legalSets_2.includes(row[attr]) || obscurePassLocal(row);
                            };
                        }
                        catch (err) {
                            if (err instanceof OakExpressionUnresolvedException) {
                                return function (node, nodeDict) {
                                    var row = _this.constructRow(node, context, option);
                                    if (!row) {
                                        return false;
                                    }
                                    var option2 = Object.assign({}, option, { nodeDict: nodeDict });
                                    var legalSets = _this.selectAbjointRow(inData_1.entity, inData_1, context, option2).map(function (ele) {
                                        var data = inData_1.data;
                                        var key = Object.keys(data)[0];
                                        return ele[key];
                                    });
                                    return !legalSets.includes(row[attr]) || obscurePassLocal(row);
                                };
                            }
                            else {
                                throw err;
                            }
                        }
                    }
                }
                else {
                    var fn_2 = this.translatePredicate(attr, predicate, filter[predicate], option);
                    return function (node) {
                        var row = _this.constructRow(node, context, option);
                        if (!row) {
                            return false;
                        }
                        return fn_2(row);
                    };
                }
            }
            else {
                // 对象的内部查询
                (0, assert_1.assert)(((_a = this.getSchema()[entity].attributes[attr]) === null || _a === void 0 ? void 0 : _a.type) === 'object');
                var fn_3 = this.translateObjectPredicate(filter);
                return function (node) {
                    var row = _this.constructRow(node, context, option);
                    if (!row) {
                        return false;
                    }
                    return fn_3(row[attr]) || obscurePassLocal(row);
                };
            }
        }
    };
    TreeStore.prototype.translateFilter = function (entity, filter, context, option) {
        var _this = this;
        var fns = [];
        var nodeId;
        var _loop_1 = function (attr) {
            var _a;
            if (attr === '#id') {
                nodeId = filter['#id'];
            }
            else if (['$and', '$or', '$xor', '$not'].includes(attr)) {
                fns.push(this_1.translateLogicFilter(entity, filter, attr, context, option));
            }
            else if (attr.toLowerCase().startsWith(Demand_1.EXPRESSION_PREFIX)) {
                var fn_4 = this_1.translateExpression(entity, filter[attr], context, option);
                fns.push(function (node, nodeDict, exprResolveFns) {
                    var row = _this.constructRow(node, context, option);
                    if (!row) {
                        return false;
                    }
                    var result = fn_4(row, nodeDict);
                    if (typeof result === 'function') {
                        exprResolveFns.push(result);
                    }
                    return !!result;
                });
            }
            else if (attr.toLowerCase() === '$text') {
                fns.push(this_1.translateFulltext(entity, filter[attr], context, option));
            }
            else {
                // 属性级过滤
                var relation_2 = (0, relation_1.judgeRelation)(this_1.getSchema(), entity, attr);
                if (relation_2 === 1) {
                    // 行本身的属性
                    fns.push(this_1.translateAttribute(entity, filter[attr], attr, context, option));
                }
                else if (relation_2 === 2) {
                    // 基于entity/entityId的指针
                    var fn_5 = this_1.translateFilter(attr, filter[attr], context, option);
                    fns.push(function (node, nodeDict, exprResolveFns) {
                        var row = _this.constructRow(node, context, option);
                        if (obscurePass(row.entity, option) || obscurePass(row.entityId, option)) {
                            return true;
                        }
                        if (row.entity !== attr || !row.entityId) {
                            return false;
                        }
                        var node2 = (0, lodash_1.get)(_this.store, "".concat(attr, ".").concat(row.entityId));
                        if (!node2) {
                            if (option === null || option === void 0 ? void 0 : option.obscure) {
                                return true;
                            }
                            return false;
                        }
                        return fn_5(node2, nodeDict, exprResolveFns);
                    });
                }
                else if (typeof relation_2 === 'string') {
                    // 只能是基于普通属性的外键
                    var fn_6 = this_1.translateFilter(relation_2, filter[attr], context, option);
                    fns.push(function (node, nodeDict, exprResolveFns) {
                        var row = _this.constructRow(node, context, option);
                        if (obscurePass(row["".concat(attr, "Id")], option)) {
                            return true;
                        }
                        if (row["".concat(attr, "Id")]) {
                            var node2 = (0, lodash_1.get)(_this.store, "".concat(relation_2, ".").concat(row["".concat(attr, "Id")]));
                            if (!node2) {
                                if (option === null || option === void 0 ? void 0 : option.obscure) {
                                    return true;
                                }
                                return false;
                            }
                            return fn_6(node2, nodeDict, exprResolveFns);
                        }
                        return false;
                    });
                }
                else if (relation_2 instanceof Array) {
                    // 一对多的子查询
                    var _b = tslib_1.__read(relation_2, 2), otmEntity_1 = _b[0], otmForeignKey = _b[1];
                    var predicate_1 = filter[attr][Demand_1.SUB_QUERY_PREDICATE_KEYWORD] || 'in';
                    if (option === null || option === void 0 ? void 0 : option.obscure) {
                        // 如果是obscure，则返回的集合中有没有都不能否决“可能有”或“并不全部是”，所以可以直接返回true
                        if (['in', 'not all'].includes(predicate_1)) {
                            fns.push(function () { return true; });
                            return "continue";
                        }
                    }
                    var fk_1 = otmForeignKey || 'entityId';
                    var otmProjection_1 = (_a = {},
                        _a[fk_1] = 1,
                        _a);
                    var otmFilter_1 = !otmForeignKey ? Object.assign({
                        entity: entity,
                    }, filter[attr]) : filter[attr];
                    try {
                        var subQuerySet_1 = (this_1.selectAbjointRow(otmEntity_1, {
                            data: otmProjection_1,
                            filter: otmFilter_1,
                        }, context, { dontCollect: true })).map(function (ele) {
                            return (ele)[fk_1];
                        });
                        fns.push(function (node) {
                            var row = _this.constructRow(node, context, option);
                            if (!row) {
                                return false;
                            }
                            switch (predicate_1) {
                                case 'in': {
                                    return subQuerySet_1.includes(row.id);
                                }
                                case 'not in': {
                                    return !subQuerySet_1.includes(row.id);
                                }
                                case 'all': {
                                    return !subQuerySet_1.find(function (ele) { return ele !== row.id; });
                                }
                                case 'not all': {
                                    return !!subQuerySet_1.find(function (ele) { return ele !== row.id; });
                                }
                                default: {
                                    throw new Error("illegal sqp: ".concat(predicate_1));
                                }
                            }
                        });
                    }
                    catch (err) {
                        if (err instanceof OakExpressionUnresolvedException) {
                            fns.push(function (node, nodeDict) {
                                var row = _this.constructRow(node, context, option);
                                if (!row) {
                                    return false;
                                }
                                var option2 = Object.assign({}, option, { nodeDict: nodeDict, dontCollect: true });
                                var subQuerySet = (_this.selectAbjointRow(otmEntity_1, {
                                    data: otmProjection_1,
                                    filter: otmFilter_1,
                                }, context, option2)).map(function (ele) {
                                    return (ele)[fk_1];
                                });
                                switch (predicate_1) {
                                    case 'in': {
                                        return subQuerySet.includes(row.id);
                                    }
                                    case 'not in': {
                                        return !subQuerySet.includes(row.id);
                                    }
                                    case 'all': {
                                        return !subQuerySet.find(function (ele) { return ele !== row.id; });
                                    }
                                    case 'not all': {
                                        return !!subQuerySet.find(function (ele) { return ele !== row.id; });
                                    }
                                    default: {
                                        throw new Error("illegal sqp: ".concat(predicate_1));
                                    }
                                }
                            });
                        }
                        else {
                            throw err;
                        }
                    }
                }
                else {
                    // metadata
                    (0, assert_1.assert)(relation_2 === 0);
                }
            }
        };
        var this_1 = this;
        for (var attr in filter) {
            _loop_1(attr);
        }
        return function (node, nodeDict, exprResolveFns) {
            var _a, e_6, _b;
            if (nodeId) {
                (0, assert_1.assert)(!nodeDict.hasOwnProperty(nodeId), "Filter\u4E2D\u7684nodeId\u300C".concat(nodeId, "\u300D\u51FA\u73B0\u4E86\u591A\u6B21"));
                Object.assign(nodeDict, (_a = {},
                    _a[nodeId] = _this.constructRow(node, context, option),
                    _a));
            }
            var row = _this.constructRow(node, context, option);
            if (!row) {
                return false;
            }
            try {
                for (var fns_6 = tslib_1.__values(fns), fns_6_1 = fns_6.next(); !fns_6_1.done; fns_6_1 = fns_6.next()) {
                    var fn = fns_6_1.value;
                    if (!fn(node, nodeDict, exprResolveFns)) {
                        return false;
                    }
                }
            }
            catch (e_6_1) { e_6 = { error: e_6_1 }; }
            finally {
                try {
                    if (fns_6_1 && !fns_6_1.done && (_b = fns_6.return)) _b.call(fns_6);
                }
                finally { if (e_6) throw e_6.error; }
            }
            return true;
        };
    };
    TreeStore.prototype.translateSorter = function (entity, sorter, context, option) {
        var _this = this;
        var compare = function (row1, row2, entity2, sortAttr, direction) {
            var row11 = row1;
            var row22 = row2;
            (0, assert_1.assert)(Object.keys(sortAttr).length === 1);
            var attr = Object.keys(sortAttr)[0];
            var relation = (0, relation_1.judgeRelation)(_this.getSchema(), entity2, attr);
            if (relation === 1 || relation === 0) {
                var getAttrOrExprValue = function (r) {
                    if (sortAttr[attr] === 1) {
                        return r[attr];
                    }
                    else {
                        // 改变策略，让所有需要获得的值在projection上取得
                        (0, assert_1.assert)(typeof sortAttr[attr] === 'string' && sortAttr[attr].startsWith('$expr'));
                        return r[sortAttr[attr]];
                    }
                };
                var v1 = row1 && getAttrOrExprValue(row11);
                var v2 = row2 && getAttrOrExprValue(row22);
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
                    (0, assert_1.assert)(row11['entity'] === row22['entity']);
                    (0, assert_1.assert)(row11.entity === attr);
                    var node1 = _this.store[row11.entity] && _this.store[row11.entity][row11.entityId];
                    var node2 = _this.store[row22.entity] && _this.store[row22.entity][row22.entityId];
                    var row111 = node1 && _this.constructRow(node1, context, option);
                    var row222 = node2 && _this.constructRow(node2, context, option);
                    return compare(row111, row222, row11['entity'], sortAttr[attr], direction);
                }
                else {
                    (0, assert_1.assert)(typeof relation === 'string');
                    var node1 = _this.store[relation] && _this.store[relation][row11["".concat(attr, "Id")]];
                    var node2 = _this.store[relation] && _this.store[relation][row22["".concat(attr, "Id")]];
                    var row111 = node1 && _this.constructRow(node1, context, option);
                    var row222 = node2 && _this.constructRow(node2, context, option);
                    return compare(row111, row222, relation, sortAttr[attr], direction);
                }
            }
        };
        return function (row1, row2) {
            var e_7, _a;
            try {
                for (var sorter_1 = tslib_1.__values(sorter), sorter_1_1 = sorter_1.next(); !sorter_1_1.done; sorter_1_1 = sorter_1.next()) {
                    var sorterElement = sorter_1_1.value;
                    var $attr = sorterElement.$attr, $direction = sorterElement.$direction;
                    var result = compare(row1, row2, entity, $attr, $direction);
                    if (result !== 0) {
                        return result;
                    }
                }
            }
            catch (e_7_1) { e_7 = { error: e_7_1 }; }
            finally {
                try {
                    if (sorter_1_1 && !sorter_1_1.done && (_a = sorter_1.return)) _a.call(sorter_1);
                }
                finally { if (e_7) throw e_7.error; }
            }
            return 0;
        };
    };
    TreeStore.prototype.selectAbjointRow = function (entity, selection, context, option) {
        var e_8, _a, e_9, _b;
        var _this = this;
        var filter = selection.filter;
        var nodeDict = option === null || option === void 0 ? void 0 : option.nodeDict;
        var filterFn = filter && this.translateFilter(entity, filter, context, option);
        var entityNodes = this.store[entity] ? Object.values(this.store[entity]) : [];
        var nodes = [];
        try {
            for (var entityNodes_1 = tslib_1.__values(entityNodes), entityNodes_1_1 = entityNodes_1.next(); !entityNodes_1_1.done; entityNodes_1_1 = entityNodes_1.next()) {
                var n = entityNodes_1_1.value;
                // 做个优化，若是插入的行不用等
                if (n.$txnId && n.$txnId !== context.getCurrentTxnId() && n.$current === null) {
                    continue;
                }
                (0, assert_1.assert)(!n.$txnId || n.$txnId === context.getCurrentTxnId());
                var exprResolveFns = [];
                var nodeDict2 = {};
                if (nodeDict) {
                    Object.assign(nodeDict2, nodeDict);
                }
                // 如果没有filterFn，要保证行不为null(本事务remove的case)
                if (filterFn ? filterFn(n, nodeDict2, exprResolveFns) : this.constructRow(n, context, option)) {
                    // 如果有延时处理的expression，在这里加以判断，此时所有在filter中的node应该都已经加以遍历了
                    var exprResult = true;
                    if (exprResolveFns.length > 0) {
                        try {
                            for (var exprResolveFns_1 = (e_9 = void 0, tslib_1.__values(exprResolveFns)), exprResolveFns_1_1 = exprResolveFns_1.next(); !exprResolveFns_1_1.done; exprResolveFns_1_1 = exprResolveFns_1.next()) {
                                var fn = exprResolveFns_1_1.value;
                                var result = fn(nodeDict2);
                                if (typeof result === 'function') {
                                    throw new OakExpressionUnresolvedException();
                                }
                                if (!!!result) {
                                    exprResult = false;
                                    break;
                                }
                            }
                        }
                        catch (e_9_1) { e_9 = { error: e_9_1 }; }
                        finally {
                            try {
                                if (exprResolveFns_1_1 && !exprResolveFns_1_1.done && (_b = exprResolveFns_1.return)) _b.call(exprResolveFns_1);
                            }
                            finally { if (e_9) throw e_9.error; }
                        }
                    }
                    if (exprResult) {
                        nodes.push(n);
                    }
                }
            }
        }
        catch (e_8_1) { e_8 = { error: e_8_1 }; }
        finally {
            try {
                if (entityNodes_1_1 && !entityNodes_1_1.done && (_a = entityNodes_1.return)) _a.call(entityNodes_1);
            }
            finally { if (e_8) throw e_8.error; }
        }
        var rows = nodes.map(function (node) { return _this.constructRow(node, context, option); });
        var rows2 = this.formResult(entity, rows, selection, context, option);
        return rows2;
    };
    TreeStore.prototype.updateAbjointRow = function (entity, operation, context, option) {
        var e_10, _a;
        var data = operation.data, action = operation.action, operId = operation.id;
        switch (action) {
            case 'create': {
                var id = data.id;
                (0, assert_1.assert)(id);
                // const node = this.store[entity] && (this.store[entity]!)[id as string];
                // const row = node && this.constructRow(node, context) || {};
                /* if (row) {
                    throw new OakError(RowStore.$$LEVEL, RowStore.$$CODES.primaryKeyConfilict);
                } */
                if (this.store[entity] && (this.store[entity])[id]) {
                    var node = this.store[entity] && (this.store[entity])[id];
                    throw new Exception_1.OakCongruentRowExists(entity, this.constructRow(node, context, option));
                }
                if (!data.$$seq$$) {
                    // tree-store随意生成即可
                    Object.assign(data, {
                        $$seq$$: "".concat(Math.ceil((Math.random() + 1000) * 100)),
                    });
                }
                var node2 = {
                    $txnId: context.getCurrentTxnId(),
                    $current: null,
                    $next: data,
                    $path: "".concat(entity, ".").concat(id),
                };
                if (!this.store[entity]) {
                    this.store[entity] = {};
                }
                (0, lodash_1.set)(this.store, "".concat(entity, ".").concat(id), node2);
                this.addToTxnNode(node2, context, 'create');
                return 1;
            }
            default: {
                var selection = {
                    data: {
                        id: 1,
                    },
                    filter: operation.filter,
                    indexFrom: operation.indexFrom,
                    count: operation.count,
                };
                var rows = this.selectAbjointRow(entity, selection, context, { dontCollect: true });
                var ids = rows.map(function (ele) { return ele.id; });
                try {
                    for (var ids_1 = tslib_1.__values(ids), ids_1_1 = ids_1.next(); !ids_1_1.done; ids_1_1 = ids_1.next()) {
                        var id = ids_1_1.value;
                        var alreadyDirtyNode = false;
                        var node = (this.store[entity])[id];
                        (0, assert_1.assert)(node && (!node.$txnId || node.$txnId == context.getCurrentTxnId()));
                        if (!node.$txnId) {
                            node.$txnId = context.getCurrentTxnId();
                        }
                        else {
                            (0, assert_1.assert)(node.$txnId === context.getCurrentTxnId());
                            alreadyDirtyNode = true;
                        }
                        if (action === 'remove') {
                            node.$next = null;
                            node.$path = "".concat(entity, ".").concat(id);
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
                }
                catch (e_10_1) { e_10 = { error: e_10_1 }; }
                finally {
                    try {
                        if (ids_1_1 && !ids_1_1.done && (_a = ids_1.return)) _a.call(ids_1);
                    }
                    finally { if (e_10) throw e_10.error; }
                }
                return rows.length;
            }
        }
    };
    TreeStore.prototype.selectAbjointRowAsync = function (entity, selection, context, option) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
                return [2 /*return*/, this.selectAbjointRow(entity, selection, context, option)];
            });
        });
    };
    TreeStore.prototype.updateAbjointRowAsync = function (entity, operation, context, option) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
                return [2 /*return*/, this.updateAbjointRow(entity, operation, context, option)];
            });
        });
    };
    TreeStore.prototype.operateSync = function (entity, operation, context, option) {
        (0, assert_1.assert)(context.getCurrentTxnId());
        return this.cascadeUpdate(entity, operation, context, option);
    };
    TreeStore.prototype.operateAsync = function (entity, operation, context, option) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
                (0, assert_1.assert)(context.getCurrentTxnId());
                return [2 /*return*/, this.cascadeUpdateAsync(entity, operation, context, option)];
            });
        });
    };
    /**
     * 计算最终结果集当中的函数，这个函数可能测试不够充分
     * @param entity
     * @param projection
     * @param data
     * @param nodeDict
     * @param context
     */
    TreeStore.prototype.formExprInResult = function (entity, projection, data, nodeDict, context) {
        var _a, _b, _c, _d;
        var _this = this;
        var laterExprDict = {};
        for (var attr in projection) {
            if (attr.startsWith(Demand_1.EXPRESSION_PREFIX)) {
                var ExprNodeTranslator = this.translateExpression(entity, projection[attr], context, {});
                var exprResult = ExprNodeTranslator(data, nodeDict);
                if (typeof exprResult === 'function') {
                    Object.assign(laterExprDict, (_a = {},
                        _a[attr] = exprResult,
                        _a));
                }
                else {
                    Object.assign(data, (_b = {},
                        _b[attr] = exprResult,
                        _b));
                }
            }
            else if (attr === '#id') {
                var nodeId = projection[attr];
                (0, assert_1.assert)(!nodeDict.hasOwnProperty(nodeId), "Filter\u4E2D\u7684nodeId\u300C".concat(nodeId, "\u300D\u51FA\u73B0\u4E86\u591A\u6B21"));
                Object.assign(nodeDict, (_c = {},
                    _c[nodeId] = data,
                    _c));
            }
        }
        var _loop_2 = function (attr) {
            var rel = this_2.judgeRelation(entity, attr);
            if (rel === 1) {
            }
            else if (rel === 2) {
                if (data[attr]) {
                    this_2.formExprInResult(attr, projection[attr], data[attr], nodeDict, context);
                }
            }
            else if (typeof rel === 'string') {
                if (data[attr]) {
                    var result2 = {};
                    this_2.formExprInResult(rel, projection[attr], data[attr], nodeDict, context);
                }
            }
            else if (rel instanceof Array) {
                if (!attr.endsWith('$$aggr')) {
                    if (data[attr] && data[attr] instanceof Array) {
                        data[attr].map(function (ele) { return _this.formExprInResult(rel[0], projection[attr].data, ele, nodeDict, context); });
                    }
                }
            }
        };
        var this_2 = this;
        for (var attr in projection) {
            _loop_2(attr);
        }
        for (var attr in laterExprDict) {
            var exprResult = laterExprDict[attr](nodeDict);
            // projection是不应出现计算不出来的情况
            (0, assert_1.assert)(typeof exprResult !== 'function', 'data中的expr无法计算，请检查命名与引用的一致性');
            Object.assign(data, (_d = {},
                _d[attr] = exprResult,
                _d));
        }
    };
    TreeStore.prototype.formResult = function (entity, rows, selection, context, option) {
        var e_11, _a, _b;
        var _this = this;
        var data = selection.data, sorter = selection.sorter, indexFrom = selection.indexFrom, count = selection.count;
        var findAvailableExprName = function (current) {
            var counter = 1;
            while (counter < 20) {
                var exprName = "$expr".concat(counter++);
                if (!current.includes(exprName)) {
                    return exprName;
                }
            }
            (0, assert_1.assert)(false, '找不到可用的expr命名');
        };
        var sortToProjection = function (entity2, proj, sort) {
            Object.keys(sort).forEach(function (attr) {
                var _a, _b, _c, _d;
                // 要把sorter中的expr运算提到这里做掉，否则异步运算无法排序        
                if (attr.startsWith('$expr') && typeof sort[attr] === 'object') {
                    var attrName = findAvailableExprName(Object.keys(proj));
                    Object.assign(proj, (_a = {},
                        _a[attrName] = sort[attr],
                        _a));
                    Object.assign(sort, (_b = {},
                        _b[attr] = attrName,
                        _b));
                }
                var rel = (0, relation_1.judgeRelation)(_this.getSchema(), entity2, attr);
                if (rel === 2 || typeof rel === 'string') {
                    if (!proj[attr]) {
                        Object.assign(proj, (_c = {},
                            _c[attr] = {},
                            _c));
                    }
                    var entity3 = typeof rel === 'string' ? rel : attr;
                    sortToProjection(entity3, proj[attr], sort[attr]);
                }
                else if (rel === 1) {
                    Object.assign(proj, (_d = {},
                        _d[attr] = 1,
                        _d));
                }
            });
        };
        if (sorter) {
            sorter.forEach(function (ele) {
                sortToProjection(entity, data, ele.$attr);
            });
        }
        // 先计算projection，formResult只处理abjoint的行，不需要考虑expression和一对多多对一关系
        var rows2 = [];
        var incompletedRowIds = [];
        var projection = selection.data;
        try {
            for (var rows_1 = tslib_1.__values(rows), rows_1_1 = rows_1.next(); !rows_1_1.done; rows_1_1 = rows_1.next()) {
                var row = rows_1_1.value;
                var result = {};
                var _loop_3 = function (attr) {
                    var _c, _d;
                    var rel = this_3.judgeRelation(entity, attr);
                    if (rel === 1) {
                        if (row[attr] === undefined) {
                            incompletedRowIds.push(row.id);
                            return "break";
                        }
                        else if (typeof projection[attr] === 'number') {
                            Object.assign(result, (_c = {},
                                _c[attr] = row[attr],
                                _c));
                        }
                        else {
                            // object数据的深层次select
                            Object.assign(result, (_d = {},
                                _d[attr] = {},
                                _d));
                            var assignIner_1 = function (dest, proj, source) {
                                if (proj instanceof Array) {
                                    (0, assert_1.assert)(dest instanceof Array);
                                    (0, assert_1.assert)(source instanceof Array);
                                    proj.forEach(function (attr, idx) {
                                        if (typeof attr === 'number') {
                                            dest[idx] = source[idx];
                                        }
                                        else if (typeof attr === 'object') {
                                            dest[idx] = {};
                                            assignIner_1(dest[idx], attr, source[idx]);
                                        }
                                    });
                                }
                                else {
                                    for (var attr_1 in proj) {
                                        if (typeof proj[attr_1] === 'number') {
                                            dest[attr_1] = source[attr_1];
                                        }
                                        else if (typeof proj[attr_1] === 'object') {
                                            dest[attr_1] = proj[attr_1] instanceof Array ? [] : {};
                                            assignIner_1(dest[attr_1], proj[attr_1], source[attr_1]);
                                        }
                                    }
                                }
                            };
                            assignIner_1(result[attr], projection[attr], row[attr]);
                        }
                    }
                };
                var this_3 = this;
                for (var attr in projection) {
                    var state_1 = _loop_3(attr);
                    if (state_1 === "break")
                        break;
                }
                if (row.$$deleteAt$$) {
                    Object.assign(result, (_b = {},
                        _b[Entity_1.DeleteAtAttribute] = row.$$deleteAt$$,
                        _b));
                }
                rows2.push(result);
            }
        }
        catch (e_11_1) { e_11 = { error: e_11_1 }; }
        finally {
            try {
                if (rows_1_1 && !rows_1_1.done && (_a = rows_1.return)) _a.call(rows_1);
            }
            finally { if (e_11) throw e_11.error; }
        }
        if (incompletedRowIds.length > 0) {
            // 如果有缺失属性的行，则报OakRowUnexistedException错误
            // fixed: 这里不报了。按约定框架应当保证取到要访问的属性
            /* throw new OakRowUnexistedException([{
                entity,
                selection: {
                    data: projection,
                    filter: {
                        id: {
                            $in: incompletedRowIds,
                        },
                    },
                },
            }]); */
        }
        // 再计算sorter
        if (sorter) {
            var sorterFn = this.translateSorter(entity, sorter, context, option);
            rows2.sort(sorterFn);
        }
        // 最后用indexFrom和count来截断
        if (typeof indexFrom === 'number') {
            return rows2.slice(indexFrom, indexFrom + count);
        }
        else {
            return rows2;
        }
    };
    /**
     * 本函数把结果中的相应属性映射成一个字符串，用于GroupBy
     * @param entity
     * @param row
     * @param projection
     */
    TreeStore.prototype.mappingProjectionOnRow = function (entity, row, projection) {
        var _this = this;
        var key = '';
        var result = {};
        var values = [];
        var mappingIter = function (entity2, row2, p2, result2) {
            var e_12, _a;
            var keys = Object.keys(p2).sort(function (ele1, ele2) { return ele1 < ele2 ? -1 : 1; });
            try {
                for (var keys_1 = tslib_1.__values(keys), keys_1_1 = keys_1.next(); !keys_1_1.done; keys_1_1 = keys_1.next()) {
                    var k = keys_1_1.value;
                    var rel = _this.judgeRelation(entity2, k);
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
                        key += "".concat(row2[k]);
                        values.push(row2[k]);
                    }
                }
            }
            catch (e_12_1) { e_12 = { error: e_12_1 }; }
            finally {
                try {
                    if (keys_1_1 && !keys_1_1.done && (_a = keys_1.return)) _a.call(keys_1);
                }
                finally { if (e_12) throw e_12.error; }
            }
        };
        mappingIter(entity, row, projection, result);
        return {
            result: result,
            key: key,
            values: values,
        };
    };
    TreeStore.prototype.calcAggregation = function (entity, rows, aggregationData) {
        var e_13, _a, e_14, _b, e_15, _c;
        var ops = Object.keys(aggregationData).filter(function (ele) { return ele !== '#aggr'; });
        var result = {};
        try {
            for (var rows_2 = tslib_1.__values(rows), rows_2_1 = rows_2.next(); !rows_2_1.done; rows_2_1 = rows_2.next()) {
                var row = rows_2_1.value;
                try {
                    for (var ops_1 = (e_14 = void 0, tslib_1.__values(ops)), ops_1_1 = ops_1.next(); !ops_1_1.done; ops_1_1 = ops_1.next()) {
                        var op = ops_1_1.value;
                        var values = this.mappingProjectionOnRow(entity, row, aggregationData[op]).values;
                        (0, assert_1.assert)(values.length === 1, "\u805A\u5408\u8FD0\u7B97\u4E2D\uFF0C".concat(op, "\u7684\u76EE\u6807\u5C5E\u6027\u591A\u4E8E1\u4E2A"));
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
                catch (e_14_1) { e_14 = { error: e_14_1 }; }
                finally {
                    try {
                        if (ops_1_1 && !ops_1_1.done && (_b = ops_1.return)) _b.call(ops_1);
                    }
                    finally { if (e_14) throw e_14.error; }
                }
            }
        }
        catch (e_13_1) { e_13 = { error: e_13_1 }; }
        finally {
            try {
                if (rows_2_1 && !rows_2_1.done && (_a = rows_2.return)) _a.call(rows_2);
            }
            finally { if (e_13) throw e_13.error; }
        }
        try {
            for (var ops_2 = tslib_1.__values(ops), ops_2_1 = ops_2.next(); !ops_2_1.done; ops_2_1 = ops_2.next()) {
                var op = ops_2_1.value;
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
        }
        catch (e_15_1) { e_15 = { error: e_15_1 }; }
        finally {
            try {
                if (ops_2_1 && !ops_2_1.done && (_c = ops_2.return)) _c.call(ops_2);
            }
            finally { if (e_15) throw e_15.error; }
        }
        return result;
    };
    TreeStore.prototype.formAggregation = function (entity, rows, aggregationData) {
        var _this = this;
        var aggrExpr = aggregationData["#aggr"];
        if (aggrExpr) {
            var groups_1 = (0, lodash_1.groupBy)(rows, function (row) {
                var key = _this.mappingProjectionOnRow(entity, row, aggrExpr).key;
                return key;
            });
            var result = Object.keys(groups_1).map(function (ele) {
                var aggr = _this.calcAggregation(entity, groups_1[ele], aggregationData);
                var r = _this.mappingProjectionOnRow(entity, groups_1[ele][0], aggrExpr).result;
                aggr['#data'] = r;
                return aggr;
            });
            return result;
        }
        var aggr = this.calcAggregation(entity, rows, aggregationData);
        return [aggr];
    };
    TreeStore.prototype.selectSync = function (entity, selection, context, option) {
        var _this = this;
        (0, assert_1.assert)(context.getCurrentTxnId());
        var result = this.cascadeSelect(entity, selection, context, option);
        // 在这里再计算所有的表达式
        result.forEach(function (ele) { return _this.formExprInResult(entity, selection.data, ele, {}, context); });
        return result;
    };
    TreeStore.prototype.selectAsync = function (entity, selection, context, option) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var result;
            var _this = this;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        (0, assert_1.assert)(context.getCurrentTxnId());
                        return [4 /*yield*/, this.cascadeSelectAsync(entity, selection, context, option)];
                    case 1:
                        result = _a.sent();
                        // 在这里再计算所有的表达式
                        result.forEach(function (ele) { return _this.formExprInResult(entity, selection.data, ele, {}, context); });
                        return [2 /*return*/, result];
                }
            });
        });
    };
    TreeStore.prototype.aggregateSync = function (entity, aggregation, context, option) {
        var _this = this;
        (0, assert_1.assert)(context.getCurrentTxnId());
        var data = aggregation.data, filter = aggregation.filter, sorter = aggregation.sorter, indexFrom = aggregation.indexFrom, count = aggregation.count;
        var p = {};
        for (var k in data) {
            Object.assign(p, (0, lodash_1.cloneDeep)(data[k]));
        }
        var selection = {
            data: p,
            filter: filter,
            sorter: sorter,
            indexFrom: indexFrom,
            count: count,
        };
        var result = this.cascadeSelect(entity, selection, context, Object.assign({}, option, {
            dontCollect: true,
        }));
        // 在这里再计算所有的表达式
        result.forEach(function (ele) { return _this.formExprInResult(entity, selection.data, ele, {}, context); });
        // 最后计算Aggregation
        return this.formAggregation(entity, result, aggregation.data);
    };
    TreeStore.prototype.aggregateAsync = function (entity, aggregation, context, option) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var data, filter, sorter, indexFrom, count, p, k, selection, result;
            var _this = this;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        (0, assert_1.assert)(context.getCurrentTxnId());
                        data = aggregation.data, filter = aggregation.filter, sorter = aggregation.sorter, indexFrom = aggregation.indexFrom, count = aggregation.count;
                        p = {};
                        for (k in data) {
                            Object.assign(p, (0, lodash_1.cloneDeep)(data[k]));
                        }
                        selection = {
                            data: p,
                            filter: filter,
                            sorter: sorter,
                            indexFrom: indexFrom,
                            count: count,
                        };
                        return [4 /*yield*/, this.cascadeSelectAsync(entity, selection, context, Object.assign({}, option, {
                                dontCollect: true,
                            }))];
                    case 1:
                        result = _a.sent();
                        // 在这里再计算所有的表达式
                        result.forEach(function (ele) { return _this.formExprInResult(entity, selection.data, ele, {}, context); });
                        // 最后计算Aggregation
                        return [2 /*return*/, this.formAggregation(entity, result, aggregation.data)];
                }
            });
        });
    };
    TreeStore.prototype.countSync = function (entity, selection, context, option) {
        var selection2 = Object.assign({}, selection, {
            data: {
                id: 1,
            },
        });
        var result = this.selectSync(entity, selection2, context, Object.assign({}, option, {
            dontCollect: true,
        }));
        return typeof selection.count === 'number' ? Math.min(result.length, selection.count) : result.length;
    };
    TreeStore.prototype.countAsync = function (entity, selection, context, option) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var selection2, result;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        selection2 = Object.assign({}, selection, {
                            data: {
                                id: 1,
                            },
                        });
                        return [4 /*yield*/, this.selectAsync(entity, selection2, context, Object.assign({}, option, {
                                dontCollect: true,
                            }))];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, typeof selection.count === 'number' ? Math.min(result.length, selection.count) : result.length];
                }
            });
        });
    };
    TreeStore.prototype.addToTxnNode = function (node, context, action) {
        var txnNode = this.activeTxnDict[context.getCurrentTxnId()];
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
    };
    TreeStore.prototype.getStat = function () {
        return this.stat;
    };
    TreeStore.prototype.beginSync = function () {
        var _a;
        var uuid = "".concat(Math.random());
        (0, assert_1.assert)(!this.activeTxnDict.hasOwnProperty(uuid));
        Object.assign(this.activeTxnDict, (_a = {},
            _a[uuid] = {
                create: 0,
                update: 0,
                remove: 0,
                waitList: [],
            },
            _a));
        return uuid;
    };
    TreeStore.prototype.commitSync = function (uuid) {
        var e_16, _a;
        (0, assert_1.assert)(this.activeTxnDict.hasOwnProperty(uuid), uuid);
        var node = this.activeTxnDict[uuid].nodeHeader;
        while (node) {
            var node2 = node.$nextNode;
            if (node.$txnId === uuid) {
                if (node.$next) {
                    // create/update
                    node.$current = Object.assign(node.$current || {}, node.$next);
                    (0, lodash_1.unset)(node, '$txnId');
                    (0, lodash_1.unset)(node, '$next');
                    (0, lodash_1.unset)(node, '$path');
                    (0, lodash_1.unset)(node, '$nextNode');
                }
                else {
                    // remove
                    (0, assert_1.assert)(node.$path);
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
        try {
            // 唤起等待者
            for (var _b = tslib_1.__values(this.activeTxnDict[uuid].waitList), _c = _b.next(); !_c.done; _c = _b.next()) {
                var waiter = _c.value;
                waiter.fn();
            }
        }
        catch (e_16_1) { e_16 = { error: e_16_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_16) throw e_16.error; }
        }
        (0, lodash_1.unset)(this.activeTxnDict, uuid);
    };
    TreeStore.prototype.rollbackSync = function (uuid) {
        var e_17, _a;
        (0, assert_1.assert)(this.activeTxnDict.hasOwnProperty(uuid));
        var node = this.activeTxnDict[uuid].nodeHeader;
        while (node) {
            var node2 = node.$nextNode;
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
        try {
            // 唤起等待者
            for (var _b = tslib_1.__values(this.activeTxnDict[uuid].waitList), _c = _b.next(); !_c.done; _c = _b.next()) {
                var waiter = _c.value;
                waiter.fn();
            }
        }
        catch (e_17_1) { e_17 = { error: e_17_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_17) throw e_17.error; }
        }
        (0, lodash_1.unset)(this.activeTxnDict, uuid);
    };
    TreeStore.prototype.beginAsync = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
                return [2 /*return*/, this.beginSync()];
            });
        });
    };
    TreeStore.prototype.commitAsync = function (uuid) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
                return [2 /*return*/, this.commitSync(uuid)];
            });
        });
    };
    TreeStore.prototype.rollbackAsync = function (uuid) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
                return [2 /*return*/, this.rollbackSync(uuid)];
            });
        });
    };
    // 将输入的OpRecord同步到数据中
    TreeStore.prototype.sync = function (opRecords, context, option) {
        var e_18, _a, e_19, _b;
        var option2 = Object.assign({}, option, {
            dontCollect: true,
            dontCreateOper: true,
        });
        try {
            for (var opRecords_1 = tslib_1.__values(opRecords), opRecords_1_1 = opRecords_1.next(); !opRecords_1_1.done; opRecords_1_1 = opRecords_1.next()) {
                var record = opRecords_1_1.value;
                switch (record.a) {
                    case 'c': {
                        var e = record.e, d = record.d;
                        if (d instanceof Array) {
                            try {
                                for (var d_1 = (e_19 = void 0, tslib_1.__values(d)), d_1_1 = d_1.next(); !d_1_1.done; d_1_1 = d_1.next()) {
                                    var dd = d_1_1.value;
                                    if (this.store[e] && this.store[e][dd.id]) {
                                        this.updateAbjointRow(e, {
                                            id: 'dummy',
                                            action: 'update',
                                            data: dd,
                                            filter: {
                                                id: dd.id,
                                            },
                                        }, context, option2);
                                    }
                                    else {
                                        this.updateAbjointRow(e, {
                                            id: 'dummy',
                                            action: 'create',
                                            data: dd,
                                        }, context, option2);
                                    }
                                }
                            }
                            catch (e_19_1) { e_19 = { error: e_19_1 }; }
                            finally {
                                try {
                                    if (d_1_1 && !d_1_1.done && (_b = d_1.return)) _b.call(d_1);
                                }
                                finally { if (e_19) throw e_19.error; }
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
                            }
                            else {
                                this.updateAbjointRow(e, {
                                    id: 'dummy',
                                    action: 'create',
                                    data: d,
                                }, context, option2);
                            }
                        }
                        break;
                    }
                    case 'u': {
                        var _c = record, e = _c.e, d = _c.d, f = _c.f;
                        this.updateAbjointRow(e, {
                            id: 'dummy',
                            action: 'update',
                            data: d,
                            filter: f,
                        }, context, option2);
                        break;
                    }
                    case 'r': {
                        var _d = record, e = _d.e, f = _d.f;
                        this.updateAbjointRow(e, {
                            id: 'dummy',
                            action: 'remove',
                            data: {},
                            filter: f,
                        }, context, option2);
                        break;
                    }
                    case 's': {
                        var d = record.d;
                        for (var entity in d) {
                            for (var id in d[entity]) {
                                if (this.store[entity] && this.store[entity][id]) {
                                    this.updateAbjointRow(entity, {
                                        id: 'dummy',
                                        action: 'update',
                                        data: d[entity][id],
                                        filter: {
                                            id: id,
                                        },
                                    }, context, option2);
                                }
                                else {
                                    this.updateAbjointRow(entity, {
                                        id: 'dummy',
                                        action: 'create',
                                        data: d[entity][id],
                                    }, context, option2);
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
        }
        catch (e_18_1) { e_18 = { error: e_18_1 }; }
        finally {
            try {
                if (opRecords_1_1 && !opRecords_1_1.done && (_a = opRecords_1.return)) _a.call(opRecords_1);
            }
            finally { if (e_18) throw e_18.error; }
        }
    };
    return TreeStore;
}(CascadeStore_1.CascadeStore));
exports.default = TreeStore;
