import { String, Int, Float, Double, Boolean, Text, Datetime, File, Image } from "oak-domain/src/types/DataType";
import { Q_DateValue, Q_BooleanValue, Q_NumberValue, Q_StringValue, Q_EnumValue, NodeId, MakeFilter, FulltextFilter, ExprOp, ExpressionKey } from "oak-domain/src/types/Demand";
import { OneOf, ValueOf } from "oak-domain/src/types/Polyfill";
import * as SubQuery from "../_SubQuery";
import { Operation as OakOperation } from "oak-domain/src/types/Entity";
import { GenericAction } from "oak-domain/lib/actions/action";
import * as Application from "../Application/Schema";
import * as UserSystem from "../UserSystem/Schema";
export type OpSchema = {
    id: String<64>;
    $$createAt$$?: Datetime;
    $$updateAt$$?: Datetime;
    $$removeAt$$?: Datetime;
    name: String<32>;
    description: Text;
    config: Object;
};
export type OpAttr = keyof OpSchema;
export type Schema = {
    id: String<64>;
    $$createAt$$?: Datetime;
    $$updateAt$$?: Datetime;
    $$removeAt$$?: Datetime;
    name: String<32>;
    description: Text;
    config: Object;
    application$system?: Array<Application.Schema>;
    userSystem$system?: Array<UserSystem.Schema>;
} & {
    [A in ExpressionKey]?: any;
};
type AttrFilter = {
    id: Q_StringValue | SubQuery.SystemIdSubQuery;
    $$createAt$$: Q_DateValue;
    $$updateAt$$: Q_DateValue;
    name: Q_StringValue;
    description: Q_StringValue;
};
export type Filter = MakeFilter<AttrFilter & ExprOp<OpAttr>>;
export type Projection = {
    "#id"?: NodeId;
    id: 1;
    $$createAt$$?: 1;
    $$updateAt$$?: 1;
    name?: 1;
    description?: 1;
    config?: 1;
    application$system?: Application.Selection;
    userSystem$system?: UserSystem.Selection;
} & ExprOp<OpAttr>;
export type ExportProjection = {
    "#id"?: NodeId;
    id?: string;
    $$createAt$$?: string;
    $$updateAt$$?: string;
    name?: string;
    description?: string;
    config?: string;
    application$system?: Application.Exportation;
    userSystem$system?: UserSystem.Exportation;
} & ExprOp<OpAttr>;
type SystemIdProjection = OneOf<{
    id: 1;
}>;
export type SortAttr = OneOf<{
    id: 1;
    $$createAt$$: 1;
    $$updateAt$$: 1;
    name: 1;
    description: 1;
} & ExprOp<OpAttr>>;
export type SortNode = {
    $attr: SortAttr;
    $direction?: "asc" | "desc";
};
export type Sorter = SortNode[];
export type SelectOperation<P = Projection> = OakOperation<"select", P, Filter, Sorter>;
export type Selection<P = Projection> = Omit<SelectOperation<P>, "action">;
export type Exportation = OakOperation<"export", ExportProjection, Filter, Sorter>;
type CreateOperationData = OpSchema & {
    application$system?: Application.CreateOperation | Application.UpdateOperation;
    userSystem$system?: UserSystem.CreateOperation | UserSystem.UpdateOperation;
};
export type CreateSingleOperation = OakOperation<"create", CreateOperationData>;
export type CreateMultipleOperation = OakOperation<"create", Array<CreateOperationData>>;
export type CreateOperation = CreateSingleOperation | CreateMultipleOperation;
type UpdateOperationData = Partial<Omit<OpSchema, "id">> & {
    applications$system?: Application.CreateOperation | Omit<Application.UpdateOperation, "id" | "ids" | "filter">;
    userSystems$system?: UserSystem.CreateOperation | Omit<UserSystem.UpdateOperation, "id" | "ids" | "filter">;
};
export type UpdateOperation = OakOperation<"update", UpdateOperationData, Filter>;
type RemoveOperationData = {} & {
    applications$system?: Omit<Application.UpdateOperation | Application.RemoveOperation, "id" | "ids" | "filter">;
    userSystems$system?: Omit<UserSystem.UpdateOperation | UserSystem.RemoveOperation, "id" | "ids" | "filter">;
};
export type RemoveOperation = OakOperation<"remove", RemoveOperationData, Filter>;
export type Operation = CreateOperation | UpdateOperation | RemoveOperation | SelectOperation;
export type SystemIdSubQuery = Selection<SystemIdProjection>;
export type NativeAttr = OpAttr;
export type FullAttr = NativeAttr | `applications$${number}.${Application.NativeAttr}` | `userSystems$${number}.${UserSystem.NativeAttr}`;
export type EntityDef = {
    Schema: Schema;
    OpSchema: OpSchema;
    Action: GenericAction;
    Selection: Selection;
    Operation: Operation;
};