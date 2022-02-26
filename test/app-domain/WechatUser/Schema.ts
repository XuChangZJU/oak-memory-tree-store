import { String, Int, Float, Double, Boolean, Text, Datetime, File, Image } from "oak-domain/src/types/DataType";
import { Q_DateValue, Q_BooleanValue, Q_NumberValue, Q_StringValue, Q_EnumValue, NodeId, MakeFilter, FulltextFilter, ExprOp, ExpressionKey } from "oak-domain/src/types/Demand";
import { OneOf, ValueOf } from "oak-domain/src/types/Polyfill";
import * as SubQuery from "../_SubQuery";
import { Operation as OakOperation } from "oak-domain/src/types/Entity";
import { GenericAction } from "oak-domain/lib/actions/action";
import * as User from "../User/Schema";
import * as Application from "../Application/Schema";
export type OpSchema = {
    id: String<64>;
    $$createAt$$?: Datetime;
    $$updateAt$$?: Datetime;
    $$removeAt$$?: Datetime;
    origin: 'mp' | 'public';
    openId?: String<32>;
    unionId?: String<32>;
    accessToken: String<32>;
    sessionKey?: String<64>;
    subscribed?: Boolean;
    subscribedAt?: Datetime;
    unsubscribedAt?: Datetime;
    userId?: String<64>;
    applicationId: String<64>;
};
export type OpAttr = keyof OpSchema;
export type Schema = {
    id: String<64>;
    $$createAt$$?: Datetime;
    $$updateAt$$?: Datetime;
    $$removeAt$$?: Datetime;
    origin: 'mp' | 'public';
    openId?: String<32>;
    unionId?: String<32>;
    accessToken: String<32>;
    sessionKey?: String<64>;
    subscribed?: Boolean;
    subscribedAt?: Datetime;
    unsubscribedAt?: Datetime;
    userId?: String<64>;
    applicationId: String<64>;
    user?: User.Schema;
    application: Application.Schema;
} & {
    [A in ExpressionKey]?: any;
};
type AttrFilter = {
    id: Q_StringValue | SubQuery.WechatUserIdSubQuery;
    $$createAt$$: Q_DateValue;
    $$updateAt$$: Q_DateValue;
    origin: Q_EnumValue<'mp' | 'public'>;
    openId: Q_StringValue;
    unionId: Q_StringValue;
    accessToken: Q_StringValue;
    sessionKey: Q_StringValue;
    subscribed: Q_BooleanValue;
    subscribedAt: Q_DateValue;
    unsubscribedAt: Q_DateValue;
    userId: Q_StringValue | SubQuery.UserIdSubQuery;
    user: User.Filter;
    applicationId: Q_StringValue | SubQuery.ApplicationIdSubQuery;
    application: Application.Filter;
};
export type Filter = MakeFilter<AttrFilter & ExprOp<OpAttr>>;
export type Projection = {
    "#id"?: NodeId;
    id: 1;
    $$createAt$$?: 1;
    $$updateAt$$?: 1;
    origin?: 1;
    openId?: 1;
    unionId?: 1;
    accessToken?: 1;
    sessionKey?: 1;
    subscribed?: 1;
    subscribedAt?: 1;
    unsubscribedAt?: 1;
    userId?: 1;
    user?: User.Projection;
    applicationId?: 1;
    application?: Application.Projection;
} & ExprOp<OpAttr>;
export type ExportProjection = {
    "#id"?: NodeId;
    id?: string;
    $$createAt$$?: string;
    $$updateAt$$?: string;
    origin?: string;
    openId?: string;
    unionId?: string;
    accessToken?: string;
    sessionKey?: string;
    subscribed?: string;
    subscribedAt?: string;
    unsubscribedAt?: string;
    userId?: string;
    user?: User.ExportProjection;
    applicationId?: string;
    application?: Application.ExportProjection;
} & ExprOp<OpAttr>;
type WechatUserIdProjection = OneOf<{
    id: 1;
}>;
type UserIdProjection = OneOf<{
    userId: 1;
}>;
type ApplicationIdProjection = OneOf<{
    applicationId: 1;
}>;
export type SortAttr = OneOf<{
    id: 1;
    $$createAt$$: 1;
    $$updateAt$$: 1;
    origin: 1;
    openId: 1;
    unionId: 1;
    accessToken: 1;
    sessionKey: 1;
    subscribed: 1;
    subscribedAt: 1;
    unsubscribedAt: 1;
    userId: 1;
    user: User.SortAttr;
    applicationId: 1;
    application: Application.SortAttr;
} & ExprOp<OpAttr>>;
export type SortNode = {
    $attr: SortAttr;
    $direction?: "asc" | "desc";
};
export type Sorter = SortNode[];
export type SelectOperation<P = Projection> = OakOperation<"select", P, Filter, Sorter>;
export type Selection<P = Projection> = Omit<SelectOperation<P>, "action">;
export type Exportation = OakOperation<"export", ExportProjection, Filter, Sorter>;
type CreateOperationData = Omit<OpSchema, "userId" | "applicationId"> & ({
    user?: User.CreateSingleOperation | (User.UpdateOperation & {
        id: String<64>;
    });
    userId?: undefined;
} | {
    user?: undefined;
    userId?: String<64>;
}) & ({
    application?: Application.CreateSingleOperation | (Application.UpdateOperation & {
        id: String<64>;
    });
    applicationId?: undefined;
} | {
    application?: undefined;
    applicationId?: String<64>;
});
export type CreateSingleOperation = OakOperation<"create", CreateOperationData>;
export type CreateMultipleOperation = OakOperation<"create", Array<CreateOperationData>>;
export type CreateOperation = CreateSingleOperation | CreateMultipleOperation;
type UpdateOperationData = Partial<Omit<OpSchema, "id" | "userId" | "applicationId">> & ({
    user?: User.CreateSingleOperation | Omit<User.UpdateOperation, "id" | "ids" | "filter">;
    userId?: undefined;
} | {
    user?: undefined;
    userId?: String<64>;
}) & ({
    application?: Application.CreateSingleOperation | Omit<Application.UpdateOperation, "id" | "ids" | "filter">;
    applicationId?: undefined;
} | {
    application?: undefined;
    applicationId?: String<64>;
});
export type UpdateOperation = OakOperation<"update", UpdateOperationData, Filter>;
type RemoveOperationData = {} & {
    user?: Omit<User.UpdateOperation | User.RemoveOperation, "id" | "ids" | "filter">;
    application?: Omit<Application.UpdateOperation | Application.RemoveOperation, "id" | "ids" | "filter">;
};
export type RemoveOperation = OakOperation<"remove", RemoveOperationData, Filter>;
export type Operation = CreateOperation | UpdateOperation | RemoveOperation | SelectOperation;
export type UserIdSubQuery = Selection<UserIdProjection>;
export type ApplicationIdSubQuery = Selection<ApplicationIdProjection>;
export type WechatUserIdSubQuery = Selection<WechatUserIdProjection>;
export type NativeAttr = OpAttr | `user.${User.NativeAttr}` | `application.${Application.NativeAttr}`;
export type FullAttr = NativeAttr;
export type EntityDef = {
    Schema: Schema;
    OpSchema: OpSchema;
    Action: GenericAction;
    Selection: Selection;
    Operation: Operation;
};