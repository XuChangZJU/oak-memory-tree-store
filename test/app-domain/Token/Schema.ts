import { String, Int, Float, Double, Boolean, Text, Datetime, File, Image } from "oak-domain/src/types/DataType";
import { Q_DateValue, Q_BooleanValue, Q_NumberValue, Q_StringValue, Q_EnumValue, NodeId, MakeFilter, FulltextFilter, ExprOp, ExpressionKey } from "oak-domain/src/types/Demand";
import { OneOf, ValueOf } from "oak-domain/src/types/Polyfill";
import * as SubQuery from "../_SubQuery";
import { Operation as OakOperation } from "oak-domain/src/types/Entity";
import { AbleState } from "oak-domain/lib/actions/action";
import { ParticularAction, Action } from "./Action";
import * as User from "../User/Schema";
import * as Mobile from "../Mobile/Schema";
export type OpSchema = {
    id: String<64>;
    $$createAt$$?: Datetime;
    $$updateAt$$?: Datetime;
    $$removeAt$$?: Datetime;
    entity: "mobile";
    entityId: String<64>;
    userId?: String<64>;
    playerId?: String<64>;
    ableState?: AbleState;
};
export type OpAttr = keyof OpSchema;
export type Schema = {
    id: String<64>;
    $$createAt$$?: Datetime;
    $$updateAt$$?: Datetime;
    $$removeAt$$?: Datetime;
    entity: "mobile";
    entityId: String<64>;
    userId?: String<64>;
    playerId?: String<64>;
    ableState?: AbleState;
    user?: User.Schema;
    player?: User.Schema;
    mobile?: Mobile.Schema;
} & {
    [A in ExpressionKey]?: any;
};
type AttrFilter<E = Q_EnumValue<"mobile">> = {
    id: Q_StringValue | SubQuery.TokenIdSubQuery;
    $$createAt$$: Q_DateValue;
    $$updateAt$$: Q_DateValue;
    entity: E;
    entityId: Q_StringValue;
    userId: Q_StringValue | SubQuery.UserIdSubQuery;
    user: User.Filter;
    playerId: Q_StringValue | SubQuery.UserIdSubQuery;
    player: User.Filter;
    ableState: Q_EnumValue<AbleState>;
};
export type Filter<E = Q_EnumValue<"mobile">> = MakeFilter<AttrFilter<E> & ExprOp<OpAttr>>;
export type Projection = {
    "#id"?: NodeId;
    id: 1;
    $$createAt$$?: 1;
    $$updateAt$$?: 1;
    entity?: 1;
    entityId?: 1;
    userId?: 1;
    user?: User.Projection;
    playerId?: 1;
    player?: User.Projection;
    ableState?: 1;
    mobile?: Mobile.Projection;
} & ExprOp<OpAttr>;
export type ExportProjection = {
    "#id"?: NodeId;
    id?: string;
    $$createAt$$?: string;
    $$updateAt$$?: string;
    entity?: string;
    entityId?: string;
    userId?: string;
    user?: User.ExportProjection;
    playerId?: string;
    player?: User.ExportProjection;
    ableState?: string;
    mobile?: Mobile.ExportProjection;
} & ExprOp<OpAttr>;
type TokenIdProjection = OneOf<{
    id: 1;
}>;
type UserIdProjection = OneOf<{
    userId: 1;
    playerId: 1;
}>;
type MobileIdProjection = OneOf<{
    entityId: 1;
}>;
export type SortAttr = OneOf<{
    id: 1;
    $$createAt$$: 1;
    $$updateAt$$: 1;
    entity: 1;
    entityId: 1;
    userId: 1;
    user: User.SortAttr;
    playerId: 1;
    player: User.SortAttr;
    ableState: 1;
    mobile: Mobile.SortAttr;
} & ExprOp<OpAttr>>;
export type SortNode = {
    $attr: SortAttr;
    $direction?: "asc" | "desc";
};
export type Sorter = SortNode[];
export type SelectOperation<P = Projection> = OakOperation<"select", P, Filter, Sorter>;
export type Selection<P = Projection> = Omit<SelectOperation<P>, "action">;
export type Exportation = OakOperation<"export", ExportProjection, Filter, Sorter>;
type CreateOperationData = Omit<OpSchema, "userId" | "playerId" | "entityId"> & ({
    entity: "mobile";
    entityId: String<64>;
    mobile?: undefined;
} | ({
    entity?: undefined;
    entityId?: undefined;
} & OneOf<{
    mobile: Mobile.CreateSingleOperation | (Mobile.UpdateOperation & {
        id: String<64>;
    });
}>));
export type CreateSingleOperation = OakOperation<"create", CreateOperationData>;
export type CreateMultipleOperation = OakOperation<"create", Array<CreateOperationData>>;
export type CreateOperation = CreateSingleOperation | CreateMultipleOperation;
type UpdateOperationData = Partial<Omit<OpSchema, "id" | "userId" | "playerId" | "entityId">> & ({
    entity?: "mobile";
    entityId?: String<64>;
    mobile?: undefined;
} | ({
    entity?: undefined;
    entityId?: undefined;
} & OneOf<{
    mobile: Mobile.CreateSingleOperation | Omit<Mobile.UpdateOperation, "id" | "ids" | "filter">;
}>));
export type UpdateOperation = OakOperation<ParticularAction | "update", UpdateOperationData, Filter>;
type RemoveOperationData = {} & OneOf<{
    mobile?: Omit<Mobile.UpdateOperation | Mobile.RemoveOperation, "id" | "ids" | "filter">;
}>;
export type RemoveOperation = OakOperation<"remove", RemoveOperationData, Filter>;
export type Operation = CreateOperation | UpdateOperation | RemoveOperation | SelectOperation;
export type UserIdSubQuery = Selection<UserIdProjection>;
export type MobileIdSubQuery = Selection<MobileIdProjection>;
export type TokenIdSubQuery = Selection<TokenIdProjection>;
export type NativeAttr = OpAttr | `user.${User.NativeAttr}` | `player.${User.NativeAttr}` | `entity.${Mobile.NativeAttr}`;
export type FullAttr = NativeAttr;
export type EntityDef = {
    Schema: Schema;
    OpSchema: OpSchema;
    Action: Action;
    Selection: Selection;
    Operation: Operation;
    ParticularAction: ParticularAction;
};