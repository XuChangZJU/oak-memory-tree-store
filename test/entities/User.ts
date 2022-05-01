import { String, Int, Text, Image, Datetime } from 'oak-domain/lib/types/DataType';
import { ActionDef } from 'oak-domain/lib/types/Action';
import { Index } from 'oak-domain/lib/types/Storage';
import { Schema as ExtraFile } from './ExtraFile';
import { EntityShape } from 'oak-domain/lib/types/Entity';

export interface Schema extends EntityShape {
    name?: String<16>;
    nickname?: String<64>;
    password?: Text;
    birth?: Datetime;
    gender?: 'male' | 'female';
    avatar?: Image;
    idCardType?: 'ID-Card' | 'passport' | 'Mainland-passport';
    idNumber?: String<32>;
    ref?: Schema;
    files: Array<ExtraFile>;
};

type IdAction = 'verify' | 'accept' | 'reject';
type IdState = 'unverified' | 'verified' | 'verifying';
const IdActionDef: ActionDef<IdAction, IdState> = {
    stm: {
        verify: ['unverified', 'verifying'],
        accept: [['unverified', 'verifying'], 'verified'],
        reject: [['verifying', 'verified'], 'unverified'],
    },
    is: 'unverified',
};

type UserAction = 'activate' | 'disable' | 'enable' | 'mergeTo' | 'mergeFrom';
type UserState = 'shadow' | 'normal' | 'disabled' | 'merged';
const UserActionDef: ActionDef<UserAction, UserState> = {
    stm: {
        activate: ['shadow', 'normal'],
        disable: [['normal', 'shadow'], 'disabled'],
        enable: ['disabled', 'normal'],
        mergeTo: [['normal', 'shadow'], 'merged'],
        mergeFrom: ['normal', 'normal'],
    },
};

type Action = UserAction | IdAction;

const indexes: Index<Schema>[] = [
    {
        name: 'index_test2',
        attributes: [
            {
                name: 'birth',
                direction: 'ASC',
            },
        ],
    },
    {
        name: 'index_test',
        attributes: [
            {
                name: 'name',
            },
            {
                name: 'nickname',
            }
        ],
        config: {
            type: 'fulltext',
            parser: 'ngram',
        }
    }
];
