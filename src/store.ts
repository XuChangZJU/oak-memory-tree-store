import { assign, cloneDeep, get, last, set, unset } from 'lodash';
import assert from 'assert';
import { EntityDef, SelectionResult, DeduceCreateSingleOperation, DeduceFilter, DeduceSelection, EntityShape, DeduceRemoveOperation, DeduceUpdateOperation, DeduceSorter, DeduceSorterAttr, OperationResult, OperateParams } from "oak-domain/lib/types/Entity";
import { ExpressionKey, EXPRESSION_PREFIX, NodeId, RefAttr } from 'oak-domain/lib/types/Demand';
import { CascadeStore } from 'oak-domain/lib/schema/CascadeStore';
import { StorageSchema } from 'oak-domain/lib/types/Storage';
import { OakError } from 'oak-domain/lib/OakError';
import { Context } from "./context";
import { ExprResolveFn, NodeDict, RowNode } from "./types/type";
import { RowStore } from 'oak-domain/lib/types/RowStore';
import { isRefAttrNode, Q_BooleanValue, Q_FullTextValue, Q_NumberValue, Q_StringValue } from 'oak-domain/lib/types/Demand';
import { judgeRelation } from 'oak-domain/lib/schema/relation';
import { execOp, Expression, ExpressionConstant, isExpression, opMultipleParams } from 'oak-domain/lib/types/Expression';


interface ExprLaterCheckFn {
    (nodeDict: NodeDict): ExpressionConstant | ExprLaterCheckFn;
};

interface ExprNodeTranslator {
    (row: any, nodeDict: NodeDict): ExpressionConstant | ExprLaterCheckFn;
};

