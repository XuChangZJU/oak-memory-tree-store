import { EntityDef, SelectionResult, DeduceCreateSingleOperation, DeduceSelection, EntityShape, DeduceRemoveOperation, DeduceUpdateOperation } from "oak-domain/lib/types/Entity";
import { CascadeStore } from 'oak-domain/lib/schema/CascadeStore';
import { StorageSchema } from 'oak-domain/lib/types/Storage';
import { Context } from "./context";
import { NodeDict, RowNode } from "./types/type";
export default class TreeStore<E extends string, ED extends {
    [K in E]: EntityDef<E, ED, K, SH>;
}, SH extends EntityShape = EntityShape> extends CascadeStore<E, ED, SH> {
    store: {
        [T in E]?: {
            [ID: string]: RowNode<SH>;
        };
    };
    immutable: boolean;
    activeTxnDict: {
        [T: string]: {
            nodeHeader?: RowNode<SH>;
            create: number;
            update: number;
            remove: number;
        };
    };
    constructor(storageSchema: StorageSchema, immutable?: boolean);
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
    protected selectAbjointRow<T extends E>(entity: T, selection: Omit<ED[T]['Selection'], 'indexFrom' | 'count' | 'data' | 'sorter'>, context: Context<E, ED, SH>, params?: Object): Promise<SelectionResult<E, ED, T, SH>>;
    protected updateAbjointRow<T extends E>(entity: T, operation: DeduceCreateSingleOperation<E, ED, T, SH> | DeduceUpdateOperation<E, ED, T, SH> | DeduceRemoveOperation<E, ED, T, SH>, context: Context<E, ED, SH>, params?: Object): Promise<void>;
    private doOperation;
    operate<T extends E>(entity: T, operation: ED[T]['Operation'], context: Context<E, ED, SH>, params?: Object): Promise<void>;
    protected formProjection<T extends E>(entity: T, row: ED[T]['Schema'], data: DeduceSelection<E, ED, T, SH>['data'], result: Partial<ED[T]['Schema']>, nodeDict: NodeDict<SH>, context: Context<E, ED, SH>): Promise<void>;
    private formResult;
    select<T extends E>(entity: T, selection: ED[T]['Selection'], context: Context<E, ED, SH>, params?: Object): Promise<SelectionResult<E, ED, T, SH>>;
    countRow<T extends E>(entity: T, selection: Omit<ED[T]['Selection'], "action" | "data" | "sorter">, context: Context<E, ED, SH>, params?: Object): Promise<number>;
    private addToTxnNode;
    begin(uuid: string): void;
    commit(uuid: string): void;
    rollback(uuid: string): void;
}
