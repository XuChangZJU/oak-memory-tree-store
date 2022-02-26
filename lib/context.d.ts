import { Context as ContextInterface } from 'oak-domain/lib/types/Context';
import { EntityDef, EntityShape } from 'oak-domain/lib/types/Entity';
import TreeStore from './store';
export declare class Context<E extends string, ED extends {
    [K in E]: EntityDef<E, ED, K, SH>;
}, SH extends EntityShape = EntityShape> implements ContextInterface<E, ED, SH> {
    rowStore: TreeStore<E, ED, SH>;
    uuid?: string;
    constructor(store: TreeStore<E, ED, SH>);
    on(event: 'commit' | 'rollback', callback: (context: ContextInterface<E, ED, SH>) => Promise<void>): void;
    begin(options?: object): Promise<void>;
    commit(): Promise<void>;
    rollback(): Promise<void>;
}
