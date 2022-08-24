import { cloneDeep, get, set, unset } from 'oak-domain/lib/utils/lodash';
import { assert } from 'oak-domain/lib/utils/assert';
import {
    DeduceCreateSingleOperation, DeduceFilter, DeduceSelection, EntityShape, DeduceRemoveOperation,
    DeduceUpdateOperation, DeduceSorter, DeduceSorterAttr, OperationResult, OperateOption, OpRecord,
    DeduceCreateOperationData, UpdateOpResult, RemoveOpResult, SelectOpResult,
    EntityDict, SelectRowShape, SelectionResult, SelectOption} from "oak-domain/lib/types/Entity";
import { ExpressionKey, EXPRESSION_PREFIX, NodeId, RefAttr } from 'oak-domain/lib/types/Demand';
import { OakCongruentRowExists } from 'oak-domain/lib/types/Exception';
import { EntityDict as BaseEntityDict } from 'oak-domain/lib/base-app-domain';
import { CascadeStore } from 'oak-domain/lib/store/CascadeStore';
import { StorageSchema } from 'oak-domain/lib/types/Storage';
import { OakError } from 'oak-domain/lib/OakError';
import { Context } from "oak-domain/lib/types/Context";
import { ExprResolveFn, NodeDict, RowNode } from "./types/type";
import { RowStore } from 'oak-domain/lib/types/RowStore';
import { isRefAttrNode, Q_BooleanValue, Q_FullTextValue, Q_NumberValue, Q_StringValue } from 'oak-domain/lib/types/Demand';
import { judgeRelation } from 'oak-domain/lib/store/relation';
import { execOp, Expression, ExpressionConstant, isExpression, opMultipleParams } from 'oak-domain/lib/types/Expression';


interface ExprLaterCheckFn {
    (nodeDict: NodeDict): ExpressionConstant | ExprLaterCheckFn;
};

interface ExprNodeTranslator {
    (row: any, nodeDict: NodeDict): ExpressionConstant | ExprLaterCheckFn;
};

function obscurePass(row: any, attr: string, option?: SelectOption): boolean {
    return !!(option?.obscure && row[attr] === undefined);
}


interface TreeStoreSelectOption extends SelectOption {
    nodeDict?: NodeDict;
}

interface TreeStoreOperateOption extends OperateOption {
};

