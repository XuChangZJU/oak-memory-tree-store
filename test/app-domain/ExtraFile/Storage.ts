import { StorageDesc } from "oak-domain/src/types/Storage";
export const desc: StorageDesc = {
    attributes: {
        origin: {
            type: "varchar",
            params: {
                length: 16
            }
        },
        type: {
            type: "varchar",
            params: {
                length: 16
            }
        },
        bucket: {
            type: "varchar",
            params: {
                width: 16
            }
        },
        objectId: {
            type: "varchar",
            params: {
                width: 64
            }
        },
        tag1: {
            type: "varchar",
            params: {
                width: 16
            }
        },
        tag2: {
            type: "varchar",
            params: {
                width: 16
            }
        },
        filename: {
            type: "varchar",
            params: {
                width: 64
            }
        },
        md5: {
            type: "text"
        },
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
        }
    }
};