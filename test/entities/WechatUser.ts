import { String, Int, Datetime, Image, Boolean } from 'oak-domain/lib/types/DataType';
import { Schema as User } from './User';
import { Schema as Application } from './Application';
import { Schema as Token } from './Token';
import { EntityShape } from 'oak-domain/lib/types/Entity';
import { LocaleDef } from 'oak-domain/lib/types/Locale';

export interface Schema extends EntityShape {
    origin: 'mp' | 'public';
    openId?: String<32>;
    unionId?: String<32>;
    accessToken?: String<32>;
    sessionKey?: String<64>;
    subscribed?: Boolean;
    subscribedAt?: Datetime;
    unsubscribedAt?: Datetime;
    user?: User;
    application: Application;
    tokens: Array<Token>;
};

const locale: LocaleDef<Schema, '', '', {
    origin: Schema['origin'];
}> = {
    zh_CN: {
        attr: {
            origin: '源',
            openId: 'openId',
            unionId: 'unionId',
            accessToken: 'accessToken',
            sessionKey: 'sessionKey',
            subscribed: '是否订阅',
            subscribedAt: '订阅时间',
            unsubscribedAt: '取关时间',
            user: '用户',
            tokens: '相关令牌',
            application: '应用',
        },
        v: {
            origin: {
                mp: '小程序',
                public: '公众号',
            },
        }
    },
 };

