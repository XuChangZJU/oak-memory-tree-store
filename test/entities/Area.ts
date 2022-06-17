import { String, Geo } from 'oak-domain/lib/types/DataType';
import { EntityShape } from 'oak-domain/lib/types/Entity';
import { LocaleDef } from 'oak-domain/lib/types/Locale';

export interface Schema extends EntityShape {
    name: String<32>;
    level: 'province' | 'city' | 'district' | 'street' | 'country';
    depth: 0 | 1 | 2 | 3 | 4;
    parent?: Schema;
    code: String<12>;
    center: Geo;
};

const locale: LocaleDef<Schema, '', '', {
    level: Schema['level'];
}> = {
    zh_CN: {
        attr: {
            level: '层级',
            depth: '深度',
            parent: '上级地区',
            name: '名称',
            code: '邮政编码',
            center: '中心坐标',
        },
        v: {
            level: {
                country: '国家',
                province: '省',
                city: '市',
                district: '区',
                street: '街道',
            }
        }
    },
};
