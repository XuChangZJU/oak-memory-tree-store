import { EntityDef, SelectionResult, DeduceCreateSingleOperation, DeduceRemoveOperation, DeduceUpdateOperation, OperationResult } from "oak-domain/lib/types/Entity";
import { CascadeStore } from 'oak-domain/lib/schema/CascadeStore';
import { StorageSchema } from 'oak-domain/lib/types/Storage';
import { Context } from "./context";
import { NodeDict, RowNode } from "./types/type";
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
    }): void;
    getCurrentData(): {
        [T in keyof ED]?: {
            [ID: string]: ED[T]['OpSchema'];
        };
    };
    constructor(storageSchema: StorageSchema<ED>, immutable?: boolean, initialData?: {
        [T in keyof ED]?: {
            [ID: string]: ED[T]['OpSchema'];
        };
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
    protected selectAbjointRow<T extends keyof ED>(entity: T, selection: Omit<ED[T]['Selection'], 'indexFrom' | 'count' | 'data' | 'sorter'>, context: Context<ED>, params?: Object): Promise<SelectionResult<ED, T>['result']>;
    protected updateAbjointRow<T extends keyof ED>(entity: T, operation: DeduceCreateSingleOperation<ED[T]['Schema']> | DeduceUpdateOperation<ED[T]['Schema']> | DeduceRemoveOperation<ED[T]['Schema']>, context: Context<ED>, params?: Object): Promise<void>;
    private doOperation;
    operate<T extends keyof ED>(entity: T, operation: ED[T]['Operation'], context: Context<ED>, params?: Object): Promise<OperationResult<ED>>;
    protected formProjection<T extends keyof ED>(entity: T, row: ED[T]['Schema'], data: ED[T]['Selection']['data'], result: Partial<ED[T]['Schema']>, nodeDict: NodeDict, context: Context<ED>): Promise<void>;
    private formResult;
    select<T extends keyof ED>(entity: T, selection: ED[T]['Selection'], context: Context<ED>, params?: Object): Promise<SelectionResult<ED, T>>;
    count<T extends keyof ED>(entity: T, selection: Omit<ED[T]['Selection'], "action" | "data" | "sorter">, context: Context<ED>, params?: Object): Promise<number>;
    private addToTxnNode;
    begin(uuid: string): void;
    commit(uuid: string): void;
    rollback(uuid: string): void;
}
