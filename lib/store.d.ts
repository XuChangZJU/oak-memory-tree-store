import { DeduceCreateSingleOperation, DeduceRemoveOperation, DeduceUpdateOperation, OperationResult, OperateParams, OpRecord, EntityDict, SelectRowShape, SelectionResult } from "oak-domain/lib/types/Entity";
import { CascadeStore } from 'oak-domain/lib/store/CascadeStore';
import { StorageSchema } from 'oak-domain/lib/types/Storage';
import { Context } from "oak-domain/lib/types/Context";
import { NodeDict } from "./types/type";
export default class TreeStore<ED extends EntityDict, Cxt extends Context<ED>> extends CascadeStore<ED, Cxt> {
    private store;
    private activeTxnDict;
    private stat;
    protected supportMultipleCreate(): boolean;
    protected supportManyToOneJoin(): boolean;
    setInitialData(data: {
        [T in keyof ED]?: {
            [ID: string]: ED[T]['OpSchema'];
        };
    }): void;
    getCurrentData(): {
        [T in keyof ED]?: {
            [ID: string]: ED[T]['OpSchema'];
        };
    };
    constructor(storageSchema: StorageSchema<ED>, initialData?: {
        [T in keyof ED]?: {
            [ID: string]: ED[T]['OpSchema'];
        };
    }, stat?: {
        create: number;
        update: number;
        remove: number;
        commit: number;
    });
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
    /**
     * 将一次查询的结果集加入result
     * @param entity
     * @param rows
     * @param context
     */
    private addToResultSelections;
    protected selectAbjointRow<T extends keyof ED, S extends ED[T]['Selection']>(entity: T, selection: S, context: Cxt, params?: OperateParams): Promise<SelectRowShape<ED[T]['Schema'], S['data']>[]>;
    protected updateAbjointRow<T extends keyof ED>(entity: T, operation: DeduceCreateSingleOperation<ED[T]['Schema']> | DeduceUpdateOperation<ED[T]['Schema']> | DeduceRemoveOperation<ED[T]['Schema']>, context: Cxt, params?: OperateParams): Promise<number>;
    private doOperation;
    operate<T extends keyof ED>(entity: T, operation: ED[T]['Operation'], context: Cxt, params?: OperateParams): Promise<OperationResult<ED>>;
    protected formProjection<T extends keyof ED>(entity: T, row: Partial<ED[T]['OpSchema']>, data: ED[T]['Selection']['data'], result: object, nodeDict: NodeDict, context: Cxt): Promise<void>;
    private formResult;
    select<T extends keyof ED, S extends ED[T]['Selection']>(entity: T, selection: S, context: Cxt, params?: Object): Promise<SelectionResult<ED[T]['Schema'], S['data']>>;
    count<T extends keyof ED>(entity: T, selection: Omit<ED[T]['Selection'], "action" | "data" | "sorter">, context: Cxt, params?: Object): Promise<number>;
    private addToTxnNode;
    getStat(): {
        create: number;
        update: number;
        remove: number;
        commit: number;
    };
    begin(): Promise<string>;
    commit(uuid: string): Promise<void>;
    rollback(uuid: string): Promise<void>;
    sync(opRecords: Array<OpRecord<ED>>, context: Cxt): Promise<void>;
}