export default class TreeStore<ED extends EntityDict & BaseEntityDict, Cxt extends Context<ED>> extends CascadeStore<ED, Cxt> {
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
        };
    };
    private stat: {
        create: number;
        update: number;
        remove: number;
        commit: number;
    };

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
        for (const entity in data) {
            this.store[entity] = {};
            for (const row of data[entity]!) {
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

    private constructRow(node: RowNode, context: Cxt) {
        let data = cloneDeep(node.$current);
        if (context.getCurrentTxnId() && node.$txnId === context.getCurrentTxnId()) {
            if (!node.$next) {
                return null;
            }
            else {
                return Object.assign({}, data, node.$next);
            }
        }
        return data;
    }

    private translateLogicFilter<T extends keyof ED, OP extends TreeStoreSelectOption>(
        entity: T,
        filter: DeduceFilter<ED[T]['Schema']>,
        attr: string,
        context: Cxt,
        option?: OP): (node: RowNode, nodeDict: NodeDict, exprResolveFns: Array<ExprResolveFn>) => Promise<boolean> {
        switch (attr) {
            case '$and': {
                const filters = filter[attr];
                const fns = filters!.map(
                    ele => this.translateFilter(entity, ele, context, option)
                );
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
                const fns = filters!.map(
                    ele => this.translateFilter(entity, ele, context, option)
                );
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
                const fn = this.translateFilter(entity, filter2!, context, option);
                return async (node, nodeDict, exprResolveFns) => {
                    if (await (await fn)(node, nodeDict, exprResolveFns)) {
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
    private translateExpressionNode<T extends keyof ED, OP extends TreeStoreSelectOption>(
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

    private translateExpression<T extends keyof ED, OP extends TreeStoreSelectOption>(
        entity: T,
        expression: Expression<keyof ED[T]['Schema']>,
        context: Cxt, option?: OP): (row: Partial<ED[T]['OpSchema']>, nodeDict: NodeDict) => Promise<ExpressionConstant | ExprLaterCheckFn> {
        const expr = this.translateExpressionNode(entity, expression, context, option);

        return async (row, nodeDict) => {
            if (typeof expr !== 'function') {
                return expr;
            }
            const result = expr(row, nodeDict);
            return result;
        };
    }

    private translateFulltext<T extends keyof ED, OP extends TreeStoreSelectOption>(
        entity: T,
        filter: Q_FullTextValue,
        context: Cxt,
        option?: OP): (node: RowNode) => Promise<boolean> {
        // 全文索引查找
        const { [entity]: { indexes } } = this.storageSchema;
        const fulltextIndex = indexes!.find(
            ele => ele.config && ele.config.type === 'fulltext'
        );

        const { attributes } = fulltextIndex!;
        const { $search } = filter;

        return async (node) => {
            const row = this.constructRow(node, context) as any;
            for (const attr of attributes) {
                const { name } = attr;
                if (row && row[name] && (typeof row[name] === 'string' && row[name].contains($search) || obscurePass(row, name as string, option))) {
                    return true;
                }
            }
            return false;
        };
    }

    private async translateAttribute<T extends keyof ED, OP extends TreeStoreSelectOption>(filter: Q_NumberValue | Q_StringValue | Q_BooleanValue | ED[T]['Selection'] & {
        entity: T;
    }, attr: string, context: Cxt, option?: OP): Promise<(node: RowNode, nodeDict: NodeDict, exprResolveFns: Array<ExprResolveFn>) => Promise<boolean>> {
        // 如果是模糊查询且该属性为undefined，说明没取到，返回true
        function obscurePassLocal(row: any) {
            return obscurePass(row, attr, option);
        }
        if (typeof filter !== 'object') {
            return async (node) => {
                const row = this.constructRow(node, context);
                return row ? (row as any)[attr] === filter || obscurePassLocal(row) : false;
            };
        }
        const fns: Array<(row: any, nodeDict: NodeDict, exprResolveFns: Array<ExprResolveFn>) => Promise<boolean>> = [];
        for (const op in filter) {
            switch (op) {
                case '$gt': {
                    fns.push(async (row) => row && (row[attr] > (filter as any)[op]) || obscurePassLocal(row));
                    break;
                }
                case '$lt': {
                    fns.push(async (row) => row && (row[attr] < (filter as any)[op]) || obscurePassLocal(row));
                    break;
                }
                case '$gte': {
                    fns.push(async (row) => row && (row[attr] >= (filter as any)[op]) || obscurePassLocal(row));
                    break;
                }
                case '$lte': {
                    fns.push(async (row) => row && (row[attr] <= (filter as any)[op]) || obscurePassLocal(row));
                    break;
                }
                case '$eq': {
                    fns.push(async (row) => row && (row[attr] === (filter as any)[op]) || obscurePassLocal(row));
                    break;
                }
                case '$ne': {
                    fns.push(async (row) => row && (row[attr] !== (filter as any)[op]) || obscurePassLocal(row));
                    break;
                }
                case '$between': {
                    fns.push(async (row) => {
                        return row && (row[attr] >= (filter as any)[op][0] && row[attr] <= (filter as any)[op][1] || obscurePassLocal(row));
                    });
                    break;
                }
                case '$startsWith': {
                    fns.push(async (row) => {
                        return row && (row[attr]?.startsWith((filter as any)[op]) || obscurePassLocal(row));
                    });
                    break;
                }
                case '$endsWith': {
                    fns.push(async (row) => {
                        return row && (row[attr]?.$endsWith((filter as any)[op]) || obscurePassLocal(row));
                    });
                    break;
                }
                case '$includes': {
                    fns.push(async (row) => {
                        return row && (row[attr]?.includes((filter as any)[op]) || obscurePassLocal(row));
                    });
                    break;
                }
                case '$exists': {
                    const exists = (filter as any)[op];
                    assert(typeof exists === 'boolean');
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
                    const inData = (filter as any)[op];
                    assert(typeof inData === 'object');
                    if (inData instanceof Array) {
                        fns.push(async (row) => inData.includes(row[attr]) || obscurePassLocal(row));
                    }
                    else {
                        // 如果是obscure，则返回的集合中有没有都不能否决“可能有”，所以可以直接返回true
                        if (option?.obscure) {
                            fns.push(async () => true);
                        }
                        else {
                            // 这里只有当子查询中的filter不包含引用外部的子查询时才可以提前计算，否则必须等到执行时再计算
                            try {
                                const legalSets = (await this.selectAbjointRow(inData.entity, inData, context, option)).map(
                                    (ele) => {
                                        const { data } = inData;
                                        const key = Object.keys(data)[0];
                                        return (ele as any)[key];
                                    }
                                );

                                fns.push(
                                    async (row) => legalSets.includes(row[attr])
                                );
                            }
                            catch (err) {
                                if (err instanceof OakError && err.$$code === RowStore.$$CODES.expressionUnresolved[0]) {
                                    fns.push(
                                        async (row, nodeDict) => {
                                            const option2 = Object.assign({}, option, { nodeDict });
                                            const legalSets = (await this.selectAbjointRow(inData.entity, inData, context, option2)).map(
                                                (ele) => {
                                                    const { data } = inData as DeduceSelection<ED[keyof ED]['Schema']>;
                                                    const key = Object.keys(data)[0];
                                                    return (ele as any)[key];
                                                }
                                            );
                                            return legalSets.includes(row[attr]);
                                        }
                                    );
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
                    const inData = (filter as any)[op];
                    assert(typeof inData === 'object');
                    if (inData instanceof Array) {
                        fns.push(async (row) => !inData.includes(row[attr]) || obscurePassLocal(row));
                    }
                    else {
                        // obscure对nin没有影响，如果返回的子查询结果中包含此行就一定是false，否则一定为true（obscure只考虑数据不完整，不考虑不准确），但若相应属性为undefined则任然可以认为true
                        // 这里只有当子查询中的filter不包含引用外部的子查询时才可以提前计算，否则必须等到执行时再计算
                        try {
                            const legalSets = (await this.selectAbjointRow(inData.entity, inData, context, option)).map(
                                (ele) => {
                                    const { data } = inData as DeduceSelection<ED[keyof ED]['Schema']>;
                                    const key = Object.keys(data)[0];
                                    return (ele as any)[key];
                                }
                            );

                            fns.push(
                                async (row) => !legalSets.includes(row[attr]) || obscurePassLocal(row)
                            );
                        }
                        catch (err) {
                            if (err instanceof OakError && err.$$code === RowStore.$$CODES.expressionUnresolved[0]) {
                                fns.push(
                                    async (row, nodeDict) => {
                                        const option2 = Object.assign({}, option, { nodeDict });
                                        const legalSets = (await this.selectAbjointRow(inData.entity, inData, context, option2)).map(
                                            (ele) => {
                                                const { data } = inData as DeduceSelection<ED[keyof ED]['Schema']>;
                                                const key = Object.keys(data)[0];
                                                return (ele as any)[key];
                                            }
                                        );
                                        return !legalSets.includes(row[attr]) || obscurePassLocal(row);
                                    }
                                );
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
        }
    }

    private async translateFilter<T extends keyof ED, OP extends TreeStoreSelectOption>(
        entity: T,
        filter: DeduceFilter<ED[T]['Schema']>,
        context: Cxt,
        option?: OP): Promise<(node: RowNode, nodeDict: NodeDict, exprResolveFns: Array<ExprResolveFn>) => Promise<boolean>> {
        const fns: Array<(node: RowNode, nodeDict: NodeDict, exprResolveFns: Array<ExprResolveFn>) => Promise<boolean>> = [];

        let nodeId: NodeId;
        for (const attr in filter) {
            if (attr === '#id') {
                nodeId = (filter as {
                    ['#id']: NodeId;
                })['#id'];
            }
            else if (['$and', '$or', '$xor', '$not'].includes(attr)) {
                fns.push(this.translateLogicFilter(entity, filter, attr, context, option));
            }
            else if (attr.toLowerCase().startsWith(EXPRESSION_PREFIX)) {
                const fn = this.translateExpression(entity, (filter as any)[attr], context, option);
                fns.push(
                    async (node, nodeDict, exprResolveFns) => {
                        const row = this.constructRow(node, context);
                        if (!row) {
                            return false;
                        }
                        const result = await fn(row, nodeDict);
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
                const relation = judgeRelation(this.storageSchema, entity, attr);

                if (relation === 1) {
                    // 行本身的属性
                    fns.push(await this.translateAttribute((filter as any)[attr], attr, context, option));
                }
                else if (relation === 2) {
                    // 基于entity/entityId的指针
                    const fn = await this.translateFilter(attr, (filter as any)[attr], context, option);
                    fns.push(
                        async (node, nodeDict, exprResolveFns) => {
                            const row = this.constructRow(node, context);
                            if (obscurePass(row, 'entity', option) || obscurePass(row, 'entityId', option)) {
                                return true;
                            }
                            if ((row as any).entity !== attr || (row as any).entityId) {
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
                else {
                    assert(typeof relation === 'string');
                    // 只能是基于普通属性的外键
                    const fn = await this.translateFilter(relation, (filter as any)[attr], context, option);
                    fns.push(
                        async (node, nodeDict, exprResolveFns) => {
                            const row = this.constructRow(node, context);
                            if (obscurePass(row, `${attr}Id`, option)) {
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
            }
        }

        return async (node, nodeDict, exprResolveFns) => {
            if (nodeId) {
                assert(!nodeDict.hasOwnProperty(nodeId), new OakError(RowStore.$$LEVEL, RowStore.$$CODES.nodeIdRepeated, `Filter中的nodeId「${nodeId}」出现了多次`));
                Object.assign(nodeDict, {
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

    private translateSorter<T extends keyof ED>(
        entity: T,
        sorter: DeduceSorter<ED[T]['Schema']>,
        context: Cxt):
        (row1: object | null | undefined, row2: object | null | undefined) => number {
        const compare = <T2 extends keyof ED>(
            row1: object | null | undefined,
            row2: object | null | undefined,
            entity2: T2,
            sortAttr: DeduceSorterAttr<ED[T2]['Schema']>, direction?: 'asc' | 'desc'): number => {
            const row11 = row1 as any;
            const row22 = row2 as any;
            assert(Object.keys(sortAttr).length === 1);
            const attr = Object.keys(sortAttr)[0];

            const relation = judgeRelation(this.storageSchema, entity2, attr);
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
                    const row111 = node1 && this.constructRow(node1, context);
                    const row222 = node2 && this.constructRow(node2, context);

                    return compare(row111, row222, row11['entity'], (sortAttr as any)[attr], direction);
                }
                else {
                    assert(typeof relation === 'string');
                    const node1 = this.store[relation] && this.store[relation]![row11[`${attr}Id`]];
                    const node2 = this.store[relation] && this.store[relation]![row22[`${attr}Id`]];
                    const row111 = node1 && this.constructRow(node1, context);
                    const row222 = node2 && this.constructRow(node2, context);

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

    protected async selectAbjointRow<T extends keyof ED, S extends ED[T]['Selection'], OP extends TreeStoreSelectOption>(
        entity: T,
        selection: S,
        context: Cxt,
        option?: OP): Promise<SelectRowShape<ED[T]['Schema'], S['data']>[]> {
        const { filter } = selection;
        const nodeDict = option?.nodeDict;

        const filterFn = filter && this.translateFilter(entity, filter!, context, option);
        const entityNodes = this.store[entity] ? Object.values(this.store[entity]!) : [];
        const nodes = [];
        for (const n of entityNodes) {
            const nodeDict2: NodeDict = {};
            if (nodeDict) {
                Object.assign(nodeDict2, nodeDict);
            }
            const exprResolveFns: Array<ExprResolveFn> = [];
            if (!filterFn || await (await filterFn)(n, nodeDict2, exprResolveFns)) {
                // 如果有延时处理的expression，在这里加以判断，此时所有在filter中的node应该都已经加以遍历了
                let exprResult = true;
                if (exprResolveFns.length > 0) {
                    for (const fn of exprResolveFns) {
                        const result = fn(nodeDict2);
                        if (typeof result === 'function') {
                            throw new OakError(RowStore.$$LEVEL, RowStore.$$CODES.expressionUnresolved, `表达式计算失败，请检查Filter中的结点编号和引用是否一致`);
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
            (node) => this.constructRow(node, context) as EntityShape
        );

        const rows2 = await this.formResult(entity, rows, selection, context);
        return rows2;
    }

    protected async updateAbjointRow<T extends keyof ED, OP extends TreeStoreOperateOption>(
        entity: T,
        operation: DeduceCreateSingleOperation<ED[T]['Schema']> | DeduceUpdateOperation<ED[T]['Schema']> | DeduceRemoveOperation<ED[T]['Schema']>,
        context: Cxt,
        option: OP): Promise<number> {
        const { data, action, id: operId } = operation;
        
        switch (action) {
            case 'create': {
                const { id } = data as DeduceCreateOperationData<ED[T]["Schema"]>;
                // const node = this.store[entity] && (this.store[entity]!)[id as string];
                // const row = node && this.constructRow(node, context) || {};
                /* if (row) {
                    throw new OakError(RowStore.$$LEVEL, RowStore.$$CODES.primaryKeyConfilict);
                } */
                
                if (this.store[entity] && (this.store[entity]!)[id as string]) {
                    const node = this.store[entity] && (this.store[entity]!)[id as string];
                    throw new OakCongruentRowExists(this.constructRow(node, context)!);                    
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
                const rows = await this.selectAbjointRow(entity, selection, context);

                const ids = rows.map(ele => ele.id);
                ids.forEach(
                    (id) => {
                        let alreadyDirtyNode = false;
                        const node = (this.store[entity]!)[id as string];
                        assert(node);
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
                            node.$next = data;
                            if (!alreadyDirtyNode) {
                                // 如果已经更新过的结点就不能再加了，会形成循环
                                this.addToTxnNode(node, context, 'update');
                            }
                        }
                    }
                );

                return rows.length;
            }
        }
    }

    private async doOperation<T extends keyof ED, OP extends TreeStoreOperateOption>(entity: T, operation: ED[T]['Operation'], context: Cxt, option: OP): Promise<OperationResult<ED>> {
        const { action } = operation;
        if (action === 'select') {
            throw new Error('现在不支持使用select operation');
        }
        else {
            return await this.cascadeUpdate(entity, operation as any, context, option);
        }
    }

    async operate<T extends keyof ED, OP extends TreeStoreOperateOption>(entity: T, operation: ED[T]['Operation'], context: Cxt, option: OP): Promise<OperationResult<ED>> {
        assert(context.getCurrentTxnId());
        return await this.doOperation(entity, operation, context, option);
    }

    protected async formProjection<T extends keyof ED>(
        entity: T,
        row: Partial<ED[T]['OpSchema']>,
        data: ED[T]['Selection']['data'],
        result: object,
        nodeDict: NodeDict,
        context: Cxt) {
        const row2 = row as any;
        const data2 = data as any;

        const laterExprDict: {
            [A in ExpressionKey]?: ExprLaterCheckFn;
        } = {};
        for (const attr in data) {
            if (attr.startsWith(EXPRESSION_PREFIX)) {
                const ExprNodeTranslator = this.translateExpression(entity, data2[attr], context, {});
                const exprResult = await ExprNodeTranslator(row, nodeDict);
                if (typeof exprResult === 'function') {
                    Object.assign(laterExprDict, {
                        [attr]: exprResult,
                    });
                }
                else {
                    Object.assign(result, {
                        [attr]: exprResult,
                    });
                }
            }
            else if (attr === '#id') {
                const nodeId = data[attr] as NodeId;
                assert(!nodeDict.hasOwnProperty(nodeId), new OakError(RowStore.$$LEVEL, RowStore.$$CODES.nodeIdRepeated, `Filter中的nodeId「${nodeId}」出现了多次`));
                Object.assign(nodeDict, {
                    [nodeId]: row,
                });
            }
        }

        for (const attr in data) {
            if (!attr.startsWith(EXPRESSION_PREFIX) && attr !== '#id') {
                const relation = judgeRelation(this.storageSchema, entity, attr);
                if (relation === 1) {
                    Object.assign(result, {
                        [attr]: row2[attr],
                    });
                }
                else if (relation === 2) {
                    if (row2[attr]) {
                        const result2 = {};
                        const { entity, entityId } = row2;
                        await this.formProjection(attr, row2[attr], data2[attr], result2, nodeDict, context);
                        Object.assign(result, {
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
                        Object.assign(result, {
                            [attr]: result2,
                        });
                    }
                }
                else {
                    assert(relation instanceof Array);
                    if (row2[attr] instanceof Array) {
                        const result2 = await this.formResult(relation[0], row2[attr], data2[attr], context, nodeDict);

                        Object.assign(result, {
                            [attr]: result2,
                        });
                    }
                }
            }
        }

        for (const attr in laterExprDict) {
            const exprResult = laterExprDict[attr as ExpressionKey]!(nodeDict);
            // projection是不应出现计算不出来的情况
            assert(typeof exprResult !== 'function', new OakError(RowStore.$$LEVEL, RowStore.$$CODES.expressionUnresolved, 'data中的expr无法计算，请检查命名与引用的一致性'));
            Object.assign(result, {
                [attr]: exprResult,
            });
        }
    }

    private async formResult<T extends keyof ED, S extends ED[T]['Selection']>(
        entity: T,
        rows: Array<Partial<ED[T]['Schema']>>,
        selection: S,
        context: Cxt,
        nodeDict?: NodeDict) {
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
                    const rel = judgeRelation(this.storageSchema, entity2, attr);
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

        // 先计算projection
        const rows2: Array<SelectRowShape<ED[T]['Schema'], S['data']>> = [];
        for (const row of rows) {
            const result = {};
            const nodeDict2: NodeDict = {};
            if (nodeDict) {
                Object.assign(nodeDict2, nodeDict);
            }
            await this.formProjection(entity, row, data, result, nodeDict2, context);
            rows2.push(result as SelectRowShape<ED[T]['Schema'], S['data']>);
        }

        // 再计算sorter
        if (sorter) {
            const sorterFn = this.translateSorter(entity, sorter, context);
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

    async select<T extends keyof ED, S extends ED[T]['Selection'], OP extends TreeStoreSelectOption>(
        entity: T,
        selection: S,
        context: Cxt,
        option: OP): Promise<SelectionResult<ED[T]['Schema'], S['data']>> {
        assert(context.getCurrentTxnId());
        const result = await this.cascadeSelect(entity, selection, context, option);
        return {
            result,
            // stats,
        };
    }

    async count<T extends keyof ED, OP extends TreeStoreSelectOption>(
        entity: T,
        selection: Pick<ED[T]['Selection'], 'filter' | 'count'>,
        context: Cxt, option: OP): Promise<number> {
        const { result } = await this.select(entity, Object.assign({}, selection, {
            data: {
                id: 1,
            }
        }) as any, context, Object.assign({}, option, {
            dontCollect: true,
        }));

        return typeof selection.count === 'number' ? Math.min(result.length, selection.count) : result.length;
    }

    private addToTxnNode(node: RowNode, context: Cxt, action: 'create' | 'update' | 'remove') {
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

    async begin() {
        const uuid = `${Math.random()}`;
        assert(!this.activeTxnDict.hasOwnProperty(uuid));
        Object.assign(this.activeTxnDict, {
            [uuid]: {
                create: 0,
                update: 0,
                remove: 0,
            },
        });
        return uuid;
    }

    async commit(uuid: string) {
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

        unset(this.activeTxnDict, uuid);
    }

    async rollback(uuid: string) {
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
        unset(this.activeTxnDict, uuid);
    }

    // 将输入的OpRecord同步到数据中
    async sync(opRecords: Array<OpRecord<ED>>, context: Cxt) {
        for (const record of opRecords) {
            switch (record.a) {
                case 'c': {
                    const { e, d } = record;
                    if (d instanceof Array) {
                        for (const dd of d) {
                            if (this.store[e] && this.store[e]![dd.id]) {
                                await this.updateAbjointRow(e, {
                                    id: 'dummy',
                                    action: 'update',
                                    data: dd,
                                    filter: {
                                        id: dd.id,
                                    } as any,
                                }, context, {
                                    dontCollect: true,
                                    dontCreateOper: true,                                    
                                })
                            }
                            else {
                                await this.updateAbjointRow(e, {
                                    id: 'dummy',
                                    action: 'create',
                                    data: dd,
                                }, context, {
                                    dontCollect: true,
                                    dontCreateOper: true,
                                });
                            }
                        }
                    }
                    else {
                        if (this.store[e] && this.store[e]![d.id]) {
                            await this.updateAbjointRow(e, {
                                id: 'dummy',
                                action: 'update',
                                data: d,
                                filter: {
                                    id: d.id,
                                } as any,
                            }, context, {
                                dontCollect: true,
                                dontCreateOper: true,                                    
                            });
                        }
                        else {
                            await this.updateAbjointRow(e, {
                                id: 'dummy',
                                action: 'create',
                                data: d,
                            }, context, {
                                dontCollect: true,
                                dontCreateOper: true,
                            });
                        }
                    }
                    break;
                }
                case 'u': {
                    const { e, d, f } = record as UpdateOpResult<ED, keyof ED>;
                    await this.updateAbjointRow(e, {
                        id: 'dummy',
                        action: 'update',
                        data: d,
                        filter: f,
                    }, context, {
                        dontCollect: true,
                        dontCreateOper: true,                                    
                    });
                    break;
                }
                case 'r': {
                    const { e, f } = record as RemoveOpResult<ED, keyof ED>;
                    await this.updateAbjointRow(e, {
                        id: 'dummy',
                        action: 'remove',
                        data: {},
                        filter: f,
                    }, context, {
                        dontCollect: true,
                        dontCreateOper: true,
                    });
                    break;
                }
                case 's': {
                    const { d } = record as SelectOpResult<ED>;
                    for (const entity in d) {
                        for (const id in d[entity]) {
                            if (this.store[entity] && this.store[entity]![id]) {
                                await this.updateAbjointRow(entity, {
                                    id: 'dummy',
                                    action: 'update',
                                    data: d[entity]![id],
                                    filter: {
                                        id,
                                    } as any,
                                }, context, {
                                    dontCollect: true,
                                    dontCreateOper: true,                                    
                                });
                            }
                            else {
                                await this.updateAbjointRow(entity, {
                                    id: 'dummy',
                                    action: 'create',
                                    data: d[entity]![id],
                                }, context, {
                                    dontCollect: true,
                                    dontCreateOper: true,
                                });
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