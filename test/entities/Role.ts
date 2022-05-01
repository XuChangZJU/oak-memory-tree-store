import { EntityShape } from 'oak-domain/lib/types/Entity';
import { String } from 'oak-domain/lib/types/DataType';

export interface Schema extends EntityShape {
   name: String<64>;
};

export type Relation = 'owner';