import { DeduceCreateSingleOperation, DeduceRemoveOperation, DeduceUpdateOperation, OperationResult, OperateOption, OpRecord, EntityDict, SelectOption } from "oak-domain/lib/types/Entity";
import { EntityDict as BaseEntityDict } from 'oak-domain/lib/base-app-domain';
import { StorageSchema } from 'oak-domain/lib/types/Storage';
import { NodeDict } from "./types/type";
import { SyncContext } from 'oak-domain/lib/store/SyncRowStore';
import { AsyncContext } from 'oak-domain/lib/store/AsyncRowStore';
import { CascadeStore } from 'oak-domain/lib/store/CascadeStore';
import { Context } from 'oak-domain/lib/types';
export interface TreeStoreSelectOption extends SelectOption {
    nodeDict?: NodeDict;
}
export interface TreeStoreOperateOption extends OperateOption {
}
export default class TreeStore<ED extends EntityDict & BaseEntityDict> extends CascadeStore<ED> {
    private store;
    private activeTxnDict;
    private stat;
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
    getCurrentData(): {
        [T in keyof ED]?: ED[T]['OpSchema'][];
    };
    constructor(storageSchema: StorageSchema<ED>);
    private constructRow;
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
    private translateAttribute;
    private translateFilter;
    private translateSorter;
    protected selectAbjointRow<T extends keyof ED, OP extends TreeStoreSelectOption, Cxt extends Context>(entity: T, selection: ED[T]['Selection'], context: Cxt, option?: OP): Partial<ED[T]['Schema']>[];
    protected updateAbjointRow<T extends keyof ED, OP extends TreeStoreOperateOption, Cxt extends Context>(entity: T, operation: DeduceCreateSingleOperation<ED[T]['Schema']> | DeduceUpdateOperation<ED[T]['Schema']> | DeduceRemoveOperation<ED[T]['Schema']>, context: Cxt, option?: OP): number;
    protected selectAbjointRowAsync<T extends keyof ED, OP extends TreeStoreSelectOption, Cxt extends Context>(entity: T, selection: ED[T]['Selection'], context: Cxt, option?: OP): Promise<Partial<ED[T]["Schema"]>[]>;
    protected updateAbjointRowAsync<T extends keyof ED, OP extends TreeStoreOperateOption, Cxt extends Context>(entity: T, operation: DeduceCreateSingleOperation<ED[T]['Schema']> | DeduceUpdateOperation<ED[T]['Schema']> | DeduceRemoveOperation<ED[T]['Schema']>, context: Cxt, option?: OP): Promise<number>;
    operateSync<T extends keyof ED, OP extends TreeStoreOperateOption, Cxt extends SyncContext<ED>>(entity: T, operation: ED[T]['Operation'], context: Cxt, option: OP): OperationResult<ED>;
    operateAsync<T extends keyof ED, OP extends TreeStoreOperateOption, Cxt extends AsyncContext<ED>>(entity: T, operation: ED[T]['Operation'], context: Cxt, option: OP): Promise<OperationResult<ED>>;
    /**
     * 计算最终结果集当中的函数，这个函数可能测试不够充分
     * @param entity
     * @param projection
     * @param data
     * @param nodeDict
     * @param context
     */
    protected formExprInResult<T extends keyof ED, Cxt extends Context>(entity: T, projection: ED[T]['Selection']['data'], data: Partial<ED[T]['Schema']>, nodeDict: NodeDict, context: Cxt): void;
    private formResult;
    selectSync<T extends keyof ED, OP extends TreeStoreSelectOption, Cxt extends SyncContext<ED>>(entity: T, selection: ED[T]['Selection'], context: Cxt, option: OP): Partial<ED[T]['Schema']>[];
    selectAsync<T extends keyof ED, OP extends TreeStoreSelectOption, Cxt extends AsyncContext<ED>>(entity: T, selection: ED[T]['Selection'], context: Cxt, option: OP): Promise<Partial<ED[T]["Schema"]>[]>;
    countSync<T extends keyof ED, OP extends TreeStoreSelectOption, Cxt extends SyncContext<ED>>(entity: T, selection: Pick<ED[T]['Selection'], 'filter' | 'count'>, context: Cxt, option: OP): number;
    countAsync<T extends keyof ED, OP extends TreeStoreSelectOption, Cxt extends AsyncContext<ED>>(entity: T, selection: Pick<ED[T]['Selection'], 'filter' | 'count'>, context: Cxt, option: OP): Promise<number>;
    private addToTxnNode;
    getStat(): {
        create: number;
        update: number;
        remove: number;
        commit: number;
    };
    beginSync(): string;
    commitSync(uuid: string): void;
    rollbackSync(uuid: string): void;
    beginAsync(): Promise<string>;
    commitAsync(uuid: string): Promise<void>;
    rollbackAsync(uuid: string): Promise<void>;
    sync<OP extends TreeStoreOperateOption, Cxt extends SyncContext<ED>>(opRecords: Array<OpRecord<ED>>, context: Cxt, option?: OP): void;
}
