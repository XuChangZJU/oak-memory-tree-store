import { NodeId } from "oak-domain/lib/types/Demand";
import { EntityShape } from "oak-domain/src/types/Entity";
export declare type RowNode<SH extends EntityShape = EntityShape> = {
    $uuid?: string;
    $next?: Partial<SH> | null;
    $current?: SH | null;
    $nextNode?: RowNode<SH>;
    $path?: string;
};
export declare type NodeDict<SH extends EntityShape = EntityShape> = {
    [K in NodeId]: SH;
};
export declare type ExprResolveFn<SH extends EntityShape = EntityShape> = (nodeDict: NodeDict<SH>) => ExprResolveFn<SH> | any;
