import { String, Int, Text, Image, Datetime } from 'oak-domain/lib/types/DataType';
import { ActionDef } from 'oak-domain/lib/types/Action';
import { LocaleDef } from 'oak-domain/lib/types/Locale';
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

type CascadeAction = 'play';

type Action = UserAction | IdAction | CascadeAction;

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

const locale: LocaleDef<Schema, Action, '', {
    userState: UserState;
    idState: IdState;
    gender: Required<Schema>['gender'];
    idCardType: Required<Schema>['idCardType'];
}> = {
    "zh_CN": {
        attr: {
            name: '姓名',
            nickname: '昵称',
            birth: '生日',
            password: '密码',
            gender: '性别',
            avatar: '头像',
            idCardType: '证件类型',
            idNumber: '证件号码',
            ref: '介绍人',
            files: '相关文件',
        },
        action: {
            activate: '激活',
            play: '扮演',
            accept: '同意',
            verify: '验证',
            reject: '拒绝',
            enable: '启用',
            disable: '禁用',
            mergeTo: '合并',
            mergeFrom: '使合并',
        },
        v: {
            userState: {
                shadow: '未激活',
                normal: '正常',
                disabled: '禁用',
                merged: '已被合并',
            },
            idState: {
                unverified: '未验证',
                verifying: '验证中',
                verified: '已验证',
            },
            gender: {
                male: '男',
                female: '女',
            },
            idCardType: {
                "ID-Card": '身份证',
                passport: '护照',
                "Mainland-passport": '港澳台通行证',
            },
        }
    }
};
