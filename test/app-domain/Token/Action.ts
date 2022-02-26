import { AbleAction } from "oak-domain/lib/actions/action";
import { ActionDef } from "oak-domain/src/types/Action";
import { GenericAction } from "oak-domain/lib/actions/action";
export type ParticularAction = AbleAction;
export type Action = GenericAction | ParticularAction;