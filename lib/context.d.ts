import { Context as ContextInterface } from 'oak-domain/lib/types/Context';
import { EntityDict, OpRecord } from 'oak-domain/lib/types/Entity';
import TreeStore from './store';
export declare class Context<ED extends EntityDict> implements ContextInterface<ED> {
    rowStore: TreeStore<ED>;
    uuid?: string;
    opRecords: OpRecord<ED>[];
    getRandomNumber: (length: number) => Promise<Uint8Array>;
    constructor(store: TreeStore<ED>, getRandomNumber: (length: number) => Promise<Uint8Array>);
    on(event: 'commit' | 'rollback', callback: (context: ContextInterface<ED>) => Promise<void>): void;
    begin(options?: object): Promise<void>;
    commit(): Promise<void>;
    rollback(): Promise<void>;
}
