import { String, Int, Text, Image } from 'oak-domain/lib/types/DataType';
import { FileCarrierEntityShape } from 'oak-domain/lib/types/Entity';
import { LocaleDef } from 'oak-domain/lib/types/Locale';

export interface Schema extends FileCarrierEntityShape {
    origin: 'qiniu' | 'unknown';
    type: 'image' | 'pdf' | 'video' | 'audio' | 'file';
    bucket: String<16>;
    objectId: String<64>;
    tag1: String<16>;
    tag2: String<16>;
    filename: String<64>;
    md5: Text;
    entity: String<32>;
    entityId: String<64>;
    extra1?: Text;
    extension: String<16>;
    size?: Int<4>;
};

const locale: LocaleDef<Schema, '', '', {
    origin: Schema['origin'];
    type: Schema['type'];
}> = {
    zh_CN: {
        attr: {
            origin: '源',
            type: '类型',
            bucket: '桶',
            objectId: '对象编号',
            tag1: '标签一',
            tag2: '标签二',
            filename: '文件名',
            md5: "md5",
            entity: '关联对象',
            entityId: '关联对象id',
            extra1: '额外信息',
            extension: '后缀名',
            size: '体积',
        },
        v: {
            origin: {
                qiniu: '七牛云',
                unknown: '未知',
            },
            type: {
                image: '图像',
                pdf: 'pdf',
                video: '视频',
                audio: '音频',
                file: '文件',
            }
        }
    },
};
