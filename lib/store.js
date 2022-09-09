"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var lodash_1 = require("oak-domain/lib/utils/lodash");
var assert_1 = require("oak-domain/lib/utils/assert");
var Demand_1 = require("oak-domain/lib/types/Demand");
var Exception_1 = require("oak-domain/lib/types/Exception");
var CascadeStore_1 = require("oak-domain/lib/store/CascadeStore");
var OakError_1 = require("oak-domain/lib/OakError");
var RowStore_1 = require("oak-domain/lib/types/RowStore");
var Demand_2 = require("oak-domain/lib/types/Demand");
var relation_1 = require("oak-domain/lib/store/relation");
var Expression_1 = require("oak-domain/lib/types/Expression");
;
;
function obscurePass(row, attr, option) {
    return !!((option === null || option === void 0 ? void 0 : option.obscure) && row[attr] === undefined);
}
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
    TreeStore.prototype.supportMultipleCreate = function () {
        return false;
    };
    TreeStore.prototype.supportManyToOneJoin = function () {
        return false;
    };
    TreeStore.prototype.resetInitialData = function (data, stat) {
        var e_1, _a;
        this.store = {};
        for (var entity in data) {
            this.store[entity] = {};
            try {
                for (var _b = (e_1 = void 0, tslib_1.__values(data[entity])), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var row = _c.value;
                    (0, lodash_1.set)(this.store, "".concat(entity, ".").concat(row.id, ".$current"), row);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
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
                return function (node, nodeDict, exprResolveFns) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                    var fns_2, fns_2_1, fn, e_2_1;
                    var e_2, _a;
                    return tslib_1.__generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                _b.trys.push([0, 6, 7, 8]);
                                fns_2 = tslib_1.__values(fns_1), fns_2_1 = fns_2.next();
                                _b.label = 1;
                            case 1:
                                if (!!fns_2_1.done) return [3 /*break*/, 5];
                                fn = fns_2_1.value;
                                return [4 /*yield*/, fn];
                            case 2: return [4 /*yield*/, (_b.sent())(node, nodeDict, exprResolveFns)];
                            case 3:
                                if (!(_b.sent())) {
                                    return [2 /*return*/, false];
                                }
                                _b.label = 4;
                            case 4:
                                fns_2_1 = fns_2.next();
                                return [3 /*break*/, 1];
                            case 5: return [3 /*break*/, 8];
                            case 6:
                                e_2_1 = _b.sent();
                                e_2 = { error: e_2_1 };
                                return [3 /*break*/, 8];
                            case 7:
                                try {
                                    if (fns_2_1 && !fns_2_1.done && (_a = fns_2.return)) _a.call(fns_2);
                                }
                                finally { if (e_2) throw e_2.error; }
                                return [7 /*endfinally*/];
                            case 8: return [2 /*return*/, true];
                        }
                    });
                }); };
            }
            case '$or': {
                var filters = filter[attr];
                var fns_3 = filters.map(function (ele) { return _this.translateFilter(entity, ele, context, option); });
                return function (node, nodeDict, exprResolveFns) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                    var fns_4, fns_4_1, fn, e_3_1;
                    var e_3, _a;
                    return tslib_1.__generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                _b.trys.push([0, 6, 7, 8]);
                                fns_4 = tslib_1.__values(fns_3), fns_4_1 = fns_4.next();
                                _b.label = 1;
                            case 1:
                                if (!!fns_4_1.done) return [3 /*break*/, 5];
                                fn = fns_4_1.value;
                                return [4 /*yield*/, fn];
                            case 2: return [4 /*yield*/, (_b.sent())(node, nodeDict, exprResolveFns)];
                            case 3:
                                if (_b.sent()) {
                                    return [2 /*return*/, true];
                                }
                                _b.label = 4;
                            case 4:
                                fns_4_1 = fns_4.next();
                                return [3 /*break*/, 1];
                            case 5: return [3 /*break*/, 8];
                            case 6:
                                e_3_1 = _b.sent();
                                e_3 = { error: e_3_1 };
                                return [3 /*break*/, 8];
                            case 7:
                                try {
                                    if (fns_4_1 && !fns_4_1.done && (_a = fns_4.return)) _a.call(fns_4);
                                }
                                finally { if (e_3) throw e_3.error; }
                                return [7 /*endfinally*/];
                            case 8: return [2 /*return*/, false];
                        }
                    });
                }); };
            }
            case '$not': {
                var filter2 = filter[attr];
                var fn_1 = this.translateFilter(entity, filter2, context, option);
                return function (node, nodeDict, exprResolveFns) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                    return tslib_1.__generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, fn_1];
                            case 1: return [4 /*yield*/, (_a.sent())(node, nodeDict, exprResolveFns)];
                            case 2:
                                if (_a.sent()) {
                                    return [2 /*return*/, false];
                                }
                                return [2 /*return*/, true];
                        }
                    });
                }); };
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
        var _this = this;
        var expr = this.translateExpressionNode(entity, expression, context, option);
        return function (row, nodeDict) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            var result;
            return tslib_1.__generator(this, function (_a) {
                if (typeof expr !== 'function') {
                    return [2 /*return*/, expr];
                }
                result = expr(row, nodeDict);
                return [2 /*return*/, result];
            });
        }); };
    };
    TreeStore.prototype.translateFulltext = function (entity, filter, context, option) {
        var _this = this;
        // 全文索引查找
        var _a = this.storageSchema, _b = entity, indexes = _a[_b].indexes;
        var fulltextIndex = indexes.find(function (ele) { return ele.config && ele.config.type === 'fulltext'; });
        var attributes = fulltextIndex.attributes;
        var $search = filter.$search;
        return function (node) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            var row, attributes_1, attributes_1_1, attr, name_1;
            var e_4, _a;
            return tslib_1.__generator(this, function (_b) {
                row = this.constructRow(node, context);
                try {
                    for (attributes_1 = tslib_1.__values(attributes), attributes_1_1 = attributes_1.next(); !attributes_1_1.done; attributes_1_1 = attributes_1.next()) {
                        attr = attributes_1_1.value;
                        name_1 = attr.name;
                        if (row && row[name_1] && (typeof row[name_1] === 'string' && row[name_1].contains($search) || obscurePass(row, name_1, option))) {
                            return [2 /*return*/, true];
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
                return [2 /*return*/, false];
            });
        }); };
    };
    TreeStore.prototype.translateAttribute = function (entity, filter, attr, context, option) {
        var _a;
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            // 如果是模糊查询且该属性为undefined，说明没取到，返回true
            function obscurePassLocal(row) {
                return obscurePass(row, attr, option);
            }
            var fns, _loop_1, this_1, _b, _c, _i, op;
            var _this = this;
            return tslib_1.__generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        if (typeof filter !== 'object') {
                            return [2 /*return*/, function (node) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                                    var row;
                                    return tslib_1.__generator(this, function (_a) {
                                        row = this.constructRow(node, context);
                                        return [2 /*return*/, row ? row[attr] === filter || obscurePassLocal(row) : false];
                                    });
                                }); }];
                        }
                        else if (((_a = this.storageSchema[entity].attributes[attr]) === null || _a === void 0 ? void 0 : _a.type) === 'object') {
                            // 如果查询的目标就是object，则转化成object的比较
                            return [2 /*return*/, function (node) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                                    var row;
                                    return tslib_1.__generator(this, function (_a) {
                                        row = this.constructRow(node, context);
                                        return [2 /*return*/, row ? JSON.stringify(row[attr]) === JSON.stringify(filter) || obscurePassLocal(row) : false];
                                    });
                                }); }];
                        }
                        fns = [];
                        _loop_1 = function (op) {
                            var _e, exists_1, inData_1, legalSets_1, err_1, inData_2, legalSets_2, err_2;
                            return tslib_1.__generator(this, function (_f) {
                                switch (_f.label) {
                                    case 0:
                                        _e = op;
                                        switch (_e) {
                                            case '$gt': return [3 /*break*/, 1];
                                            case '$lt': return [3 /*break*/, 2];
                                            case '$gte': return [3 /*break*/, 3];
                                            case '$lte': return [3 /*break*/, 4];
                                            case '$eq': return [3 /*break*/, 5];
                                            case '$ne': return [3 /*break*/, 6];
                                            case '$between': return [3 /*break*/, 7];
                                            case '$startsWith': return [3 /*break*/, 8];
                                            case '$endsWith': return [3 /*break*/, 9];
                                            case '$includes': return [3 /*break*/, 10];
                                            case '$exists': return [3 /*break*/, 11];
                                            case '$in': return [3 /*break*/, 12];
                                            case '$nin': return [3 /*break*/, 18];
                                        }
                                        return [3 /*break*/, 23];
                                    case 1:
                                        {
                                            fns.push(function (row) { return tslib_1.__awaiter(_this, void 0, void 0, function () { return tslib_1.__generator(this, function (_a) {
                                                return [2 /*return*/, row && (row[attr] > filter[op]) || obscurePassLocal(row)];
                                            }); }); });
                                            return [3 /*break*/, 24];
                                        }
                                        _f.label = 2;
                                    case 2:
                                        {
                                            fns.push(function (row) { return tslib_1.__awaiter(_this, void 0, void 0, function () { return tslib_1.__generator(this, function (_a) {
                                                return [2 /*return*/, row && (row[attr] < filter[op]) || obscurePassLocal(row)];
                                            }); }); });
                                            return [3 /*break*/, 24];
                                        }
                                        _f.label = 3;
                                    case 3:
                                        {
                                            fns.push(function (row) { return tslib_1.__awaiter(_this, void 0, void 0, function () { return tslib_1.__generator(this, function (_a) {
                                                return [2 /*return*/, row && (row[attr] >= filter[op]) || obscurePassLocal(row)];
                                            }); }); });
                                            return [3 /*break*/, 24];
                                        }
                                        _f.label = 4;
                                    case 4:
                                        {
                                            fns.push(function (row) { return tslib_1.__awaiter(_this, void 0, void 0, function () { return tslib_1.__generator(this, function (_a) {
                                                return [2 /*return*/, row && (row[attr] <= filter[op]) || obscurePassLocal(row)];
                                            }); }); });
                                            return [3 /*break*/, 24];
                                        }
                                        _f.label = 5;
                                    case 5:
                                        {
                                            fns.push(function (row) { return tslib_1.__awaiter(_this, void 0, void 0, function () { return tslib_1.__generator(this, function (_a) {
                                                return [2 /*return*/, row && (row[attr] === filter[op]) || obscurePassLocal(row)];
                                            }); }); });
                                            return [3 /*break*/, 24];
                                        }
                                        _f.label = 6;
                                    case 6:
                                        {
                                            fns.push(function (row) { return tslib_1.__awaiter(_this, void 0, void 0, function () { return tslib_1.__generator(this, function (_a) {
                                                return [2 /*return*/, row && (row[attr] !== filter[op]) || obscurePassLocal(row)];
                                            }); }); });
                                            return [3 /*break*/, 24];
                                        }
                                        _f.label = 7;
                                    case 7:
                                        {
                                            fns.push(function (row) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                                                return tslib_1.__generator(this, function (_a) {
                                                    return [2 /*return*/, row && (row[attr] >= filter[op][0] && row[attr] <= filter[op][1] || obscurePassLocal(row))];
                                                });
                                            }); });
                                            return [3 /*break*/, 24];
                                        }
                                        _f.label = 8;
                                    case 8:
                                        {
                                            fns.push(function (row) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                                                var _a;
                                                return tslib_1.__generator(this, function (_b) {
                                                    return [2 /*return*/, row && (((_a = row[attr]) === null || _a === void 0 ? void 0 : _a.startsWith(filter[op])) || obscurePassLocal(row))];
                                                });
                                            }); });
                                            return [3 /*break*/, 24];
                                        }
                                        _f.label = 9;
                                    case 9:
                                        {
                                            fns.push(function (row) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                                                var _a;
                                                return tslib_1.__generator(this, function (_b) {
                                                    return [2 /*return*/, row && (((_a = row[attr]) === null || _a === void 0 ? void 0 : _a.$endsWith(filter[op])) || obscurePassLocal(row))];
                                                });
                                            }); });
                                            return [3 /*break*/, 24];
                                        }
                                        _f.label = 10;
                                    case 10:
                                        {
                                            fns.push(function (row) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                                                var _a;
                                                return tslib_1.__generator(this, function (_b) {
                                                    return [2 /*return*/, row && (((_a = row[attr]) === null || _a === void 0 ? void 0 : _a.includes(filter[op])) || obscurePassLocal(row))];
                                                });
                                            }); });
                                            return [3 /*break*/, 24];
                                        }
                                        _f.label = 11;
                                    case 11:
                                        {
                                            exists_1 = filter[op];
                                            (0, assert_1.assert)(typeof exists_1 === 'boolean');
                                            fns.push(function (row) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                                                return tslib_1.__generator(this, function (_a) {
                                                    if (exists_1) {
                                                        return [2 /*return*/, ![null, undefined].includes(row[attr]) || obscurePassLocal(row)];
                                                    }
                                                    else {
                                                        return [2 /*return*/, [null, undefined].includes(row[attr]) || obscurePassLocal(row)];
                                                    }
                                                    return [2 /*return*/];
                                                });
                                            }); });
                                            return [3 /*break*/, 24];
                                        }
                                        _f.label = 12;
                                    case 12:
                                        inData_1 = filter[op];
                                        (0, assert_1.assert)(typeof inData_1 === 'object');
                                        if (!(inData_1 instanceof Array)) return [3 /*break*/, 13];
                                        fns.push(function (row) { return tslib_1.__awaiter(_this, void 0, void 0, function () { return tslib_1.__generator(this, function (_a) {
                                            return [2 /*return*/, inData_1.includes(row[attr]) || obscurePassLocal(row)];
                                        }); }); });
                                        return [3 /*break*/, 17];
                                    case 13:
                                        if (!(option === null || option === void 0 ? void 0 : option.obscure)) return [3 /*break*/, 14];
                                        fns.push(function () { return tslib_1.__awaiter(_this, void 0, void 0, function () { return tslib_1.__generator(this, function (_a) {
                                            return [2 /*return*/, true];
                                        }); }); });
                                        return [3 /*break*/, 17];
                                    case 14:
                                        _f.trys.push([14, 16, , 17]);
                                        return [4 /*yield*/, this_1.selectAbjointRow(inData_1.entity, inData_1, context, option)];
                                    case 15:
                                        legalSets_1 = (_f.sent()).map(function (ele) {
                                            var data = inData_1.data;
                                            var key = Object.keys(data)[0];
                                            return ele[key];
                                        });
                                        fns.push(function (row) { return tslib_1.__awaiter(_this, void 0, void 0, function () { return tslib_1.__generator(this, function (_a) {
                                            return [2 /*return*/, legalSets_1.includes(row[attr])];
                                        }); }); });
                                        return [3 /*break*/, 17];
                                    case 16:
                                        err_1 = _f.sent();
                                        if (err_1 instanceof OakError_1.OakError && err_1.$$code === RowStore_1.RowStore.$$CODES.expressionUnresolved[0]) {
                                            fns.push(function (row, nodeDict) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                                                var option2, legalSets;
                                                return tslib_1.__generator(this, function (_a) {
                                                    switch (_a.label) {
                                                        case 0:
                                                            option2 = Object.assign({}, option, { nodeDict: nodeDict });
                                                            return [4 /*yield*/, this.selectAbjointRow(inData_1.entity, inData_1, context, option2)];
                                                        case 1:
                                                            legalSets = (_a.sent()).map(function (ele) {
                                                                var data = inData_1.data;
                                                                var key = Object.keys(data)[0];
                                                                return ele[key];
                                                            });
                                                            return [2 /*return*/, legalSets.includes(row[attr])];
                                                    }
                                                });
                                            }); });
                                        }
                                        else {
                                            throw err_1;
                                        }
                                        return [3 /*break*/, 17];
                                    case 17: return [3 /*break*/, 24];
                                    case 18:
                                        inData_2 = filter[op];
                                        (0, assert_1.assert)(typeof inData_2 === 'object');
                                        if (!(inData_2 instanceof Array)) return [3 /*break*/, 19];
                                        fns.push(function (row) { return tslib_1.__awaiter(_this, void 0, void 0, function () { return tslib_1.__generator(this, function (_a) {
                                            return [2 /*return*/, !inData_2.includes(row[attr]) || obscurePassLocal(row)];
                                        }); }); });
                                        return [3 /*break*/, 22];
                                    case 19:
                                        _f.trys.push([19, 21, , 22]);
                                        return [4 /*yield*/, this_1.selectAbjointRow(inData_2.entity, inData_2, context, option)];
                                    case 20:
                                        legalSets_2 = (_f.sent()).map(function (ele) {
                                            var data = inData_2.data;
                                            var key = Object.keys(data)[0];
                                            return ele[key];
                                        });
                                        fns.push(function (row) { return tslib_1.__awaiter(_this, void 0, void 0, function () { return tslib_1.__generator(this, function (_a) {
                                            return [2 /*return*/, !legalSets_2.includes(row[attr]) || obscurePassLocal(row)];
                                        }); }); });
                                        return [3 /*break*/, 22];
                                    case 21:
                                        err_2 = _f.sent();
                                        if (err_2 instanceof OakError_1.OakError && err_2.$$code === RowStore_1.RowStore.$$CODES.expressionUnresolved[0]) {
                                            fns.push(function (row, nodeDict) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                                                var option2, legalSets;
                                                return tslib_1.__generator(this, function (_a) {
                                                    switch (_a.label) {
                                                        case 0:
                                                            option2 = Object.assign({}, option, { nodeDict: nodeDict });
                                                            return [4 /*yield*/, this.selectAbjointRow(inData_2.entity, inData_2, context, option2)];
                                                        case 1:
                                                            legalSets = (_a.sent()).map(function (ele) {
                                                                var data = inData_2.data;
                                                                var key = Object.keys(data)[0];
                                                                return ele[key];
                                                            });
                                                            return [2 /*return*/, !legalSets.includes(row[attr]) || obscurePassLocal(row)];
                                                    }
                                                });
                                            }); });
                                        }
                                        else {
                                            throw err_2;
                                        }
                                        return [3 /*break*/, 22];
                                    case 22: return [3 /*break*/, 24];
                                    case 23: return [3 /*break*/, 24];
                                    case 24: return [2 /*return*/];
                                }
                            });
                        };
                        this_1 = this;
                        _b = [];
                        for (_c in filter)
                            _b.push(_c);
                        _i = 0;
                        _d.label = 1;
                    case 1:
                        if (!(_i < _b.length)) return [3 /*break*/, 4];
                        op = _b[_i];
                        return [5 /*yield**/, _loop_1(op)];
                    case 2:
                        _d.sent();
                        _d.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/, function (node, nodeDict, exprResolveFns) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                            var row, fns_5, fns_5_1, fn, e_5_1;
                            var e_5, _a;
                            return tslib_1.__generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        row = this.constructRow(node, context);
                                        if (!row) {
                                            return [2 /*return*/, false];
                                        }
                                        _b.label = 1;
                                    case 1:
                                        _b.trys.push([1, 6, 7, 8]);
                                        fns_5 = tslib_1.__values(fns), fns_5_1 = fns_5.next();
                                        _b.label = 2;
                                    case 2:
                                        if (!!fns_5_1.done) return [3 /*break*/, 5];
                                        fn = fns_5_1.value;
                                        return [4 /*yield*/, fn(row, nodeDict, exprResolveFns)];
                                    case 3:
                                        if ((_b.sent()) === false) {
                                            return [2 /*return*/, false];
                                        }
                                        _b.label = 4;
                                    case 4:
                                        fns_5_1 = fns_5.next();
                                        return [3 /*break*/, 2];
                                    case 5: return [3 /*break*/, 8];
                                    case 6:
                                        e_5_1 = _b.sent();
                                        e_5 = { error: e_5_1 };
                                        return [3 /*break*/, 8];
                                    case 7:
                                        try {
                                            if (fns_5_1 && !fns_5_1.done && (_a = fns_5.return)) _a.call(fns_5);
                                        }
                                        finally { if (e_5) throw e_5.error; }
                                        return [7 /*endfinally*/];
                                    case 8: return [2 /*return*/, true];
                                }
                            });
                        }); }];
                }
            });
        });
    };
    TreeStore.prototype.translateFilter = function (entity, filter, context, option) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var fns, nodeId, _loop_2, this_2, _a, _b, _i, attr;
            var _this = this;
            return tslib_1.__generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        fns = [];
                        _loop_2 = function (attr) {
                            var fn_2, relation_2, _d, _e, fn_3, fn_4;
                            return tslib_1.__generator(this, function (_f) {
                                switch (_f.label) {
                                    case 0:
                                        if (!(attr === '#id')) return [3 /*break*/, 1];
                                        nodeId = filter['#id'];
                                        return [3 /*break*/, 10];
                                    case 1:
                                        if (!['$and', '$or', '$xor', '$not'].includes(attr)) return [3 /*break*/, 2];
                                        fns.push(this_2.translateLogicFilter(entity, filter, attr, context, option));
                                        return [3 /*break*/, 10];
                                    case 2:
                                        if (!attr.toLowerCase().startsWith(Demand_1.EXPRESSION_PREFIX)) return [3 /*break*/, 3];
                                        fn_2 = this_2.translateExpression(entity, filter[attr], context, option);
                                        fns.push(function (node, nodeDict, exprResolveFns) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                                            var row, result;
                                            return tslib_1.__generator(this, function (_a) {
                                                switch (_a.label) {
                                                    case 0:
                                                        row = this.constructRow(node, context);
                                                        if (!row) {
                                                            return [2 /*return*/, false];
                                                        }
                                                        return [4 /*yield*/, fn_2(row, nodeDict)];
                                                    case 1:
                                                        result = _a.sent();
                                                        if (typeof result === 'function') {
                                                            exprResolveFns.push(result);
                                                        }
                                                        return [2 /*return*/, !!result];
                                                }
                                            });
                                        }); });
                                        return [3 /*break*/, 10];
                                    case 3:
                                        if (!(attr.toLowerCase() === '$text')) return [3 /*break*/, 4];
                                        fns.push(this_2.translateFulltext(entity, filter[attr], context, option));
                                        return [3 /*break*/, 10];
                                    case 4:
                                        relation_2 = (0, relation_1.judgeRelation)(this_2.storageSchema, entity, attr);
                                        if (!(relation_2 === 1)) return [3 /*break*/, 6];
                                        // 行本身的属性
                                        _e = (_d = fns).push;
                                        return [4 /*yield*/, this_2.translateAttribute(entity, filter[attr], attr, context, option)];
                                    case 5:
                                        // 行本身的属性
                                        _e.apply(_d, [_f.sent()]);
                                        return [3 /*break*/, 10];
                                    case 6:
                                        if (!(relation_2 === 2)) return [3 /*break*/, 8];
                                        return [4 /*yield*/, this_2.translateFilter(attr, filter[attr], context, option)];
                                    case 7:
                                        fn_3 = _f.sent();
                                        fns.push(function (node, nodeDict, exprResolveFns) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                                            var row, node2;
                                            return tslib_1.__generator(this, function (_a) {
                                                row = this.constructRow(node, context);
                                                if (obscurePass(row, 'entity', option) || obscurePass(row, 'entityId', option)) {
                                                    return [2 /*return*/, true];
                                                }
                                                if (row.entity !== attr || !row.entityId) {
                                                    return [2 /*return*/, false];
                                                }
                                                node2 = (0, lodash_1.get)(this.store, "".concat(attr, ".").concat(row.entityId));
                                                if (!node2) {
                                                    if (option === null || option === void 0 ? void 0 : option.obscure) {
                                                        return [2 /*return*/, true];
                                                    }
                                                    return [2 /*return*/, false];
                                                }
                                                return [2 /*return*/, fn_3(node2, nodeDict, exprResolveFns)];
                                            });
                                        }); });
                                        return [3 /*break*/, 10];
                                    case 8:
                                        (0, assert_1.assert)(typeof relation_2 === 'string');
                                        return [4 /*yield*/, this_2.translateFilter(relation_2, filter[attr], context, option)];
                                    case 9:
                                        fn_4 = _f.sent();
                                        fns.push(function (node, nodeDict, exprResolveFns) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                                            var row, node2;
                                            return tslib_1.__generator(this, function (_a) {
                                                row = this.constructRow(node, context);
                                                if (obscurePass(row, "".concat(attr, "Id"), option)) {
                                                    return [2 /*return*/, true];
                                                }
                                                if (row["".concat(attr, "Id")]) {
                                                    node2 = (0, lodash_1.get)(this.store, "".concat(relation_2, ".").concat(row["".concat(attr, "Id")]));
                                                    if (!node2) {
                                                        if (option === null || option === void 0 ? void 0 : option.obscure) {
                                                            return [2 /*return*/, true];
                                                        }
                                                        return [2 /*return*/, false];
                                                    }
                                                    return [2 /*return*/, fn_4(node2, nodeDict, exprResolveFns)];
                                                }
                                                return [2 /*return*/, false];
                                            });
                                        }); });
                                        _f.label = 10;
                                    case 10: return [2 /*return*/];
                                }
                            });
                        };
                        this_2 = this;
                        _a = [];
                        for (_b in filter)
                            _a.push(_b);
                        _i = 0;
                        _c.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 4];
                        attr = _a[_i];
                        return [5 /*yield**/, _loop_2(attr)];
                    case 2:
                        _c.sent();
                        _c.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/, function (node, nodeDict, exprResolveFns) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
                            var row, fns_6, fns_6_1, fn, e_6_1;
                            var _a, e_6, _b;
                            return tslib_1.__generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0:
                                        if (nodeId) {
                                            (0, assert_1.assert)(!nodeDict.hasOwnProperty(nodeId), new OakError_1.OakError(RowStore_1.RowStore.$$LEVEL, RowStore_1.RowStore.$$CODES.nodeIdRepeated, "Filter\u4E2D\u7684nodeId\u300C".concat(nodeId, "\u300D\u51FA\u73B0\u4E86\u591A\u6B21")));
                                            Object.assign(nodeDict, (_a = {},
                                                _a[nodeId] = this.constructRow(node, context),
                                                _a));
                                        }
                                        row = this.constructRow(node, context);
                                        if (!row) {
                                            return [2 /*return*/, false];
                                        }
                                        _c.label = 1;
                                    case 1:
                                        _c.trys.push([1, 6, 7, 8]);
                                        fns_6 = tslib_1.__values(fns), fns_6_1 = fns_6.next();
                                        _c.label = 2;
                                    case 2:
                                        if (!!fns_6_1.done) return [3 /*break*/, 5];
                                        fn = fns_6_1.value;
                                        return [4 /*yield*/, fn(node, nodeDict, exprResolveFns)];
                                    case 3:
                                        if (!(_c.sent())) {
                                            return [2 /*return*/, false];
                                        }
                                        _c.label = 4;
                                    case 4:
                                        fns_6_1 = fns_6.next();
                                        return [3 /*break*/, 2];
                                    case 5: return [3 /*break*/, 8];
                                    case 6:
                                        e_6_1 = _c.sent();
                                        e_6 = { error: e_6_1 };
                                        return [3 /*break*/, 8];
                                    case 7:
                                        try {
                                            if (fns_6_1 && !fns_6_1.done && (_b = fns_6.return)) _b.call(fns_6);
                                        }
                                        finally { if (e_6) throw e_6.error; }
                                        return [7 /*endfinally*/];
                                    case 8: return [2 /*return*/, true];
                                }
                            });
                        }); }];
                }
            });
        });
    };
    TreeStore.prototype.translateSorter = function (entity, sorter, context) {
        var _this = this;
        var compare = function (row1, row2, entity2, sortAttr, direction) {
            var row11 = row1;
            var row22 = row2;
            (0, assert_1.assert)(Object.keys(sortAttr).length === 1);
            var attr = Object.keys(sortAttr)[0];
            var relation = (0, relation_1.judgeRelation)(_this.storageSchema, entity2, attr);
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
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var filter, nodeDict, filterFn, entityNodes, nodes, entityNodes_1, entityNodes_1_1, n, nodeDict2, exprResolveFns, _a, exprResult, exprResolveFns_1, exprResolveFns_1_1, fn, result, e_8_1, rows, rows2;
            var e_8, _b, e_9, _c;
            var _this = this;
            return tslib_1.__generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        filter = selection.filter;
                        nodeDict = option === null || option === void 0 ? void 0 : option.nodeDict;
                        filterFn = filter && this.translateFilter(entity, filter, context, option);
                        entityNodes = this.store[entity] ? Object.values(this.store[entity]) : [];
                        nodes = [];
                        _d.label = 1;
                    case 1:
                        _d.trys.push([1, 8, 9, 10]);
                        entityNodes_1 = tslib_1.__values(entityNodes), entityNodes_1_1 = entityNodes_1.next();
                        _d.label = 2;
                    case 2:
                        if (!!entityNodes_1_1.done) return [3 /*break*/, 7];
                        n = entityNodes_1_1.value;
                        nodeDict2 = {};
                        if (nodeDict) {
                            Object.assign(nodeDict2, nodeDict);
                        }
                        exprResolveFns = [];
                        _a = !filterFn;
                        if (_a) return [3 /*break*/, 5];
                        return [4 /*yield*/, filterFn];
                    case 3: return [4 /*yield*/, (_d.sent())(n, nodeDict2, exprResolveFns)];
                    case 4:
                        _a = (_d.sent());
                        _d.label = 5;
                    case 5:
                        if (_a) {
                            exprResult = true;
                            if (exprResolveFns.length > 0) {
                                try {
                                    for (exprResolveFns_1 = (e_9 = void 0, tslib_1.__values(exprResolveFns)), exprResolveFns_1_1 = exprResolveFns_1.next(); !exprResolveFns_1_1.done; exprResolveFns_1_1 = exprResolveFns_1.next()) {
                                        fn = exprResolveFns_1_1.value;
                                        result = fn(nodeDict2);
                                        if (typeof result === 'function') {
                                            throw new OakError_1.OakError(RowStore_1.RowStore.$$LEVEL, RowStore_1.RowStore.$$CODES.expressionUnresolved, "\u8868\u8FBE\u5F0F\u8BA1\u7B97\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5Filter\u4E2D\u7684\u7ED3\u70B9\u7F16\u53F7\u548C\u5F15\u7528\u662F\u5426\u4E00\u81F4");
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
                                        if (exprResolveFns_1_1 && !exprResolveFns_1_1.done && (_c = exprResolveFns_1.return)) _c.call(exprResolveFns_1);
                                    }
                                    finally { if (e_9) throw e_9.error; }
                                }
                            }
                            if (exprResult) {
                                nodes.push(n);
                            }
                        }
                        _d.label = 6;
                    case 6:
                        entityNodes_1_1 = entityNodes_1.next();
                        return [3 /*break*/, 2];
                    case 7: return [3 /*break*/, 10];
                    case 8:
                        e_8_1 = _d.sent();
                        e_8 = { error: e_8_1 };
                        return [3 /*break*/, 10];
                    case 9:
                        try {
                            if (entityNodes_1_1 && !entityNodes_1_1.done && (_b = entityNodes_1.return)) _b.call(entityNodes_1);
                        }
                        finally { if (e_8) throw e_8.error; }
                        return [7 /*endfinally*/];
                    case 10:
                        rows = nodes.map(function (node) { return _this.constructRow(node, context); });
                        return [4 /*yield*/, this.formResult(entity, rows, selection, context)];
                    case 11:
                        rows2 = _d.sent();
                        return [2 /*return*/, rows2];
                }
            });
        });
    };
    TreeStore.prototype.updateAbjointRow = function (entity, operation, context, option) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var data, action, operId, _a, id, node, node2, selection, rows, ids;
            var _this = this;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        data = operation.data, action = operation.action, operId = operation.id;
                        _a = action;
                        switch (_a) {
                            case 'create': return [3 /*break*/, 1];
                        }
                        return [3 /*break*/, 2];
                    case 1:
                        {
                            id = data.id;
                            (0, assert_1.assert)(id);
                            // const node = this.store[entity] && (this.store[entity]!)[id as string];
                            // const row = node && this.constructRow(node, context) || {};
                            /* if (row) {
                                throw new OakError(RowStore.$$LEVEL, RowStore.$$CODES.primaryKeyConfilict);
                            } */
                            if (this.store[entity] && (this.store[entity])[id]) {
                                node = this.store[entity] && (this.store[entity])[id];
                                throw new Exception_1.OakCongruentRowExists(this.constructRow(node, context));
                            }
                            node2 = {
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
                            return [2 /*return*/, 1];
                        }
                        _b.label = 2;
                    case 2:
                        selection = {
                            data: {
                                id: 1,
                            },
                            filter: operation.filter,
                            indexFrom: operation.indexFrom,
                            count: operation.count,
                        };
                        return [4 /*yield*/, this.selectAbjointRow(entity, selection, context)];
                    case 3:
                        rows = _b.sent();
                        ids = rows.map(function (ele) { return ele.id; });
                        ids.forEach(function (id) {
                            var alreadyDirtyNode = false;
                            var node = (_this.store[entity])[id];
                            (0, assert_1.assert)(node);
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
                                    _this.addToTxnNode(node, context, 'remove');
                                }
                            }
                            else {
                                node.$next = Object.assign(node.$next || {}, data);
                                if (!alreadyDirtyNode) {
                                    // 如果已经更新过的结点就不能再加了，会形成循环
                                    _this.addToTxnNode(node, context, 'update');
                                }
                            }
                        });
                        return [2 /*return*/, rows.length];
                }
            });
        });
    };
    TreeStore.prototype.doOperation = function (entity, operation, context, option) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var action;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        action = operation.action;
                        if (!(action === 'select')) return [3 /*break*/, 1];
                        throw new Error('现在不支持使用select operation');
                    case 1: return [4 /*yield*/, this.cascadeUpdate(entity, operation, context, option)];
                    case 2: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    TreeStore.prototype.operate = function (entity, operation, context, option) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        (0, assert_1.assert)(context.getCurrentTxnId());
                        return [4 /*yield*/, this.doOperation(entity, operation, context, option)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    TreeStore.prototype.formProjection = function (entity, row, data, result, nodeDict, context) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var row2, data2, laterExprDict, _a, _b, _i, attr, ExprNodeTranslator, exprResult, nodeId, _c, _d, _e, attr, relation, result2, entity_1, entityId, result2, result2, attr, exprResult;
            var _f, _g, _h, _j, _k, _l, _m, _o;
            return tslib_1.__generator(this, function (_p) {
                switch (_p.label) {
                    case 0:
                        row2 = row;
                        data2 = data;
                        laterExprDict = {};
                        _a = [];
                        for (_b in data)
                            _a.push(_b);
                        _i = 0;
                        _p.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 5];
                        attr = _a[_i];
                        if (!attr.startsWith(Demand_1.EXPRESSION_PREFIX)) return [3 /*break*/, 3];
                        ExprNodeTranslator = this.translateExpression(entity, data2[attr], context, {});
                        return [4 /*yield*/, ExprNodeTranslator(row, nodeDict)];
                    case 2:
                        exprResult = _p.sent();
                        if (typeof exprResult === 'function') {
                            Object.assign(laterExprDict, (_f = {},
                                _f[attr] = exprResult,
                                _f));
                        }
                        else {
                            Object.assign(result, (_g = {},
                                _g[attr] = exprResult,
                                _g));
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        if (attr === '#id') {
                            nodeId = data[attr];
                            (0, assert_1.assert)(!nodeDict.hasOwnProperty(nodeId), new OakError_1.OakError(RowStore_1.RowStore.$$LEVEL, RowStore_1.RowStore.$$CODES.nodeIdRepeated, "Filter\u4E2D\u7684nodeId\u300C".concat(nodeId, "\u300D\u51FA\u73B0\u4E86\u591A\u6B21")));
                            Object.assign(nodeDict, (_h = {},
                                _h[nodeId] = row,
                                _h));
                        }
                        _p.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 1];
                    case 5:
                        _c = [];
                        for (_d in data)
                            _c.push(_d);
                        _e = 0;
                        _p.label = 6;
                    case 6:
                        if (!(_e < _c.length)) return [3 /*break*/, 16];
                        attr = _c[_e];
                        if (!(!attr.startsWith(Demand_1.EXPRESSION_PREFIX) && attr !== '#id')) return [3 /*break*/, 15];
                        relation = (0, relation_1.judgeRelation)(this.storageSchema, entity, attr);
                        if (!(relation === 1)) return [3 /*break*/, 7];
                        Object.assign(result, (_j = {},
                            _j[attr] = row2[attr],
                            _j));
                        return [3 /*break*/, 15];
                    case 7:
                        if (!(relation === 2)) return [3 /*break*/, 10];
                        if (!row2[attr]) return [3 /*break*/, 9];
                        result2 = {};
                        entity_1 = row2.entity, entityId = row2.entityId;
                        return [4 /*yield*/, this.formProjection(attr, row2[attr], data2[attr], result2, nodeDict, context)];
                    case 8:
                        _p.sent();
                        Object.assign(result, (_k = {},
                            _k[attr] = result2,
                            _k.entity = entity_1,
                            _k.entityId = entityId,
                            _k));
                        _p.label = 9;
                    case 9: return [3 /*break*/, 15];
                    case 10:
                        if (!(typeof relation === 'string')) return [3 /*break*/, 13];
                        if (!row2[attr]) return [3 /*break*/, 12];
                        result2 = {};
                        return [4 /*yield*/, this.formProjection(relation, row2[attr], data2[attr], result2, nodeDict, context)];
                    case 11:
                        _p.sent();
                        Object.assign(result, (_l = {},
                            _l[attr] = result2,
                            _l));
                        _p.label = 12;
                    case 12: return [3 /*break*/, 15];
                    case 13:
                        (0, assert_1.assert)(relation instanceof Array);
                        if (!(row2[attr] instanceof Array)) return [3 /*break*/, 15];
                        return [4 /*yield*/, this.formResult(relation[0], row2[attr], data2[attr], context, nodeDict)];
                    case 14:
                        result2 = _p.sent();
                        Object.assign(result, (_m = {},
                            _m[attr] = result2,
                            _m));
                        _p.label = 15;
                    case 15:
                        _e++;
                        return [3 /*break*/, 6];
                    case 16:
                        for (attr in laterExprDict) {
                            exprResult = laterExprDict[attr](nodeDict);
                            // projection是不应出现计算不出来的情况
                            (0, assert_1.assert)(typeof exprResult !== 'function', new OakError_1.OakError(RowStore_1.RowStore.$$LEVEL, RowStore_1.RowStore.$$CODES.expressionUnresolved, 'data中的expr无法计算，请检查命名与引用的一致性'));
                            Object.assign(result, (_o = {},
                                _o[attr] = exprResult,
                                _o));
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    TreeStore.prototype.formResult = function (entity, rows, selection, context, nodeDict) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var data, sorter, indexFrom, count, findAvailableExprName, sortToProjection, rows2, rows_1, rows_1_1, row, result, nodeDict2, e_10_1, sorterFn;
            var e_10, _a;
            var _this = this;
            return tslib_1.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        data = selection.data, sorter = selection.sorter, indexFrom = selection.indexFrom, count = selection.count;
                        findAvailableExprName = function (current) {
                            var counter = 1;
                            while (counter < 20) {
                                var exprName = "$expr".concat(counter++);
                                if (!current.includes(exprName)) {
                                    return exprName;
                                }
                            }
                            (0, assert_1.assert)(false, '找不到可用的expr命名');
                        };
                        sortToProjection = function (entity2, proj, sort) {
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
                                var rel = (0, relation_1.judgeRelation)(_this.storageSchema, entity2, attr);
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
                        rows2 = [];
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 6, 7, 8]);
                        rows_1 = tslib_1.__values(rows), rows_1_1 = rows_1.next();
                        _b.label = 2;
                    case 2:
                        if (!!rows_1_1.done) return [3 /*break*/, 5];
                        row = rows_1_1.value;
                        result = {};
                        nodeDict2 = {};
                        if (nodeDict) {
                            Object.assign(nodeDict2, nodeDict);
                        }
                        return [4 /*yield*/, this.formProjection(entity, row, data, result, nodeDict2, context)];
                    case 3:
                        _b.sent();
                        rows2.push(result);
                        _b.label = 4;
                    case 4:
                        rows_1_1 = rows_1.next();
                        return [3 /*break*/, 2];
                    case 5: return [3 /*break*/, 8];
                    case 6:
                        e_10_1 = _b.sent();
                        e_10 = { error: e_10_1 };
                        return [3 /*break*/, 8];
                    case 7:
                        try {
                            if (rows_1_1 && !rows_1_1.done && (_a = rows_1.return)) _a.call(rows_1);
                        }
                        finally { if (e_10) throw e_10.error; }
                        return [7 /*endfinally*/];
                    case 8:
                        // 再计算sorter
                        if (sorter) {
                            sorterFn = this.translateSorter(entity, sorter, context);
                            rows2.sort(sorterFn);
                        }
                        // 最后用indexFrom和count来截断
                        if (typeof indexFrom === 'number') {
                            return [2 /*return*/, rows2.slice(indexFrom, indexFrom + count)];
                        }
                        else {
                            return [2 /*return*/, rows2];
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    TreeStore.prototype.select = function (entity, selection, context, option) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var result;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        (0, assert_1.assert)(context.getCurrentTxnId());
                        return [4 /*yield*/, this.cascadeSelect(entity, selection, context, option)];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, {
                                result: result,
                                // stats,
                            }];
                }
            });
        });
    };
    TreeStore.prototype.count = function (entity, selection, context, option) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var result;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.select(entity, Object.assign({}, selection, {
                            data: {
                                id: 1,
                            }
                        }), context, Object.assign({}, option, {
                            dontCollect: true,
                        }))];
                    case 1:
                        result = (_a.sent()).result;
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
    TreeStore.prototype.begin = function () {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var uuid;
            var _a;
            return tslib_1.__generator(this, function (_b) {
                uuid = "".concat(Math.random());
                (0, assert_1.assert)(!this.activeTxnDict.hasOwnProperty(uuid));
                Object.assign(this.activeTxnDict, (_a = {},
                    _a[uuid] = {
                        create: 0,
                        update: 0,
                        remove: 0,
                    },
                    _a));
                return [2 /*return*/, uuid];
            });
        });
    };
    TreeStore.prototype.commit = function (uuid) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var node, node2;
            return tslib_1.__generator(this, function (_a) {
                (0, assert_1.assert)(this.activeTxnDict.hasOwnProperty(uuid), uuid);
                node = this.activeTxnDict[uuid].nodeHeader;
                while (node) {
                    node2 = node.$nextNode;
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
                (0, lodash_1.unset)(this.activeTxnDict, uuid);
                return [2 /*return*/];
            });
        });
    };
    TreeStore.prototype.rollback = function (uuid) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var node, node2;
            return tslib_1.__generator(this, function (_a) {
                (0, assert_1.assert)(this.activeTxnDict.hasOwnProperty(uuid));
                node = this.activeTxnDict[uuid].nodeHeader;
                while (node) {
                    node2 = node.$nextNode;
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
                (0, lodash_1.unset)(this.activeTxnDict, uuid);
                return [2 /*return*/];
            });
        });
    };
    // 将输入的OpRecord同步到数据中
    TreeStore.prototype.sync = function (opRecords, context) {
        return tslib_1.__awaiter(this, void 0, void 0, function () {
            var opRecords_1, opRecords_1_1, record, _a, e, d, d_1, d_1_1, dd, e_11_1, _b, e, d, f, _c, e, f, d, _d, _e, _i, entity, _f, _g, _h, id, e_12_1;
            var e_12, _j, e_11, _k;
            return tslib_1.__generator(this, function (_l) {
                switch (_l.label) {
                    case 0:
                        _l.trys.push([0, 34, 35, 36]);
                        opRecords_1 = tslib_1.__values(opRecords), opRecords_1_1 = opRecords_1.next();
                        _l.label = 1;
                    case 1:
                        if (!!opRecords_1_1.done) return [3 /*break*/, 33];
                        record = opRecords_1_1.value;
                        _a = record.a;
                        switch (_a) {
                            case 'c': return [3 /*break*/, 2];
                            case 'u': return [3 /*break*/, 18];
                            case 'r': return [3 /*break*/, 20];
                            case 's': return [3 /*break*/, 22];
                        }
                        return [3 /*break*/, 31];
                    case 2:
                        e = record.e, d = record.d;
                        if (!(d instanceof Array)) return [3 /*break*/, 13];
                        _l.label = 3;
                    case 3:
                        _l.trys.push([3, 10, 11, 12]);
                        d_1 = (e_11 = void 0, tslib_1.__values(d)), d_1_1 = d_1.next();
                        _l.label = 4;
                    case 4:
                        if (!!d_1_1.done) return [3 /*break*/, 9];
                        dd = d_1_1.value;
                        if (!(this.store[e] && this.store[e][dd.id])) return [3 /*break*/, 6];
                        return [4 /*yield*/, this.updateAbjointRow(e, {
                                id: 'dummy',
                                action: 'update',
                                data: dd,
                                filter: {
                                    id: dd.id,
                                },
                            }, context, {
                                dontCollect: true,
                                dontCreateOper: true,
                            })];
                    case 5:
                        _l.sent();
                        return [3 /*break*/, 8];
                    case 6: return [4 /*yield*/, this.updateAbjointRow(e, {
                            id: 'dummy',
                            action: 'create',
                            data: dd,
                        }, context, {
                            dontCollect: true,
                            dontCreateOper: true,
                        })];
                    case 7:
                        _l.sent();
                        _l.label = 8;
                    case 8:
                        d_1_1 = d_1.next();
                        return [3 /*break*/, 4];
                    case 9: return [3 /*break*/, 12];
                    case 10:
                        e_11_1 = _l.sent();
                        e_11 = { error: e_11_1 };
                        return [3 /*break*/, 12];
                    case 11:
                        try {
                            if (d_1_1 && !d_1_1.done && (_k = d_1.return)) _k.call(d_1);
                        }
                        finally { if (e_11) throw e_11.error; }
                        return [7 /*endfinally*/];
                    case 12: return [3 /*break*/, 17];
                    case 13:
                        if (!(this.store[e] && this.store[e][d.id])) return [3 /*break*/, 15];
                        return [4 /*yield*/, this.updateAbjointRow(e, {
                                id: 'dummy',
                                action: 'update',
                                data: d,
                                filter: {
                                    id: d.id,
                                },
                            }, context, {
                                dontCollect: true,
                                dontCreateOper: true,
                            })];
                    case 14:
                        _l.sent();
                        return [3 /*break*/, 17];
                    case 15: return [4 /*yield*/, this.updateAbjointRow(e, {
                            id: 'dummy',
                            action: 'create',
                            data: d,
                        }, context, {
                            dontCollect: true,
                            dontCreateOper: true,
                        })];
                    case 16:
                        _l.sent();
                        _l.label = 17;
                    case 17: return [3 /*break*/, 32];
                    case 18:
                        _b = record, e = _b.e, d = _b.d, f = _b.f;
                        return [4 /*yield*/, this.updateAbjointRow(e, {
                                id: 'dummy',
                                action: 'update',
                                data: d,
                                filter: f,
                            }, context, {
                                dontCollect: true,
                                dontCreateOper: true,
                            })];
                    case 19:
                        _l.sent();
                        return [3 /*break*/, 32];
                    case 20:
                        _c = record, e = _c.e, f = _c.f;
                        return [4 /*yield*/, this.updateAbjointRow(e, {
                                id: 'dummy',
                                action: 'remove',
                                data: {},
                                filter: f,
                            }, context, {
                                dontCollect: true,
                                dontCreateOper: true,
                            })];
                    case 21:
                        _l.sent();
                        return [3 /*break*/, 32];
                    case 22:
                        d = record.d;
                        _d = [];
                        for (_e in d)
                            _d.push(_e);
                        _i = 0;
                        _l.label = 23;
                    case 23:
                        if (!(_i < _d.length)) return [3 /*break*/, 30];
                        entity = _d[_i];
                        _f = [];
                        for (_g in d[entity])
                            _f.push(_g);
                        _h = 0;
                        _l.label = 24;
                    case 24:
                        if (!(_h < _f.length)) return [3 /*break*/, 29];
                        id = _f[_h];
                        if (!(this.store[entity] && this.store[entity][id])) return [3 /*break*/, 26];
                        return [4 /*yield*/, this.updateAbjointRow(entity, {
                                id: 'dummy',
                                action: 'update',
                                data: d[entity][id],
                                filter: {
                                    id: id,
                                },
                            }, context, {
                                dontCollect: true,
                                dontCreateOper: true,
                            })];
                    case 25:
                        _l.sent();
                        return [3 /*break*/, 28];
                    case 26: return [4 /*yield*/, this.updateAbjointRow(entity, {
                            id: 'dummy',
                            action: 'create',
                            data: d[entity][id],
                        }, context, {
                            dontCollect: true,
                            dontCreateOper: true,
                        })];
                    case 27:
                        _l.sent();
                        _l.label = 28;
                    case 28:
                        _h++;
                        return [3 /*break*/, 24];
                    case 29:
                        _i++;
                        return [3 /*break*/, 23];
                    case 30: return [3 /*break*/, 32];
                    case 31:
                        {
                            (0, assert_1.assert)(false);
                        }
                        _l.label = 32;
                    case 32:
                        opRecords_1_1 = opRecords_1.next();
                        return [3 /*break*/, 1];
                    case 33: return [3 /*break*/, 36];
                    case 34:
                        e_12_1 = _l.sent();
                        e_12 = { error: e_12_1 };
                        return [3 /*break*/, 36];
                    case 35:
                        try {
                            if (opRecords_1_1 && !opRecords_1_1.done && (_j = opRecords_1.return)) _j.call(opRecords_1);
                        }
                        finally { if (e_12) throw e_12.error; }
                        return [7 /*endfinally*/];
                    case 36: return [2 /*return*/];
                }
            });
        });
    };
    return TreeStore;
}(CascadeStore_1.CascadeStore));
exports.default = TreeStore;
