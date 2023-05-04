import { cloneDeep, get, groupBy, set, unset, difference, intersection } from 'oak-domain/lib/utils/lodash';
import { assert } from 'oak-domain/lib/utils/assert';
import {
    EntityShape, OperationResult, OperateOption, OpRecord,
    UpdateOpResult, RemoveOpResult, SelectOpResult,
    EntityDict, SelectOption, DeleteAtAttribute, AggregationResult, AggregationOp, CreateAtAttribute, UpdateAtAttribute
} from "oak-domain/lib/types/Entity";
import { ExpressionKey, EXPRESSION_PREFIX, NodeId, RefAttr } from 'oak-domain/lib/types/Demand';
import { OakCongruentRowExists, OakException, OakRowUnexistedException } from 'oak-domain/lib/types/Exception';
import { EntityDict as BaseEntityDict } from 'oak-domain/lib/base-app-domain';
import { StorageSchema } from 'oak-domain/lib/types/Storage';
import { ExprResolveFn, NodeDict, RowNode } from "./types/type";
import { isRefAttrNode, Q_BooleanValue, Q_FullTextValue, Q_NumberValue, Q_StringValue } from 'oak-domain/lib/types/Demand';
import { judgeRelation } from 'oak-domain/lib/store/relation';
import { execOp, Expression, ExpressionConstant, isExpression, opMultipleParams } from 'oak-domain/lib/types/Expression';
import { SyncContext } from 'oak-domain/lib/store/SyncRowStore';
import { AsyncContext } from 'oak-domain/lib/store/AsyncRowStore';
import { CascadeStore } from 'oak-domain/lib/store/CascadeStore';
import { Context } from 'oak-domain/lib/types';


interface ExprLaterCheckFn {
    (nodeDict: NodeDict): ExpressionConstant | ExprLaterCheckFn;
};

interface ExprNodeTranslator {
    (row: any, nodeDict: NodeDict): ExpressionConstant | ExprLaterCheckFn;
};

function obscurePass(value: any, option?: SelectOption): boolean {
    return !!(option?.obscure && value === undefined);
}

class OakExpressionUnresolvedException<ED extends EntityDict & BaseEntityDict> extends OakException<ED> {

}

export interface TreeStoreSelectOption extends SelectOption {
    nodeDict?: NodeDict;
}

export interface TreeStoreOperateOption extends OperateOption {
};

export default class TreeStore<ED extends EntityDict & BaseEntityDict> extends CascadeStore<ED> {
    private store: {
        [T in keyof ED]?: {
            [ID: string]: RowNode;
        };
    };
    private activeTxnDict: {
        [T: string]: {
            nodeHeader?: RowNode;
            create: number;
            update: number;
            remove: number;
            waitList: Array<{
                id: string;
                fn: Function;
            }>;
        };
    };
    private stat: {
        create: number;
        update: number;
        remove: number;
        commit: number;
    };

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

    protected supportMultipleCreate(): boolean {
        return false;
    }

    protected supportManyToOneJoin(): boolean {
        return false;
    }

