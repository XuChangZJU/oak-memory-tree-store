import assert from 'assert';
import { v4 } from 'uuid';
import { Context as ContextInterface } from 'oak-domain/lib/types/Context';
import { EntityDef, EntityDict, OperationResult, OpRecord } from 'oak-domain/lib/types/Entity';
import TreeStore from './store';

export class Context<ED extends EntityDict> implements ContextInterface<ED> {
    rowStore: TreeStore<ED>;
    uuid?: string;
    opRecords: OpRecord<ED>[];

    constructor(store: TreeStore<ED>) {
        this.rowStore = store;
        this.opRecords = [];
    }

    on(event: 'commit' | 'rollback', callback: (context: ContextInterface<ED>) => Promise<void>): void {
        throw new Error('not implemented here!');
    }

    async begin(options?: object): Promise<void> {
        assert(!this.uuid);
        this.uuid = v4();
        this.rowStore.begin(this.uuid);
    }
    async commit(): Promise<void> {
        assert(this.uuid);
        this.rowStore.commit(this.uuid!);
        this.uuid = undefined;
    }
    async rollback(): Promise<void> {
        assert(this.uuid);
        this.rowStore.rollback(this.uuid!);
        this.uuid = undefined;
    }
}