export default class TreeStore<ED extends {
    [E: string]: EntityDef;
}> extends CascadeStore<ED> {
    countextends: any;
    store: {
        [T in keyof ED]?: {
            [ID: string]: RowNode;
        };
    };
    immutable: boolean;
    activeTxnDict: {
        [T: string]: {
            nodeHeader?: RowNode;
            create: number;
            update: number;
            remove: number;
        };
    };

    setInitialData(data: {
        [T in keyof ED]?: {
            [ID: string]: ED[T]['OpSchema'];
        };
    }) {
        for (const entity in data) {
            for (const rowId in data[entity]) {
                set(this.store, `${entity}.${rowId}.#current`, data[entity]![rowId]);
            }
        }
    }

    getCurrentData(): {
        [T in keyof ED]?: {
            [ID: string]: ED[T]['OpSchema'];
        };
    } {
        const result = {};
        for (const entity in this.store) {
            for (const rowId in this.store[entity]) {
                set(result, `${entity}.${rowId}`, this.store[entity]![rowId]!['$current']);
            }
        }
        return result;
    }

    constructor(storageSchema: StorageSchema<ED>, immutable: boolean = false, initialData?: {
        [T in keyof ED]?: {
            [ID: string]: ED[T]['OpSchema'];
        };
    }) {
        super(storageSchema);
        this.immutable = immutable;
        this.store = {};
        if (initialData) {
            this.setInitialData(initialData);
        }
        this.activeTxnDict = {};
    }

    private constructRow(node: RowNode, context: Context<ED>) {
        let data = cloneDeep(node.$current);
        if (context.uuid && node.$uuid === context.uuid) {
            if (!node.$next) {
                return null;
            }
            else {
                assign(data, node.$next);
            }
        }
        return data;
    }

    private translateLogicFilter<T extends keyof ED>(
        entity: T,
        filter: DeduceFilter<ED[T]['Schema']>,
        attr: string,
        context: Context<ED>,
        params: Object): (node: RowNode, nodeDict: NodeDict, exprResolveFns: Array<ExprResolveFn>) => Promise<boolean> {
        switch (attr) {
            case '$and': {
                const filters = filter[attr];
                const fns = filters!.map(
                    ele => this.translateFilter(entity, ele, context, params)
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
                    ele => this.translateFilter(entity, ele, context, params)
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
    private translateExpressionNode<T extends keyof ED>(
        entity: T,
        expression: Expression<keyof ED[T]['Schema']> | RefAttr<keyof ED[T]['Schema']> | ExpressionConstant,
        context: Context<ED>): ExprNodeTranslator | ExpressionConstant {

        if (isExpression(expression)) {
            const op = Object.keys(expression)[0];
            const params = (expression as any)[op];

            if (opMultipleParams(op)) {
                const paramsTranslated = (params as (Expression<keyof ED[T]['Schema']> | RefAttr<keyof ED[T]['Schema']>)[]).map(
                    ele => this.translateExpressionNode(entity, ele, context)
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
                        return execOp(op, results);
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
                        return execOp(op, results);
                    };
                    return laterCheckFn;
                }
            }
            else {
                const paramsTranslated = this.translateExpressionNode(entity, params, context);
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
                        return execOp(op, result);
                    }
                }
                else {
                    return () => {
                        return execOp(op, paramsTranslated);
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

    private translateExpression<T extends keyof ED>(
        entity: T,
        expression: Expression<keyof ED[T]['Schema']>,
        context: Context<ED>): (row: ED[T]['Schema'], nodeDict: NodeDict) => Promise<ExpressionConstant | ExprLaterCheckFn> {
        const expr = this.translateExpressionNode(entity, expression, context);

        return async (row, nodeDict) => {
            if (typeof expr !== 'function') {
                return expr;
            }
            const result = expr(row, nodeDict);
            return result;
        };
    }

    private translateFulltext<T extends keyof ED>(
        entity: T,
        filter: Q_FullTextValue,
        context: Context<ED>): (node: RowNode) => Promise<boolean> {
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
                if (row && row[name] && typeof row[name] === 'string' && row[name].contains($search)) {
                    return true;
                }
            }
            return false;
        };
    }

    private async translateAttribute<T extends keyof ED>(filter: Q_NumberValue | Q_StringValue | Q_BooleanValue | ED[T]['Selection'] & {
        entity: T;
    }, attr: string, context: Context<ED>, params: Object): Promise<(node: RowNode, nodeDict: NodeDict, exprResolveFns: Array<ExprResolveFn>) => Promise<boolean>> {
        if (typeof filter !== 'object') {
            return async (node) => {
                const row = this.constructRow(node, context);
                return row ? (row as any)[attr] === filter : false;
            };
        }
        const fns: Array<(row: any, nodeDict: NodeDict, exprResolveFns: Array<ExprResolveFn>) => Promise<boolean>> = [];
        for (const op in filter) {
            switch (op) {
                case '$gt': {
                    fns.push(async (row) => row[attr] > (filter as any)[op]);
                    break;
                }
                case '$lt': {
                    fns.push(async (row) => row[attr] < (filter as any)[op]);
                    break;
                }
                case '$gte': {
                    fns.push(async (row) => row[attr] >= (filter as any)[op]);
                    break;
                }
                case '$lte': {
                    fns.push(async (row) => row[attr] <= (filter as any)[op]);
                    break;
                }
                case '$eq': {
                    fns.push(async (row) => row[attr] === (filter as any)[op]);
                    break;
                }
                case '$ne': {
                    fns.push(async (row) => row[attr] !== (filter as any)[op]);
                    break;
                }
                case '$between': {
                    fns.push(async (row) => {
                        return row[attr] >= (filter as any)[op][0] && row[attr] <= (filter as any)[op][1];
                    });
                    break;
                }
                case '$startsWith': {
                    fns.push(async (row) => {
                        assert(typeof row[attr] === 'string');
                        return row[attr].startsWith((filter as any)[op]);
                    });
                    break;
                }
                case '$endsWith': {
                    fns.push(async (row) => {
                        assert(typeof row[attr] === 'string');
                        return row[attr].$endsWith((filter as any)[op]);
                    });
                    break;
                }
                case '$includes': {
                    fns.push(async (row) => {
                        assert(typeof row[attr] === 'string');
                        return row[attr].includes((filter as any)[op]);
                    });
                    break;
                }
                case '$exists': {
                    const exists = (filter as any)[op];
                    assert(typeof exists === 'boolean');
                    fns.push(async (row) => {
                        if (exists) {
                            return [null, undefined].includes(row[attr]);
                        }
                        else {
                            return ![null, undefined].includes(row[attr]);
                        }
                    });
                    break;
                }
                case '$in': {
                    const inData = (filter as any)[op];
                    assert(typeof inData === 'object');
                    if (inData instanceof Array) {
                        fns.push(async (row) => inData.includes(row[attr]));
                    }
                    else {
                        // 这里只有当子查询中的filter不包含引用外部的子查询时才可以提前计算，否则必须等到执行时再计算
                        try {
                            const legalSets = (await this.selectAbjointRow(inData.entity, inData, context, params)).map(
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
                                        assign(params, {
                                            nodeDict,
                                        });
                                        const legalSets = (await this.selectAbjointRow(inData.entity, inData, context, params)).map(
                                            (ele) => {
                                                const { data } = inData as DeduceSelection<ED[keyof ED]['Schema']>;
                                                const key = Object.keys(data)[0];
                                                return (ele as any)[key];
                                            }
                                        );
                                        unset(params, 'nodeDict');
                                        return legalSets.includes(row[attr]);
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
                case '$nin': {
                    const inData = (filter as any)[op];
                    assert(typeof inData === 'object');
                    if (inData instanceof Array) {
                        fns.push(async (row) => !inData.includes(row[attr]));
                    }
                    else {
                        // 这里只有当子查询中的filter不包含引用外部的子查询时才可以提前计算，否则必须等到执行时再计算
                        try {
                            const legalSets = (await this.selectAbjointRow(inData.entity, inData, context, params)).map(
                                (ele) => {
                                    const { data } = inData as DeduceSelection<ED[keyof ED]['Schema']>;
                                    const key = Object.keys(data)[0];
                                    return (ele as any)[key];
                                }
                            );

                            fns.push(
                                async (row) => !legalSets.includes(row[attr])
                            );
                        }
                        catch (err) {
                            if (err instanceof OakError && err.$$code === RowStore.$$CODES.expressionUnresolved[0]) {
                                fns.push(
                                    async (row, nodeDict) => {
                                        assign(params, {
                                            nodeDict,
                                        });
                                        const legalSets = (await this.selectAbjointRow(inData.entity, inData, context, params)).map(
                                            (ele) => {
                                                const { data } = inData as DeduceSelection<ED[keyof ED]['Schema']>;
                                                const key = Object.keys(data)[0];
                                                return (ele as any)[key];
                                            }
                                        );
                                        unset(params, 'nodeDict');
                                        return !legalSets.includes(row[attr]);
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

    private async translateFilter<T extends keyof ED>(
        entity: T,
        filter: DeduceFilter<ED[T]['Schema']>,
        context: Context<ED>,
        params: Object): Promise<(node: RowNode, nodeDict: NodeDict, exprResolveFns: Array<ExprResolveFn>) => Promise<boolean>> {
        const fns: Array<(node: RowNode, nodeDict: NodeDict, exprResolveFns: Array<ExprResolveFn>) => Promise<boolean>> = [];

        let nodeId: NodeId;
        for (const attr in filter) {
            if (attr === '#id') {
                nodeId = (filter as {
                    ['#id']: NodeId;
                })['#id'];
            }
            else if (['$and', '$or', '$xor', '$not'].includes(attr)) {
                fns.push(this.translateLogicFilter(entity, filter, attr, context, params));
            }
            else if (attr.toLowerCase().startsWith(EXPRESSION_PREFIX)) {
                const fn = this.translateExpression(entity, (filter as any)[attr], context);
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
                fns.push(this.translateFulltext(entity, (filter as any)[attr], context));
            }
            else {
                // 属性级过滤
                const relation = judgeRelation(this.storageSchema, entity, attr);

                if (relation === 1) {
                    // 行本身的属性
                    fns.push(await this.translateAttribute((filter as any)[attr], attr, context, params));
                }
                else if (relation === 2) {
                    // 基于entity/entityId的指针
                    const fn = await this.translateFilter(attr, (filter as any)[attr], context, params);
                    fns.push(
                        async (node, nodeDict, exprResolveFns) => {
                            const row = this.constructRow(node, context);
                            if ((row as any).entity !== attr) {
                                return false;
                            }
                            const node2 = get(this.store, `${attr}.${(row as any).entityId}`);
                            assert(node2);
                            return fn(node2, nodeDict, exprResolveFns);
                        }
                    );
                }
                else {
                    assert(typeof relation === 'string');
                    // 只能是基于普通属性的外键
                    const fn = await this.translateFilter(relation, (filter as any)[attr], context, params);
                    fns.push(
                        async (node, nodeDict, exprResolveFns) => {
                            const row = this.constructRow(node, context);
                            const node2 = get(this.store, `${relation}.${(row as any)[`${attr}Id`]}`);
                            assert(node2);
                            return fn(node2, nodeDict, exprResolveFns);
                        }
                    );
                }
            }
        }

        return async (node, nodeDict, exprResolveFns) => {
            if (nodeId) {
                assert(!nodeDict.hasOwnProperty(nodeId), new OakError(RowStore.$$LEVEL, RowStore.$$CODES.nodeIdRepeated, `Filter中的nodeId「${nodeId}」出现了多次`));
                assign(nodeDict, {
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

    private translateSorter<T extends keyof ED>(entity: T, sorter: DeduceSorter<ED[T]['Schema']>, context: Context<ED>):
        (row1: Partial<EntityShape>, row2: Partial<EntityShape>) => number {
        const compare = <T2 extends keyof ED>(
            row1: Partial<ED[T2]['Schema']> | null | undefined,
            row2: Partial<ED[T2]['Schema']> | null | undefined,
            entity2: T2,
            sortAttr: DeduceSorterAttr<ED[T2]['Schema']>, direction?: 'asc' | 'desc'): number => {
            const row11 = row1 as any;
            const row22 = row2 as any;
            assert(Object.keys(sortAttr).length === 1);
            const attr = Object.keys(sortAttr)[0];

            const relation = judgeRelation(this.storageSchema, entity2, attr);
            if (relation === 1) {
                const v1 = row1 && row11[attr];
                const v2 = row2 && row22[attr];
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

    /**
     * 将一次查询的结果集加入result
     * @param entity 
     * @param rows 
     * @param context 
     */
    private addToResultSelections<T extends keyof ED>(entity: T, rows: Array<ED[T]['OpSchema']>, context: Context<ED>) {
        const { result } = context;
        const { operations } = result!;

        let lastOperation = last(operations);
        if (lastOperation && lastOperation.a === 's') {
            const entityBranch = lastOperation.d[entity];
            if (entityBranch) {
                rows.forEach(
                    (row) => {
                        const { id } = row;
                        if (!entityBranch![id!]) {
                            assign(entityBranch!, {
                                [id!]: cloneDeep(row),
                            });
                        }
                    }
                );
                return;
            }
        }
        else {
            lastOperation = {
                a: 's',
                d: {},
            };
            operations.push(lastOperation);
        }
        
        const entityBranch = {};
        rows.forEach(
            (row) => {
                const { id } = row;
                assign(entityBranch!, {
                    [id!]: cloneDeep(row),
                });
            }
        );
        assign(lastOperation.d, {
            [entity]: entityBranch,
        });
    }

    protected async selectAbjointRow<T extends keyof ED>(
        entity: T,
        selection: Omit<ED[T]['Selection'], 'indexFrom' | 'count' | 'data' | 'sorter'>,
        context: Context<ED>,
        params: Object = {}): Promise<SelectionResult<ED, T>['result']> {
        const { filter } = selection;
        const { nodeDict } = params as {
            nodeDict: NodeDict;
        };

        const filterFn = filter && this.translateFilter(entity, filter!, context, params);
        const entityNodes = this.store[entity] ? Object.values(this.store[entity]!) : [];
        const nodes = [];
        for (const n of entityNodes) {
            const nodeDict2: NodeDict = {};
            if (nodeDict) {
                assign(nodeDict2, nodeDict);
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

        this.addToResultSelections(entity, rows, context);
        return rows;
    }

    protected async updateAbjointRow<T extends keyof ED>(
        entity: T,
        operation: DeduceCreateSingleOperation<ED[T]['Schema']> | DeduceUpdateOperation<ED[T]['Schema']> | DeduceRemoveOperation<ED[T]['Schema']>,
        context: Context<ED>,
        params?: OperateParams): Promise<void> {
        const { data, action } = operation;

        switch (action) {
            case 'create': {
                const { id } = data as DeduceCreateSingleOperation<ED[T]['Schema']>['data'];
                const row = get(this.store, `${entity}.${id!}`);
                if (row) {
                    throw new OakError(RowStore.$$LEVEL, RowStore.$$CODES.primaryKeyConfilict);
                }
                const node: RowNode = {
                    $uuid: context.uuid!,
                    $current: null,
                    $next: data as DeduceCreateSingleOperation<ED[T]['Schema']>['data'],
                    $path: `${entity}.${id!}`,
                };
                set(this.store, `${entity}.${id!}`, node);
                this.addToTxnNode(node, context, 'create');
                if (!params || !params.notCollect) {
                    context.result!.operations.push({
                        a: 'c',
                        e: entity,
                        d: data,
                    });
                }
                break;
            }
            default: {
                const selection = assign({}, operation, {
                    data: {
                        id: 1,
                    },
                    action: 'select',
                }) as ED[T]['Selection'];
                const rows = await this.selectAbjointRow(entity, selection, context, params);

                const ids = rows.map(ele => ele.id);
                ids.forEach(
                    (id) => {
                        const node = (this.store[entity]!)[id as string];
                        assert(node && !node.$uuid && node.$next === undefined);
                        node.$uuid = context.uuid!;
                        if (action === 'remove') {
                            node.$next = null;
                            node.$path = `${entity}.${id!}`;
                            this.addToTxnNode(node, context, 'remove');
                            if (!params || !params.notCollect) {
                                context.result!.operations.push({
                                    a: 'r',
                                    e: entity,
                                    f: (operation as DeduceRemoveOperation<ED[T]['Schema']>).filter,
                                });
                            }
                        }
                        else {
                            node.$next = data as EntityShape;
                            this.addToTxnNode(node, context, 'update');
                            if (!params || !params.notCollect) {
                                context.result!.operations.push({
                                    a: 'u',
                                    e: entity,
                                    d: data,
                                    f: (operation as DeduceUpdateOperation<ED[T]['Schema']>).filter,
                                });
                            }
                        }
                    }
                );
                break;
            }
        }
    }

    private async doOperation<T extends keyof ED>(entity: T, operation: ED[T]['Operation'], context: Context<ED>, params?: OperateParams): Promise<void> {
        const { action } = operation;
        if (action === 'select') {
            const result = await this.cascadeSelect(entity, operation as any, context, params);
            const ids = result.map(
                (ele) => ele.id
            );
            assign(context.result, {
                ids,
            });
        }
        else {
            return this.cascadeUpdate(entity, operation as any, context, params);
        }
    }

    async operate<T extends keyof ED>(entity: T, operation: ED[T]['Operation'], context: Context<ED>, params?: OperateParams): Promise<OperationResult<ED>> {
        let autoCommit = false;
        if (!context.uuid) {
            autoCommit = true;
            await context.begin();
        }
        try {
            await this.doOperation(entity, operation, context, params);
        } catch (err) {
            if (autoCommit) {
                await context.rollback();
            }
            throw err;
        }
        if (autoCommit) {
            await context.commit();
        }
        return context.result!;
    }

    protected async formProjection<T extends keyof ED>(
        entity: T,
        row: ED[T]['Schema'],
        data: ED[T]['Selection']['data'],
        result: Partial<ED[T]['Schema']>,
        nodeDict: NodeDict,
        context: Context<ED>) {
        const row2 = row as any;
        const data2 = data as any;

        const laterExprDict: {
            [A in ExpressionKey]?: ExprLaterCheckFn;
        } = {};
        for (const attr in data) {
            if (attr.startsWith(EXPRESSION_PREFIX)) {
                const ExprNodeTranslator = this.translateExpression(entity, data2[attr], context);
                const exprResult = await ExprNodeTranslator(row, nodeDict);
                if (typeof exprResult === 'function') {
                    assign(laterExprDict, {
                        [attr]: exprResult,
                    });
                }
                else {
                    assign(result, {
                        [attr]: exprResult,
                    });
                }
            }
            else if (attr === '#id') {
                const nodeId = data[attr] as NodeId;
                assert(!nodeDict.hasOwnProperty(nodeId), new OakError(RowStore.$$LEVEL, RowStore.$$CODES.nodeIdRepeated, `Filter中的nodeId「${nodeId}」出现了多次`));
                assign(nodeDict, {
                    [nodeId]: row,
                });
            }
        }

        for (const attr in data) {
            if (!attr.startsWith(EXPRESSION_PREFIX) && attr !== '#id') {
                const relation = judgeRelation(this.storageSchema, entity, attr);
                if (relation === 1) {
                    assign(result, {
                        [attr]: row2[attr],
                    });
                }
                else if (relation === 2) {
                    const result2 = {};
                    const { entity, entityId } = row2;
                    await this.formProjection(attr, row2[attr], data2[attr], result2, nodeDict, context);
                    assign(result, {
                        [attr]: result2,
                        entity,
                        entityId,
                    });
                }
                else if (typeof relation === 'string') {
                    const result2 = {};
                    await this.formProjection(relation, row2[attr], data2[attr], result2, nodeDict, context);
                    assign(result, {
                        [attr]: result2,
                    });
                }
                else {
                    assert(relation instanceof Array);
                    assert(row2[attr] instanceof Array);
                    const result2 = await this.formResult(relation[0], row2[attr], data2[attr], context, nodeDict);

                    assign(result, {
                        [attr]: result2,
                    });
                }
            }
        }

        for (const attr in laterExprDict) {
            const exprResult = laterExprDict[attr as ExpressionKey]!(nodeDict);
            // projection是不应出现计算不出来的情况
            assert(typeof exprResult !== 'function', new OakError(RowStore.$$LEVEL, RowStore.$$CODES.expressionUnresolved, 'data中的expr无法计算，请检查命名与引用的一致性'));
            assign(result, {
                [attr]: exprResult,
            });
        }
    }

    private async formResult<T extends keyof ED>(
        entity: T,
        rows: Array<Partial<ED[T]['Schema']>>,
        selection: Omit<ED[T]['Selection'], 'filter'>,
        context: Context<ED>,
        nodeDict?: NodeDict) {
        const { data, sorter, indexFrom, count } = selection;
        // 先计算projection
        const rows2 = await Promise.all(
            rows.map(
                async (row) => {
                    const result: Partial<ED[T]['Schema']> = {};
                    const nodeDict2: NodeDict = {};
                    if (nodeDict) {
                        assign(nodeDict2, nodeDict);
                    }
                    await this.formProjection(entity, row, data, result, nodeDict2, context);
                    return result;
                }
            )
        );

        return rows2;
    }

    async select<T extends keyof ED>(entity: T, selection: ED[T]['Selection'], context: Context<ED>, params?: Object): Promise<SelectionResult<ED, T>> {
        let autoCommit = false;
        let result;
        if (!context.uuid) {
            autoCommit = true;
            await context.begin();
        }
        try {
            const rows = await this.cascadeSelect(entity, selection, context, params);
    
            result = await this.formResult(entity, rows, selection, context);
        } catch (err) {
            if (autoCommit) {
                await context.rollback();
            }
            throw err;
        }
        if (autoCommit) {
            await context.commit();
        }
        const { stats } = context.result!;
        return {
            result,
            stats,
        };
    }

    async count<T extends keyof ED>(entity: T, selection: Omit<ED[T]['Selection'], "action" | "data" | "sorter">, context: Context<ED>, params?: Object): Promise<number> {
        const rows = await this.cascadeSelect(entity, assign({}, selection, {
            data: {
                id: 1,
            }
        }) as any, context, params);

        return rows.length;
    }

    private addToTxnNode(node: RowNode, context: Context<ED>, action: 'create' | 'update' | 'remove') {
        const txnNode = this.activeTxnDict[context.uuid!];
        assert(txnNode);
        assert(!node.$nextNode);
        if (txnNode.nodeHeader) {
            node.$nextNode = txnNode.nodeHeader;
            txnNode.nodeHeader = node;
        }
        else {
            txnNode.nodeHeader = node;
        }
        txnNode[action]++;
    }

    begin(uuid: string) {
        assert(!this.activeTxnDict.hasOwnProperty(uuid));
        assign(this.activeTxnDict, {
            [uuid]: {
                create: 0,
                update: 0,
                remove: 0,
            },
        });
    }

    commit(uuid: string) {
        assert(this.activeTxnDict.hasOwnProperty(uuid));
        let node = this.activeTxnDict[uuid].nodeHeader;
        while (node) {
            const node2 = node.$nextNode;
            assert(node.$uuid === uuid);
            if (node.$next) {
                // create/update
                node.$current = assign(node.$current, node.$next);
                unset(node, '$uuid');
                unset(node, '$next');
                unset(node, '$path');
                unset(node, '$nextNode');
            }
            else {
                // remove
                assert(node.$path);
                unset(this.store, node.$path);
            }
            node = node2;
        }
        unset(this.activeTxnDict, uuid);
    }

    rollback(uuid: string) {
        assert(this.activeTxnDict.hasOwnProperty(uuid));
        let node = this.activeTxnDict[uuid].nodeHeader;
        while (node) {
            const node2 = node.$nextNode;
            assert(node.$uuid === uuid);
            if (node.$current) {
                // update/remove
                unset(node, '$uuid');
                unset(node, '$next');
                unset(node, '$path');
                unset(node, '$nextNode');
            }
            else {
                // create
                assert(node.$path);
                unset(this.store, node.$path);
            }
            node = node2;
        }
        unset(this.activeTxnDict, uuid);
    }
}