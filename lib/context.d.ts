import { Context as ContextInterface } from 'oak-domain/lib/types/Context';
import { EntityDef, OperationResult } from 'oak-domain/lib/types/Entity';
import TreeStore from './store';
export declare class Context<ED extends {
    [E: string]: EntityDef;
}> implements ContextInterface<ED> {
    rowStore: TreeStore<ED>;
    uuid?: string;
    result?: OperationResult<ED>;
    constructor(store: TreeStore<ED>);
    on(event: 'commit' | 'rollback', callback: (context: ContextInterface<ED>) => Promise<void>): void;
    begin(options?: object): Promise<void>;
    commit(): Promise<void>;
    rollback(): Promise<void>;
}
