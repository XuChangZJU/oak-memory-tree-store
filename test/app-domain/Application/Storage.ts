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
        type: {
            type: "varchar",
            params: {
                length: 16
            }
        },
        system: {
            type: "ref",
            ref: "system"
        }
    }
};