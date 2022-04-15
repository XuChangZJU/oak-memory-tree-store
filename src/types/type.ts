import { NodeId } from "oak-domain/lib/types/Demand";
import { EntityShape, EntityDef } from "oak-domain/src/types/Entity";

export type RowNode = {
    $txnId?: string;       // 当前加锁的事务号
    $next?: Partial<EntityShape> | null;       // 更新的后项，如果是删除则为null
    $current?: EntityShape | null;             // 当前数据，如果是插入则为null
    $nextNode?: RowNode;          // 当前事务的下一结点（提交回滚时遍历）
    $path?: string;                   // 结点在树上的路径，为了create的回滚所用
};

export type NodeDict = {
    [K in NodeId]: EntityShape;
};

export type ExprResolveFn = (nodeDict: NodeDict) => ExprResolveFn | any;