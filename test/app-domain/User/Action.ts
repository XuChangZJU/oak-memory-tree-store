import { ActionDef } from "oak-domain/src/types/Action";
import { GenericAction } from "oak-domain/lib/actions/action";
type IdAction = 'verify' | 'accept' | 'reject';
export type IdState = 'unverified' | 'verified' | 'verifying';
const IdActionDef: ActionDef<IdAction, IdState> = {
    stm: {
        verify: ['unverified', 'verifying'],
        accept: [['unverified', 'verifying'], 'verified'],
        reject: [['verifying', 'verified'], 'unverified']
    },
    is: 'unverified'
};
type UserAction = 'activate' | 'disable' | 'enable' | 'mergeTo' | 'mergeFrom';
export type UserState = 'shadow' | 'normal' | 'disabled' | 'merged';
const UserActionDef: ActionDef<UserAction, UserState> = {
    stm: {
        activate: ['shadow', 'normal'],
        disable: [['normal', 'shadow'], 'disabled'],
        enable: ['disabled', 'normal'],
        mergeTo: [['normal', 'shadow'], 'merged'],
        mergeFrom: ['normal', 'normal']
    }
};
export type ParticularAction = UserAction | IdAction;
export type Action = GenericAction | ParticularAction;