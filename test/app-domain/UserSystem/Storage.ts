import { StorageDesc } from "oak-domain/src/types/Storage";
export const desc: StorageDesc = {
    attributes: {
        user: {
            type: "ref",
            ref: "user"
        },
        system: {
            type: "ref",
            ref: "system"
        },
        relation: {
            type: "varchar",
            params: {
                length: 16
            }
        }
    }
};