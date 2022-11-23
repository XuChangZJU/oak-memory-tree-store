"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var lodash_1 = require("oak-domain/lib/utils/lodash");
var assert_1 = require("oak-domain/lib/utils/assert");
var Demand_1 = require("oak-domain/lib/types/Demand");
var Exception_1 = require("oak-domain/lib/types/Exception");
var Demand_2 = require("oak-domain/lib/types/Demand");
var relation_1 = require("oak-domain/lib/store/relation");
var Expression_1 = require("oak-domain/lib/types/Expression");
var CascadeStore_1 = require("oak-domain/lib/store/CascadeStore");
;
;
function obscurePass(row, attr, option) {
    return !!((option === null || option === void 0 ? void 0 : option.obscure) && row[attr] === undefined);
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
                    (0, assert_1.assert)(row.id);
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
    TreeStore.prototype.constructRow = function (node, context) {
        var data = (0, lodash_1.cloneDeep)(node.$current);
        if (context.getCurrentTxnId() && node.$txnId === context.getCurrentTxnId()) {
            if (!node.$next) {
                return null;
            }
            else {
                return Object.assign({}, data, node.$next);
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
            var row = _this.constructRow(node, context);
            try {
                for (var attributes_1 = tslib_1.__values(attributes), attributes_1_1 = attributes_1.next(); !attributes_1_1.done; attributes_1_1 = attributes_1.next()) {
                    var attr = attributes_1_1.value;
                    var name_1 = attr.name;
                    if (row && row[name_1] && (typeof row[name_1] === 'string' && row[name_1].contains($search) || obscurePass(row, name_1, option))) {
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
    TreeStore.prototype.translateAttribute = function (entity, filter, attr, context, option) {
        var _this = this;
        var _a;
        // 如果是模糊查询且该属性为undefined，说明没取到，返回true
        function obscurePassLocal(row) {
            return obscurePass(row, attr, option);
        }
        if (typeof filter !== 'object') {
            return function (node) {
                var row = _this.constructRow(node, context);
                return row ? row[attr] === filter || obscurePassLocal(row) : false;
            };
        }
        else if (((_a = this.getSchema()[entity].attributes[attr]) === null || _a === void 0 ? void 0 : _a.type) === 'object') {
            // 如果查询的目标就是object，则转化成object的比较
            return function (node) {
                var row = _this.constructRow(node, context);
                return row ? JSON.stringify(row[attr]) === JSON.stringify(filter) || obscurePassLocal(row) : false;
            };
        }
        var fns = [];
        var _loop_1 = function (op) {
            switch (op) {
                case '$gt': {
                    fns.push(function (row) { return row && (row[attr] > filter[op]) || obscurePassLocal(row); });
                    break;
                }
                case '$lt': {
                    fns.push(function (row) { return row && (row[attr] < filter[op]) || obscurePassLocal(row); });
                    break;
                }
                case '$gte': {
                    fns.push(function (row) { return row && (row[attr] >= filter[op]) || obscurePassLocal(row); });
                    break;
                }
                case '$lte': {
                    fns.push(function (row) { return row && (row[attr] <= filter[op]) || obscurePassLocal(row); });
                    break;
                }
                case '$eq': {
                    fns.push(function (row) { return row && (row[attr] === filter[op]) || obscurePassLocal(row); });
                    break;
                }
                case '$ne': {
                    fns.push(function (row) { return row && (row[attr] !== filter[op]) || obscurePassLocal(row); });
                    break;
                }
                case '$between': {
                    fns.push(function (row) {
                        return row && (row[attr] >= filter[op][0] && row[attr] <= filter[op][1] || obscurePassLocal(row));
                    });
                    break;
                }
                case '$startsWith': {
                    fns.push(function (row) {
                        var _a;
                        return row && (((_a = row[attr]) === null || _a === void 0 ? void 0 : _a.startsWith(filter[op])) || obscurePassLocal(row));
                    });
                    break;
                }
                case '$endsWith': {
                    fns.push(function (row) {
                        var _a;
                        return row && (((_a = row[attr]) === null || _a === void 0 ? void 0 : _a.$endsWith(filter[op])) || obscurePassLocal(row));
                    });
                    break;
                }
                case '$includes': {
                    fns.push(function (row) {
                        var _a;
                        return row && (((_a = row[attr]) === null || _a === void 0 ? void 0 : _a.includes(filter[op])) || obscurePassLocal(row));
                    });
                    break;
                }
                case '$exists': {
                    var exists_1 = filter[op];
                    (0, assert_1.assert)(typeof exists_1 === 'boolean');
                    fns.push(function (row) {
                        if (exists_1) {
                            return ![null, undefined].includes(row[attr]) || obscurePassLocal(row);
                        }
                        else {
                            return [null, undefined].includes(row[attr]) || obscurePassLocal(row);
                        }
                    });
                    break;
                }
                case '$in': {
                    var inData_1 = filter[op];
                    (0, assert_1.assert)(typeof inData_1 === 'object');
                    if (inData_1 instanceof Array) {
                        fns.push(function (row) { return inData_1.includes(row[attr]) || obscurePassLocal(row); });
                    }
                    else {
                        // 如果是obscure，则返回的集合中有没有都不能否决“可能有”，所以可以直接返回true
                        if (option === null || option === void 0 ? void 0 : option.obscure) {
                            fns.push(function () { return true; });
                        }
                        else {
                            // 这里只有当子查询中的filter不包含引用外部的子查询时才可以提前计算，否则必须等到执行时再计算
                            try {
                                var legalSets_1 = (this_1.selectAbjointRow(inData_1.entity, inData_1, context, option)).map(function (ele) {
                                    var data = inData_1.data;
                                    var key = Object.keys(data)[0];
                                    return ele[key];
                                });
                                fns.push(function (row) { return legalSets_1.includes(row[attr]); });
                            }
                            catch (err) {
                                if (err instanceof OakExpressionUnresolvedException) {
                                    fns.push(function (row, nodeDict) {
                                        var option2 = Object.assign({}, option, { nodeDict: nodeDict });
                                        var legalSets = _this.selectAbjointRow(inData_1.entity, inData_1, context, option2).map(function (ele) {
                                            var data = inData_1.data;
                                            var key = Object.keys(data)[0];
                                            return ele[key];
                                        });
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
                    var inData_2 = filter[op];
                    (0, assert_1.assert)(typeof inData_2 === 'object');
                    if (inData_2 instanceof Array) {
                        fns.push(function (row) { return !inData_2.includes(row[attr]) || obscurePassLocal(row); });
                    }
                    else {
                        // obscure对nin没有影响，如果返回的子查询结果中包含此行就一定是false，否则一定为true（obscure只考虑数据不完整，不考虑不准确），但若相应属性为undefined则任然可以认为true
                        // 这里只有当子查询中的filter不包含引用外部的子查询时才可以提前计算，否则必须等到执行时再计算
                        try {
                            var legalSets_2 = this_1.selectAbjointRow(inData_2.entity, inData_2, context, option).map(function (ele) {
                                var data = inData_2.data;
                                var key = Object.keys(data)[0];
                                return ele[key];
                            });
                            fns.push(function (row) { return !legalSets_2.includes(row[attr]) || obscurePassLocal(row); });
                        }
                        catch (err) {
                            if (err instanceof OakExpressionUnresolvedException) {
                                fns.push(function (row, nodeDict) {
                                    var option2 = Object.assign({}, option, { nodeDict: nodeDict });
                                    var legalSets = _this.selectAbjointRow(inData_2.entity, inData_2, context, option2).map(function (ele) {
                                        var data = inData_2.data;
                                        var key = Object.keys(data)[0];
                                        return ele[key];
                                    });
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
                    (0, assert_1.assert)(false, "\u76EE\u524D\u4E0D\u652F\u6301\u7684\u7B97\u5B50".concat(op));
            }
        };
        var this_1 = this;
        for (var op in filter) {
            _loop_1(op);
        }
        return function (node, nodeDict, exprResolveFns) {
            var e_5, _a;
            var row = _this.constructRow(node, context);
            if (!row) {
                return false;
            }
            try {
                for (var fns_5 = tslib_1.__values(fns), fns_5_1 = fns_5.next(); !fns_5_1.done; fns_5_1 = fns_5.next()) {
                    var fn = fns_5_1.value;
                    if (fn(row, nodeDict, exprResolveFns) === false) {
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
    TreeStore.prototype.translateFilter = function (entity, filter, context, option) {
        var _this = this;
        var fns = [];
        var nodeId;
        var _loop_2 = function (attr) {
            if (attr === '#id') {
                nodeId = filter['#id'];
            }
            else if (['$and', '$or', '$xor', '$not'].includes(attr)) {
                fns.push(this_2.translateLogicFilter(entity, filter, attr, context, option));
            }
            else if (attr.toLowerCase().startsWith(Demand_1.EXPRESSION_PREFIX)) {
                var fn_2 = this_2.translateExpression(entity, filter[attr], context, option);
                fns.push(function (node, nodeDict, exprResolveFns) {
                    var row = _this.constructRow(node, context);
                    if (!row) {
                        return false;
                    }
                    var result = fn_2(row, nodeDict);
                    if (typeof result === 'function') {
                        exprResolveFns.push(result);
                    }
                    return !!result;
                });
            }
            else if (attr.toLowerCase() === '$text') {
                fns.push(this_2.translateFulltext(entity, filter[attr], context, option));
            }
            else {
                // 属性级过滤
                var relation_2 = (0, relation_1.judgeRelation)(this_2.getSchema(), entity, attr);
                if (relation_2 === 1) {
                    // 行本身的属性
                    fns.push(this_2.translateAttribute(entity, filter[attr], attr, context, option));
                }
                else if (relation_2 === 2) {
                    // 基于entity/entityId的指针
                    var fn_3 = this_2.translateFilter(attr, filter[attr], context, option);
                    fns.push(function (node, nodeDict, exprResolveFns) {
                        var row = _this.constructRow(node, context);
                        if (obscurePass(row, 'entity', option) || obscurePass(row, 'entityId', option)) {
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
                        return fn_3(node2, nodeDict, exprResolveFns);
                    });
                }
                else {
                    (0, assert_1.assert)(typeof relation_2 === 'string');
                    // 只能是基于普通属性的外键
                    var fn_4 = this_2.translateFilter(relation_2, filter[attr], context, option);
                    fns.push(function (node, nodeDict, exprResolveFns) {
                        var row = _this.constructRow(node, context);
                        if (obscurePass(row, "".concat(attr, "Id"), option)) {
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
                            return fn_4(node2, nodeDict, exprResolveFns);
                        }
                        return false;
                    });
                }
            }
        };
        var this_2 = this;
        for (var attr in filter) {
            _loop_2(attr);
        }
        return function (node, nodeDict, exprResolveFns) {
            var _a, e_6, _b;
            if (nodeId) {
                (0, assert_1.assert)(!nodeDict.hasOwnProperty(nodeId), "Filter\u4E2D\u7684nodeId\u300C".concat(nodeId, "\u300D\u51FA\u73B0\u4E86\u591A\u6B21"));
                Object.assign(nodeDict, (_a = {},
                    _a[nodeId] = _this.constructRow(node, context),
                    _a));
            }
            var row = _this.constructRow(node, context);
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
    TreeStore.prototype.translateSorter = function (entity, sorter, context) {
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
                    var row111 = node1 && _this.constructRow(node1, context);
                    var row222 = node2 && _this.constructRow(node2, context);
                    return compare(row111, row222, row11['entity'], sortAttr[attr], direction);
                }
                else {
                    (0, assert_1.assert)(typeof relation === 'string');
                    var node1 = _this.store[relation] && _this.store[relation][row11["".concat(attr, "Id")]];
                    var node2 = _this.store[relation] && _this.store[relation][row22["".concat(attr, "Id")]];
                    var row111 = node1 && _this.constructRow(node1, context);
                    var row222 = node2 && _this.constructRow(node2, context);
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
                var nodeDict2 = {};
                if (nodeDict) {
                    Object.assign(nodeDict2, nodeDict);
                }
                var exprResolveFns = [];
                if (!filterFn || filterFn(n, nodeDict2, exprResolveFns)) {
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
        var rows = nodes.map(function (node) { return _this.constructRow(node, context); });
        var rows2 = this.formResult(entity, rows, selection, context);
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
                    throw new Exception_1.OakCongruentRowExists(entity, this.constructRow(node, context));
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
                var rows = this.selectAbjointRow(entity, selection, context);
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
                var nodeId = data[attr];
                (0, assert_1.assert)(!nodeDict.hasOwnProperty(nodeId), "Filter\u4E2D\u7684nodeId\u300C".concat(nodeId, "\u300D\u51FA\u73B0\u4E86\u591A\u6B21"));
                Object.assign(nodeDict, (_c = {},
                    _c[nodeId] = data,
                    _c));
            }
        }
        var _loop_3 = function (attr) {
            var rel = this_3.judgeRelation(entity, attr);
            if (rel === 1) {
            }
            else if (rel === 2) {
                if (data[attr]) {
                    this_3.formExprInResult(attr, projection[attr], data[attr], nodeDict, context);
                }
            }
            else if (typeof rel === 'string') {
                if (data[attr]) {
                    var result2 = {};
                    this_3.formExprInResult(rel, projection[attr], data[attr], nodeDict, context);
                }
            }
            else if (rel instanceof Array) {
                if (data[attr] && data[attr] instanceof Array) {
                    data[attr].map(function (ele) { return _this.formExprInResult(rel[0], projection[attr].data, ele, nodeDict, context); });
                }
            }
        };
        var this_3 = this;
        for (var attr in projection) {
            _loop_3(attr);
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
    TreeStore.prototype.formResult = function (entity, rows, selection, context) {
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
                for (var attr in projection) {
                    var rel = this.judgeRelation(entity, attr);
                    if (rel === 1) {
                        if (row[attr] === undefined) {
                            incompletedRowIds.push(row.id);
                            break;
                        }
                        else {
                            Object.assign(result, (_b = {},
                                _b[attr] = row[attr],
                                _b));
                        }
                    }
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
            throw new Exception_1.OakRowUnexistedException([{
                    entity: entity,
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
        // 再计算sorter
        if (sorter) {
            var sorterFn = this.translateSorter(entity, sorter, context);
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
    TreeStore.prototype.countSync = function (entity, selection, context, option) {
        var result = this.selectSync(entity, Object.assign({}, selection, {
            data: {
                id: 1,
            }
        }), context, Object.assign({}, option, {
            dontCollect: true,
        }));
        return typeof selection.count === 'number' ? Math.min(result.length, selection.count) : result.length;
    };
    TreeStore.prototype.countAsync = function (entity, selection, context, option) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var result;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.selectAsync(entity, Object.assign({}, selection, {
                            data: {
                                id: 1,
                            }
                        }), context, Object.assign({}, option, {
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
        var e_12, _a;
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
        catch (e_12_1) { e_12 = { error: e_12_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_12) throw e_12.error; }
        }
        (0, lodash_1.unset)(this.activeTxnDict, uuid);
    };
    TreeStore.prototype.rollbackSync = function (uuid) {
        var e_13, _a;
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
        catch (e_13_1) { e_13 = { error: e_13_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_13) throw e_13.error; }
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
        var e_14, _a, e_15, _b;
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
                                for (var d_1 = (e_15 = void 0, tslib_1.__values(d)), d_1_1 = d_1.next(); !d_1_1.done; d_1_1 = d_1.next()) {
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
                            catch (e_15_1) { e_15 = { error: e_15_1 }; }
                            finally {
                                try {
                                    if (d_1_1 && !d_1_1.done && (_b = d_1.return)) _b.call(d_1);
                                }
                                finally { if (e_15) throw e_15.error; }
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
        catch (e_14_1) { e_14 = { error: e_14_1 }; }
        finally {
            try {
                if (opRecords_1_1 && !opRecords_1_1.done && (_a = opRecords_1.return)) _a.call(opRecords_1);
            }
            finally { if (e_14) throw e_14.error; }
        }
    };
    return TreeStore;
}(CascadeStore_1.CascadeStore));
exports.default = TreeStore;
