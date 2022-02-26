import { StorageDesc } from "oak-domain/src/types/Storage";
export const desc: StorageDesc = {
    attributes: {
        entity: {
            type: "varchar",
            params: {
                width: 32
            }
        },
        entityId: {
            type: "varchar",
            params: {
                width: 64
            }
        },
        user: {
            type: "ref",
            ref: "user"
        },
        player: {
            type: "ref",
            ref: "user"
        },
        ableState: {
            type: "varchar",
            params: {
                length: 16
            }
        }
    }
};