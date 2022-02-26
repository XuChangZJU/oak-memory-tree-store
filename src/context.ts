import assert from 'assert';
import { v4 } from 'uuid';
import { Context as ContextInterface } from 'oak-domain/lib/types/Context';
import { EntityDef, EntityShape } from 'oak-domain/lib/types/Entity';
import TreeStore from './store';

export class Context<E extends string, ED extends {
    [K in E]: EntityDef<E, ED, K, SH>;
}, SH extends EntityShape = EntityShape> implements ContextInterface<E, ED, SH> {
    rowStore: TreeStore<E, ED, SH>;
    uuid?: string;

    constructor(store: TreeStore<E, ED, SH>) {
        this.rowStore = store;
    }

    on(event: 'commit' | 'rollback', callback: (context: ContextInterface<E, ED, SH>) => Promise<void>): void {
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