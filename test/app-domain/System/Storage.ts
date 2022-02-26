import { StorageDesc } from "oak-domain/src/types/Storage";
export const desc: StorageDesc = {
    attributes: {
        name: {
            type: "varchar",
            params: {
                width: 32
            }
        },
        description: {
            type: "text"
        },
        config: {
            type: "object"
        }
    }
};