import { String, Int, Datetime, Image, Boolean, Text } from 'oak-domain/lib/types/DataType';
import { EntityShape } from 'oak-domain/lib/types/Entity';
import { LocaleDef } from 'oak-domain/lib/types/Locale';
import { Schema as Area } from './Area';

export interface Schema extends EntityShape {
    detail: String<32>;
    area: Area;
    phone: String<12>;
    name: String<32>;
    default: Boolean;
    remark: Text;
};

const locale: LocaleDef<Schema, '', '', {}> = {
    zh_CN: {
        attr: {
            detail: '详情',
            area: '所在地区',
            phone: '联系电话',
            name: '姓名',
            default: '是否默认',
            remark: '备注',
        },
    },
};