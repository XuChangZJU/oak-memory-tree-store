import { String, Text, Datetime, Boolean } from 'oak-domain/lib/types/DataType';
import { EntityShape } from 'oak-domain/lib/types/Entity';
import { LocaleDef } from 'oak-domain/lib/types/Locale';
import { Index } from 'oak-domain/lib/types/Storage';
import { Schema as Application } from './Application';

export type WechatQrCodeProps = {
    pathname: string;
    props?: Record<string, any>;
    state?: Record<string, any>;
};

export interface Schema extends EntityShape {
    entity: String<32>;
    entityId: String<64>;
    type: 'wechatMpDomainUrl' | 'wechatMpWxaCode' | 'wechatPublic' | 'wechatPublicForMp',
    allowShare: Boolean;        // 是否允许通过分享授权
    tag?: String<32>;       // 调用者加的tag
    expiresAt?: Datetime; // 过期时间
    expired?: Boolean; //是否过期
    ticket?: Text;
    url?: String<64>;
    permanent: Boolean; //是否永久码
    buffer?: Text;  // 若没有url，使用buffer存储生成的小程序码数据（base64)
    application: Application;
    props: WechatQrCodeProps;
}

const indexes: Index<Schema>[] = [
    {
        name: 'index_entity_entityId_tag',
        attributes: [
            {
                name: 'entity',
            },
            {
                name: 'entityId',
            },
            {
                name: 'tag',
            }
        ],
    },
    {
        name: 'index_expired_expiresAt',
        attributes: [
            {
                name: 'expired',
            },
            {
                name: 'expiresAt',
            },
        ],
    },
    {
        name: 'index_url',
        attributes: [
            {
                name: 'url',
            },
        ],
    },
];

const locale: LocaleDef<Schema, '', '', {
    type: Schema['type'];
}> = {
    zh_CN: {
        attr: {
            entity: '关联对象',
            entityId: '关联对象id',
            type: '类型',
            allowShare: '允许分享',
            tag: 'tag',
            ticket: 'ticket',
            url: 'url',
            permanent: '是否永久码',
            buffer: '小程序码数据（动态）',
            expired: '是否过期',
            expiresAt: '过期时间',
            application: '应用',
            props: '属性',
        },
        v: {
            type: {
                wechatMpDomainUrl: '小程序域名跳转',
                wechatMpWxaCode: '小程序码',
                wechatPublic: '公众号码',
                wechatPublicForMp: '公众号跳小程序',
            }
        }
    },
 };
