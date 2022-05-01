import { String, Int, Datetime, Image, Boolean } from 'oak-domain/lib/types/DataType';
import { Schema as User } from './User';
import { Schema as Application } from './Application';
import { Schema as Token } from './Token';
import { EntityShape } from 'oak-domain/lib/types/Entity';

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
