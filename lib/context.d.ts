import { Context as ContextInterface } from 'oak-domain/lib/types/Context';
import { EntityDict, OpRecord } from 'oak-domain/lib/types/Entity';
import TreeStore from './store';
export declare class Context<ED extends EntityDict> implements ContextInterface<ED> {
    rowStore: TreeStore<ED>;
    uuid?: string;
    opRecords: OpRecord<ED>[];
    constructor(store: TreeStore<ED>);
    begin(options?: object): Promise<void>;
    commit(): Promise<void>;
    rollback(): Promise<void>;
}
