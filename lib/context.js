"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Context = void 0;
const uuid_1 = require("uuid");
class Context {
    rowStore;
    uuid;
    opRecords;
    constructor(store) {
        this.rowStore = store;
        this.opRecords = [];
    }
    async begin(options) {
        if (!this.uuid) {
            const random = await getRandomValues(16);
            this.uuid = (0, uuid_1.v4)({ random });
            this.rowStore.begin(this.uuid);
        }
    }
    async commit() {
        if (this.uuid) {
            this.rowStore.commit(this.uuid);
            this.uuid = undefined;
        }
    }
    async rollback() {
        if (this.uuid) {
            this.rowStore.rollback(this.uuid);
            this.uuid = undefined;
        }
    }
}
exports.Context = Context;
