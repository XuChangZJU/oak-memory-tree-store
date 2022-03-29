import assert from 'assert';
import { v4 } from 'uuid';
import { Context as ContextInterface } from 'oak-domain/lib/types/Context';
import { EntityDict, OperationResult, OpRecord } from 'oak-domain/lib/types/Entity';
import TreeStore from './store';

export class Context<ED extends EntityDict> implements ContextInterface<ED> {
    rowStore: TreeStore<ED>;
    uuid?: string;
    opRecords: OpRecord<ED>[];
    getRandomNumber: (length: number) => Promise<Uint8Array>;   // 在不同的环境下取随机数的实现

    constructor(store: TreeStore<ED>, getRandomNumber: (length: number) => Promise<Uint8Array>) {
        this.rowStore = store;
        this.opRecords = [];
        this.getRandomNumber = getRandomNumber;
    }

    on(event: 'commit' | 'rollback', callback: (context: ContextInterface<ED>) => Promise<void>): void {
        throw new Error('not implemented here!');
    }

    async begin(options?: object): Promise<void> {
        assert(!this.uuid);
        const random = await this.getRandomNumber(16);
        this.uuid = v4({ random });
        this.rowStore.begin(this.uuid);
    }
    async commit(): Promise<void> {
        if (this.uuid) {
            this.rowStore.commit(this.uuid!);
            this.uuid = undefined;
        }
    }
    async rollback(): Promise<void> {
        if(this.uuid) {
            this.rowStore.rollback(this.uuid!);
            this.uuid = undefined;
        }
    }
}