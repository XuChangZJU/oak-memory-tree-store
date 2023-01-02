import TreeStore from '../src/store';
import { EntityDict } from 'oak-domain/lib/base-app-domain';
import { SyncContext, SyncRowStore } from "oak-domain/lib/store/SyncRowStore";
import { OperateOption, OperationResult, SelectOption, AggregationResult, TxnOption, StorageSchema } from "oak-domain/lib/types";

/**
 * 实现一个同步的context和store用于测试
 */
export class FrontendRuntimeContext extends SyncContext<EntityDict> {
    isRoot(): boolean {
        return true;
    }
    getCurrentUserId(allowUnloggedIn?: boolean | undefined): string | undefined {
        return 'OAK_ROOT_ID';
    }
    toString(): string {
        throw new Error("Method not implemented.");
    }
    allowUserUpdate(): boolean {
        return true;
    }
};

export class FrontendStore extends TreeStore<EntityDict> implements SyncRowStore<EntityDict, FrontendRuntimeContext> {
    operate<T extends keyof EntityDict, OP extends OperateOption>(entity: T, operation: EntityDict[T]["Operation"], context: FrontendRuntimeContext, option: OP): OperationResult<EntityDict> {
        return this.operateSync(entity, operation, context, option);
    }
    select<T extends keyof EntityDict, OP extends SelectOption>(entity: T, selection: EntityDict[T]["Selection"], context: FrontendRuntimeContext, option: OP): Partial<EntityDict[T]["Schema"]>[] {
        return this.selectSync(entity, selection, context, option);
    }
    count<T extends keyof EntityDict, OP extends SelectOption>(entity: T, selection: Pick<EntityDict[T]["Selection"], "count" | "filter">, context: FrontendRuntimeContext, option: OP): number {
        return this.countSync(entity, selection, context, option);
    }
    aggregate<T extends keyof EntityDict, OP extends SelectOption>(entity: T, aggregation: EntityDict[T]["Aggregation"], context: FrontendRuntimeContext, option: OP): AggregationResult<EntityDict[T]["Schema"]> {
        throw new Error("Method not implemented.");
    }
    begin(option?: TxnOption | undefined): string {
        return this.beginSync();
    }
    commit(txnId: string): void {
        return this.commitSync(txnId);
    }
    rollback(txnId: string): void {
        return this.rollbackSync(txnId);
    }
};