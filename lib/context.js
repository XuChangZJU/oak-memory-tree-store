"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Context = void 0;
const assert_1 = __importDefault(require("assert"));
const uuid_1 = require("uuid");
class Context {
    rowStore;
    uuid;
    constructor(store) {
        this.rowStore = store;
    }
    on(event, callback) {
    }
    async begin(options) {
        (0, assert_1.default)(!this.uuid);
        this.uuid = (0, uuid_1.v4)();
        this.rowStore.begin(this.uuid);
    }
    async commit() {
        (0, assert_1.default)(this.uuid);
        this.rowStore.commit(this.uuid);
        this.uuid = undefined;
    }
    async rollback() {
        (0, assert_1.default)(this.uuid);
        this.rowStore.rollback(this.uuid);
        this.uuid = undefined;
    }
}
exports.Context = Context;
