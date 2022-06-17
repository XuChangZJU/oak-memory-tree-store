import { String, Int, Datetime, Image, Boolean, Text } from 'oak-domain/lib/types/DataType';
import { EntityShape } from 'oak-domain/lib/types/Entity';
import { LocaleDef } from 'oak-domain/lib/types/Locale';

export type SystemConfig = {
    Cos?: {
        qiniu?: {
            accessKey: string;
            secretKey: string;
            uploadHost: string; //七牛上传域名
            bucket: string;
            domain: string; //域名
            protocol: string | string[];
        };
    };
    Map?: {
        amap?: {
            webApiKey: string; // 高德访问rest服务接口的key
        };
    };
    UserEntityGrant?: {
        lifetimeLength: number; // 授权的过期时间（ms）
    };
};

export interface Schema extends EntityShape {
    name: String<32>;
    description: Text;
    config: SystemConfig;
};

export type Relation = 'owner';


const locale: LocaleDef<Schema, '', Relation, {}> = {
    zh_CN: {
        attr: {
            name: '名称',
            description: '描述',
            config: '设置',
        },
        r: {
            owner: '所有者',
        }
    },
 };
 