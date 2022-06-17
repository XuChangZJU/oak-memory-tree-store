import { String, Int, Text, Image } from 'oak-domain/lib/types/DataType';
import { Schema as User } from './User';
import { Schema as Token } from './Token';
import { EntityShape } from 'oak-domain/lib/types/Entity';
import { LocaleDef } from 'oak-domain/lib/types/Locale';

export interface Schema extends EntityShape {
    mobile: String<16>;
    user: User;
    tokens: Array<Token>;
};

const locale: LocaleDef<Schema, '', '', {}> = {
    zh_CN: {
        attr: {
            mobile: '手机号',
            user: '关联用户',
            tokens: '相关令牌',
        },
    },
};
