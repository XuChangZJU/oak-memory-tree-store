import { String, Text, Datetime, Int } from 'oak-domain/lib/types/DataType';
import { EntityShape } from 'oak-domain/lib/types/Entity';
import { LocaleDef } from 'oak-domain/lib/types/Locale';
import { Index } from 'oak-domain/lib/types/Storage';
import { Schema as User } from './User';
import { Schema as WechatQrCode } from './WechatQrCode';

export interface Schema extends EntityShape {
    entity: String<32>;
    entityId: String<64>;
    relation: String<32>;
    type: 'grant' | 'transfer';
    number: Int<2>;
    confirmed: Int<2>;
    remark?: Text;
    granter: User;
    grantee?: User;
    files: Array<WechatQrCode>;
    expiresAt?: Datetime;
    expired?: Boolean;
}

type Action = 'confirm';
type IState = 'init';

const indexes: Index<Schema>[] = [
    {
        name: 'index_entity_entityId',
        attributes: [
            {
                name: 'entity',
            },
            {
                name: 'entityId',
            },
        ],
    },
    {
        name: 'index_uuid',
        attributes: [
            {
                name: 'expired',
            },
            {
                name: 'expiresAt',
            }
        ],
    },
];

const locale: LocaleDef<Schema, Action, '', {
    type: Schema['type'];
    iState: IState;
}> = {
    zh_CN: {
        attr: {
            relation: '关系',
            entity: '关联对象',
            entityId: '关联对象id',
            type: '类型',
            number: '次数',
            confirmed: '已确认人数',
            remark: '备注',
            grantee: '领取人',
            granter: '授权人',
            files: '微信码',
            expired: '是否过期',
            expiresAt: '过期时间'
        },
        action: {
            confirm: '确认'
        },
        v: {
            type: {
                grant: '授予',
                transfer: '转交',
            },
            iState: {
                init: '初始',
            },
        },
    },
 };
