import { String, Int, Text, Image } from 'oak-domain/lib/types/DataType';
import { EntityShape } from 'oak-domain/lib/types/Entity';

export interface Schema extends EntityShape {
    origin: 'qiniu';
    type: 'image' | 'pdf' | 'video' | 'audio' | 'file';
    bucket: String<16>;
    objectId: String<64>;
    tag1: String<16>;
    tag2: String<16>;
    filename: String<64>;
    md5: Text;
    entity: String<32>;
    entityId: String<64>;
};
