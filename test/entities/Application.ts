import { String, Int, Datetime, Image, Boolean, Text } from 'oak-domain/lib/types/DataType';
import { EntityShape } from 'oak-domain/lib/types/Entity';
import { Schema as System } from './System';
import { Schema as ExtraFile } from './ExtraFile';

export type WechatMpConfig = {
    type: 'wechatMp';
    appId: string;
    appSecret: string;
};

export type WebConfig = {
    type: 'web';
    domain: string;
};

export type WechatPublicCofig = {
    type: 'wechatPublic';
    appId: string;
    appSecret: string;
};

export interface Schema extends EntityShape {
    name: String<32>;
    description: Text;
    type: 'web' | 'wechatPublic' | 'wechatMp';
    system: System;
    dd: Array<ExtraFile>;
    config: WebConfig | WechatMpConfig| WechatPublicCofig;
};
