import { NodeId } from "oak-domain/lib/types/Demand";
import { EntityShape } from "oak-domain/src/types/Entity";
export declare type RowNode = {
    $txnId?: string;
    $next?: Partial<EntityShape & {
        [K: string]: any;
    }> | null;
    $current?: EntityShape | null;
    $nextNode?: RowNode;
    $path?: string;
};
export declare type NodeDict = {
    [K in NodeId]: EntityShape;
};
export declare type ExprResolveFn = (nodeDict: NodeDict) => ExprResolveFn | any;
