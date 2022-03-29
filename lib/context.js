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
    opRecords;
    getRandomNumber; // 在不同的环境下取随机数的实现
    constructor(store, getRandomNumber) {
        this.rowStore = store;
        this.opRecords = [];
        this.getRandomNumber = getRandomNumber;
    }
    on(event, callback) {
        throw new Error('not implemented here!');
    }
    async begin(options) {
        (0, assert_1.default)(!this.uuid);
        const random = await this.getRandomNumber(16);
        this.uuid = (0, uuid_1.v4)({ random });
        this.rowStore.begin(this.uuid);
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