    resetInitialData(data: {
        [T in keyof ED]?: ED[T]['OpSchema'][];
    }, stat?: {
        create: number;
        update: number;
        remove: number;
        commit: number;
    }) {
        this.store = {};
        const now = Date.now();
        for (const entity in data) {
            const { attributes } = this.getSchema()[entity];
            this.store[entity] = {};
            for (const row of data[entity]!) {
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
                    Object.assign(row, {
                        $$seq$$: `${Math.ceil((Math.random() + 1000) * 100)}`,
                    });
                }
                assert(row.id);
                set(this.store, `${entity}.${row.id}.$current`, row);
            }
        }
        if (stat) {
            this.stat = stat;
        }
    }

    getCurrentData(): {
        [T in keyof ED]?: ED[T]['OpSchema'][];
    } {
        const result: {
            [T in keyof ED]?: ED[T]['OpSchema'][];
        } = {};
        for (const entity in this.store) {
            result[entity] = [];
            for (const rowId in this.store[entity]) {
                result[entity]?.push(this.store[entity]![rowId]!['$current']!);
            }
        }
        return result;
    }

    constructor(storageSchema: StorageSchema<ED>) {
        super(storageSchema);
        this.store = {};
        this.activeTxnDict = {};
        this.stat = {
            create: 0,
            update: 0,
            remove: 0,
            commit: 0,
        };
    }

    private constructRow<Cxt extends Context, OP extends TreeStoreSelectOption>(node: RowNode, context: Cxt, option?: OP) {
        let data = cloneDeep(node.$current);
        if (context.getCurrentTxnId() && node.$txnId === context.getCurrentTxnId()) {
            if (!node.$next) {
                // 如果要求返回delete数据，返回带$$deleteAt$$的行
                if (option?.includedDeleted) {
                    return Object.assign({}, data, {
                        [DeleteAtAttribute]: 1,
                    });
                }
                return null;
            }
            else if (!node.$current) {
                // 本事务创建的，$$createAt$$和$$updateAt$$置为1
                return Object.assign({}, data, node.$next, {
                    [CreateAtAttribute]: 1,
                    [UpdateAtAttribute]: 1,
                });
            }
            else {
                // 本事务更新的，$$updateAt$$置为1
                return Object.assign({}, data, node.$next, {
                    [UpdateAtAttribute]: 1,
                });
            }
        }
        return data;
    }

    private translateLogicFilter<T extends keyof ED, OP extends TreeStoreSelectOption, Cxt extends Context>(
        entity: T,
        filter: NonNullable<ED[T]['Selection']['filter']>,
        attr: string,
        context: Cxt,
        option?: OP): (node: RowNode, nodeDict: NodeDict, exprResolveFns: Array<ExprResolveFn>) => boolean {
        switch (attr) {
            case '$and': {
                const filters = filter[attr];
                const fns = filters!.map(
                    (ele: NonNullable<ED[T]['Selection']['filter']>) => this.translateFilter(entity, ele, context, option)
                );
                return (node, nodeDict, exprResolveFns) => {
                    for (const fn of fns) {
                        if (!fn(node, nodeDict, exprResolveFns)) {
                            return false;
                        }
                    }
                    return true;
                };
            }
            case '$or': {
                const filters = filter[attr];
                const fns = filters!.map(
                    (ele: NonNullable<ED[T]['Selection']['filter']>) => this.translateFilter(entity, ele, context, option)
                );
                return (node, nodeDict, exprResolveFns) => {
                    for (const fn of fns) {
                        if (fn(node, nodeDict, exprResolveFns)) {
                            return true;
                        }
                    }
                    return false;
                };

            }
            case '$not': {
                const filter2 = filter[attr];
                const fn = this.translateFilter(entity, filter2!, context, option);
                return (node, nodeDict, exprResolveFns) => {
                    if (fn(node, nodeDict, exprResolveFns)) {
                        return false;
                    }
                    return true;
                }
            }
            default: {
                assert(false, `${attr}算子暂不支持`);
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
    private translateExpressionNode<T extends keyof ED, OP extends TreeStoreSelectOption, Cxt extends Context>(
        entity: T,
        expression: Expression<keyof ED[T]['Schema']> | RefAttr<keyof ED[T]['Schema']> | ExpressionConstant,
        context: Cxt,
        option?: OP): ExprNodeTranslator | ExpressionConstant {

        if (isExpression(expression)) {
            const op = Object.keys(expression)[0];
            const option2 = (expression as any)[op];

            if (opMultipleParams(op)) {
                const paramsTranslated = (option2 as (Expression<keyof ED[T]['Schema']> | RefAttr<keyof ED[T]['Schema']>)[]).map(
                    ele => this.translateExpressionNode(entity, ele, context, option2)
                );

                return (row, nodeDict) => {
                    let later = false;
                    let results = paramsTranslated.map(
                        (ele) => {
                            if (typeof ele === 'function') {
                                const r = ele(row, nodeDict);
                                if (typeof r === 'function') {
                                    later = true;
                                }
                                return r;
                            }
                            return ele;
                        }
                    );

                    if (!later) {
                        return execOp(op, results, option2.obscure);
                    }
                    const laterCheckFn = (nodeDict2: NodeDict) => {
                        results = results.map(
                            (ele) => {
                                if (typeof ele === 'function') {
                                    const r = ele(nodeDict2);
                                    return r;
                                }
                                return ele;
                            }
                        );
                        if (results.find(ele => typeof ele === 'function')) {
                            return laterCheckFn;
                        }
                        return execOp(op, results, option && option.obscure);
                    };
                    return laterCheckFn;
                }
            }
            else {
                const paramsTranslated = this.translateExpressionNode(entity, option2, context, option2);
                if (typeof paramsTranslated === 'function') {
                    return (row, nodeDict) => {
                        let result = paramsTranslated(row, nodeDict);
                        if (typeof result === 'function') {
                            const laterCheckFn = (nodeDict2: NodeDict) => {
                                result = (result as ExprLaterCheckFn)(nodeDict2);
                                if (typeof result === 'function') {
                                    return laterCheckFn;
                                }
                                return result;
                            }
                            return laterCheckFn;
                        }
                        return execOp(op, result, option2.obscure);
                    }
                }
                else {
                    return () => {
                        return execOp(op, paramsTranslated, option2.obscure);
                    };
                }
            }
        }
        else if (isRefAttrNode(expression)) {
            // 是RefAttr结点
            return (row, nodeDict) => {
                if (expression.hasOwnProperty('#attr')) {
                    // 说明是本结点的属性;
                    return row[(expression as {
                        '#attr': keyof ED[T]['Schema'];
                    })['#attr']] as ExpressionConstant;
                }
                else {
                    assert(expression.hasOwnProperty('#refId'));
                    const { ['#refId']: refId, ['#refAttr']: refAttr } = expression as {
                        '#refId': NodeId;
                        '#refAttr': string;
                    };
                    if (nodeDict.hasOwnProperty(refId)) {
                        return (nodeDict[refId] as any)[refAttr] as ExpressionConstant;
                    }
                    // 引用的结点还没有取到，此时需要在未来的某个时刻再检查
                    const laterCheckFn = (nodeDict2: NodeDict) => {
                        if (nodeDict2.hasOwnProperty(refId)) {
                            return (nodeDict2[refId] as any)[refAttr] as ExpressionConstant;
                        }
                        return laterCheckFn;
                    };
                    return laterCheckFn;
                }
            };
        }
        else {
            // 是常量结点
            return expression as ExpressionConstant;
        }
    }

    private translateExpression<T extends keyof ED, OP extends TreeStoreSelectOption, Cxt extends Context>(
        entity: T,
        expression: Expression<keyof ED[T]['Schema']>,
        context: Cxt, option?: OP): (row: Partial<ED[T]['OpSchema']>, nodeDict: NodeDict) => ExpressionConstant | ExprLaterCheckFn {
        const expr = this.translateExpressionNode(entity, expression, context, option);

        return (row, nodeDict) => {
            if (typeof expr !== 'function') {
                return expr;
            }
            const result = expr(row, nodeDict);
            return result;
        };
    }

    private translateFulltext<T extends keyof ED, OP extends TreeStoreSelectOption, Cxt extends Context>(
        entity: T,
        filter: Q_FullTextValue,
        context: Cxt,
        option?: OP): (node: RowNode) => boolean {
        // 全文索引查找
        const { [entity]: { indexes } } = this.getSchema();
        const fulltextIndex = indexes!.find(
            ele => ele.config && ele.config.type === 'fulltext'
        );

        const { attributes } = fulltextIndex!;
        const { $search } = filter;

        return (node) => {
            const row = this.constructRow(node, context, option) as any;
            for (const attr of attributes) {
                const { name } = attr;
                if (row && row[name] && (typeof row[name] === 'string' && row[name].includes($search) || obscurePass(row[name], option))) {
                    return true;
                }
            }
            return false;
        };
    }

    private translatePredicate<OP extends TreeStoreSelectOption>(path: string, predicate: string, value: any, option?: OP): (row: Record<string, any>) => boolean {
        switch (predicate) {
            case '$gt': {
                return (row) => {
                    const data = get(row, path);
                    return data > value || obscurePass(data, option);
                };
            }
            case '$lt': {
                return (row) => {
                    const data = get(row, path);
                    return data < value || obscurePass(data, option);
                };
            }case '$gte': {
                return (row) => {
                    const data = get(row, path);
                    return data >= value || obscurePass(data, option);
                };
            }
            case '$lte': {
                return (row) => {
                    const data = get(row, path);
                    return data <= value || obscurePass(data, option);
                };
            }
            case '$eq': {
                return (row) => {
                    const data = get(row, path);
                    return data === value || obscurePass(data, option);
                };
            }
            case '$ne': {
                return (row) => {
                    const data = get(row, path);
                    return data !== value || obscurePass(data, option);
                };
            }
            case '$between': {
                return (row) => {
                    const data = get(row, path);
                    return data  >= value[0] &&  data <= value[1]|| obscurePass(data, option);
                };
            }
            case '$startsWith': {
                return (row) => {
                    const data = get(row, path);
                    return data.startsWith(value) || obscurePass(data, option);
                };
            }
            case '$endsWith': {
                return (row) => {
                    const data = get(row, path);
                    return data.endsWith(value) || obscurePass(data, option);
                };
            }
            case '$includes': {
                return (row) => {
                    const data = get(row, path);
                    return data.includes(value) || obscurePass(data, option);
                };
            }
            case '$exists': {
                assert(typeof value === 'boolean');
                return (row) => {
                    const data = get(row, path);
                    if (value) {
                        return ![null, undefined].includes(data) || obscurePass(data, option);
                    }
                    else {
                        return [null, undefined].includes(data) || obscurePass(data, option);
                    }
                };
            }
            case '$in': {
                assert(value instanceof Array);
                return (row) => {
                    const data = get(row, path);
                    return value.includes(data) || obscurePass(data, option);
                };
            }
            case '$nin': {
                assert(value instanceof Array);
                return (row) => {
                    const data = get(row, path);
                    return !value.includes(data) || obscurePass(data, option);
                };
            }
            case '$contains': {
                // json中的多值查询
                const array = value instanceof Array ? value : [value];
                return (row) => {
                    const data = get(row, path);
                    return difference(array, data).length === 0 || obscurePass(data, option);
                };
            }
            case '$overlaps': {
                // json中的多值查询
                const array = value instanceof Array ? value : [value];
                return (row) => {
                    const data = get(row, path);
                    return intersection(array, data).length > 0 || obscurePass(data, option);
                };                
            }
            default: {
                throw new Error(`predicate ${predicate} is not recoganized`);
            }
        }
    }

    private translateObjectPredicate(filter: Record<string, any>) {
        const fns: Array<(value: any) => boolean> = [];
        const translatePredicateInner = (p: Record<string, any>, path: string) => {
            const predicate = Object.keys(p)[0];
            if (predicate.startsWith('$')) {
                assert(Object.keys(p).length === 1);
                fns.push(
                    this.translatePredicate(path, predicate, p[predicate])
                );
            }
            else {
                if (p instanceof Array) {
                    p.forEach(
                        (ele, idx) => {
                            const path2 = `${path}[${idx}]`;
                            if (typeof ele !== 'object') {
                                if (![null, undefined].includes(ele)) {
                                    fns.push(this.translatePredicate(path2, '$eq', ele));
                                }
                            }
                            else {
                                translatePredicateInner(ele, path2);
                            }
                        }
                    );
                }
                else {
                    for (const attr in p) {
                        const path2 = path ? `${path}.${attr}` : attr;
                        if (typeof p[attr] !== 'object') {
                            fns.push(this.translatePredicate(path2, '$eq', filter[attr]));
                        }
                        else {
                            translatePredicateInner(p[attr], path2);
                        }
                    }
                }
            }
        };
        translatePredicateInner(filter, '');
        return (value: any) => {
            for (const fn of fns) {
                if (!fn(value)) {
                    return false;
                }
            }
            return true;
        }
    }

    private translateAttribute<T extends keyof ED, OP extends TreeStoreSelectOption, Cxt extends Context>(
        entity: T,
        filter: Q_NumberValue | Q_StringValue | Q_BooleanValue | Object | ED[T]['Selection'] & {
            entity: T;
        },
        attr: string,
        context: Cxt,
        option?: OP): (node: RowNode, nodeDict: NodeDict, exprResolveFns: Array<ExprResolveFn>) => boolean {
        // 如果是模糊查询且该属性为undefined，说明没取到，返回true
        function obscurePassLocal(row: any) {
            return obscurePass(row[attr], option);
        }
        if (typeof filter !== 'object') {
            return (node) => {
                const row = this.constructRow(node, context, option);
                return row ? (row as any)[attr] === filter || obscurePassLocal(row) : false;
            };
        }
        else {
            const predicate = Object.keys(filter)[0];
            if (predicate.startsWith('$')) {
                if (['$in', '$nin'].includes(predicate) && !((filter as Record<string, any>)[predicate] instanceof Array)) {
                    const inData = (filter as Record<string, any>)[predicate];
                    if (predicate === '$in') {
                        // 如果是obscure，则返回的集合中有没有都不能否决“可能有”，所以可以直接返回true
                        if (option?.obscure) {
                            return () => true;
                        }
                        else {
                            // 这里只有当子查询中的filter不包含引用外部的子查询时才可以提前计算，否则必须等到执行时再计算
                            try {
                                const legalSets = (this.selectAbjointRow(inData.entity, inData, context, option)).map(
                                    (ele) => {
                                        const { data } = inData;
                                        const key = Object.keys(data)[0];
                                        return (ele as any)[key];
                                    }
                                );

                                return (node) => {
                                    const row = this.constructRow(node, context, option);
                                    if (!row) {
                                        return false;
                                    }
                                    return legalSets.includes((row as any)[attr]);
                                };
                            }
                            catch (err) {
                                if (err instanceof OakExpressionUnresolvedException) {
                                    return (node, nodeDict) => {
                                        const row = this.constructRow(node, context, option);
                                        if (!row) {
                                            return false;
                                        }
                                        const option2 = Object.assign({}, option, { nodeDict });
                                        const legalSets = this.selectAbjointRow(inData.entity, inData, context, option2).map(
                                            (ele) => {
                                                const { data } = inData as ED[keyof ED]['Selection'];
                                                const key = Object.keys(data)[0];
                                                return (ele as any)[key];
                                            }
                                        );
                                        return legalSets.includes((row as any)[attr]);
                                    }
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
                        try {
                            const legalSets = this.selectAbjointRow(inData.entity, inData, context, option).map(
                                (ele) => {
                                    const { data } = inData as ED[keyof ED]['Selection'];
                                    const key = Object.keys(data)[0];
                                    return (ele as any)[key];
                                }
                            );
                            return (node) => {
                                const row = this.constructRow(node, context, option);
                                if (!row) {
                                    return false;
                                }
                                return !legalSets.includes((row as any)[attr]) || obscurePassLocal(row);
                            };
                        }
                        catch (err) {
                            if (err instanceof OakExpressionUnresolvedException) {
                                return (node, nodeDict) => {
                                    const row = this.constructRow(node, context, option);
                                    if (!row) {
                                        return false;
                                    }
                                    const option2 = Object.assign({}, option, { nodeDict });
                                    const legalSets = this.selectAbjointRow(inData.entity, inData, context, option2).map(
                                        (ele) => {
                                            const { data } = inData as ED[keyof ED]['Selection'];
                                            const key = Object.keys(data)[0];
                                            return (ele as any)[key];
                                        }
                                    );
                                    return !legalSets.includes((row as any)[attr]) || obscurePassLocal(row);
                                };
                            }
                            else {
                                throw err;
                            }
                        }
                    }
                }
                else {
                    const fn = this.translatePredicate(attr, predicate, (filter as Record<string, any>)[predicate], option);
                    return (node) => {
                        const row = this.constructRow(node, context, option);
                        if (!row) {
                            return false;
                        }
                        return fn(row);
                    }; 
                }
            }
            else {
                // 对象的内部查询
                assert(this.getSchema()[entity].attributes[attr]?.type === 'object');
                const fn = this.translateObjectPredicate(filter);
                return (node) => {
                    const row = this.constructRow(node, context, option);
                    if (!row) {
                        return false;
                    }
                    return fn((row as any)[attr]) || obscurePassLocal(row);
                }
            }        
        }
    }

    private translateFilter<T extends keyof ED, OP extends TreeStoreSelectOption, Cxt extends Context>(
        entity: T,
        filter: ED[T]['Selection']['filter'],
        context: Cxt,
        option?: OP): (node: RowNode, nodeDict: NodeDict, exprResolveFns: Array<ExprResolveFn>) => boolean {
        const fns: Array<(node: RowNode, nodeDict: NodeDict, exprResolveFns: Array<ExprResolveFn>) => boolean> = [];

        let nodeId: NodeId;
        for (const attr in filter) {
            if (attr === '#id') {
                nodeId = (filter as {
                    ['#id']: NodeId;
                })['#id'];
            }
            else if (['$and', '$or', '$xor', '$not'].includes(attr)) {
                fns.push(this.translateLogicFilter(entity, filter!, attr, context, option));
            }
            else if (attr.toLowerCase().startsWith(EXPRESSION_PREFIX)) {
                const fn = this.translateExpression(entity, (filter as any)[attr], context, option);
                fns.push(
                    (node, nodeDict, exprResolveFns) => {
                        const row = this.constructRow(node, context, option);
                        if (!row) {
                            return false;
                        }
                        const result = fn(row, nodeDict);
                        if (typeof result === 'function') {
                            exprResolveFns.push(result);
                        }
                        return !!result;
                    }
                );
            }
            else if (attr.toLowerCase() === '$text') {
                fns.push(this.translateFulltext(entity, (filter as any)[attr], context, option));
            }
            else {
                // 属性级过滤
                const relation = judgeRelation(this.getSchema(), entity, attr);

                if (relation === 1) {
                    // 行本身的属性
                    fns.push(this.translateAttribute(entity, (filter as any)[attr], attr, context, option));
                }
                else if (relation === 2) {
                    // 基于entity/entityId的指针
                    const fn = this.translateFilter(attr, (filter as any)[attr], context, option);
                    fns.push(
                        (node, nodeDict, exprResolveFns) => {
                            const row = this.constructRow(node, context, option);
                            if (obscurePass((row as any).entity, option) || obscurePass((row as any).entityId, option)) {
                                return true;
                            }
                            if ((row as any).entity !== attr || !(row as any).entityId) {
                                return false;
                            }
                            const node2 = get(this.store, `${attr}.${(row as any).entityId}`);
                            if (!node2) {
                                if (option?.obscure) {
                                    return true;
                                }
                                return false;
                            }
                            return fn(node2, nodeDict, exprResolveFns);
                        }
                    );
                }
                else if (typeof relation === 'string') {
                    // 只能是基于普通属性的外键
                    const fn = this.translateFilter(relation, (filter as any)[attr], context, option);
                    fns.push(
                        (node, nodeDict, exprResolveFns) => {
                            const row = this.constructRow(node, context, option);
                            if (obscurePass((row as any)[`${attr}Id`], option)) {
                                return true;
                            }
                            if ((row as any)[`${attr}Id`]) {
                                const node2 = get(this.store, `${relation}.${(row as any)[`${attr}Id`]}`);
                                if (!node2) {
                                    if (option?.obscure) {
                                        return true;
                                    }
                                    return false;
                                }
                                return fn(node2, nodeDict, exprResolveFns);
                            }
                            return false;
                        }
                    );
                }
                else {
                    // metadata
                    assert(relation === 0);
                }
            }
        }

        return (node, nodeDict, exprResolveFns) => {
            if (nodeId) {
                assert(!nodeDict.hasOwnProperty(nodeId), `Filter中的nodeId「${nodeId}」出现了多次`);
                Object.assign(nodeDict, {
                    [nodeId]: this.constructRow(node, context, option),
                });
            }
            const row = this.constructRow(node, context, option);
            if (!row) {
                return false;
            }
            for (const fn of fns) {
                if (!fn(node, nodeDict, exprResolveFns)) {
                    return false;
                }
            }
            return true;
        };
    }

    private translateSorter<T extends keyof ED, OP extends TreeStoreSelectOption, Cxt extends Context>(
        entity: T,
        sorter: NonNullable<ED[T]['Selection']['sorter']>,
        context: Cxt,
        option?: OP):
        (row1: object | null | undefined, row2: object | null | undefined) => number {
        const compare = <T2 extends keyof ED>(
            row1: object | null | undefined,
            row2: object | null | undefined,
            entity2: T2,
            sortAttr: NonNullable<ED[T]['Selection']['sorter']>[number]['$attr'],
            direction?: NonNullable<ED[T]['Selection']['sorter']>[number]['$direction']): number => {
            const row11 = row1 as any;
            const row22 = row2 as any;
            assert(Object.keys(sortAttr).length === 1);
            const attr = Object.keys(sortAttr)[0];

            const relation = judgeRelation(this.getSchema(), entity2, attr);
            if (relation === 1 || relation === 0) {
                const getAttrOrExprValue = (r: any) => {
                    if (sortAttr[attr] === 1) {
                        return r[attr];
                    }
                    else {
                        // 改变策略，让所有需要获得的值在projection上取得
                        assert(typeof sortAttr[attr] === 'string' && (sortAttr[attr] as any).startsWith('$expr'));
                        return r[sortAttr[attr] as any];
                    }
                }
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
                    assert(row11['entity'] === row22['entity']);
                    assert(row11.entity === attr);
                    const node1 = this.store[row11.entity] && this.store[row11.entity]![row11.entityId];
                    const node2 = this.store[row22.entity] && this.store[row22.entity]![row22.entityId];
                    const row111 = node1 && this.constructRow(node1, context, option);
                    const row222 = node2 && this.constructRow(node2, context, option);

                    return compare(row111, row222, row11['entity'], (sortAttr as any)[attr], direction);
                }
                else {
                    assert(typeof relation === 'string');
                    const node1 = this.store[relation] && this.store[relation]![row11[`${attr}Id`]];
                    const node2 = this.store[relation] && this.store[relation]![row22[`${attr}Id`]];
                    const row111 = node1 && this.constructRow(node1, context, option);
                    const row222 = node2 && this.constructRow(node2, context, option);

                    return compare(row111, row222, relation, (sortAttr as any)[attr], direction);
                }
            }
        }
        return (row1, row2) => {
            for (const sorterElement of sorter) {
                const { $attr, $direction } = sorterElement;
                const result = compare(row1, row2, entity, $attr, $direction);
                if (result !== 0) {
                    return result;
                }
            }
            return 0;
        }
    }

    protected selectAbjointRow<T extends keyof ED, OP extends TreeStoreSelectOption, Cxt extends Context>(
        entity: T,
        selection: ED[T]['Selection'],
        context: Cxt,
        option?: OP): Partial<ED[T]['Schema']>[] {
        const { filter } = selection;
        const nodeDict = option?.nodeDict;

        const filterFn = filter && this.translateFilter(entity, filter!, context, option);
        const entityNodes = this.store[entity] ? Object.values(this.store[entity]!) : [];
        const nodes = [];
        for (const n of entityNodes) {
            // 做个优化，若是插入的行不用等
            if (n.$txnId && n.$txnId !== context.getCurrentTxnId() && n.$current === null) {
                continue;
            }
            assert(!n.$txnId || n.$txnId === context.getCurrentTxnId());
            const nodeDict2: NodeDict = {};
            if (nodeDict) {
                Object.assign(nodeDict2, nodeDict);
            }
            const exprResolveFns: Array<ExprResolveFn> = [];

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
        const rows = nodes.map(
            (node) => this.constructRow(node, context, option) as EntityShape
        );

        const rows2 = this.formResult(entity, rows, selection, context, option);
        return rows2;
    }

    protected updateAbjointRow<T extends keyof ED, OP extends TreeStoreOperateOption, Cxt extends Context>(
        entity: T,
        operation: ED[T]['CreateSingle'] | ED[T]['Update'] | ED[T]['Remove'],
        context: Cxt,
        option?: OP): number {
        const { data, action, id: operId } = operation;

        switch (action) {
            case 'create': {
                const { id } = data as ED[T]['CreateSingle']['data'];
                assert(id);
                // const node = this.store[entity] && (this.store[entity]!)[id as string];
                // const row = node && this.constructRow(node, context) || {};
                /* if (row) {
                    throw new OakError(RowStore.$$LEVEL, RowStore.$$CODES.primaryKeyConfilict);
                } */
                if (this.store[entity] && (this.store[entity]!)[id]) {
                    const node = this.store[entity] && (this.store[entity]!)[id as string];
                    throw new OakCongruentRowExists(entity as string, this.constructRow(node, context, option)!);
                }
                if (!data.$$seq$$) {
                    // tree-store随意生成即可
                    Object.assign(data, {
                        $$seq$$: `${Math.ceil((Math.random() + 1000) * 100)}`,
                    });
                }
                const node2: RowNode = {
                    $txnId: context.getCurrentTxnId()!,
                    $current: null,
                    $next: data,
                    $path: `${entity as string}.${id!}`,
                };
                if (!this.store[entity]) {
                    this.store[entity] = {};
                }
                set(this.store, `${entity as string}.${id!}`, node2);
                this.addToTxnNode(node2, context, 'create');
                return 1;
            }
            default: {
                const selection: ED[T]['Selection'] = {
                    data: {
                        id: 1,
                    },
                    filter: operation.filter,
                    indexFrom: operation.indexFrom,
                    count: operation.count,
                };
                const rows = this.selectAbjointRow(entity, selection, context);

                const ids = rows.map(ele => ele.id);
                for (const id of ids) {
                    let alreadyDirtyNode = false;
                    const node = (this.store[entity]!)[id as string];
                    assert(node && (!node.$txnId || node.$txnId == context.getCurrentTxnId()));
                    if (!node.$txnId) {
                        node.$txnId = context.getCurrentTxnId()!;
                    }
                    else {
                        assert(node.$txnId === context.getCurrentTxnId());
                        alreadyDirtyNode = true;
                    }
                    if (action === 'remove') {
                        node.$next = null;
                        node.$path = `${entity as string}.${id!}`;
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

    protected async selectAbjointRowAsync<T extends keyof ED, OP extends TreeStoreSelectOption, Cxt extends Context>(
        entity: T,
        selection: ED[T]['Selection'],
        context: Cxt,
        option?: OP) {
        return this.selectAbjointRow(entity, selection, context, option);
    }

    protected async updateAbjointRowAsync<T extends keyof ED, OP extends TreeStoreOperateOption, Cxt extends Context>(
        entity: T,
        operation: ED[T]['CreateSingle'] | ED[T]['Update'] | ED[T]['Remove'],
        context: Cxt,
        option?: OP) {
        return this.updateAbjointRow(entity, operation, context, option);
    }


    protected operateSync<T extends keyof ED, OP extends TreeStoreOperateOption, Cxt extends SyncContext<ED>>(entity: T, operation: ED[T]['Operation'], context: Cxt, option: OP): OperationResult<ED> {
        assert(context.getCurrentTxnId());
        return this.cascadeUpdate(entity, operation, context, option);
    }

    protected async operateAsync<T extends keyof ED, OP extends TreeStoreOperateOption, Cxt extends AsyncContext<ED>>(entity: T, operation: ED[T]['Operation'], context: Cxt, option: OP) {
        assert(context.getCurrentTxnId());
        return this.cascadeUpdateAsync(entity, operation, context, option);
    }

    /**
     * 计算最终结果集当中的函数，这个函数可能测试不够充分
     * @param entity 
     * @param projection 
     * @param data 
     * @param nodeDict 
     * @param context 
     */
    private formExprInResult<T extends keyof ED, Cxt extends Context>(
        entity: T,
        projection: ED[T]['Selection']['data'],
        data: Partial<ED[T]['Schema']>,
        nodeDict: NodeDict,
        context: Cxt) {

        const laterExprDict: {
            [A in ExpressionKey]?: ExprLaterCheckFn;
        } = {};
        for (const attr in projection) {
            if (attr.startsWith(EXPRESSION_PREFIX)) {
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
                const nodeId = projection[attr] as NodeId;
                assert(!nodeDict.hasOwnProperty(nodeId), `Filter中的nodeId「${nodeId}」出现了多次`);
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
                    this.formExprInResult(attr, projection[attr], data[attr]!, nodeDict, context);
                }
            }
            else if (typeof rel === 'string') {
                if (data[attr]) {
                    const result2 = {};
                    this.formExprInResult(rel, projection[attr], data[attr]!, nodeDict, context);
                }
            }
            else if (rel instanceof Array) {
                if (!attr.endsWith('$$aggr')) {
                    if (data[attr] && (data[attr] as any) instanceof Array) {
                        data[attr].map(
                            (ele: any) => this.formExprInResult(rel[0], projection[attr].data, ele, nodeDict, context)
                        )
                    }
                }
            }
        }

        for (const attr in laterExprDict) {
            const exprResult = laterExprDict[attr as ExpressionKey]!(nodeDict);
            // projection是不应出现计算不出来的情况
            assert(typeof exprResult !== 'function', 'data中的expr无法计算，请检查命名与引用的一致性');
            Object.assign(data, {
                [attr]: exprResult,
            });
        }
    }

    private formResult<T extends keyof ED, OP extends TreeStoreSelectOption, Cxt extends Context>(
        entity: T,
        rows: Array<Partial<ED[T]['Schema']>>,
        selection: ED[T]['Selection'],
        context: Cxt,
        option?: OP) {
        const { data, sorter, indexFrom, count } = selection;

        const findAvailableExprName = (current: string[]) => {
            let counter = 1;
            while (counter < 20) {
                const exprName = `$expr${counter++}`;
                if (!current.includes(exprName)) {
                    return exprName;
                }
            }
            assert(false, '找不到可用的expr命名');
        }
        const sortToProjection = <T2 extends keyof ED>(entity2: T2, proj: ED[T2]['Selection']['data'], sort: any) => {
            Object.keys(sort).forEach(
                (attr) => {
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
                    const rel = judgeRelation(this.getSchema(), entity2, attr);
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
                        })
                    }
                }
            )
        };
        if (sorter) {
            sorter.forEach(
                (ele) => {
                    sortToProjection(entity, data, ele.$attr)
                }
            );
        }

        // 先计算projection，formResult只处理abjoint的行，不需要考虑expression和一对多多对一关系
        const rows2: Array<Partial<ED[T]['Schema']>> = [];
        const incompletedRowIds: string[] = [];
        const { data: projection } = selection;
        for (const row of rows) {
            const result = {} as Partial<ED[T]['Schema']>;
            for (const attr in projection) {
                const rel = this.judgeRelation(entity, attr);
                if (rel === 1) {
                    if (row[attr] === undefined) {
                        incompletedRowIds.push(row.id!);
                        break;
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

                        const assignIner = (dest: Record<string, any> | Array<any>, proj: Record<string, any> | Array<any>, source: Record<string, any> | Array<any>) => {
                            if (proj instanceof Array) {
                                assert(dest instanceof Array);
                                assert(source instanceof Array);
                                proj.forEach(
                                    (attr, idx) => {
                                        if (typeof attr === 'number') {
                                            dest[idx] = source[idx];
                                        }
                                        else if (typeof attr === 'object') {
                                            dest[idx] = {};
                                            assignIner(dest[idx], attr, source[idx]);
                                        }
                                    }
                                );
                            }
                            else {
                                for (const attr in proj) {
                                    if (typeof proj[attr] === 'number') {
                                        (<Record<string, any>>dest)[attr] = (<Record<string, any>>source)[attr];
                                    }
                                    else if (typeof proj[attr] === 'object') {
                                        (<Record<string, any>>dest)[attr] = proj[attr] instanceof Array ? [] : {};
                                        assignIner((<Record<string, any>>dest)[attr], proj[attr], (<Record<string, any>>source)[attr]);
                                    }
                                }
                            }
                        };
                        assignIner(result[attr]!, projection[attr], row[attr]!);
                    }
                }
            }
            if (row.$$deleteAt$$) {
                Object.assign(result, {
                    [DeleteAtAttribute]: row.$$deleteAt$$,
                })
            }
            rows2.push(result);
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
            const sorterFn = this.translateSorter(entity, sorter as NonNullable<ED[T]['Selection']['sorter']>, context, option);
            rows2.sort(sorterFn);
        }

        // 最后用indexFrom和count来截断
        if (typeof indexFrom === 'number') {
            return rows2.slice(indexFrom, indexFrom! + count!);
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
    private mappingProjectionOnRow<T extends keyof ED>(
        entity: T,
        row: Partial<ED[T]['Schema']>,
        projection: ED[T]['Selection']['data']
    ) {
        let key = '';
        let result = {} as Partial<ED[T]['Schema']>;
        const values = [] as any[];
        const mappingIter = <T2 extends keyof ED>(
            entity2: T2,
            row2: Partial<ED[T2]['Schema']>,
            p2: ED[T2]['Selection']['data'],
            result2: Partial<ED[T2]['Schema']>) => {
            const keys = Object.keys(p2).sort((ele1, ele2) => ele1 < ele2 ? -1 : 1);
            for (const k of keys) {
                const rel = this.judgeRelation(entity2, k);
                if (rel === 2) {
                    (result2 as any)[k] = {};
                    if (row2[k]) {
                        mappingIter(k, row2[k]!, p2[k], result2[k]!);
                    }
                }
                else if (typeof rel === 'string') {
                    (result2 as any)[k] = {};
                    if (row2[k]) {
                        mappingIter(rel, row2[k]!, p2[k], result2[k]!);
                    }
                }
                else {
                    assert([0, 1].includes(rel as number));
                    (result2 as any)[k] = row2[k];
                    assert(['string', 'number', 'boolean'].includes(typeof row2[k]));
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

    private calcAggregation<T extends keyof ED>(
        entity: T,
        rows: Partial<ED[T]['Schema']>[],
        aggregationData: ED[T]['Aggregation']['data']
    ) {
        const ops = Object.keys(aggregationData).filter(
            ele => ele !== '#aggr'
        ) as AggregationOp[];
        const result = {} as Record<string, any>;
        for (const row of rows) {
            for (const op of ops) {
                const { values } = this.mappingProjectionOnRow(entity, row, (aggregationData as any)[op]);
                assert(values.length === 1, `聚合运算中，${op}的目标属性多于1个`);
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
                        assert(typeof values[0] === 'number', '只有number类型的属性才可以计算sum');
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
                    assert(op.startsWith('#avg'));
                    if (![undefined, null].includes(values[0])) {
                        assert(typeof values[0] === 'number', '只有number类型的属性才可以计算avg');
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
        return result as AggregationResult<ED[T]['Schema']>[number];
    }

    private formAggregation<T extends keyof ED, Cxt extends Context>(
        entity: T,
        rows: Array<Partial<ED[T]['Schema']>>,
        aggregationData: ED[T]['Aggregation']['data']) {
        const { "#aggr": aggrExpr } = aggregationData;
        if (aggrExpr) {
            const groups = groupBy(rows, (row) => {
                const { key } = this.mappingProjectionOnRow(entity, row, aggrExpr);
                return key;
            });
            const result = Object.keys(groups).map(
                (ele) => {
                    const aggr = this.calcAggregation(entity, groups[ele], aggregationData);
                    const { result: r } = this.mappingProjectionOnRow(entity, groups[ele][0], aggrExpr);
                    aggr['#data'] = r;
                    return aggr;
                }
            );

            return result;
        }
        const aggr = this.calcAggregation(entity, rows, aggregationData);
        return [aggr];
    }

    protected selectSync<T extends keyof ED, OP extends TreeStoreSelectOption, Cxt extends SyncContext<ED>>(
        entity: T,
        selection: ED[T]['Selection'],
        context: Cxt,
        option: OP): Partial<ED[T]['Schema']>[] {
        assert(context.getCurrentTxnId());
        const result = this.cascadeSelect(entity, selection, context, option);
        // 在这里再计算所有的表达式
        result.forEach(
            (ele) => this.formExprInResult(entity, selection.data, ele, {}, context)
        );
        return result;
    }

    protected async selectAsync<T extends keyof ED, OP extends TreeStoreSelectOption, Cxt extends AsyncContext<ED>>(
        entity: T,
        selection: ED[T]['Selection'],
        context: Cxt,
        option: OP) {
        assert(context.getCurrentTxnId());
        const result = await this.cascadeSelectAsync(entity, selection, context, option);
        // 在这里再计算所有的表达式
        result.forEach(
            (ele) => this.formExprInResult(entity, selection.data, ele, {}, context)
        );
        return result;
    }

    protected aggregateSync<T extends keyof ED, OP extends TreeStoreSelectOption, Cxt extends SyncContext<ED>>(
        entity: T,
        aggregation: ED[T]['Aggregation'],
        context: Cxt,
        option: OP): AggregationResult<ED[T]['Schema']> {
        assert(context.getCurrentTxnId());
        const { data, filter, sorter, indexFrom, count } = aggregation;
        const p: ED[T]['Selection']['data'] = {};
        for (const k in data) {
            Object.assign(p, cloneDeep((data as any)[k]));
        }
        const selection: ED[T]['Selection'] = {
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
        result.forEach(
            (ele) => this.formExprInResult(entity, selection.data, ele, {}, context)
        );

        // 最后计算Aggregation
        return this.formAggregation(entity, result, aggregation.data);
    }

    protected async aggregateAsync<T extends keyof ED, OP extends TreeStoreSelectOption, Cxt extends AsyncContext<ED>>(
        entity: T,
        aggregation: ED[T]['Aggregation'],
        context: Cxt,
        option: OP): Promise<AggregationResult<ED[T]['Schema']>> {
        assert(context.getCurrentTxnId());
        const { data, filter, sorter, indexFrom, count } = aggregation;
        const p: ED[T]['Selection']['data'] = {};
        for (const k in data) {
            Object.assign(p, cloneDeep((data as any)[k]));
        }
        const selection: ED[T]['Selection'] = {
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
        result.forEach(
            (ele) => this.formExprInResult(entity, selection.data, ele, {}, context)
        );

        // 最后计算Aggregation
        return this.formAggregation(entity, result, aggregation.data);
    }

    protected countSync<T extends keyof ED, OP extends TreeStoreSelectOption, Cxt extends SyncContext<ED>>(
        entity: T,
        selection: Pick<ED[T]['Selection'], 'filter' | 'count'>,
        context: Cxt, option: OP): number {
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

    protected async countAsync<T extends keyof ED, OP extends TreeStoreSelectOption, Cxt extends AsyncContext<ED>>(
        entity: T,
        selection: Pick<ED[T]['Selection'], 'filter' | 'count'>,
        context: Cxt, option: OP) {
        const selection2 = Object.assign({}, selection, {
            data: {
                id: 1,
            },
        });
        const result = await this.selectAsync(entity, selection2, context, Object.assign({}, option, {
            dontCollect: true,
        }));

        return typeof selection.count === 'number' ? Math.min(result.length, selection.count) : result.length;
    }

    private addToTxnNode<Cxt extends Context>(node: RowNode, context: Cxt, action: 'create' | 'update' | 'remove') {
        const txnNode = this.activeTxnDict[context.getCurrentTxnId()!];
        assert(txnNode);
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
        assert(!this.activeTxnDict.hasOwnProperty(uuid));
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

    commitSync(uuid: string) {
        assert(this.activeTxnDict.hasOwnProperty(uuid), uuid);
        let node = this.activeTxnDict[uuid].nodeHeader;
        while (node) {
            const node2 = node.$nextNode;
            if (node.$txnId === uuid) {
                if (node.$next) {
                    // create/update
                    node.$current = Object.assign(node.$current || {}, node.$next) as EntityShape;
                    unset(node, '$txnId');
                    unset(node, '$next');
                    unset(node, '$path');
                    unset(node, '$nextNode');
                }
                else {
                    // remove
                    assert(node.$path);
                    unset(this.store, node.$path);
                    unset(node, '$txnId');
                }
            }
            else {
                // 同一行被同一事务更新多次
                assert(node.$txnId === undefined);
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

        unset(this.activeTxnDict, uuid);
    }

    rollbackSync(uuid: string) {
        assert(this.activeTxnDict.hasOwnProperty(uuid));
        let node = this.activeTxnDict[uuid].nodeHeader;
        while (node) {
            const node2 = node.$nextNode;
            if (node.$txnId === uuid) {
                if (node.$current) {
                    // update/remove
                    unset(node, '$txnId');
                    unset(node, '$next');
                    unset(node, '$path');
                    unset(node, '$nextNode');
                }
                else {
                    // create
                    assert(node.$path);
                    unset(this.store, node.$path);
                    unset(node, '$txnId');
                }
            }
            else {
                // 该结点被同一事务反复处理
                assert(node.$txnId === undefined);
            }
            node = node2;
        }
        // 唤起等待者
        for (const waiter of this.activeTxnDict[uuid].waitList) {
            waiter.fn();
        }
        unset(this.activeTxnDict, uuid);
    }

    async beginAsync() {
        return this.beginSync();
    }

    async commitAsync(uuid: string) {
        return this.commitSync(uuid);
    }

    async rollbackAsync(uuid: string) {
        return this.rollbackSync(uuid);
    }

    // 将输入的OpRecord同步到数据中
    sync<OP extends TreeStoreOperateOption, Cxt extends SyncContext<ED>>(opRecords: Array<OpRecord<ED>>, context: Cxt, option?: OP) {
        const option2 = Object.assign({}, option, {
            dontCollect: true,
            dontCreateOper: true,
        });
        for (const record of opRecords) {
            switch (record.a) {
                case 'c': {
                    const { e, d } = record;
                    if (d instanceof Array) {
                        for (const dd of d) {
                            if (this.store[e] && this.store[e]![dd.id]) {
                                this.updateAbjointRow(e, {
                                    id: 'dummy',
                                    action: 'update',
                                    data: dd as any,
                                    filter: {
                                        id: dd.id,
                                    } as any,
                                }, context, option2)
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
                    else {
                        if (this.store[e] && this.store[e]![d.id]) {
                            this.updateAbjointRow(e, {
                                id: 'dummy',
                                action: 'update',
                                data: d as any,
                                filter: {
                                    id: d.id,
                                } as any,
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
                    const { e, d, f } = record as UpdateOpResult<ED, keyof ED>;
                    this.updateAbjointRow(e, {
                        id: 'dummy',
                        action: 'update',
                        data: d,
                        filter: f,
                    }, context, option2);
                    break;
                }
                case 'r': {
                    const { e, f } = record as RemoveOpResult<ED, keyof ED>;
                    this.updateAbjointRow(e, {
                        id: 'dummy',
                        action: 'remove',
                        data: {},
                        filter: f,
                    }, context, option2);
                    break;
                }
                case 's': {
                    const { d } = record as SelectOpResult<ED>;
                    for (const entity in d) {
                        for (const id in d[entity]) {
                            if (this.store[entity] && this.store[entity]![id]) {
                                this.updateAbjointRow(entity, {
                                    id: 'dummy',
                                    action: 'update',
                                    data: d[entity]![id] as any,
                                    filter: {
                                        id,
                                    } as any,
                                }, context, option2);
                            }
                            else {
                                this.updateAbjointRow(entity, {
                                    id: 'dummy',
                                    action: 'create',
                                    data: d[entity]![id],
                                } as ED[keyof ED]['CreateSingle'], context, option2);
                            }
                        }
                    }
                    break;
                }
                default: {
                    assert(false);
                }
            }
        }
    }
}