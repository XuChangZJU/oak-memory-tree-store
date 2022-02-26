import { StorageDesc } from "oak-domain/src/types/Storage";
export const desc: StorageDesc = {
    attributes: {
        mobile: {
            type: "varchar",
            params: {
                width: 16
            }
        },
        user: {
            type: "ref",
            ref: "user"
        }
    }
};