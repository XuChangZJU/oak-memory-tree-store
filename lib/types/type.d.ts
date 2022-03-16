import { NodeId } from "oak-domain/lib/types/Demand";
import { EntityShape } from "oak-domain/src/types/Entity";
export declare type RowNode = {
    $uuid?: string;
    $next?: Partial<EntityShape> | null;
    $current?: EntityShape | null;
    $nextNode?: RowNode;
    $path?: string;
};
export declare type NodeDict = {
    [K in NodeId]: EntityShape;
};
export declare type ExprResolveFn = (nodeDict: NodeDict) => ExprResolveFn | any;
