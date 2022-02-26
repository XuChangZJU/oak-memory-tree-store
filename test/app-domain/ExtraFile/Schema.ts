import { String, Int, Float, Double, Boolean, Text, Datetime, File, Image } from "oak-domain/src/types/DataType";
import { Q_DateValue, Q_BooleanValue, Q_NumberValue, Q_StringValue, Q_EnumValue, NodeId, MakeFilter, FulltextFilter, ExprOp, ExpressionKey } from "oak-domain/src/types/Demand";
import { OneOf, ValueOf } from "oak-domain/src/types/Polyfill";
import * as SubQuery from "../_SubQuery";
import { Operation as OakOperation } from "oak-domain/src/types/Entity";
import { GenericAction } from "oak-domain/lib/actions/action";
import * as Application from "../Application/Schema";
import * as User from "../User/Schema";
export type OpSchema = {
    id: String<64>;
    $$createAt$$?: Datetime;
    $$updateAt$$?: Datetime;
    $$removeAt$$?: Datetime;
    origin: 'qiniu';
    type: 'image' | 'pdf' | 'video' | 'audio' | 'file';
    bucket: String<16>;
    objectId: String<64>;
    tag1: String<16>;
    tag2: String<16>;
    filename: String<64>;
    md5: Text;
    entity: "application" | "user";
    entityId: String<64>;
};
export type OpAttr = keyof OpSchema;
export type Schema = {
    id: String<64>;
    $$createAt$$?: Datetime;
    $$updateAt$$?: Datetime;
    $$removeAt$$?: Datetime;
    origin: 'qiniu';
    type: 'image' | 'pdf' | 'video' | 'audio' | 'file';
    bucket: String<16>;
    objectId: String<64>;
    tag1: String<16>;
    tag2: String<16>;
    filename: String<64>;
    md5: Text;
    entity: "application" | "user";
    entityId: String<64>;
    application?: Application.Schema;
    user?: User.Schema;
} & {
    [A in ExpressionKey]?: any;
};
type AttrFilter<E = Q_EnumValue<"application" | "user">> = {
    id: Q_StringValue | SubQuery.ExtraFileIdSubQuery;
    $$createAt$$: Q_DateValue;
    $$updateAt$$: Q_DateValue;
    origin: Q_EnumValue<'qiniu'>;
    type: Q_EnumValue<'image' | 'pdf' | 'video' | 'audio' | 'file'>;
    bucket: Q_StringValue;
    objectId: Q_StringValue;
    tag1: Q_StringValue;
    tag2: Q_StringValue;
    filename: Q_StringValue;
    md5: Q_StringValue;
    entity: E;
    entityId: Q_StringValue;
};
export type Filter<E = Q_EnumValue<"application" | "user">> = MakeFilter<AttrFilter<E> & ExprOp<OpAttr>>;
export type Projection = {
    "#id"?: NodeId;
    id: 1;
    $$createAt$$?: 1;
    $$updateAt$$?: 1;
    origin?: 1;
    type?: 1;
    bucket?: 1;
    objectId?: 1;
    tag1?: 1;
    tag2?: 1;
    filename?: 1;
    md5?: 1;
    entity?: 1;
    entityId?: 1;
    application?: Application.Projection;
    user?: User.Projection;
} & ExprOp<OpAttr>;
export type ExportProjection = {
    "#id"?: NodeId;
    id?: string;
    $$createAt$$?: string;
    $$updateAt$$?: string;
    origin?: string;
    type?: string;
    bucket?: string;
    objectId?: string;
    tag1?: string;
    tag2?: string;
    filename?: string;
    md5?: string;
    entity?: string;
    entityId?: string;
    application?: Application.ExportProjection;
    user?: User.ExportProjection;
} & ExprOp<OpAttr>;
type ExtraFileIdProjection = OneOf<{
    id: 1;
}>;
type ApplicationIdProjection = OneOf<{
    entityId: 1;
}>;
type UserIdProjection = OneOf<{
    entityId: 1;
}>;
export type SortAttr = OneOf<{
    id: 1;
    $$createAt$$: 1;
    $$updateAt$$: 1;
    origin: 1;
    type: 1;
    bucket: 1;
    objectId: 1;
    tag1: 1;
    tag2: 1;
    filename: 1;
    md5: 1;
    entity: 1;
    entityId: 1;
    application: Application.SortAttr;
    user: User.SortAttr;
} & ExprOp<OpAttr>>;
export type SortNode = {
    $attr: SortAttr;
    $direction?: "asc" | "desc";
};
export type Sorter = SortNode[];
export type SelectOperation<P = Projection> = OakOperation<"select", P, Filter, Sorter>;
export type Selection<P = Projection> = Omit<SelectOperation<P>, "action">;
export type Exportation = OakOperation<"export", ExportProjection, Filter, Sorter>;
type CreateOperationData = Omit<OpSchema, "entityId" | "entityId"> & ({
    entity: "application" | "user";
    entityId: String<64>;
    application?: undefined;
    user?: undefined;
} | ({
    entity?: undefined;
    entityId?: undefined;
} & OneOf<{
    application: Application.CreateSingleOperation | (Application.UpdateOperation & {
        id: String<64>;
    });
    user: User.CreateSingleOperation | (User.UpdateOperation & {
        id: String<64>;
    });
}>));
export type CreateSingleOperation = OakOperation<"create", CreateOperationData>;
export type CreateMultipleOperation = OakOperation<"create", Array<CreateOperationData>>;
export type CreateOperation = CreateSingleOperation | CreateMultipleOperation;
type UpdateOperationData = Partial<Omit<OpSchema, "id" | "entityId" | "entityId">> & ({
    entity?: "application" | "user";
    entityId?: String<64>;
    application?: undefined;
    user?: undefined;
} | ({
    entity?: undefined;
    entityId?: undefined;
} & OneOf<{
    application: Application.CreateSingleOperation | Omit<Application.UpdateOperation, "id" | "ids" | "filter">;
    user: User.CreateSingleOperation | Omit<User.UpdateOperation, "id" | "ids" | "filter">;
}>));
export type UpdateOperation = OakOperation<"update", UpdateOperationData, Filter>;
type RemoveOperationData = {} & OneOf<{
    application?: Omit<Application.UpdateOperation | Application.RemoveOperation, "id" | "ids" | "filter">;
    user?: Omit<User.UpdateOperation | User.RemoveOperation, "id" | "ids" | "filter">;
}>;
export type RemoveOperation = OakOperation<"remove", RemoveOperationData, Filter>;
export type Operation = CreateOperation | UpdateOperation | RemoveOperation | SelectOperation;
export type ApplicationIdSubQuery = Selection<ApplicationIdProjection>;
export type UserIdSubQuery = Selection<UserIdProjection>;
export type ExtraFileIdSubQuery = Selection<ExtraFileIdProjection>;
export type NativeAttr = OpAttr | `entity.${Application.NativeAttr}` | `entity.${User.NativeAttr}`;
export type FullAttr = NativeAttr;
export type EntityDef = {
    Schema: Schema;
    OpSchema: OpSchema;
    Action: GenericAction;
    Selection: Selection;
    Operation: Operation;
};