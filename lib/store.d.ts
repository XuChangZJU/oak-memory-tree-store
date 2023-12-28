import { OperationResult, OperateOption, OpRecord, EntityDict, SelectOption, AggregationResult } from "oak-domain/lib/types/Entity";
import { EntityDict as BaseEntityDict } from 'oak-domain/lib/base-app-domain';
import { StorageSchema } from 'oak-domain/lib/types/Storage';
import { NodeDict } from "./types/type";
import { SyncContext } from 'oak-domain/lib/store/SyncRowStore';
import { AsyncContext } from 'oak-domain/lib/store/AsyncRowStore';
import { CascadeStore } from 'oak-domain/lib/store/CascadeStore';
import { Context } from 'oak-domain/lib/types';
export interface TreeStoreSelectOption extends SelectOption {
    nodeDict?: NodeDict;
    disableSubQueryHashjoin?: boolean;
}
export interface TreeStoreOperateOption extends OperateOption {
}
export default class TreeStore<ED extends EntityDict & BaseEntityDict> extends CascadeStore<ED> {
    private store;
    private seq;
    private activeTxnDict;
    private stat;
    private getNextSeq;
    private setMaxSeq;
    protected supportMultipleCreate(): boolean;
    protected supportManyToOneJoin(): boolean;
    resetInitialData(data: {
        [T in keyof ED]?: ED[T]['OpSchema'][];
    }, stat?: {
        create: number;
        update: number;
        remove: number;
        commit: number;
    }): void;
    getCurrentData(keys?: (keyof ED)[]): {
        [T in keyof ED]?: ED[T]['OpSchema'][];
    };
    constructor(storageSchema: StorageSchema<ED>);
    private constructRow;
    private testFilterFns;
    private translateLogicFilter;
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
    private translateExpressionNode;
    private translateExpression;
    private translateFulltext;
    private translatePredicate;
    private translateObjectPredicate;
    private translateAttribute;
    private translateFilterInner;
    private translateFilter;
    private translateSorter;
    /**
     * 目标行，如果有id过滤条件可直接取
     * @param entity
     * @param selection
     * @returns
     */
    private getEntityNodes;
    protected selectAbjointRow<T extends keyof ED, OP extends TreeStoreSelectOption, Cxt extends Context>(entity: T, selection: ED[T]['Selection'], context: Cxt, option: OP): Partial<ED[T]['Schema']>[];
    protected updateAbjointRow<T extends keyof ED, OP extends TreeStoreOperateOption, Cxt extends Context>(entity: T, operation: ED[T]['CreateSingle'] | ED[T]['Update'] | ED[T]['Remove'], context: Cxt, option: OP): number;
    protected selectAbjointRowAsync<T extends keyof ED, OP extends TreeStoreSelectOption, Cxt extends Context>(entity: T, selection: ED[T]['Selection'], context: Cxt, option: OP): Promise<Partial<ED[T]["Schema"]>[]>;
    protected updateAbjointRowAsync<T extends keyof ED, OP extends TreeStoreOperateOption, Cxt extends Context>(entity: T, operation: ED[T]['CreateSingle'] | ED[T]['Update'] | ED[T]['Remove'], context: Cxt, option: OP): Promise<number>;
    protected operateSync<T extends keyof ED, OP extends TreeStoreOperateOption, Cxt extends SyncContext<ED>>(entity: T, operation: ED[T]['Operation'], context: Cxt, option: OP): OperationResult<ED>;
    protected operateAsync<T extends keyof ED, OP extends TreeStoreOperateOption, Cxt extends AsyncContext<ED>>(entity: T, operation: ED[T]['Operation'], context: Cxt, option: OP): Promise<OperationResult<ED>>;
    /**
     * 计算最终结果集当中的函数，这个函数可能测试不够充分
     * @param entity
     * @param projection
     * @param data
     * @param nodeDict
     * @param context
     */
    private formExprInResult;
    private formResult;
    /**
     * 本函数把结果中的相应属性映射成一个字符串，用于GroupBy
     * @param entity
     * @param row
     * @param projection
     */
    private mappingProjectionOnRow;
    private calcAggregation;
    private formAggregation;
    protected selectSync<T extends keyof ED, OP extends TreeStoreSelectOption, Cxt extends SyncContext<ED>>(entity: T, selection: ED[T]['Selection'], context: Cxt, option: OP): Partial<ED[T]['Schema']>[];
    protected selectAsync<T extends keyof ED, OP extends TreeStoreSelectOption, Cxt extends AsyncContext<ED>>(entity: T, selection: ED[T]['Selection'], context: Cxt, option: OP): Promise<Partial<ED[T]["Schema"]>[]>;
    protected aggregateAbjointRowSync<T extends keyof ED, OP extends TreeStoreSelectOption, Cxt extends SyncContext<ED>>(entity: T, aggregation: ED[T]['Aggregation'], context: Cxt, option: OP): AggregationResult<ED[T]['Schema']>;
    protected aggregateAbjointRowAsync<T extends keyof ED, OP extends TreeStoreSelectOption, Cxt extends AsyncContext<ED>>(entity: T, aggregation: ED[T]['Aggregation'], context: Cxt, option: OP): Promise<AggregationResult<ED[T]['Schema']>>;
    protected countAbjointRow<T extends keyof ED, OP extends TreeStoreSelectOption, Cxt extends SyncContext<ED>>(entity: T, selection: Pick<ED[T]['Selection'], 'filter' | 'count'>, context: Cxt, option: OP): number;
    protected countAbjointRowAsync<T extends keyof ED, OP extends TreeStoreSelectOption, Cxt extends AsyncContext<ED>>(entity: T, selection: Pick<ED[T]['Selection'], 'filter' | 'count'>, context: Cxt, option: OP): Promise<number>;
    private addToTxnNode;
    getStat(): {
        create: number;
        update: number;
        remove: number;
        commit: number;
    };
    beginSync(): string;
    private commitCallbacks;
    onCommit(callback: (result: OperationResult<ED>) => Promise<void>): () => ((result: OperationResult<ED>) => Promise<void>)[];
    private addToOperationResult;
    private commitLogic;
    commitSync(uuid: string): void;
    rollbackSync(uuid: string): void;
    beginAsync(): Promise<string>;
    commitAsync(uuid: string): Promise<void>;
    rollbackAsync(uuid: string): Promise<void>;
    sync<OP extends TreeStoreOperateOption, Cxt extends SyncContext<ED>>(opRecords: Array<OpRecord<ED>>, context: Cxt, option?: OP): void;
}
