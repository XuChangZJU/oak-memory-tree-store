import { StorageDesc } from "oak-domain/src/types/Storage";
export const desc: StorageDesc = {
    attributes: {
        origin: {
            type: "varchar",
            params: {
                length: 16
            }
        },
        openId: {
            type: "varchar",
            params: {
                width: 32
            }
        },
        unionId: {
            type: "varchar",
            params: {
                width: 32
            }
        },
        accessToken: {
            type: "varchar",
            params: {
                width: 32
            }
        },
        sessionKey: {
            type: "varchar",
            params: {
                width: 64
            }
        },
        subscribed: {
            type: "boolean"
        },
        subscribedAt: {
            type: "datetime"
        },
        unsubscribedAt: {
            type: "datetime"
        },
        user: {
            type: "ref",
            ref: "user"
        },
        application: {
            type: "ref",
            ref: "application"
        }
    }
};